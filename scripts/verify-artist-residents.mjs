import assert from 'node:assert/strict';
import * as THREE from '../web/vendor/three.module.js';
import {ARTISTS} from '../web/art-city-data.js';
import {buildArtCity} from '../web/art-city-scene.js';
import {buildArtistResidents} from '../web/artist-residents.js';

const original=structuredClone(ARTISTS),city=buildArtCity(THREE,ARTISTS),hosts=buildArtistResidents(THREE,ARTISTS,city);
assert.deepEqual(ARTISTS,original,'Residents must not rewrite artwork descriptions or historical attribution.');
assert.equal(hosts.group.children.length,10);assert.equal(hosts.states().length,10);assert.equal(hosts.targets[0],hosts.group);
assert.equal(hosts.state('socrates'),null);assert.equal(hosts.greet('missing'),false);
const raycaster=new THREE.Raycaster(),looks=new Set(),geometry=new Set(),materials=new Set(),beginnings=new Map(),walked=new Map();let meshes=0;
hosts.group.updateMatrixWorld(true);city.group.updateMatrixWorld(true);
for(const artist of ARTISTS){
 const resident=hosts.state(artist.id),root=hosts.group.children.find(child=>child.userData.artistResidentId===artist.id),entrance=city.entryFor(artist.id);
 assert.ok(root,artist.name+' has an actual embodied resident.');assert.equal(root.name,artist.name+' · resident');assert.equal(resident.activity,'observing');
 assert.equal(city.insideAt(resident.position.x,resident.position.z),artist.id,'The artist starts in their own home.');
 assert.ok(city.canStand(resident.position.x,resident.position.z),'The artist starts clear of walls and furniture.');
 assert.ok(Math.hypot(resident.position.x-entrance.x,resident.position.z-entrance.z)<3.2,'Each host can be reached immediately upon entering their gallery.');
 const greetingDistance=Math.hypot(resident.position.x-entrance.x,resident.position.z-entrance.z);assert.ok(greetingDistance>=1.5&&greetingDistance<=2,'Greeting distance leaves the resident’s head, name and held tool room in the first-person view.');
 assert.deepEqual(resident.meetingPoint,resident.position,'The stable meeting point starts at the visible entrance position.');
 resident.meetingPoint.x+=100;assert.deepEqual(hosts.state(artist.id).meetingPoint,hosts.state(artist.id).position,'Meeting-point snapshots cannot rewrite the actual resident entrance.');
 const origin=new THREE.Vector3(entrance.x,1.65,entrance.z),target=new THREE.Vector3(resident.position.x,1.53,resident.position.z),direction=target.clone().sub(origin).normalize();
 raycaster.set(origin,direction);const hit=raycaster.intersectObjects([city.group,hosts.group],true)[0];
 assert.equal(hit?.object.userData.artistResidentId,artist.id,artist.name+' is visible and selectable from the real doorway, rather than hidden behind the gallery bench or a wall.');
 const shape=[];root.traverse(object=>{
  assert.ok(object.position.toArray().every(Number.isFinite)&&object.scale.toArray().every(Number.isFinite));
  if(!object.isMesh)return;meshes++;assert.equal(object.userData.artistResidentId,artist.id);assert.equal(object.userData.label,'Talk with '+artist.name);
  geometry.add(object.geometry);materials.add(object.material);shape.push([object.geometry.type,object.geometry.parameters,object.position.toArray(),object.scale.toArray(),object.material.color.getHex()]);
  for(const attribute of Object.values(object.geometry.attributes))for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)assert.ok(Number.isFinite(attribute.getComponent(i,c)));
 });
 looks.add(JSON.stringify(shape));beginnings.set(artist.id,{...resident.position});walked.set(artist.id,0);
}
assert.equal(looks.size,10,'Distinct resident appearances must come from mesh shape, clothing and art tools, rather than only different names.');
assert.ok(meshes<550,'Keep embodied hosts practical for a browser scene.');assert.ok(geometry.size<120,'Residents reuse their clothing, body and tool geometry.');

// Exercise the actual resident update and shipped collision pathfinder rather
// than a duplicate navigator. Every tick stays inside that artist's own house.
let prior=new Map(hosts.states().map(state=>[state.artistId,state.position]));
for(let tick=0;tick<2400;tick++){
 hosts.update(.05);
 for(const state of hosts.states()){
  const house=city.houses.find(h=>h.artistId===state.artistId),position=state.position,last=prior.get(state.artistId),distance=Math.hypot(position.x-last.x,position.z-last.z);
  assert.ok(city.canStand(position.x,position.z),state.artistId+' never clips an actual gallery wall, bench or worktable.');
  assert.equal(city.insideAt(position.x,position.z),state.artistId,state.artistId+' remains resident in their own gallery.');
  assert.ok(position.x>house.minX+.34&&position.x<house.maxX-.34&&position.z>house.minZ+.34&&position.z<house.maxZ-.34);
  assert.ok(distance<=.035001,'A normal walking tick is bounded by the resident walking speed.');walked.set(state.artistId,walked.get(state.artistId)+distance);
  for(let sample=1;sample<5;sample++)assert.ok(city.canStand(last.x+(position.x-last.x)*sample/5,last.z+(position.z-last.z)*sample/5),'The entire physical movement segment is clear.');
 }
 prior=new Map(hosts.states().map(state=>[state.artistId,state.position]));
}
for(const artist of ARTISTS)assert.ok(walked.get(artist.id)>12,artist.name+' walks between their entrance and works rather than remaining a static decoration.');

// A returning host approaches the clear inside entrance. Conversation holds
// that person in place; it neither summons Socrates nor another artist.
for(const artist of ARTISTS){
 const beginning=beginnings.get(artist.id);assert.equal(hosts.greet(artist.id),true);
 let arrived=false;for(let tick=0;tick<700;tick++){const state=hosts.state(artist.id);if(Math.hypot(state.position.x-beginning.x,state.position.z-beginning.z)<.08){arrived=true;break;}hosts.update(.05);}
 assert.ok(arrived,artist.name+' can return through their furnished house to greet a visitor.');
 const held=hosts.state(artist.id).position;for(let tick=0;tick<30;tick++)hosts.update(.05,{talkingId:artist.id,player:city.entryFor(artist.id)});
 assert.deepEqual(hosts.state(artist.id).position,held,'An artist stays with their guest during a conversation.');assert.equal(hosts.state(artist.id).activity,'talking');
}
// A guest can look around quietly before opening conversation. A greeted host
// stays present instead of walking behind the central bench after a timer.
for(const artist of ARTISTS){
 const player=city.entryFor(artist.id),beginning=beginnings.get(artist.id);hosts.greet(artist.id);
 let arrived=false;for(let tick=0;tick<700;tick++){hosts.update(.05,{player});if(Math.hypot(hosts.state(artist.id).position.x-beginning.x,hosts.state(artist.id).position.z-beginning.z)<.08){arrived=true;break;}}
 assert.ok(arrived,artist.name+' returns to a waiting silent guest.');
 // Finish any final sub-centimetre path step before checking the held pose.
 for(let tick=0;tick<20;tick++)hosts.update(.05,{player});const held=hosts.state(artist.id).position;
 for(let tick=0;tick<700;tick++)hosts.update(.05,{player});
 assert.deepEqual(hosts.state(artist.id).position,held,artist.name+' remains available with no open dialog or talking state.');
 assert.equal(hosts.state(artist.id).activity,'observing');
 let resumed=0,last=held;for(let tick=0;tick<500;tick++){hosts.update(.05,{player:city.spawn});const p=hosts.state(artist.id).position;resumed+=Math.hypot(p.x-last.x,p.z-last.z);last=p;}
 assert.ok(resumed>2,artist.name+' resumes their own art exploration after the guest leaves.');
}
// Walking through a doorway triggers the same welcome as choosing a gallery
// from the guide. The host follows a real route and is never teleported.
for(const artist of ARTISTS){
 const entrance=hosts.state(artist.id).meetingPoint;
 for(let tick=0;tick<1600&&Math.hypot(hosts.state(artist.id).position.x-entrance.x,hosts.state(artist.id).position.z-entrance.z)<1.3;tick++)hosts.update(.05,{player:city.spawn});
 const before=hosts.state(artist.id).position;assert.ok(Math.hypot(before.x-entrance.x,before.z-entrance.z)>=1.3,'The walk-in test starts with the artist exploring their gallery.');
 const player=city.entryFor(artist.id);hosts.update(.05,{player});const after=hosts.state(artist.id).position;
 assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<=.035001,'A natural guest arrival cannot teleport its resident.');
 let arrived=false;for(let tick=0;tick<900;tick++){hosts.update(.05,{player});const position=hosts.state(artist.id).position;if(Math.hypot(position.x-entrance.x,position.z-entrance.z)<.08){arrived=true;break;}}
 assert.ok(arrived,artist.name+' notices a natural walk-in visitor and returns to the meeting point.');
 for(let tick=0;tick<20;tick++)hosts.update(.05,{player});const held=hosts.state(artist.id).position;
 for(let tick=0;tick<700;tick++)hosts.update(.05,{player});assert.deepEqual(hosts.state(artist.id).position,held,'A walk-in guest is welcomed without reopening or repeatedly restarting the greeting path.');
}
// Every artwork is a possible place to find a resident when a new guest arrives.
// Start the real visible avatar at each catalog approach and verify the return
// with the guest occupying the actual doorway, including personal space.
for(const house of city.houses)for(const anchor of house.approaches){
 const root=hosts.group.children.find(resident=>resident.userData.artistResidentId===house.id),player=city.entryFor(house.id);
 root.position.set(anchor.x,0,anchor.z);hosts.greet(house.id);const meeting=hosts.state(house.id).meetingPoint;
 let arrived=false;for(let tick=0;tick<900;tick++){const before=hosts.state(house.id).position;hosts.update(.05,{player});const position=hosts.state(house.id).position;
  assert.ok(Math.hypot(position.x-before.x,position.z-before.z)<=.035001,'Greeting an artist at an artwork uses a physical walking step.');
  assert.ok(city.canStand(position.x,position.z));assert.equal(city.insideAt(position.x,position.z),house.id);
  if(Math.hypot(position.x-meeting.x,position.z-meeting.z)<.08){arrived=true;break;}
 }
 assert.ok(arrived,house.name+' can greet from '+anchor.workId+' without becoming stuck beside its guest.');
}
const paused=hosts.states();hosts.update(NaN);hosts.update(-1);assert.deepEqual(hosts.states(),paused,'Invalid timing cannot move residents.');
let geometryDisposals=0,materialDisposals=0;for(const g of geometry)g.addEventListener('dispose',()=>geometryDisposals++);for(const m of materials)m.addEventListener('dispose',()=>materialDisposals++);
hosts.dispose();hosts.dispose();assert.equal(hosts.group.children.length,0);assert.deepEqual(hosts.states(),[]);assert.equal(geometryDisposals,geometry.size);assert.equal(materialDisposals,materials.size);assert.equal(hosts.greet('monet'),false,'Disposal cannot revive a departed resident layer.');
city.dispose();assert.throws(()=>buildArtistResidents(THREE,[],city),/one to ten/);assert.throws(()=>buildArtistResidents(THREE,[ARTISTS[0],ARTISTS[0]],city),/unique known/);
console.log(`Artist residents passed: ten distinct visible hosts, safe in-house patrols and greeting paths, conversation presence, ${meshes} shared-geometry meshes.`);
