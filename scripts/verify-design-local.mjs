import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {startServer} from '../server/local.mjs';
import {clone,starter} from '../web/model.js';
import {converse} from '../web/resident.js';
import {reflect,visitRoom} from '../web/socrates.js';
import {triangleGlb} from './verify-design-fixture.mjs';

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-design-http-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()),'Cleanup remains inside the named temporary test directory.');
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data');await fs.mkdir(webDir);await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Designer HTTP fixture</body>');
let running,session,externalCalls=0;
const start=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{},fetchImpl:async()=>{externalCalls++;throw Error('Designer tests cannot contact any external service.');}});
async function boot(){const response=await fetch(running.url+'/api/config'),data=await response.json();assert.equal(response.status,200);session={cookie:response.headers.get('set-cookie').split(';')[0],csrf:data.csrfToken};}
async function read(){const response=await fetch(running.url+'/api/house');assert.equal(response.status,200);return response.json();}
async function request(route,body,{method='POST',binary=false,csrf=true,origin=running.url,type=binary?'application/octet-stream':'application/json'}={}){
 const headers={Origin:origin,Cookie:session.cookie,'Content-Type':type};if(csrf)headers['X-Local-CSRF']=session.csrf;
 const response=await fetch(running.url+route,{method,headers,body:binary?body:JSON.stringify(body)});return {status:response.status,json:await response.json()};
}
const bytes=triangleGlb(),assetId=createHash('sha256').update(bytes).digest('hex'),object={id:'designer-chair',title:'A reading chair',assetId,placement:'room',kind:'object',roomId:'math',action:'question',note:'What makes a good place to think?',scale:1,rotation:0,position:[-1.5,0,-1]};
try{
 running=await start();await boot();const initial=await read(),originals=clone(initial.neighborhood.homes);
 // Every new asset reference requires a validated local upload, before a house changes.
 const missing=clone(initial.house);missing.designObjects=[{...object,assetId:'f'.repeat(64)}];
 const missingPut=await request('/api/house',{house:missing,revision:initial.revision},{method:'PUT'});assert.equal(missingPut.status,400);assert.match(missingPut.json.error,/GLB/);
 const missingImport=await request('/api/neighborhood/import',{house:missing,revision:initial.revision});assert.equal(missingImport.status,400);assert.match(missingImport.json.error,/GLB/);assert.deepEqual(await read(),initial,'Missing assets never create a half-imported edition.');

 // Uploads obey session/origin protection, binary type and the actual GLB validator.
 assert.equal((await request('/api/design-assets',bytes,{binary:true,csrf:false})).status,403);
 assert.equal((await request('/api/design-assets',bytes,{binary:true,origin:'https://example.com'})).status,403);
 assert.equal((await request('/api/design-assets',bytes,{binary:true,type:'text/plain'})).status,400);
 const remote=await request('/api/design-assets',triangleGlb(json=>json.buffers[0].uri='https://example.com/model.bin'),{binary:true});assert.equal(remote.status,400);assert.match(remote.json.error,/self-contained/);
 const tooBig=await new Promise((resolve,reject)=>{const request=http.request(running.url+'/api/design-assets',{method:'POST',headers:{Origin:running.url,Cookie:session.cookie,'X-Local-CSRF':session.csrf,'Content-Type':'application/octet-stream','Content-Length':12*1024*1024+1,Connection:'close'}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,json:JSON.parse(Buffer.concat(chunks).toString())}));});request.on('error',reject);request.end();});assert.equal(tooBig.status,413);
 const upload=await request('/api/design-assets',bytes,{binary:true});assert.equal(upload.status,200);assert.equal(upload.json.id,assetId);assert.equal(upload.json.triangles,1);
 assert.deepEqual(await read(),initial,'Immutable GLB upload does not change a home or its revision.');
 const duplicate=await request('/api/design-assets',bytes,{binary:true});assert.equal(duplicate.status,200);assert.equal(duplicate.json.id,assetId);assert.deepEqual(await fs.readdir(path.join(dataDir,'designs')),[`${assetId}.glb`]);
 const served=await fetch(running.url+`/assets/${assetId}.glb`);assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'model/gltf-binary');assert.equal(served.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await served.arrayBuffer()),bytes);
 const head=await fetch(running.url+`/assets/${assetId}.glb`,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
 const unknown=await fetch(running.url+`/assets/${'f'.repeat(64)}.glb`);assert.equal(unknown.status,404);

 // Owner notes, learning and resident conversation remain whole when a design forks.
 let personal=clone(initial.house);personal.ideas.push({id:'personal-note',roomId:'math',title:'An assumption',text:'Keep my original reasoning.',cue:'book'});
 personal=reflect(visitRoom(personal,'2026-10-08','math'),'2026-10-08','math','I compared two ways of placing the chair.');personal=converse(personal,'math','What does comfort mean when I am learning?',{now:'2026-10-08T09:00:00.000Z'});personal.designObjects=[object];
 const save=await request('/api/house',{house:personal,revision:initial.revision},{method:'PUT'});assert.equal(save.status,200);let current=await read();assert.equal(current.revision,initial.revision+1);assert.equal(current.neighborhood.homes.length,3);assert.equal(current.neighborhood.homes.at(-1).edition,'atelier');assert.deepEqual(current.house,personal);assert.deepEqual(current.neighborhood.homes.slice(0,2),originals);
 const stale=await request('/api/house',{house:personal,revision:initial.revision},{method:'PUT'});assert.equal(stale.status,409);assert.equal((await read()).revision,current.revision);
 const personalHome=clone(current.neighborhood.homes.at(-1));

 // A complete imported template is independent and enters the atelier renderer.
 const template=starter();template.rooms[0].name='Designer’s study';template.designObjects=[{...object,id:'house-exhibit',kind:'house',placement:'garden',roomId:undefined}];
 const imported=await request('/api/neighborhood/import',{house:template,revision:current.revision});assert.equal(imported.status,200);current=await read();assert.equal(current.neighborhood.homes.length,4);assert.equal(current.neighborhood.homes.at(-1).edition,'atelier');assert.equal(current.house.rooms[0].name,'Designer’s study');assert.deepEqual(current.neighborhood.homes[2],personalHome,'Importing another layout preserves earlier personal notes and conversations.');
 const importStale=await request('/api/neighborhood/import',{house:template,revision:current.revision-1});assert.equal(importStale.status,409);assert.equal((await read()).neighborhood.homes.length,4);

 // Visiting an old home keeps its design read-only, including after restart.
 const selected=await request('/api/neighborhood/select',{homeId:personalHome.id,revision:current.revision});assert.equal(selected.status,200);let archived=await read();assert.deepEqual(archived.house,personalHome.house);
 const archivedChange=clone(archived.house);archivedChange.designObjects[0].note='An attempted overwrite';const rejected=await request('/api/house',{house:archivedChange,revision:archived.revision},{method:'PUT'});assert.equal(rejected.status,400);assert.match(rejected.json.error,/older home is preserved/);
 const extraBytes=triangleGlb(json=>json.asset.generator='Another local designer contribution'),extraId=createHash('sha256').update(extraBytes).digest('hex');const whileArchived=await request('/api/design-assets',extraBytes,{binary:true});assert.equal(whileArchived.status,200);assert.equal(whileArchived.json.id,extraId);assert.deepEqual(await read(),archived,'An immutable upload from an old home does not mutate that home or its revision.');
 await running.close();running=null;running=await start();await boot();assert.deepEqual(await read(),archived,'Edition selection and complete old content survive a restart.');const restartedAsset=await fetch(running.url+`/assets/${assetId}.glb`);assert.deepEqual(Buffer.from(await restartedAsset.arrayBuffer()),bytes,'The original model bytes survive restart.');
 const rejectedAgain=await request('/api/house',{house:archivedChange,revision:archived.revision},{method:'PUT'});assert.equal(rejectedAgain.status,400);

 // New independent packages can be built while an old home remains preserved.
 const fromArchived=starter();fromArchived.designObjects=[{...object,assetId:extraId}];const nextDoor=await request('/api/neighborhood/import',{house:fromArchived,revision:archived.revision});assert.equal(nextDoor.status,200);current=await read();assert.deepEqual(current.neighborhood.homes.find(home=>home.id===personalHome.id),personalHome);assert.equal(current.neighborhood.homes.at(-1).edition,'atelier');

 // Two importers with one revision cannot silently replace either edition.
 const beforeRace=clone(current.neighborhood.homes),race=await Promise.all([request('/api/neighborhood/import',{house:template,revision:current.revision}),request('/api/neighborhood/import',{house:fromArchived,revision:current.revision})]);assert.deepEqual(race.map(result=>result.status).sort(),[200,409]);current=await read();assert.equal(current.neighborhood.homes.length,beforeRace.length+1);assert.deepEqual(current.neighborhood.homes.slice(0,beforeRace.length),beforeRace);
 // An optional online account file must never prevent inhabiting the offline house.
 await running.close();running=null;const registrationFile=path.join(dataDir,'chatgpt-registration.json'),corruptRegistration='{"version":1,"accounts":"preserve these exact damaged bytes"}\n';await fs.writeFile(registrationFile,corruptRegistration);running=await start();await boot();assert.deepEqual(await read(),current,'Optional connection damage leaves the complete offline neighbourhood accessible.');
 const connectionResponse=await fetch(running.url+'/api/config',{headers:{Cookie:session.cookie}}),connection=await connectionResponse.json();assert.equal(connectionResponse.status,200);assert.equal(connection.chatgpt.connected,false);assert.equal(connection.chatgpt.planEnabled,false);assert.match(connection.chatgpt.error,/registration|connection|ChatGPT/i);assert.equal(await fs.readFile(registrationFile,'utf8'),corruptRegistration,'Startup preserves the optional damaged file byte-for-byte.');
 const disabledStart=await request('/api/chatgpt/start',{});assert.equal(disabledStart.status,409);assert.match(disabledStart.json.error,/registration|connection|ChatGPT/i);
 const disabledModels=await fetch(running.url+'/api/chatgpt/models',{headers:{Origin:running.url,Cookie:session.cookie,'X-Local-CSRF':session.csrf}});assert.equal(disabledModels.status,409);
 const offlineHealth=await fetch(running.url+'/api/health');assert.equal(offlineHealth.status,200);assert.equal((await offlineHealth.json()).offline,true);
 assert.equal(externalCalls,0,'Designer import, storage and tours need no online model or service.');
 console.log('Designer HTTP: protected GLBs, byte persistence, missing-asset refusal, independent atelier imports, CAS, archives/restart and offline startup despite optional account damage passed.');
}finally{await running?.close();await fs.rm(temporary,{recursive:true,force:true});}
