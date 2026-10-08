import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../web/vendor/three.module.js';
import {ARTISTS} from '../web/art-city-data.js';
import {starter} from '../web/model.js';
import {buildArtCity} from '../web/art-city-scene.js';
import {buildArtistResidents} from '../web/artist-residents.js';

// Execute the actual scene's interaction declarations with real meshes. The
// renderer itself needs a browser, but identity, ray reach and walls do not.
const source=await fs.readFile(new URL('../web/scene.js',import.meta.url),'utf8');
function declaration(name){
 const start=source.indexOf(' function '+name+'(');assert.ok(start>=0,'The shipped scene supplies '+name);
 const brace=source.indexOf('{',start);let depth=0,quote=null,lineComment=false,blockComment=false;
 for(let i=brace;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(lineComment){if(c==='\n')lineComment=false;continue;}
  if(blockComment){if(c==='*'&&next==='/'){blockComment=false;i++;}continue;}
  if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
  if(c==='/'&&next==='/'){lineComment=true;i++;continue;}if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
  if(c==='{')depth++;if(c==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw Error('Could not extract '+name);
}
const actual=['targetData','visibleObject','glassObject','focusedTarget','useTarget','lineOfSight','artistResidentState',
 'greetArtistResident','setArtistTalking','nearestArtistResident','residentState','talk','summonResident','moveResident',
 'enterArtistHouse','showCityLayers','faceDirection','placeCityPlayer'].map(declaration).join('\n');
const pickables=source.match(/^ const pickables=\(\)=>.*;$/m)?.[0];assert.ok(pickables,'Use shipped pickable selection.');
const setSocrates=source.match(/setSocrates\(\)\{([^{}]*)\}/)?.[1];assert.ok(setSocrates,'Use shipped Socrates visibility guard.');
const artCity=buildArtCity(THREE,ARTISTS),artistResidents=buildArtistResidents(THREE,ARTISTS,artCity),scene=new THREE.Scene();
const initialHosts=new Map(artistResidents.states().map(state=>[state.artistId,state.position]));
scene.add(artCity.group,artistResidents.group);
const visitor=new THREE.Group();visitor.userData={resident:true};visitor.position.set(0,0,0);visitor.visible=false;scene.add(visitor);
const camera=new THREE.PerspectiveCamera(62,1,.08,250);scene.add(camera);
const events=[],built={group:new THREE.Group()},makersCity={group:new THREE.Group(),insideAt:()=>null};
const xrPose=new THREE.Vector3(),relocations=[];
const context=vm.createContext({THREE,scene,camera,visitor,artCity,artistResidents,artCityArtists:ARTISTS,makersCity,
 house:starter(),built,designs:{group:new THREE.Group()},homeFacilities:null,cityLayers:new Map(),neighborhoodGroup:new THREE.Group(),
 cityId:'artists',artCityMode:true,artistTalkingId:null,tourState:null,walk:true,yaw:0,pitch:0,firstPersonPosition:null,ray:new THREE.Raycaster(),
 residentRoomId:null,targetRoomId:null,residentTalking:false,path:[],pause:4,summoning:false,
 xr:{presenting:false,relocate(x,z,heading){xrPose.set(x,1.65,z);relocations.push({x,z,heading});}},
 playerPoint:()=>context.xr.presenting?xrPose:camera.position,remoteWorld:()=>artCity,cityName:()=>context.cityId==='artists'?'Artists’ City':'Makers’ City',
 onPick:data=>events.push(data),resetInput(){},
 enterArtCity(){context.cityId='artists';context.artCityMode=true;visitor.visible=false;context.showCityLayers();},
 // Home-only dependencies must never be invoked by an artist interaction.
 planVisit(){throw Error('Artist interaction reached the personal Socrates patrol.');},
 setDoor(){throw Error('Artist interaction reached a personal house door.');}});
vm.runInContext(actual+'\n'+pickables+'\nfunction setSocrates(){'+setSocrates+'}',context,{filename:'shipped-artist-interactions.js'});
const run=text=>vm.runInContext(text,context);
for(const artist of ARTISTS){
 run(`enterArtistHouse('${artist.id}')`);scene.updateMatrixWorld(true);
 assert.equal(run('residentState().available'),false);assert.equal(run('residentState().near'),false);
 assert.equal(run('summonResident()'),false,'An artist visit cannot summon Socrates.');run('setSocrates()');assert.equal(visitor.visible,false);
 assert.equal(run(`artistResidentState('${artist.id}').near`),true,artist.name+' is physically nearby and unobstructed at gallery arrival.');
 const target=run('focusedTarget()');assert.equal(target?.artistResidentId,artist.id,'The camera faces the actual resident and E selects their own identity.');
 const selectable=run('pickables()');assert.ok(selectable.includes(artistResidents.group));assert.ok(!selectable.includes(visitor),'Hidden Socrates is excluded from ray targets, not only visually hidden.');
}
for(const artist of ARTISTS){
 run(`enterArtistHouse('${artist.id}')`);
 // Other artists have continued exploring while visiting the previous house.
 // Let this returning host approach through their own room before talking.
 for(let i=0;i<900&&!run(`artistResidentState('${artist.id}').near`);i++)run('moveResident(.05)');
 assert.equal(run(`artistResidentState('${artist.id}').near`),true,artist.name+' greets a returning guest.');
 events.length=0;assert.equal(run(`useTarget({artistResidentId:'${artist.id}'})`),true);assert.equal(events.at(-1).artistResidentId,artist.id);
 events.length=0;run('talk()');assert.equal(events.at(-1)?.artistResidentId,artist.id,'The scene talk action opens the nearby artist rather than Socrates.');
 run(`setArtistTalking('${artist.id}',true)`);const held=artistResidents.state(artist.id).position;
 for(let i=0;i<20;i++)run('moveResident(.05)');assert.deepEqual(artistResidents.state(artist.id).position,held);assert.equal(artistResidents.state(artist.id).activity,'talking');
 run(`setArtistTalking('${artist.id}',false)`);for(let i=0;i<300;i++)run('moveResident(.05)');
 assert.equal(run(`artistResidentState('${artist.id}').near`),true,'A silent visitor still has their greeted host available after the initial pause.');
 assert.equal(run('focusedTarget()')?.artistResidentId,artist.id,'The returning host remains in the camera direction once they arrive at the meeting point, even after an offscreen patrol.');
 assert.equal(visitor.visible,false);
}

// A wall can separate two positions that are within conversational distance.
// Test the actual scene LOS check against the existing gallery side wall.
run("enterArtistHouse('monet')");const beginning=initialHosts.get('monet');
for(let i=0;i<900;i++){const position=artistResidents.state('monet').position;if(Math.hypot(position.x-beginning.x,position.z-beginning.z)<.08)break;run('moveResident(.05)');}
for(let i=0;i<20;i++)run('moveResident(.05)');const host=artistResidents.state('monet').position;
camera.position.set(artCity.houses[0].minX-.35,1.65,host.z);scene.updateMatrixWorld(true);
assert.ok(Math.hypot(camera.position.x-host.x,camera.position.z-host.z)<3.2);
assert.equal(run("artistResidentState('monet').near"),false,'A solid wall prevents talking even at short distance.');
events.length=0;run("useTarget({artistResidentId:'monet'})");assert.equal(events.length,0,'A stale target cannot bypass the wall check.');
run("setArtistTalking('monet',true)");assert.equal(context.artistTalkingId,null);
const hiddenState=run("artistResidentState('missing')");assert.equal(hiddenState.available,false);assert.equal(hiddenState.near,false);

context.cityId='makers';run('showCityLayers()');run('setSocrates()');assert.equal(artistResidents.group.visible,false);assert.equal(visitor.visible,true);
assert.equal(run('residentState().available'),true);assert.ok(run('pickables()').includes(visitor));assert.ok(!run('pickables()').includes(artistResidents.group));
context.cityId='home';context.artCityMode=false;run('showCityLayers()');run('setSocrates()');assert.equal(artistResidents.group.visible,false);assert.equal(visitor.visible,true);
assert.ok(run('pickables()').includes(visitor));
// Headset entry uses the locomotion rig after computing the host-facing yaw.
// Rotating only the desktop camera would be overwritten by tracked head pose.
context.xr.presenting=true;
for(const artist of ARTISTS){
 const point=artCity.entryFor(artist.id),meeting=artistResidents.state(artist.id).meetingPoint;
 run(`enterArtistHouse('${artist.id}')`);
 const relocation=relocations.at(-1),expected=Math.atan2(point.x-meeting.x,point.z-meeting.z);
 assert.equal(relocation.x,point.x);assert.equal(relocation.z,point.z);
 assert.ok(Math.abs(relocation.heading-expected)<1e-10,artist.name+' gallery entry directs the XR rig toward the stable meeting point rather than an old patrol position.');
 assert.equal(xrPose.x,point.x);assert.equal(xrPose.z,point.z);assert.equal(visitor.visible,false);
}
artistResidents.dispose();artCity.dispose();
console.log('Artist scene integration passed: shipped desktop/XR arrival, E/click/talk identity, actual wall LOS, greeting and conversation presence, Socrates visibility and city ray-target isolation.');
