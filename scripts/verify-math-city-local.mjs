import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/local.mjs';
import {starter,clone} from '../web/model.js';
import {initialNeighborhood,createEdition,validateNeighborhood} from '../web/neighborhood.js';
import {validateCityNetwork,packIdea,packBook,placeCargo,recordCityVisit,saveCityNote,exportTravelPack,importTravelPack} from '../web/city-network.js';
import {converse,observeRoom} from '../web/resident.js';
import {reflect,reviewDay} from '../web/socrates.js';
import {converseWithArtist} from '../web/artist-dialogue.js';
import {proposeArtistHome,decideArtistHome} from '../web/artist-homes.js';
import {BOOKS} from '../web/books.js';

const date='2026-10-07T09:30:00.000Z';
const instant=()=>new Date('2026-10-08T08:30:00.000Z');
const encoded=value=>JSON.stringify(value);
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-mathematics-persistence-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
assert.ok(path.basename(temporary).startsWith('house-mathematics-persistence-'));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data');
const savedFile=path.join(dataDir,'house.json');
await fs.mkdir(webDir);await fs.mkdir(dataDir);
await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Mathematics persistence fixture</body>');

// An actual old shape: no mathematics keys and complete private history.
let network={version:1,cargo:[],placements:[],notes:[],visits:{home:3,artists:4,makers:2},lastVisits:{home:date,artists:date,makers:date}};
network=packIdea(network,{id:'kept-claim',title:'Keep this old claim',text:'A private original idea, unchanged across travel.',cue:'ring',action:'question',sourceHomeTitle:'A preserved home',sourceRoomName:'Study'});
network=packBook(network,{bookId:BOOKS[0].id,sourceHomeTitle:'Earlier library',sourceRoomName:'Library'});
network=placeCargo(network,network.cargo[0].id,'artists','table');
network=placeCargo(network,network.cargo[1].id,'makers','library');
for(const cityId of ['home','artists','makers'])network=saveCityNote(network,cityId,`Keep ${cityId} journal with its exact words.`,{now:date});
network=converseWithArtist(network,{artistId:'monet',text:'How can our room help me compare changes in light?',workId:'water-lilies',date});
network=proposeArtistHome(network,'monet');
network=decideArtistHome(network,network.artistHomes.proposals[0].id,'approved');
const originalNetwork=clone(network),originalNetworkText=encoded(network);
assert.equal(encoded(validateCityNetwork(network)),originalNetworkText,'Old shape validates without adding mathematics visit fields');
assert.ok(!Object.hasOwn(network.visits,'mathematics'));
assert.ok(!Object.hasOwn(network.lastVisits,'mathematics'));
assert.equal(encoded(importTravelPack(network,exportTravelPack(network))),originalNetworkText,'Old travel pack round trip stays exact, including retained private history');
const unrelatedVisit=recordCityVisit(network,'home',{now:date});
assert.ok(!Object.hasOwn(unrelatedVisit.visits,'mathematics'),'An older-city visit does not insert new city metadata');
assert.equal(encoded(network),originalNetworkText,'Operations leave their input detached');

let personal=starter();
personal.ideas.push({id:'kept-claim',roomId:'math',title:'Keep this old claim',text:'A private original idea, unchanged across travel.',cue:'ring',action:'question',ownerMetadata:{draft:'Untouched custom idea field'}});
personal.ownerMetadata={description:'Preserve every unknown owner field',tags:['private','historical']};
personal.rooms[0].ownerFurniture={chair:'Original reading chair'};
personal=observeRoom(personal,'math',{now:date});
personal=converse(personal,'math','I disagree that a brighter room always helps me think.',{now:date});
personal=reflect(personal,'2026-10-07','math','Compare comfort separately from understanding.');
personal=reviewDay(personal,'2026-10-07');
personal.learning.enabled=false;
let neighborhood=initialNeighborhood(personal,{now:date});
neighborhood=createEdition(neighborhood,personal,{now:date,title:'Third preserved home'});
neighborhood.activeId='home-1';
neighborhood.cityNetwork=network;
neighborhood=validateNeighborhood(neighborhood);
const originalHomes=encoded(neighborhood.homes),originalActive=neighborhood.activeId;
const initial={version:2,revision:41,neighborhood};
const initialBytes=JSON.stringify(initial,null,4)+'\n\n';
await fs.writeFile(savedFile,initialBytes);

let running,session,providerCalls=0;
const launch=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{},now:instant,fetchImpl:async()=>{providerCalls++;throw Error('Mathematics persistence requires no provider');}});
async function get(route){const response=await fetch(running.url+route);assert.equal(response.status,200);return response.json();}
async function boot(){const response=await fetch(running.url+'/api/config');assert.equal(response.status,200);const config=await response.json();session={cookie:response.headers.get('set-cookie').split(';')[0],csrf:config.csrfToken};}
async function put(cityNetwork,revision){
  const response=await fetch(running.url+'/api/cities',{method:'PUT',headers:{Origin:running.url,Cookie:session.cookie,'X-Local-CSRF':session.csrf,'Content-Type':'application/json'},body:JSON.stringify({cityNetwork,revision})});
  return {status:response.status,body:await response.json()};
}
function retained(saved){
  assert.equal(encoded(saved.neighborhood.homes),originalHomes,'Every complete earlier home stays exact');
  assert.equal(saved.neighborhood.activeId,originalActive,'Mathematics travel cannot select a different home');
  const cities=saved.neighborhood.cityNetwork;
  assert.deepEqual(cities.artistConversations,originalNetwork.artistConversations);
  assert.deepEqual(cities.artistHomes,originalNetwork.artistHomes);
  assert.deepEqual(cities.notes.slice(0,originalNetwork.notes.length),originalNetwork.notes);
  assert.deepEqual(cities.placements.slice(0,originalNetwork.placements.length),originalNetwork.placements);
  assert.deepEqual(cities.cargo.slice(0,originalNetwork.cargo.length),originalNetwork.cargo);
  for(const cityId of ['home','artists','makers']){
    assert.equal(cities.visits[cityId],originalNetwork.visits[cityId]);
    assert.equal(cities.lastVisits[cityId],originalNetwork.lastVisits[cityId]);
  }
}
try{
  running=await launch();await boot();
  let current=await get('/api/house');
  assert.equal(current.revision,41);retained(current);
  assert.equal(encoded((await get('/api/cities')).cityNetwork),originalNetworkText);
  assert.ok(!Object.hasOwn(current.neighborhood.cityNetwork.visits,'mathematics'));
  assert.equal(await fs.readFile(savedFile,'utf8'),initialBytes,'Opening and reading the original saved network does not migrate its bytes');
  await running.close();running=null;running=await launch();await boot();
  assert.equal(await fs.readFile(savedFile,'utf8'),initialBytes,'Restart leaves the old envelope byte exact');

  let next=recordCityVisit(network,'mathematics',{now:'2026-10-08T09:00:00.000Z'});
  next=saveCityNote(next,'mathematics','A path through proofs connects the institute floors.',{now:'2026-10-08T09:05:00.000Z'});
  next=placeCargo(next,next.cargo[0].id,'mathematics','table');
  next=placeCargo(next,next.cargo[1].id,'mathematics','library');
  next=packIdea(next,{id:'institute-counterexample',title:'A mathematical counterexample',text:'One valid counterexample refutes a universal claim.',cue:'crystal',action:'reflect',sourceHomeTitle:'Mathematics Institute',sourceRoomName:'Logic observatory'});
  next=placeCargo(next,next.cargo.at(-1).id,'mathematics','plaza');
  const save=await put(next,41);assert.equal(save.status,200);assert.equal(save.body.revision,42);
  assert.deepEqual(save.body.cityNetwork,next);retained(save.body);
  assert.equal(next.visits.mathematics,1);
  assert.equal(next.lastVisits.mathematics,'2026-10-08T09:00:00.000Z');
  assert.equal(next.placements.filter(item=>item.cityId==='mathematics').length,3);
  assert.equal(encoded(network),originalNetworkText);
  current=await get('/api/house');assert.equal(current.revision,42);retained(current);
  const storedBeforeConflict=await fs.readFile(savedFile);
  assert.equal((await put(originalNetwork,41)).status,409,'A stale request cannot erase Mathematics City or earlier history');
  assert.deepEqual(await fs.readFile(savedFile),storedBeforeConflict,'Revision rejection keeps the saved file byte exact');
  const invalid=clone(next);invalid.placements.at(-1).anchorId='missing-mathematical-room';
  assert.equal((await put(invalid,42)).status,400);
  assert.deepEqual(await fs.readFile(savedFile),storedBeforeConflict,'Invalid mathematics placements cannot partly save');

  const competingA=saveCityNote(next,'mathematics','A second visit should test the same claim.',{now:'2026-10-08T09:10:00.000Z'});
  const competingB=saveCityNote(next,'mathematics','An alternative test must remain an explicit choice.',{now:'2026-10-08T09:11:00.000Z'});
  const race=await Promise.all([put(competingA,42),put(competingB,42)]);
  assert.deepEqual(race.map(result=>result.status).sort(),[200,409]);
  current=await get('/api/house');assert.equal(current.revision,43);retained(current);
  assert.equal(current.neighborhood.cityNetwork.notes.length,originalNetwork.notes.length+2,'Only the successful concurrent note is recorded');
  const persisted=clone(current),savedBytes=await fs.readFile(savedFile);
  await running.close();running=null;running=await launch();await boot();
  assert.deepEqual(await get('/api/house'),persisted,'Mathematics visits, cargo, placements, notes, resident memories and all complete homes survive a real restart');
  assert.deepEqual(await fs.readFile(savedFile),savedBytes);
  assert.equal(providerCalls,0);
  console.log('Mathematics HTTP persistence: exact old-network shape, three preserved complete homes, private resident/artist history, approved artist editions, mathematical travel/cargo/notes, revision rejection and durable restart passed.');
}finally{
  await running?.close();
  assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('house-mathematics-persistence-'));
  await fs.rm(temporary,{recursive:true,force:true});
}
