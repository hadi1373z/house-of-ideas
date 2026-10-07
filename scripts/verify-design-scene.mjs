import assert from 'node:assert/strict';
import * as THREE from '../web/vendor/three.module.js';
import {createDesignLayer,parseDesign,findDesignPosition,DISPLAY_BUDGET} from '../web/design-scene.js';
import {validateGlb} from '../web/design-objects.js';
import {triangleGlb} from './verify-design-fixture.mjs';

const glb=triangleGlb(),assetId='a'.repeat(64),meta={id:'design',title:'A handmade object',assetId,roomId:'a',placement:'room',kind:'object',position:[0,0,0],scale:1,rotation:0};
const home=(designs=[meta])=>({rooms:[{id:'a',name:'Room',x:0,y:0,w:6,h:5}],doors:[],ideas:[],designObjects:structuredClone(designs)});
const errors=[],scene=new THREE.Scene();let fetchCount=0,missing=false;
globalThis.fetch=async()=>{fetchCount++;return missing?new Response('',{status:404}):new Response(glb,{status:200});};
const layer=createDesignLayer(scene,{resolveAsset:id=>'/local/'+id,onError:message=>errors.push(message)});
await layer.load(home(),{},'atelier');assert.equal(layer.group.children.length,1);assert.equal(layer.group.children[0].position.x,-7);
await layer.load({...home(),rooms:[{...home().rooms[0],x:4}]},{},'atelier');assert.equal(layer.group.children[0].position.x,-3,'Moving a room must move its attached design.');assert.equal(fetchCount,1,'Layout changes reuse valid immutable geometry.');
await layer.load(home([{...meta,rotation:Math.PI/2}]),{},'atelier');
const bounds=new THREE.Box3().setFromObject(layer.group.children[0]),obstacle=layer.obstacles[0];
assert.ok(Math.abs(obstacle.minZ-bounds.min.z)<1e-10&&Math.abs(obstacle.maxZ-bounds.max.z)<1e-10);assert.ok(obstacle.maxZ-obstacle.minZ>.99,'Rotated mesh footprint belongs in collision data.');
await layer.load(home([{...meta,position:[0,0,-2.2],rotation:Math.PI/2}]),{},'atelier');assert.equal(layer.group.children.length,0);assert.equal(layer.obstacles.length,0);assert.match(errors.at(-1),/does not fit/);
await layer.load(home(),{obstacles:[{minX:-7.8,maxX:-6.2,minZ:-6,maxZ:-5}]},'atelier');assert.equal(layer.group.children.length,0);assert.match(errors.at(-1),/overlaps furniture or a doorway/);
const doorwayHome=home([{...meta,position:[2.1,0,0]}]);doorwayHome.rooms.push({id:'b',name:'Next room',x:6,y:0,w:6,h:5});doorwayHome.doors=[{a:'a',b:'b'}];
await layer.load(doorwayHome,{},'atelier');assert.equal(layer.group.children.length,0);assert.match(errors.at(-1),/doorway/);
assert.equal(findDesignPosition(home(),'a',8),null,'Oversized placement must not use a clamped fake radius.');
assert.ok(findDesignPosition(home(),'a',1));

// Mixed interleaved bytes are a valid exporter format. RGBA 0xffffffff looks
// like NaN only if another attribute's padding is incorrectly read as floats.
const interleaved=triangleGlb(json=>{json.buffers[0].byteLength=54;json.bufferViews[0].byteLength=48;json.bufferViews[0].byteStride=16;json.bufferViews[1].byteOffset=48;json.accessors.push({bufferView:0,byteOffset:12,componentType:5121,normalized:true,count:3,type:'VEC4'});json.meshes[0].primitives[0].attributes.COLOR_0=2;},binary=>{binary.fill(0);[[-.5,0,0],[.5,0,0],[0,1,0]].forEach((values,i)=>{values.forEach((v,j)=>binary.writeFloatLE(v,i*16+j*4));binary.fill(255,i*16+12,i*16+16);});binary.writeUInt16LE(0,48);binary.writeUInt16LE(1,50);binary.writeUInt16LE(2,52);},12);
assert.equal(validateGlb(interleaved).vertices,3);const parsed=await parseDesign(interleaved);assert.equal(parsed.budget.vertices,3);assert.equal(parsed.budget.drawCalls,1);assert.equal(parsed.size.y,1);
await assert.rejects(parseDesign(triangleGlb(()=>{},binary=>binary.writeFloatLE(Infinity,0))),/vertex values/);
const tooManyParts=triangleGlb(json=>{json.meshes[0].primitives=Array.from({length:256},()=>({attributes:{POSITION:0},indices:1}));json.nodes=Array.from({length:3},()=>({mesh:0}));json.scenes[0].nodes=[0,1,2];});
await assert.rejects(parseDesign(tooManyParts),/mesh parts|draw calls/);

// A failed fetch is retryable after a companion GLB becomes available.
await layer.load(home([]),{},'atelier');missing=true;await layer.load(home(),{},'atelier');assert.equal(layer.group.children.length,0);missing=false;await layer.load(home(),{},'atelier');assert.equal(layer.group.children.length,1);
let geometry;layer.group.traverse(o=>{if(o.isMesh)geometry=o.geometry;});let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
const tour=await layer.tour('design');await layer.load(home([]),{},'atelier');await Promise.resolve();assert.equal(disposed,0,'A live tour keeps its shared geometry.');tour.release();await Promise.resolve();assert.equal(disposed,1,'Leaving the final tour releases an unused cached model.');tour.release();await Promise.resolve();assert.equal(disposed,1);

// Garden models follow a moved entrance and never add invisible colliders when
// an import attempts to obstruct the doorway or sit beyond walking bounds.
const garden={...meta,placement:'garden',kind:'house'};delete garden.roomId;
await layer.load(home([garden]),{},'atelier');assert.equal(layer.group.children.length,2);const pedestal=layer.group.children.find(o=>o.userData.designOwned),originalGardenZ=pedestal.position.z;let pedestalDisposed=0;pedestal.geometry.addEventListener('dispose',()=>pedestalDisposed++);
const movedGarden=home([garden]);movedGarden.rooms[0].y=3;await layer.load(movedGarden,{},'atelier');assert.equal(pedestalDisposed,1);assert.equal(layer.group.children.find(o=>o.userData.designOwned).position.z,originalGardenZ+3);
await layer.load(home([{...garden,position:[-2.4,0,-3.2]}]),{},'atelier');assert.equal(layer.group.children.length,0);assert.equal(layer.obstacles.length,0);assert.match(errors.at(-1),/blocks the house/);
await layer.load(home([{...garden,position:[40,0,0]}]),{},'atelier');assert.equal(layer.group.children.length,0);assert.match(errors.at(-1),/reachable garden/);

// A collection has a render budget as well as each individual file. Four
// individually valid 199,998-vertex objects must not all render simultaneously.
const vertices=199998,large=triangleGlb(json=>{json.buffers[0].byteLength=vertices*12;json.bufferViews=[{buffer:0,byteOffset:0,byteLength:vertices*12}];json.accessors=[{bufferView:0,componentType:5126,count:vertices,type:'VEC3',min:[-.5,0,0],max:[.5,1,0]}];json.meshes[0].primitives[0]={attributes:{POSITION:0},material:0};},binary=>{const values=[-.5,0,0,.5,0,0,0,1,0];for(let i=0;i<vertices*3;i++)binary.writeFloatLE(values[i%9],i*4);},vertices*12-44);
globalThis.fetch=async()=>new Response(large,{status:200});const budgetErrors=[],budgetLayer=createDesignLayer(new THREE.Scene(),{resolveAsset:()=>'/large',onError:message=>budgetErrors.push(message)});
const collection=home([[0,0,0],[-1.5,0,0],[1.5,0,0],[0,0,-1]].map((position,index)=>({...meta,id:'part-'+index,assetId:'b'.repeat(64),position})));
await budgetLayer.load(collection,{},'atelier');assert.equal(budgetLayer.group.children.length,3);assert.match(budgetErrors.at(-1),/too detailed/);assert.equal(DISPLAY_BUDGET.vertices,600000);
console.log('Design scene: real GLB loading, valid interleaved attributes, finite/bounded geometry, rotated fit/collisions, room and entrance movement, furniture/door/garden keepouts, missing-asset retry, cache/tour/pedestal disposal and aggregate render budget passed.');
