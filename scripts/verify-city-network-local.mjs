import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {startServer} from '../server/local.mjs';
import {legacyStarter,starter,clone} from '../web/model.js';
import {initialNeighborhood,validateNeighborhood,selectEdition,createEdition,saveEdition} from '../web/neighborhood.js';
import {initialCityNetwork,validateCityNetwork,packIdea,packBook,placeCargo,saveCityNote,recordCityVisit,CITY_LIMITS} from '../web/city-network.js';
import {BOOKS} from '../web/books.js';

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-city-network-http-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()),'Cleanup stays inside the named temporary test directory.');
assert.ok(path.basename(temporary).startsWith('house-city-network-http-'));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data'),file=path.join(dataDir,'house.json');
await fs.mkdir(webDir);await fs.mkdir(dataDir);await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">City network HTTP fixture</body>');
const personal=legacyStarter();personal.ideas.push({id:'original-note',roomId:'math',title:'Keep my original idea',text:'A private original note.',cue:'ring'});personal.personalMetadata={owner:'Keep every field in every edition.'};
const initial=initialNeighborhood(personal,{now:'2026-10-08T08:00:00.000Z'});initial.activeId='home-1';
const initialBytes=JSON.stringify({version:2,revision:7,neighborhood:initial},null,4)+'\n\n';await fs.writeFile(file,initialBytes);
let running,session,externalCalls=0;
const launch=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{},fetchImpl:async()=>{externalCalls++;throw Error('City persistence tests must not call external providers.');}});
async function get(route){const response=await fetch(running.url+route);assert.equal(response.status,200);return response.json();}
async function boot(){const response=await fetch(running.url+'/api/config'),config=await response.json();assert.equal(response.status,200);session={cookie:response.headers.get('set-cookie').split(';')[0],csrf:config.csrfToken};}
async function request(route,input,{method='PUT',csrf=session.csrf,origin=running.url,cookie=session.cookie}={}){
  const headers={'Content-Type':'application/json'};if(origin!==null)headers.Origin=origin;if(cookie!==null)headers.Cookie=cookie;if(csrf!==null)headers['X-Local-CSRF']=csrf;
  const response=await fetch(running.url+route,{method,headers,body:JSON.stringify(input)});return {status:response.status,data:await response.json()};
}
const homeBytes=state=>Buffer.from(JSON.stringify(state.neighborhood.homes));
const date='2026-10-08T09:00:00.000Z';
try{
  assert.ok(!Object.hasOwn(validateNeighborhood(initial),'cityNetwork'),'An absent network stays absent in neighborhood validation.');
  running=await launch();await boot();let current=await get('/api/house');assert.equal(current.revision,7);
  const originalHomes=homeBytes(current),beforeCities=await get('/api/cities');assert.deepEqual(beforeCities,{cityNetwork:initialCityNetwork(),revision:7});
  await get('/api/cities');assert.equal(await fs.readFile(file,'utf8'),initialBytes,'Reading absent city state never upgrades or rewrites the previous saved envelope.');
  assert.ok(!Object.hasOwn((await get('/api/house')).neighborhood,'cityNetwork'));
  await running.close();running=null;running=await launch();await boot();assert.equal(await fs.readFile(file,'utf8'),initialBytes,'Restart also leaves an absent network byte exact.');

  let network=packIdea(initialCityNetwork(),{...personal.ideas[0],sourceHomeTitle:'Original house',sourceRoomName:'Mathematics'});
  network=packBook(network,BOOKS[0]);network=placeCargo(network,'cargo-1','artists','table');network=placeCargo(network,'cargo-2','makers','library');
  network=saveCityNote(network,'artists','Compare a shape in two different paintings.',{now:date});network=recordCityVisit(network,'artists',{now:date});
  for(const options of [{csrf:null},{csrf:'wrong'},{origin:'https://outside.example'},{origin:null},{cookie:null}]){
    const rejected=await request('/api/cities',{cityNetwork:network,revision:7},options);assert.equal(rejected.status,403);assert.equal(await fs.readFile(file,'utf8'),initialBytes);
  }
  for(const input of [{revision:7},{revision:7,cityNetwork:null},{cityNetwork:network},{cityNetwork:network,revision:-1},
    {cityNetwork:{...network,provider:'remote'},revision:7},{cityNetwork:network,revision:7,replaceHomes:true}]){
    const rejected=await request('/api/cities',input);assert.equal(rejected.status,400);assert.equal(await fs.readFile(file,'utf8'),initialBytes);
  }
  const badPlacement=clone(network);badPlacement.placements[0].cityId='outside';assert.equal((await request('/api/cities',{cityNetwork:badPlacement,revision:7})).status,400);
  const saved=await request('/api/cities',{cityNetwork:network,revision:7});assert.equal(saved.status,200);assert.equal(saved.data.revision,8);assert.deepEqual(saved.data.cityNetwork,network);
  assert.deepEqual(saved.data.neighborhood.cityNetwork,network);assert.equal(saved.data.neighborhood.activeId,'home-1');assert.deepEqual(homeBytes(saved.data),originalHomes,'City-only saves keep byte-identical home snapshots even while an archived home is selected.');
  assert.deepEqual((await get('/api/cities')).cityNetwork,network);
  current=await get('/api/house');assert.equal(current.neighborhood.homes.length,2);
  const storedCityBytes=await fs.readFile(file);
  assert.equal((await request('/api/cities',{cityNetwork:initialCityNetwork(),revision:7})).status,409);assert.deepEqual(await fs.readFile(file),storedCityBytes,'A stale city request cannot reset the collection.');
  const archivedEdit=clone(current.house);archivedEdit.rooms[0].name='Forbidden old-home edit';
  assert.equal((await request('/api/house',{house:archivedEdit,revision:current.revision})).status,400);assert.deepEqual(homeBytes(await get('/api/house')),originalHomes);

  // All existing neighborhood operations retain the separate network.
  const withNetwork=validateNeighborhood({...initial,cityNetwork:network});
  assert.deepEqual(selectEdition(withNetwork,'home-2').cityNetwork,network);assert.deepEqual(createEdition(withNetwork).cityNetwork,network);
  assert.deepEqual(saveEdition(selectEdition(withNetwork,'home-2'),withNetwork.homes[1].house).cityNetwork,network);
  let selected=await request('/api/neighborhood/select',{homeId:'home-2',revision:current.revision},{method:'POST'});assert.equal(selected.status,200);current=selected.data;assert.deepEqual(current.neighborhood.cityNetwork,network);
  const forked=await request('/api/neighborhood/create',{revision:current.revision},{method:'POST'});assert.equal(forked.status,200);current=forked.data;assert.deepEqual(current.neighborhood.cityNetwork,network);
  assert.deepEqual(homeBytes({neighborhood:{homes:current.neighborhood.homes.slice(0,2)}}),originalHomes);
  const oldBeforeEdit=clone(current.neighborhood.homes),changed=clone(current.house);changed.ideas.push({id:'new-home-idea',roomId:'math',title:'A new local question',text:'Keep this independent from cargo.',cue:'crystal'});
  const edited=await request('/api/house',{house:changed,revision:current.revision});assert.equal(edited.status,200);current=await get('/api/house');assert.equal(current.neighborhood.homes.length,4);assert.deepEqual(current.neighborhood.homes.slice(0,3),oldBeforeEdit);assert.deepEqual(current.neighborhood.cityNetwork,network);
  const template=starter();template.rooms[0].name='Imported independent study';const imported=await request('/api/neighborhood/import',{house:template,revision:current.revision},{method:'POST'});assert.equal(imported.status,200);current=imported.data;assert.deepEqual(current.neighborhood.cityNetwork,network);

  // City, home and selection saves all use the same compare-and-swap revision.
  const beforeRace=clone(current),left=saveCityNote(network,'home','First concurrent city note',{now:date}),right=saveCityNote(network,'makers','Second concurrent city note',{now:date});
  const race=await Promise.all([request('/api/cities',{cityNetwork:left,revision:current.revision}),request('/api/cities',{cityNetwork:right,revision:current.revision})]);assert.deepEqual(race.map(result=>result.status).sort(),[200,409]);
  current=await get('/api/house');assert.equal(current.revision,beforeRace.revision+1);assert.deepEqual(homeBytes(current),homeBytes(beforeRace));assert.equal(current.neighborhood.cityNetwork.notes.length,2);
  assert.equal((await request('/api/house',{house:current.house,revision:beforeRace.revision})).status,409);
  assert.equal((await request('/api/neighborhood/select',{homeId:'home-1',revision:beforeRace.revision},{method:'POST'})).status,409);
  const beforeHouseRevision=current.revision,nextHouse=clone(current.house);nextHouse.rooms[0].purpose+=' A kept home note.';
  assert.equal((await request('/api/house',{house:nextHouse,revision:current.revision})).status,200);current=await get('/api/house');
  assert.equal((await request('/api/cities',{cityNetwork:network,revision:beforeHouseRevision})).status,409,'A home save also makes an earlier city revision stale.');
  const persisted=clone(current);await running.close();running=null;running=await launch();await boot();assert.deepEqual(await get('/api/house'),persisted,'The collection, city journals, current home and every older edition survive restart.');

  // Valid multilingual collections can exceed the old 1.3 MB house-body limit.
  const large=initialCityNetwork();large.cargo=Array.from({length:64},(_,i)=>({id:'large-cargo-'+i,type:'idea',title:'A complete carried note',text:'界'.repeat(6000),cue:'book',action:'read',sourceHomeTitle:'Home',sourceRoomName:'Library'}));
  large.notes=Array.from({length:120},(_,i)=>({id:'large-note-'+i,cityId:['home','artists','makers'][i%3],date,text:'界'.repeat(2000)}));validateCityNetwork(large);
  assert.ok(Buffer.byteLength(JSON.stringify({cityNetwork:large,revision:current.revision}))>1300000);
  const largeSaved=await request('/api/cities',{cityNetwork:large,revision:current.revision});assert.equal(largeSaved.status,200);assert.deepEqual(homeBytes(largeSaved.data),homeBytes(current));current=largeSaved.data;
  const tooLarge=await new Promise((resolve,reject)=>{
    const request=http.request(running.url+'/api/cities',{method:'PUT',headers:{Origin:running.url,Cookie:session.cookie,'X-Local-CSRF':session.csrf,'Content-Type':'application/json','Content-Length':CITY_LIMITS.travelPackBytes+4097,Connection:'close'}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())}));});request.on('error',reject);request.end();
  });assert.equal(tooLarge.status,413);assert.deepEqual((await get('/api/cities')).cityNetwork,large);
  assert.equal((await request('/api/cities',{}, {method:'POST'})).status,405);
  assert.equal(externalCalls,0);
  console.log('City network HTTP: optional state without migration, immutable archived homes, protected city CAS, shared revision conflicts, preserved select/fork/import/edit state, multilingual capacity and durable restart passed.');
}finally{
  await running?.close();assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));await fs.rm(temporary,{recursive:true,force:true});
}
