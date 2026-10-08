import * as THREE from './vendor/three.module.js';

export async function xrAvailability(navigatorObject=globalThis.navigator,secure=globalThis.isSecureContext){
 if(!secure)return {available:false,reason:'VR needs HTTPS or this computer’s localhost page.'};
 if(!navigatorObject?.xr)return {available:false,reason:'This browser has no WebXR headset connection. Use a WebXR browser with your headset.'};
 try{return await navigatorObject.xr.isSessionSupported('immersive-vr')?{available:true,reason:'Headset ready'}:{available:false,reason:'No immersive VR headset is available in this browser.'};}catch{return {available:false,reason:'The browser could not check the VR headset.'};}
}
export function controllerMotion(gamepad){
 const axes=gamepad?.axes||[],x=Number(axes[axes.length-2])||0,y=Number(axes[axes.length-1])||0;
 return {turn:Math.abs(x)>.65?Math.sign(x):0,forward:Math.abs(y)>.18?-Math.max(-1,Math.min(1,y)):0};
}
export function safeTeleport(hit,canStand){return Boolean(hit&&hit.normalY>.65&&Number.isFinite(hit.x)&&Number.isFinite(hit.y)&&Number.isFinite(hit.z)&&Math.abs(hit.y)<=.18&&(hit.distance===undefined||Number.isFinite(hit.distance)&&hit.distance<=12)&&canStand(hit.x,hit.z));}
export function collisionStep(position,delta,canStand){let x=position.x,z=position.z;if(canStand(x+delta.x,z))x+=delta.x;if(canStand(x,z+delta.z))z+=delta.z;return {x,z};}

// Headset tracking and controller inputs stay local. Entering VR requires the
// user's button press; a missing headset leaves ordinary walking available.
export function initXR({renderer,scene,camera,button,canStand,targets,useTarget,onStatus,onStart,onEnd,panelContent,onCommand}){
 renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
 const rig=new THREE.Group();scene.add(rig);rig.add(camera);
 const ray=new THREE.Raycaster(),rotation=new THREE.Matrix4(),controllers=[],inputs=new Map();ray.far=12;let rigActive=false,turnCooldown=0,session=null,pending=false,available=false;
 const panel=new THREE.Group();panel.visible=false;scene.add(panel);let panelKey='',panelMap=null;
 const frame=new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.2),new THREE.MeshBasicMaterial({color:'#e9e3d2',side:THREE.DoubleSide}));panel.add(frame);
 for(const [command,label,x] of [['close','Close',-.52],['next','Next page',0],['critic','Ask a question',.52]]){
  const c=document.createElement('canvas');c.width=256;c.height=72;const context=c.getContext('2d');context.fillStyle='#526451';context.fillRect(0,0,256,72);context.fillStyle='#ffffff';context.font='24px sans-serif';context.textAlign='center';context.fillText(label,128,46);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const key=new THREE.Mesh(new THREE.PlaneGeometry(.46,.13),new THREE.MeshBasicMaterial({map:texture}));key.position.set(x,-.5,.006);key.userData={xrCommand:command};panel.add(key);
 }
 function syncCamera(){rig.updateMatrixWorld(true);const tracked=renderer.xr.getCamera(),tracking=renderer.xr.isPresenting&&rigActive&&tracked.cameras?.length;if(tracking)renderer.xr.updateCamera(camera);return tracking?tracked:camera;}
 // XR writes a tracking-space pose before animate. Apply the locomotion rig
 // and read matrixWorld directly so world getters cannot rewrite that pose.
 function position(){if(!renderer.xr.isPresenting||!rigActive)return camera.getWorldPosition(new THREE.Vector3());return new THREE.Vector3().setFromMatrixPosition(syncCamera().matrixWorld);}
 function forward(){return new THREE.Vector3().setFromMatrixColumn(syncCamera().matrixWorld,2).negate().normalize();}
 function hitFrom(controller){syncCamera();controller.updateWorldMatrix(true,false);rotation.extractRotation(controller.matrixWorld);ray.set(new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld),new THREE.Vector3(0,0,-1).applyMatrix4(rotation));const hits=ray.intersectObjects([...targets(),...(panel.visible?[panel]:[])],true);return hits.find(h=>{for(let n=h.object;n;n=n.parent)if(!n.visible)return false;return true;});}
 function select(controller){const hit=hitFrom(controller);if(!hit)return;for(let n=hit.object;n;n=n.parent)if(n.userData?.xrCommand){if(hit.distance<=3)onCommand?.(n.userData.xrCommand);return;}if(hit.distance<=3&&useTarget(hit.object))return;const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);if(safeTeleport({x:hit.point.x,y:hit.point.y,z:hit.point.z,normalY:normal?.y||0,distance:hit.distance},canStand)){const p=position();rig.position.x+=hit.point.x-p.x;rig.position.z+=hit.point.z-p.z;syncCamera();panel.visible=false;}}
 for(let i=0;i<2;i++){const controller=renderer.xr.getController(i);rig.add(controller);controllers.push(controller);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-4)]),new THREE.LineBasicMaterial({color:'#d5bd75'}));controller.add(line);controller.addEventListener('connected',event=>inputs.set(controller,event.data));controller.addEventListener('disconnected',()=>inputs.delete(controller));controller.addEventListener('selectstart',()=>select(controller));}
 renderer.xr.addEventListener('sessionstart',()=>{rigActive=false;onStart?.();rig.position.set(camera.position.x,0,camera.position.z);rig.rotation.set(0,camera.rotation.y,0);camera.position.set(0,0,0);camera.rotation.set(0,0,0);rigActive=true;panelKey='';onStatus('VR active · trigger to select or teleport to the floor · stick to move and snap turn');});
 renderer.xr.addEventListener('sessionend',()=>{const p=camera.getWorldPosition(new THREE.Vector3()),q=camera.getWorldQuaternion(new THREE.Quaternion()),e=new THREE.Euler().setFromQuaternion(q,'YXZ');rig.position.set(0,0,0);rig.rotation.set(0,0,0);camera.position.set(p.x,1.65,p.z);camera.rotation.set(THREE.MathUtils.clamp(e.x,-1.12,1.12),e.y,0,'YXZ');rigActive=false;panel.visible=false;session=null;button.textContent='Enter VR';onEnd?.();onStatus('Returned from VR.');});
 function refreshPanel(){const content=panelContent?.();if(!content){panel.visible=false;panelKey='';return;}const key=JSON.stringify(content);if(key===panelKey&&panel.visible)return;
  if(key!==panelKey){panelKey=key;
  const c=document.createElement('canvas');c.width=1024;c.height=768;const ctx=c.getContext('2d');ctx.fillStyle='#e9e3d2';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#293c32';ctx.font='bold 38px Georgia';ctx.fillText(String(content.title).slice(0,42),45,68);ctx.font='26px sans-serif';let y=120,line='';for(const word of String(content.text).slice(0,1800).split(/\s+/)){const next=line+' '+word;if(ctx.measureText(next).width>930){ctx.fillText(line,45,y);y+=38;line=word;if(y>635)break;}else line=next;}if(y<=635)ctx.fillText(line,45,y);
  panelMap?.dispose();panelMap=new THREE.CanvasTexture(c);panelMap.colorSpace=THREE.SRGBColorSpace;frame.material.map=panelMap;frame.material.needsUpdate=true;}
  const cam=syncCamera(),p=position();panel.position.copy(p).add(forward().multiplyScalar(1.7));panel.quaternion.setFromRotationMatrix(cam.matrixWorld);panel.visible=true;
 }
 function update(dt){if(!renderer.xr.isPresenting||!rigActive)return;syncCamera();turnCooldown=Math.max(0,turnCooldown-dt);for(const controller of controllers){const input=inputs.get(controller),motion=controllerMotion(input?.gamepad);if(input?.handedness==='right'&&motion.turn&&!turnCooldown){const p=position();rig.rotation.y-=motion.turn*Math.PI/6;const after=position();rig.position.x+=p.x-after.x;rig.position.z+=p.z-after.z;syncCamera();turnCooldown=.3;panel.visible=false;}if(input?.handedness==='left'&&motion.forward){const direction=forward();direction.y=0;direction.normalize();const p=position(),next=collisionStep(p,{x:direction.x*motion.forward*dt*1.5,z:direction.z*motion.forward*dt*1.5},canStand);rig.position.x+=next.x-p.x;rig.position.z+=next.z-p.z;syncCamera();}}refreshPanel();}
 button.onclick=async()=>{if(pending)return;pending=true;button.disabled=true;try{if(session){await session.end();return;}session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});await renderer.xr.setSession(session);button.textContent='Exit VR';}catch{const failed=session;session=null;await failed?.end().catch(()=>{});button.textContent='Enter VR';onStatus('VR could not start. Check your headset connection and browser permission.');}finally{pending=false;button.disabled=!available&&!session;}};
 xrAvailability().then(result=>{available=result.available;button.disabled=pending||!available&&!session;button.title=result.reason;button.textContent=session?'Exit VR':available?'Enter VR':'VR unavailable';});
 return {update,position,relocate(x,z,heading){if(!renderer.xr.isPresenting||!rigActive){camera.position.set(x,camera.position.y,z);if(Number.isFinite(heading))camera.rotation.y=heading;return;}const p=position();if(Number.isFinite(heading)){rig.rotation.y=heading;const after=position();rig.position.x+=p.x-after.x;rig.position.z+=p.z-after.z;}const current=position();rig.position.x+=x-current.x;rig.position.z+=z-current.z;syncCamera();panel.visible=false;},get presenting(){return renderer.xr.isPresenting;},rig};
}
