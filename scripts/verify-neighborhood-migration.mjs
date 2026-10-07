import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server/local.mjs';
import {legacyStarter,clone} from '../web/model.js';
import {converse} from '../web/resident.js';
import {visitRoom,reflect} from '../web/socrates.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await fs.mkdtemp(path.join(root,'.migration-test-'));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data');
await fs.mkdir(webDir);await fs.mkdir(dataDir);
await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Migration fixture</body>');
let old=legacyStarter();
old.rooms[1].name='My studio';old.rooms[1].purpose='Personal sketches and questions.';
old.ideas.push({id:'personal-claim',roomId:'math',title:'A careful claim',text:'These are my original notes.',cue:'sphere',action:'experiment'});
old=reflect(visitRoom(old,'2026-10-06','math'),'2026-10-06','math','I found an assumption in my own argument.');
old=converse(old,'math','I value careful reasoning and want to examine this claim.',{now:'2026-10-06T18:00:00.000Z'});
old.localMetadata={ownerNote:'Keep the complete house document.'};
const oldEnvelope={version:1,revision:7,house:old};
const originalBytes=JSON.stringify(oldEnvelope,null,3)+'\n';
const file=path.join(dataDir,'house.json'),backup=path.join(dataDir,'house-before-neighborhood.json');
await fs.writeFile(file,originalBytes);
let running,session;
const read=async pathname=>{const response=await fetch(running.url+pathname);return {status:response.status,json:await response.json()};};
async function boot(){
 const response=await fetch(running.url+'/api/config');
 assert.equal(response.status,200);
 const data=await response.json();
 session={cookie:response.headers.get('set-cookie').split(';')[0],csrf:data.csrfToken};
}
async function write(pathname,body,method='POST'){
 const response=await fetch(running.url+pathname,{method,headers:{Origin:running.url,Cookie:session.cookie,'X-Local-CSRF':session.csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {status:response.status,json:await response.json()};
}
const start=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{},fetchImpl:async()=>{throw Error('Migration must never contact an online service.');}});
try{
 running=await start();
 const loaded=await read('/api/house');assert.equal(loaded.status,200);
 assert.equal(loaded.json.revision,8,'Legacy conversion advances its existing revision once.');
 const neighborhood=loaded.json.neighborhood;
 assert.equal(neighborhood.homes.length,2);assert.equal(neighborhood.activeId,'home-2');
 assert.equal(neighborhood.homes[0].edition,'legacy');
 assert.deepEqual(neighborhood.homes[0].house,old,'The archived neighbor keeps the entire original document.');
 assert.equal(loaded.json.house.rooms[0].name,'Study');
 assert.deepEqual(loaded.json.house.rooms[1],old.rooms[1],'Personal room names and purpose remain personal.');
 for(const key of ['ideas','learning','resident','localMetadata'])assert.deepEqual(loaded.json.house[key],old[key],`${key} survives in the separate inhabited home.`);
 assert.equal(await fs.readFile(backup,'utf8'),originalBytes,'The pre-upgrade backup retains exact old envelope bytes.');
 const persisted=JSON.parse(await fs.readFile(file,'utf8'));
 assert.equal(persisted.version,2);assert.equal(persisted.revision,8);
 assert.deepEqual(persisted.neighborhood,neighborhood);
 await assert.rejects(start(),/already open/,'Two server instances cannot write the same migrated neighborhood.');
 await boot();
 const selected=await write('/api/neighborhood/select',{homeId:'home-1',revision:8});
 assert.equal(selected.status,200);assert.equal(selected.json.revision,9);
 assert.deepEqual(selected.json.house,old);assert.equal(selected.json.neighborhood.activeId,'home-1');
 const attempted=clone(old);attempted.ideas[0].text='An attempted overwrite';
 const rejected=await write('/api/house',{house:attempted,revision:9},'PUT');
 assert.ok([400,409].includes(rejected.status));assert.match(rejected.json.error,/older home is preserved/);
 const unchanged=await read('/api/house');assert.equal(unchanged.json.revision,9);assert.deepEqual(unchanged.json.house,old);
 await running.close();running=null;
 running=await start();
 const restarted=await read('/api/house');
 assert.equal(restarted.json.revision,9,'Version 2 startup does not migrate or advance a revision again.');
 assert.equal(restarted.json.neighborhood.activeId,'home-1','The visited old home survives restart.');
 assert.deepEqual(restarted.json.house,old);
 assert.deepEqual(restarted.json.neighborhood.homes[1],neighborhood.homes[1],'The new neighbor survives unchanged while visiting the old home.');
 await boot();
 const restartRejected=await write('/api/house',{house:attempted,revision:9},'PUT');
 assert.ok([400,409].includes(restartRejected.status));assert.match(restartRejected.json.error,/older home is preserved/);
 const gptRejected=await write('/api/gpt/chat',{message:'Change this old room',roomId:'math',revision:9});
 assert.equal(gptRejected.status,409);assert.match(gptRejected.json.error,/older home is preserved/);
 assert.equal(await fs.readFile(backup,'utf8'),originalBytes);
 assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).neighborhood,restarted.json.neighborhood);
 console.log('Verified actual version 1 migration, exact backup, complete archived/user content, atomic version 2 persistence, single writer, selected old-home restart and read-only enforcement.');
}finally{
 await running?.close();
 if(!temporary.startsWith(root+path.sep)||!path.basename(temporary).startsWith('.migration-test-'))throw Error('Refusing unexpected test cleanup path.');
 await fs.rm(temporary,{recursive:true,force:true});
}
