import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {starter,clone,validateHouse,sharedEdge,reachableRooms} from '../web/model.js';
import {createResidence,setResidenceFloors,configureRoom,assignIdeasToRoom,PAINTINGS,paintingWork,floorOf,roomBrightness,floorLabel,stairLanding,floorHouse} from '../web/residence-data.js';
import {initialNeighborhood,createEdition,saveEdition,validateNeighborhood,editionForHouse} from '../web/neighborhood.js';
import {converse,proposeCritique,decideProposal} from '../web/resident.js';
import {reflect,visitRoom} from '../web/socrates.js';
import {initialCityNetwork,packIdea} from '../web/city-network.js';
import {startServer} from '../server/local.mjs';
import {entranceFor} from '../web/navigation.js';

const instant='2026-10-09T10:00:00.000Z',options={now:instant};
const plain=starter(),plainBefore=clone(plain);
assert.equal(plain.residence,undefined);assert.ok(plain.rooms.every(room=>room.floor===undefined));
assert.equal(PAINTINGS.length,60);assert.equal(paintingWork('water-lilies').artistName,'Claude Monet');
assert.ok(PAINTINGS.every(work=>work.imageUrl.startsWith('./art-city/artworks/')&&work.citation&&work.rights));
assert.equal(paintingWork('https://example.com/image.jpg'),null);assert.equal(floorOf(plain.rooms[0]),0);assert.equal(roomBrightness(plain.rooms[0]),75);assert.equal(floorLabel(1),'First floor');

let personal=clone(plain);
personal.ideas.push({id:'owner-idea',roomId:'math',title:'My original question',text:'Complete personal notes remain here.',cue:'book',localMetadata:{source:'Original notebook'}});
personal=reflect(visitRoom(personal,'2026-10-08','math'),'2026-10-08','math','I tested a claim against a painting.');personal.learning.enabled=false;
personal=converse(personal,'math','What can I infer from what I actually see?',options);
personal=proposeCritique(personal,'math',options);personal=decideProposal(personal,personal.resident.proposals[0].id,'approve',options);
personal.localMetadata={ownerNote:'Keep complete nested custom metadata.',labels:['personal','history']};personal.rooms[0].localMetadata={originalRoom:'Room one'};
const personalBefore=clone(personal),residence=createResidence(personal);
assert.deepEqual(personal,personalBefore);assert.deepEqual(plain,plainBefore);
assert.deepEqual(residence.residence,{version:1,floors:2});assert.equal(residence.rooms.length,7);assert.equal(residence.rooms.filter(room=>floorOf(room)===1).length,1);
assert.equal(reachableRooms(residence,'learning').size,residence.rooms.length);
for(const key of ['ideas','learning','resident','localMetadata'])assert.deepEqual(residence[key],personal[key],`${key} survives the new residence.`);
assert.deepEqual(residence.rooms[0].localMetadata,personal.rooms[0].localMetadata);
assert.ok(residence.rooms.find(room=>room.id==='questions').paintings.length);assert.ok(residence.rooms.find(room=>room.id==='learning').entryText.includes('Socrates'));
assert.deepEqual(validateHouse(residence),residence,'New fields and custom metadata survive normalization.');
const lower=residence.rooms.find(room=>room.id===residence.stairs[0].a),upper=residence.rooms.find(room=>room.id===residence.stairs[0].b);
assert.equal(sharedEdge(lower,upper),null);assert.ok(stairLanding(lower,upper));
const upperOverhang=clone(residence);upperOverhang.rooms.at(-1).h=10;validateHouse(upperOverhang);assert.deepEqual(entranceFor(upperOverhang),entranceFor(plain),'An upper floor extending past the facade does not move the ground-floor entrance.');assert.equal(entranceFor(floorHouse(upperOverhang,1)).roomId,upperOverhang.rooms.at(-1).id,'An upper-only navigation view still has a valid local landing target.');
const three=setResidenceFloors(residence,3);assert.equal(three.rooms.length,8);assert.equal(three.stairs.length,2);assert.equal(reachableRooms(three,'learning').size,8);
assert.deepEqual(setResidenceFloors(three,3),three,'Choosing an existing floor count does not add duplicate rooms or stairs.');
assert.throws(()=>setResidenceFloors(three,1),/content was kept/);assert.deepEqual(residence,createResidence(personal),'Floor construction never mutates its source.');

const configured=configureRoom(residence,'math',{name:'My reading study',purpose:'Test interpretations against what is visible.',brightness:23,entryText:'Enter slowly. What do you actually know?',paintings:['water-lilies','composition-eight']});
assert.equal(configured.rooms[0].brightness,23);assert.equal(configured.rooms[0].entryText,'Enter slowly. What do you actually know?');assert.deepEqual(configured.localMetadata,personal.localMetadata);assert.deepEqual(configured.rooms[0].localMetadata,personal.rooms[0].localMetadata);
const assigned=assignIdeasToRoom(configured,'residence-floor-1',['owner-idea']);assert.equal(assigned.ideas[0].roomId,'residence-floor-1');assert.deepEqual(assigned.ideas[0].localMetadata,personal.ideas[0].localMetadata);assert.equal(configured.ideas[0].roomId,'math');
const ground=floorHouse(assigned,0),first=floorHouse(assigned,1);assert.equal(ground.rooms.length,6);assert.equal(first.rooms.length,1);assert.equal(first.ideas[0].id,'owner-idea');assert.equal(ground.ideas.length,0);assert.equal(first.stairs,undefined);assert.deepEqual(assigned,assignIdeasToRoom(configured,'residence-floor-1',['owner-idea']));

for(const [changes,pattern] of [[{brightness:-1},/brightness/],[{brightness:101},/brightness/],[{brightness:NaN},/brightness/],[{floor:3},/floor/],[{floor:1.5},/floor/],[{entryText:'x'.repeat(1001)},/1,000/],[{paintings:['unknown']},/local collection/],[{paintings:['water-lilies','water-lilies']},/different paintings/],[{paintings:PAINTINGS.slice(0,4).map(work=>work.id)},/three/]])assert.throws(()=>configureRoom(residence,'math',changes),pattern);
assert.throws(()=>configureRoom(residence,'missing',{brightness:30}),/Choose a room/);assert.throws(()=>assignIdeasToRoom(residence,'math',['missing']),/existing ideas/);
const invalid=clone(residence);invalid.stairs=[];assert.throws(()=>validateHouse(invalid),/Connect every room/);
invalid.stairs=[{id:'bad',a:'math',b:'art'}];assert.throws(()=>validateHouse(invalid),/adjacent floors/);
invalid.stairs=[...residence.stairs,{...residence.stairs[0],id:'duplicate-pair'}];assert.throws(()=>validateHouse(invalid),/already have a staircase/);
invalid.stairs=[...residence.stairs,{...residence.stairs[0]}];assert.throws(()=>validateHouse(invalid),/unique identifier/);
invalid.stairs=[{...residence.stairs[0],b:'missing'}];assert.throws(()=>validateHouse(invalid),/adjacent floors/);
const noOverlap=clone(residence);noOverlap.rooms.at(-1).x=0;noOverlap.rooms.at(-1).y=0;assert.throws(()=>validateHouse(noOverlap),/landing/);
const overlap=clone(residence);overlap.rooms[1].x=5;assert.throws(()=>validateHouse(overlap),/same floor/);
const floorDoor=clone(residence);floorDoor.doors.push({a:'learning',b:'residence-floor-1'});assert.throws(()=>validateHouse(floorDoor),/sharing/);
const full=clone(residence);for(let index=0;index<12;index++)full.ideas.push({id:'target-'+index,roomId:'art',title:'Idea '+index,text:'Keep every note.',cue:'book'});assert.throws(()=>assignIdeasToRoom(full,'art',['owner-idea']),/12/);assert.equal(full.ideas[0].roomId,'math');

const original=initialNeighborhood(personal,options);original.cityNetwork=packIdea(initialCityNetwork(),{...personal.ideas[0],sourceHomeTitle:'Original home',sourceRoomName:'Study'});
const originalBytes=JSON.stringify(original.homes),built=createEdition(original,residence,{...options,title:'Socrates’ house'});
assert.equal(built.homes.at(-1).edition,'residence');assert.equal(JSON.stringify(built.homes.slice(0,-1)),originalBytes);assert.deepEqual(built.cityNetwork,original.cityNetwork);assert.equal(editionForHouse(residence),'residence');
assert.equal(createEdition(original,residence,{...options,edition:'atelier'}).homes.at(-1).edition,'residence','A multi-floor designer import uses the capable renderer.');
assert.equal(createEdition(original,plain,{...options,edition:'atelier'}).homes.at(-1).edition,'atelier','Earlier explicit imports keep their edition type.');
assert.deepEqual(validateNeighborhood(built),built);
assert.equal(initialNeighborhood(residence,options).homes.at(-1).edition,'residence','A complete multi-floor document imported through legacy-envelope conversion uses its supported renderer.');
for(const changes of [{brightness:22},{entryText:'A different welcome.'},{paintings:['starry-night']},{name:'A visible room name'}]){
 const next=configureRoom(residence,'math',changes),saved=saveEdition(built,next,options);assert.equal(saved.homes.length,built.homes.length+1);assert.deepEqual(saved.homes.slice(0,-1),built.homes);assert.equal(saved.homes.at(-1).edition,'residence');
}
assert.equal(saveEdition(built,configureRoom(residence,'math',{purpose:'Written room purpose only.'}),options).homes.length,built.homes.length,'Editing a written purpose does not multiply buildings.');

// Exercise the actual local CAS save, full neighborhood persistence and restart.
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-residence-data-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data');await fs.mkdir(webDir);await fs.mkdir(dataDir);await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Residence persistence fixture</body>');
await fs.writeFile(path.join(dataDir,'house.json'),JSON.stringify({version:2,revision:17,neighborhood:original},null,2));
let running,session,externalCalls=0;
const launch=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{},now:()=>new Date(instant),fetchImpl:async()=>{externalCalls++;throw Error('Residence data checks must stay offline.');}});
const read=async()=>{const response=await fetch(running.url+'/api/house');assert.equal(response.status,200);return response.json();};
async function boot(){const response=await fetch(running.url+'/api/config'),body=await response.json();session={cookie:response.headers.get('set-cookie').split(';')[0],csrf:body.csrfToken};}
async function put(house,revision){const response=await fetch(running.url+'/api/house',{method:'PUT',headers:{Origin:running.url,Cookie:session.cookie,'X-Local-CSRF':session.csrf,'Content-Type':'application/json'},body:JSON.stringify({house,revision})});return {status:response.status,json:await response.json()};}
try{
 running=await launch();await boot();const loaded=await read();assert.equal(loaded.revision,17);assert.equal(JSON.stringify(loaded.neighborhood.homes),originalBytes);
 const saved=await put(residence,loaded.revision);assert.equal(saved.status,200);assert.equal(saved.json.revision,18);assert.equal(saved.json.neighborhood.homes.length,3);assert.equal(saved.json.neighborhood.homes.at(-1).edition,'residence');assert.deepEqual((await read()).house,residence);assert.equal(JSON.stringify(saved.json.neighborhood.homes.slice(0,-1)),originalBytes);assert.deepEqual(saved.json.neighborhood.cityNetwork,original.cityNetwork);
 const updated=await put(configured,saved.json.revision);assert.equal(updated.status,200);assert.equal(updated.json.neighborhood.homes.length,4);const updatedHouse=(await read()).house;assert.deepEqual(updatedHouse.localMetadata,personal.localMetadata);assert.deepEqual(updatedHouse.rooms[0].localMetadata,personal.rooms[0].localMetadata);assert.deepEqual(updatedHouse.ideas[0].localMetadata,personal.ideas[0].localMetadata);
 const persisted=await read(),persistedBytes=await fs.readFile(path.join(dataDir,'house.json'));
 const stale=await put(assigned,18);assert.equal(stale.status,409);assert.deepEqual(await read(),persisted);assert.deepEqual(await fs.readFile(path.join(dataDir,'house.json')),persistedBytes);
 const malformed=clone(persisted.house);malformed.stairs[0].b='missing';const rejected=await put(malformed,persisted.revision);assert.equal(rejected.status,400);assert.deepEqual(await read(),persisted);
 await running.close();running=null;running=await launch();await boot();assert.deepEqual(await read(),persisted,'All floors, paintings, writing, custom metadata and original houses survive restart.');assert.deepEqual(await fs.readFile(path.join(dataDir,'house.json')),persistedBytes);assert.equal(externalCalls,0);
}finally{
 await running?.close();if(path.dirname(path.resolve(temporary))!==path.resolve(os.tmpdir())||!path.basename(temporary).startsWith('house-residence-data-'))throw Error('Unexpected temporary residence cleanup path.');await fs.rm(temporary,{recursive:true,force:true});
}
console.log('Verified attributed painting catalog, configurable brightness and arrival writing, connected two/three-floor homes, landing geometry, capacities, preserved whole custom documents, independent editions, stale-save rejection and actual offline persistence/restart.');
