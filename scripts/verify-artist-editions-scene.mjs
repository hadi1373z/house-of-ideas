import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../web/vendor/three.module.js';
import {ARTISTS} from '../web/art-city-data.js';
import {buildArtCity} from '../web/art-city-scene.js';
import {buildArtistCityEditions} from '../web/artist-city-editions.js';
import {buildArtistResidents} from '../web/artist-residents.js';
import {findCityPath} from '../web/art-city-navigation.js';

function signature(group){const hash=createHash('sha256');group.updateMatrixWorld(true);group.traverse(object=>{if(!object.isMesh)return;hash.update(JSON.stringify(object.matrixWorld.elements));for(const [name,attribute] of Object.entries(object.geometry.attributes)){hash.update(name);hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));}for(const mat of Array.isArray(object.material)?object.material:[object.material])hash.update(JSON.stringify([mat.type,mat.color?.getHexString(),mat.opacity,mat.side]));if(object.isInstancedMesh)hash.update(Buffer.from(object.instanceMatrix.array.buffer));});return hash.digest('hex');}
const base=buildArtCity(THREE,ARTISTS),frozen=signature(base.group),originalColliders=structuredClone(base.colliders),originalBounds={...base.bounds},originalArtists=structuredClone(ARTISTS);
const features=['observation-alcove','composition-wall','material-table'],atmospheres=['garden','contrast','quiet'];
const editions=Array.from({length:20},(_,i)=>({id:'artist-house-'+(i+1),artistId:ARTISTS[i%10].id,number:Math.floor(i/10)+2,title:'Study house '+(i+1),reason:'Compare one useful arrangement.',exercise:'Observe it from two positions and record the difference.',feature:features[i%3],atmosphere:atmospheres[Math.floor(i/3)%3],proposalId:'approved-'+i,createdAt:'2026-10-08T19:00:00.000Z'}));
const frozenEditions=structuredClone(editions),overlay=buildArtistCityEditions(THREE,ARTISTS,base,editions),world={...base,group:overlay.group,bounds:overlay.bounds,colliders:[...base.colliders,...overlay.colliders],canStand:overlay.canStand,insideAt:overlay.insideAt,insideHouseAt:overlay.insideHouseAt};
assert.deepEqual(editions,frozenEditions);assert.deepEqual(ARTISTS,originalArtists);assert.deepEqual(base.colliders,originalColliders);assert.deepEqual(base.bounds,originalBounds);assert.equal(signature(base.group),frozen,'Adding approved houses leaves every original wall, roof, object and material unchanged.');
assert.equal(overlay.houses.length,20);assert.equal(overlay.bounds.maxZ,72);assert.equal(overlay.entryFor('monet','missing'),null);assert.equal(overlay.houseFor('missing'),null);
assert.deepEqual(overlay.entryFor('monet'),base.entryFor('monet'),'The original remains the default house when no edition is selected.');
assert.equal(overlay.houseFor('monet'),base.houses[0]);assert.equal(overlay.insideHouseAt(base.entryFor('monet').x,base.entryFor('monet').z),base.houses[0]);
const ray=new THREE.Raycaster();let artworks=0,actions=0,routes=0,previous=base.spawn;
function route(nav,from,to,label){const path=findCityPath(nav,from,to);assert.ok(path.length,label+' has a shipped physical walking route.');let prior=from;for(const next of path){for(let i=0;i<=12;i++)assert.ok(nav.canStand(prior.x+(next.x-prior.x)*i/12,prior.z+(next.z-prior.z)*i/12),label+' avoids furniture and walls between path nodes.');prior=next;}routes++;return path;}
for(let i=0;i<overlay.houses.length;i++){
 const house=overlay.houses[i],edition=editions[i],source=base.houses.find(item=>item.artistId===house.artistId);
 assert.equal(house.id,edition.id);assert.equal(house.editionId,edition.id);assert.equal(house.number,edition.number);assert.equal(house.row,1);assert.equal(house.cx,(i%5-2)*10);assert.equal(house.cz,23+Math.floor(i/5)*14);
 assert.deepEqual(overlay.entryFor(house.artistId,house.editionId),house.spawnInside);assert.equal(overlay.insideHouseAt(house.spawnInside.x,house.spawnInside.z).id,house.id);
 const roof=house.group.children.find(mesh=>mesh.isMesh&&mesh.geometry.type==='BufferGeometry'),oldRoof=source.group.children.find(mesh=>mesh.isMesh&&mesh.geometry.type==='BufferGeometry');
 assert.deepEqual([...roof.geometry.attributes.position.array],[...oldRoof.geometry.attributes.position.array],'Each artist retains their distinctive roof shape in an owned copy.');assert.notEqual(roof.geometry,oldRoof.geometry);assert.equal(roof.material.color.getHex(),oldRoof.material.color.getHex());
 route(world,previous,house.entry,house.id+' district entrance');previous=house.entry;
 const nav={...world,bounds:{minX:house.minX-.5,maxX:house.maxX+.5,minZ:house.minZ-.85,maxZ:house.maxZ+.5}};
 route(nav,house.entry,house.spawnInside,house.id+' open doorway');assert.ok(world.canStand(house.study.anchor.x,house.study.anchor.z));
 for(const anchor of house.approaches){
  route(nav,house.spawnInside,anchor,house.id+' '+(anchor.workId||anchor.feature));
  ray.set(new THREE.Vector3(anchor.x,1.62,anchor.z),new THREE.Vector3(anchor.lookAt.x,anchor.lookAt.y,anchor.lookAt.z).sub(new THREE.Vector3(anchor.x,1.62,anchor.z)).normalize());
  const hit=ray.intersectObjects([base.group,overlay.group],true)[0];assert.ok(hit);assert.equal(hit.object.userData.artistEditionId,house.id);
  if(anchor.workId){assert.equal(hit.object.userData.workId,anchor.workId,'A copied artwork stays visible after furnishing its new edition.');artworks++;}
  else {assert.equal(hit.object.userData.artAction,'edition-study');assert.equal(hit.object.userData.feature,edition.feature);assert.ok(hit.distance<=2.6,'The approved exercise has a reachable physical object.');actions++;}
 }
 assert.equal(house.approaches.length,7);house.group.traverse(object=>{assert.equal(object.userData.artistEditionId,house.id);assert.equal(object.userData.artistId,house.artistId);});
 ray.set(new THREE.Vector3(house.cx+.8,8,house.cz),new THREE.Vector3(0,-1,0));assert.ok(ray.intersectObject(house.group,true)[0]?.point.y>3,'Approved editions have a solid exterior roof.');
}
assert.equal(artworks,120);assert.equal(actions,20);route(world,base.spawn,overlay.houses.at(-1).entry,'Furthest fourth-row home from the original city gate');
// Spatial lookup preserves the exact strict boundary test while avoiding a
// full scan of thirty buildings on every walking tick.
for(let z=-16;z<72;z+=.73)for(let x=-27;x<28;x+=.91){const expected=x>world.bounds.minX+.22&&x<world.bounds.maxX-.22&&z>world.bounds.minZ+.22&&z<world.bounds.maxZ-.22&&!world.colliders.some(c=>x>c.minX-.22&&x<c.maxX+.22&&z>c.minZ-.22&&z<c.maxZ+.22);assert.equal(world.canStand(x,z),expected);}

const residents=buildArtistResidents(THREE,ARTISTS,world);assert.equal(residents.states().length,10,'One embodied artist can inhabit successive preserved versions.');
for(const house of overlay.houses){
 const player=house.spawnInside;residents.update(.05,{player});const state=residents.state(house.artistId);
 assert.equal(state.houseId,house.id,'A natural walk into an edition moves its artist into that particular house.');assert.equal(state.editionId,house.editionId);assert.equal(overlay.insideHouseAt(state.position.x,state.position.z)?.id,house.id);assert.ok(world.canStand(state.position.x,state.position.z));
 const held={...state.position};assert.equal(residents.rehome(house.artistId,house),true);assert.deepEqual(residents.state(house.artistId).position,held,'Revisiting the same house does not teleport its resident.');
 for(let tick=0;tick<120;tick++)residents.update(.05,{player});assert.deepEqual(residents.state(house.artistId).position,held,'The artist waits with a silent guest in this edition.');
 const root=residents.group.children.find(item=>item.userData.artistResidentId===house.artistId);root.traverse(object=>assert.equal(object.userData.artistEditionId,house.id));
 residents.update(.05,{player:base.spawn});for(let tick=0;tick<450;tick++){residents.update(.05,{player:base.spawn});const position=residents.state(house.artistId).position;assert.ok(world.canStand(position.x,position.z));assert.equal(overlay.insideHouseAt(position.x,position.z)?.id,house.id,'Patrol remains in the resident’s current edition.');}
}
assert.equal(residents.rehome('monet',overlay.houses.find(h=>h.artistId==='klee')),false,'A resident cannot be placed in another artist’s home.');
residents.update(.05,{player:base.entryFor('monet')});assert.equal(residents.state('monet').houseId,'monet');assert.equal(residents.state('monet').editionId,null,'Returning to the preserved original restores its original residence.');residents.dispose();
const geometry=new Set(),material=new Set();let geometryDisposals=0,materialDisposals=0,baseDisposals=0;
overlay.group.traverse(object=>{if(!object.isMesh)return;geometry.add(object.geometry);for(const mat of Array.isArray(object.material)?object.material:[object.material])material.add(mat);});
for(const geo of geometry)geo.addEventListener('dispose',()=>geometryDisposals++);for(const mat of material)mat.addEventListener('dispose',()=>materialDisposals++);
base.group.traverse(object=>{if(object.isMesh)object.geometry.addEventListener('dispose',()=>baseDisposals++);});overlay.dispose();overlay.dispose();
assert.equal(overlay.group.children.length,0);assert.equal(geometryDisposals,geometry.size);assert.equal(materialDisposals,material.size);assert.equal(baseDisposals,0,'Removing an edition layer never disposes borrowed original-city geometry.');assert.equal(signature(base.group),frozen);assert.deepEqual(base.colliders,originalColliders);
const empty=buildArtistCityEditions(THREE,ARTISTS,base,[]);assert.deepEqual(empty.bounds,originalBounds);assert.equal(empty.group.children.length,0);empty.dispose();
assert.throws(()=>buildArtistCityEditions(THREE,ARTISTS,base,[editions[0],editions[0]]),/distinct edition/);assert.throws(()=>buildArtistCityEditions(THREE,ARTISTS,base,Array.from({length:21},()=>editions[0])),/bounded edition/);base.dispose();

// The renderer-independent coordinator executes its shipped declarations with
// real copied geometry, rather than testing a second implementation of entry.
const sceneSource=await fs.readFile(new URL('../web/scene.js',import.meta.url),'utf8');
function declaration(name){
 const start=sceneSource.indexOf(' function '+name+'('),brace=sceneSource.indexOf('{',start);assert.ok(start>=0);let depth=0,quote=null;
 for(let i=brace;i<sceneSource.length;i++){const c=sceneSource[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return sceneSource.slice(start,i+1);}throw Error('Cannot extract '+name);
}
const physicalBase=buildArtCity(THREE,ARTISTS),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,1,.08,250),visitor=new THREE.Group(),events=[],relocations=[],xrPoint=new THREE.Vector3();scene.add(physicalBase.group,camera,visitor);
camera.position.set(24,1.65,0);visitor.position.set(0,0,0);
const context=vm.createContext({THREE,mathCity:null,mathFloor:0,floorHeight:()=>0,ARTISTS,scene,camera,visitor,artCityBase:physicalBase,artCity:null,artistEditionLayer:null,artistResidents:null,artistTalkingId:null,artCityArtists:ARTISTS,cityNetwork:{artistHomes:{editions:editions.slice(0,3)}},cityId:'artists',artCityMode:true,cityLayers:new Map(),tourState:null,walk:true,built:{group:new THREE.Group()},house:{ideas:[]},designs:{group:new THREE.Group()},homeFacilities:null,neighborhoodGroup:new THREE.Group(),yaw:0,pitch:0,firstPersonPosition:null,residentTalking:false,path:[],pause:0,playerPath:[],seatTarget:null,landmarkLookAt:null,ray:new THREE.Raycaster(),
 buildArtistCityEditions,buildArtistResidents,
 xr:{setFloorHeight(){},presenting:false,relocate(x,z,heading){xrPoint.set(x,1.65,z);relocations.push({x,z,heading});}},
 playerPoint:()=>context.xr.presenting?xrPoint:camera.position,remoteWorld:()=>context.artCity,canStand:(x,z)=>context.artCity.canStand(x,z),resetInput(){},refreshCargo(){},
 onPick:data=>events.push(data),enterArtCity(){context.cityId='artists';context.artCityMode=true;visitor.visible=false;context.showCityLayers();}});
const shipped=['refreshArtistEditions','setCityNetwork','showCityLayers','faceDirection','placeCityPlayer','enterArtistHouse','greetArtistResident','artistResidentState','lineOfSight','visibleObject','glassObject','targetData','focusedTarget','useTarget'].map(declaration).join('\n');
const pickables=sceneSource.match(/^ const pickables=\(\)=>.*;$/m)?.[0];assert.ok(pickables);vm.runInContext(shipped+'\n'+pickables,context);const run=text=>vm.runInContext(text,context);run('refreshArtistEditions()');
for(const edition of editions.slice(0,3)){
 run(`enterArtistHouse('${edition.artistId}','${edition.id}')`);scene.updateMatrixWorld(true);
 assert.equal(run('focusedTarget()')?.artistResidentId,edition.artistId,'The shipped camera and E target face the resident of the selected new edition.');
 assert.equal(context.artistResidents.state(edition.artistId).editionId,edition.id);assert.equal(context.artCity.insideHouseAt(camera.position.x,camera.position.z)?.editionId,edition.id);assert.equal(visitor.visible,false);
 const selected=context.artCity.houseFor(edition.artistId,edition.id),anchor=selected.study.anchor;
 camera.position.set(anchor.x,1.65,anchor.z);const direction=new THREE.Vector3(selected.study.lookAt.x,selected.study.lookAt.y,selected.study.lookAt.z).sub(camera.position);context.yaw=Math.atan2(-direction.x,-direction.z);context.pitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));run('faceDirection()');
 const target=run('focusedTarget()');assert.equal(target?.artAction,'edition-study');assert.equal(target.artistEditionId,edition.id);events.length=0;run('useTarget(focusedTarget())');assert.equal(events.at(-1).artistEditionId,edition.id,'A physical exercise retains the selected edition in the app callback.');
}
run(`enterArtistHouse('${editions[0].artistId}','${editions[0].id}')`);const originalActor=context.artistResidents,originalPosition=context.artistResidents.state(editions[0].artistId).position;
context.nextNetwork={...context.cityNetwork,artistConversations:{monet:[]}};run('setCityNetwork(nextNetwork)');assert.equal(context.artistResidents,originalActor,'Saving conversation data does not rebuild or relocate residents.');assert.deepEqual(context.artistResidents.state(editions[0].artistId).position,originalPosition);
context.nextNetwork={artistHomes:{editions:editions.slice(0,4)}};run('setCityNetwork(nextNetwork)');assert.notEqual(context.artistResidents,originalActor);assert.equal(originalActor.group.children.length,0);assert.equal(context.artistResidents.state(editions[0].artistId).editionId,editions[0].id,'Building another approved home keeps the guest and artist in the currently occupied edition.');
run(`enterArtistHouse('${editions[0].artistId}')`);assert.equal(context.artistResidents.state(editions[0].artistId).editionId,null);assert.equal(context.artCity.insideHouseAt(camera.position.x,camera.position.z)?.id,editions[0].artistId,'The preserved original remains enterable through the same shipped coordinator.');
context.xr.presenting=true;for(const edition of editions.slice(0,3)){run(`enterArtistHouse('${edition.artistId}','${edition.id}')`);const point=context.artCity.entryFor(edition.artistId,edition.id),meeting=context.artistResidents.state(edition.artistId).meetingPoint;assert.equal(relocations.at(-1).x,point.x);assert.equal(relocations.at(-1).z,point.z);assert.equal(relocations.at(-1).heading,Math.atan2(point.x-meeting.x,point.z-meeting.z));}
context.artistResidents.dispose();physicalBase.group.remove(context.artistEditionLayer.group);context.artistEditionLayer.dispose();physicalBase.dispose();
console.log(`Artist edition geometry passed: 20 preserved new lots, 120 selectable copied artworks, 20 physical approved exercises, ${routes} shipped walking routes, natural resident rehoming, exact original geometry and independent disposal.`);
