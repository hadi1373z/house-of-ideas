import assert from 'node:assert/strict';
import * as THREE from '../web/vendor/three.module.js';
import {buildObjectMarket,MARKET_STALLS} from '../web/object-market-scene.js';
import {findCityPath} from '../web/art-city-navigation.js';
import {initialCityNetwork,validateCityNetwork,recordCityVisit} from '../web/city-network.js';
import {buildCityFacilities} from '../web/city-facilities.js';
import {canOccupy} from '../web/navigation.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {STORE_OBJECTS} from '../web/object-store.js';

const old=initialCityNetwork();assert.ok(!Object.hasOwn(old.visits,'objects'));
assert.deepEqual(validateCityNetwork(old),old,'Opening older city records creates no market history.');
const next=recordCityVisit(old,'objects');assert.equal(next.visits.objects,1);assert.deepEqual(old,initialCityNetwork());
let released=0,requests=0,inflight=0,peak=0;
const market=buildObjectMarket(THREE,{loadPreview:async()=>{requests++;inflight++;peak=Math.max(peak,inflight);await new Promise(r=>setTimeout(r,1));inflight--;const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));return {group,size:new THREE.Vector3(1,1,1),dispose(){released++;group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.clear();}};}});
const facilities=buildCityFacilities(THREE,{cityId:'objects',origin:{x:23,z:34}});
const world={...market,colliders:[...market.colliders,...facilities.obstacles],collisionRadius:.22,canStand:(x,z)=>market.canStand(x,z)&&canOccupy(facilities.obstacles,x,z,.22)};
assert.equal(MARKET_STALLS.length,98);assert.ok(world.canStand(market.spawn.x,market.spawn.z));
const source=await readFile(new URL('../web/scene.js',import.meta.url),'utf8'),start=source.indexOf(' function focusedTarget('),end=source.indexOf('\n function ',start+1);
const context=vm.createContext({STORE_OBJECTS,walk:true,built:{},cityId:'objects',objectMarket:{stalls:MARKET_STALLS},yaw:0,playerPoint:()=>context.point});
vm.runInContext(source.slice(start,end),context);
for(const stall of MARKET_STALLS){context.point=stall.approach;assert.equal(vm.runInContext('focusedTarget().storeObjectId',context),stall.id,'E identifies the display in front of its inspection position, even before loading.');}
for(const stall of MARKET_STALLS){assert.ok(world.canStand(stall.approach.x,stall.approach.z),stall.title+' has a clear inspection position');const path=findCityPath(world,market.spawn,stall.approach);assert.ok(path.length,stall.title+' is reachable from the entrance');let previous=market.spawn;for(const point of path){const count=Math.ceil(Math.hypot(point.x-previous.x,point.z-previous.z)/.1);for(let i=0;i<=count;i++)assert.ok(world.canStand(previous.x+(point.x-previous.x)*i/count,previous.z+(point.z-previous.z)*i/count),stall.title+' route is clear');previous=point;}}
market.update(market.spawn);await new Promise(r=>setTimeout(r,40));assert.ok(requests>0&&requests<=10);assert.ok(peak<=2);
market.suspend();assert.equal(released,requests,'Leaving releases every nearby exhibit.');market.update(MARKET_STALLS.at(-1).approach);market.dispose();await new Promise(r=>setTimeout(r,40));assert.equal(released,requests,'Late loads after disposal release their resources too.');facilities.dispose();
console.log('Object Market: 98 reachable displays, clear inspection positions and sampled routes, unchanged older city records, bounded loading and late-load cleanup passed.');
