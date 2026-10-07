import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {starter,clone,validateHouse,sharedEdge,reachableRooms} from '../web/model.js';
import {stickVector} from '../web/joystick.js';
import worker from '../worker/index.js';
const house=starter();assert.equal(validateHouse(house).rooms.length,6);assert.equal(reachableRooms(house,'math').size,6);
const overlap=clone(house);overlap.rooms[1].x=5;assert.throws(()=>validateHouse(overlap),/overlap/);
const disconnected=clone(house);disconnected.doors.push({a:'math',b:'work'});assert.throws(()=>validateHouse(disconnected),/sharing/);
const invalidIdea=clone(house);invalidIdea.ideas.push({id:'i1',roomId:'no-room',title:'Test',text:'',cue:'crystal'});assert.throws(()=>validateHouse(invalidIdea),/room/);
const full=clone(house);for(let n=0;n<12;n++)full.ideas.push({id:'i'+n,roomId:'math',title:'Idea '+n,text:'Note '+n,cue:['crystal','ring','sphere','book'][n%4]});validateHouse(full);const overfull=clone(full);overfull.ideas.push({...full.ideas[0],id:'extra'});assert.throws(()=>validateHouse(overfull),/12/);
assert.equal(stickVector(0,0,40).x,0);assert.equal(stickVector(2,0,40).x,0);assert.ok(stickVector(25,0,40).x<stickVector(35,0,40).x);assert.equal(stickVector(80,0,40).x,1);
// Exercise the real Worker queries against SQLite, including stale-revision rejection.
const sql=new DatabaseSync(':memory:');const migration=(await fs.readdir('drizzle')).find(f=>f.endsWith('.sql'));sql.exec(await fs.readFile('drizzle/'+migration,'utf8'));
const DB={prepare(query){return {bind(...params){return {async first(){return sql.prepare(query).get(...params)||null;}};}};}};
const env={DB,ASSETS:{fetch:()=>new Response('asset')}};
function req(method='GET',body,user='owner',headers={}){return new Request('https://house.test/api/house',{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
let response=await worker.fetch(req(),env),data=await response.json();assert.equal(data.revision,0);assert.equal(data.house.rooms.length,6);
assert.equal((await worker.fetch(req('GET',null,null),env)).status,401);
assert.equal((await worker.fetch(req('PUT',{house:full,revision:0},'owner',{origin:'https://other.test'}),env)).status,403);
response=await worker.fetch(req('PUT',{house:full,revision:0}),env);assert.equal(response.status,200);assert.equal((await response.json()).revision,1);
response=await worker.fetch(req(),env);data=await response.json();assert.equal(data.house.ideas.length,12);assert.equal(data.house.ideas[3].cue,'book');
assert.equal((await worker.fetch(req('PUT',{house,revision:0}),env)).status,409);assert.equal((await worker.fetch(req('PUT',{house:overlap,revision:1}),env)).status,400);
assert.equal((await (await worker.fetch(req('GET',null,'another-user'),env)).json()).revision,0);
const moved=clone(full);moved.ideas[0].roomId='art';moved.rooms[0].name='Proofs';assert.equal((await worker.fetch(req('PUT',{house:moved,revision:1}),env)).status,200);data=await (await worker.fetch(req(),env)).json();assert.equal(data.house.ideas[0].roomId,'art');assert.equal(data.house.rooms[0].name,'Proofs');assert.equal(data.revision,2);
const throwing={...env,DB:{prepare(){throw Error('unavailable');}}};const originalError=console.error;console.error=()=>{};assert.equal((await worker.fetch(req(),throwing)).status,503);console.error=originalError;
// Use real Three.js geometry without a GPU; leave browser-only scene creation uncalled.
let source=await fs.readFile('web/scene.js','utf8');source=source.replace(/import \{OrbitControls\}[^\n]+/,'const OrbitControls=undefined;');for(const file of ['./vendor/three.module.js','./model.js','./joystick.js','./navigation.js'])source=source.replace(file,pathToFileURL(process.cwd()+'/web/'+file.slice(2)).href);
const scene=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));const built=scene.buildHouse(full,true);assert.equal(built.floors.length,6);assert.equal(built.objects.length,36);
let meshes=0;built.group.traverse(o=>{if(!o.geometry)return;meshes++;const pos=o.geometry.attributes.position.array;assert.ok([...pos].every(Number.isFinite));});assert.ok(meshes>150);
for(const d of house.doors){const a=house.rooms.find(r=>r.id===d.a),b=house.rooms.find(r=>r.id===d.b),edge=sharedEdge(a,b);const c=(edge.lo+edge.hi)/2;for(let step=-.4;step<=.4;step+=.05){const x=edge.axis==='x'?c-10:edge.fixed-10+step,z=edge.axis==='z'?c-8:edge.fixed-8+step;assert.ok(scene.canStandAt(house,built.walls,x,z),'Walk through '+d.a+' / '+d.b);}}
assert.equal(scene.canStandAt(house,built.walls,-10,-5),false);assert.equal(scene.canStandAt(house,built.walls,-14,0),false);
for(const file of ['web/app.js','web/scene.js','web/model.js','web/joystick.js','worker/index.js'])await import('node:child_process').then(({execFileSync})=>execFileSync(process.execPath,['--check',file]));
const html=await fs.readFile('web/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="\.\/([^\"]+)"/g))await fs.access('web/'+match[1]);
console.log('Verified: layout validation, idea capacity and room moves, SQLite saves/reloads and user isolation, stale-tab conflicts, finite 3D geometry, all 7 doorway crossings, joystick analog range, and local assets.');
