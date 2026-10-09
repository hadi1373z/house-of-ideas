import assert from 'node:assert/strict';
import * as THREE from '../web/vendor/three.module.js';
import {xrAvailability,controllerMotion,safeTeleport,collisionStep,initXR} from '../web/xr.js';

assert.equal((await xrAvailability({},false)).available,false);
assert.equal((await xrAvailability({},true)).available,false);
assert.equal((await xrAvailability({xr:{isSessionSupported:async()=>true}},true)).available,true);
assert.equal((await xrAvailability({xr:{isSessionSupported:async()=>{throw Error('No headset');}}},true)).available,false);
assert.deepEqual(controllerMotion({axes:[0,0,.1,-.1]}),{turn:0,forward:0});
assert.deepEqual(controllerMotion({axes:[0,0,.8,-1]}),{turn:1,forward:1});
assert.deepEqual(controllerMotion({axes:[-.8,.5]}),{turn:-1,forward:-.5});
assert.equal(safeTeleport({x:1,y:0,z:2,normalY:1,distance:8},()=>true),true);
for(const patch of [{y:4},{y:.8},{normalY:.4},{x:Infinity},{distance:20},{y:undefined}])assert.equal(safeTeleport({x:1,y:0,z:2,normalY:1,...patch},()=>true),false);
assert.equal(safeTeleport({x:1,y:0,z:2,normalY:1},()=>false),false);
const calls=[],clear=(x,z)=>{calls.push([x,z]);return !(x>.01&&z>.01);};
assert.deepEqual(collisionStep({x:0,z:0},{x:.05,z:.05},clear),{x:.05,z:0});
assert.deepEqual(calls,[[.05,0],[.05,.05]],'The z step must use the accepted x position.');

// Use the actual Three scene graph, with a small XR manager that emulates its
// tracking-space pose -> rig world -> user camera transform. No headset or GPU.
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){},measureText:value=>({width:value.length*14})})})};
globalThis.isSecureContext=true;
const manager=new THREE.EventDispatcher(),tracked=new THREE.ArrayCamera([new THREE.PerspectiveCamera()]),controllers=[new THREE.Group(),new THREE.Group()];
tracked.matrix.compose(new THREE.Vector3(.7,1.6,.2),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.2),new THREE.Vector3(1,1,1));
tracked.getWorldPosition=()=>{throw Error('XR camera world getters must not overwrite its pose.');};
tracked.getWorldDirection=()=>{throw Error('XR camera world getters must not overwrite its pose.');};
Object.assign(manager,{isPresenting:false,setReferenceSpaceType(){},getCamera:()=>tracked,getController:index=>controllers[index],updateCamera(user){tracked.matrixWorld.multiplyMatrices(user.parent.matrixWorld,tracked.matrix);user.matrix.copy(user.parent.matrixWorld).invert().multiply(tracked.matrixWorld);user.matrix.decompose(user.position,user.quaternion,user.scale);user.updateMatrixWorld(true);},async setSession(session){this.isPresenting=true;this.dispatchEvent({type:'sessionstart'});}});
const renderer={xr:manager},scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(10,1.65,20);camera.rotation.set(0,.6,0,'YXZ');
let content={title:'A book',text:'An original reading.'},endCount=0,requestCount=0,completeRequest;
const nativeSession={async end(){manager.isPresenting=false;manager.dispatchEvent({type:'sessionend'});}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{xr:{isSessionSupported:async()=>true,requestSession:()=>{requestCount++;return new Promise(resolve=>completeRequest=resolve);}}}});
let currentFloorHeight=0;
const button={},system=initXR({renderer,scene,camera,button,floorHeight:()=>currentFloorHeight,canStand:()=>true,targets:()=>[],useTarget:()=>false,onStatus(){},onEnd:()=>endCount++,panelContent:()=>content,onCommand(){}});
await Promise.resolve();await Promise.resolve();
const first=button.onclick(),duplicate=button.onclick();assert.equal(requestCount,1,'Double clicks must not request two sessions.');completeRequest(nativeSession);await Promise.all([first,duplicate]);
const before=system.position(),expected=new THREE.Vector3(.7,1.6,.2).applyMatrix4(system.rig.matrixWorld);assert.ok(before.distanceTo(expected)<1e-10);assert.ok(before.x>10&&before.z>19,'The house origin belongs in the tracked world position.');
system.update(.05);const panel=scene.children.find(group=>group!==system.rig);assert.equal(panel.visible,true);const panelMap=panel.children[0].material.map;
controllers[1].dispatchEvent({type:'connected',data:{handedness:'right',gamepad:{axes:[0,0,.9,0]}}});
system.update(.05);assert.ok(system.position().distanceTo(before)<1e-10,'Snap-turn must pivot around the physical headset.');assert.equal(panel.visible,true,'An unchanged book must reappear after turning.');assert.equal(panel.children[0].material.map,panelMap,'Turning repositions the existing reading texture.');
controllers[1].dispatchEvent({type:'disconnected'});
controllers[0].dispatchEvent({type:'connected',data:{handedness:'left',gamepad:{axes:[0,0,0,-1]}}});
const walkStart=system.position();system.update(.05);assert.ok(Math.abs(system.position().distanceTo(walkStart)-.075)<1e-10);
system.relocate(-7,-5.5,1.2);const relocated=system.position();assert.ok(Math.abs(relocated.x+7)<1e-10&&Math.abs(relocated.z+5.5)<1e-10);assert.equal(system.rig.rotation.y,1.2);
await button.onclick();assert.equal(endCount,1);assert.equal(system.presenting,false);assert.ok(Math.abs(camera.position.x-relocated.x)<1e-10&&Math.abs(camera.position.z-relocated.z)<1e-10);assert.equal(camera.position.y,1.65);assert.deepEqual(system.rig.position.toArray(),[0,0,0]);assert.equal(system.rig.rotation.y,0);assert.equal(camera.parent,system.rig);
currentFloorHeight=3.4;camera.position.y=5.05;const upstairsStart=button.onclick();completeRequest(nativeSession);await upstairsStart;assert.equal(system.rig.position.y,3.4);assert.ok(Math.abs(system.position().y-5)<1e-10,'Physical headset height is added to the actual upper floor.');currentFloorHeight=6.8;system.relocate(-2,-3,.4,6.8);assert.equal(system.rig.position.y,6.8);assert.ok(Math.abs(system.position().y-8.4)<1e-10);await button.onclick();assert.equal(camera.position.y,8.45,'Exiting VR restores desktop eye height on the selected floor.');currentFloorHeight=0;system.setFloorHeight(0);assert.equal(camera.position.y,1.65,'Returning outside resets the floor without changing physical tracking height.');
console.log('XR: capability fallback, ground-only teleport, collision-safe axes, actual rig/head world transforms, stable snap-turn pivot, optional-yaw relocation, reading panel recovery, session race prevention and desktop restoration including real upper-floor rig offsets passed. Hardware checks remain separate.');
