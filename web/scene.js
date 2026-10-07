import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sharedEdge} from './model.js';
import {createJoystick} from './joystick.js';
const toWorld=(x,y)=>new THREE.Vector3(x-10,0,y-8);
const symbols={crystal:'◇',ring:'◎',sphere:'●',book:'▤'};
export function roomCenter(r){return toWorld(r.x+r.w/2,r.y+r.h/2);}
export function canStandAt(house,walls,x,z){const gx=x+10,gz=z+8,inside=house.rooms.some(r=>gx>=r.x&&gx<=r.x+r.w&&gz>=r.y&&gz<=r.y+r.h);if(!inside)return false;return !walls.some(w=>{const dist=w.axis==='x'?Math.abs(gz-w.fixed):Math.abs(gx-w.fixed),along=w.axis==='x'?gx:gz;return dist<.2&&along>w.lo-.2&&along<w.hi+.2;});}
function mat(color,roughness=.7,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function box(group,w,h,d,x,y,z,material,data){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;if(data)o.userData=data;group.add(o);return o;}
function label(text,color,scale=3){
 if(typeof document==='undefined')return new THREE.Group();
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.font='500 44px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text.length>30?text.slice(0,28)+'…':text,384,64,740);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(scale,scale/6,1);sprite.renderOrder=5;return sprite;
}
export function buildHouse(house,walk=false){
 const group=new THREE.Group(),walls=[],floors=[],objects=[];
 const wallMaterial=mat('#eee9de'),trim=mat('#b8a18a'),wood=mat('#a18567');
 const height=walk?2.8:.8;
 const edges=house.doors.map(d=>({edge:sharedEdge(house.rooms.find(r=>r.id===d.a),house.rooms.find(r=>r.id===d.b)),...d}));
 const wallKeys=new Set();
 function wall(axis,fixed,lo,hi,room){
  const relevant=edges.filter(d=>(d.a===room.id||d.b===room.id)&&d.edge?.axis===axis&&d.edge.fixed===fixed);
  const holes=relevant.map(d=>{const center=(d.edge.lo+d.edge.hi)/2;return [center-.75,center+.75];}).sort((a,b)=>a[0]-b[0]);
  const segments=[];let cursor=lo;for(const [a,b] of holes){if(a>cursor)segments.push([cursor,a]);cursor=Math.max(cursor,b);}if(cursor<hi)segments.push([cursor,hi]);
  for(const [a,b] of segments){const key=[axis,fixed,a,b].join(':');if(wallKeys.has(key)||b-a<.02)continue;wallKeys.add(key);const center=(a+b)/2;const x=axis==='x'?center-10:fixed-10,z=axis==='z'?center-8:fixed-8;box(group,axis==='x'?b-a:.13,height,axis==='z'?b-a:.13,x,height/2,z,wallMaterial);box(group,axis==='x'?b-a+.03:.19,.06,axis==='z'?b-a+.03:.19,x,height+.03,z,trim);walls.push({axis,fixed,lo:a,hi:b});}
  for(const [a,b] of holes){const key='door:'+axis+fixed+':'+a;if(wallKeys.has(key))continue;wallKeys.add(key);const c=(a+b)/2,x=axis==='x'?c-10:fixed-10,z=axis==='z'?c-8:fixed-8;
   if(walk)box(group,axis==='x'?1.5:.18,.65,axis==='z'?1.5:.18,x,2.475,z,wallMaterial);
   box(group,axis==='x'?1.5:.18,.025,axis==='z'?1.5:.18,x,.04,z,mat('#e0b46c'));
  }
 }
 for(const r of house.rooms){
  const c=roomCenter(r),tint=new THREE.Color(r.color).lerp(new THREE.Color('#dcd3c1'),.7),floor=box(group,r.w-.03,.12,r.h-.03,c.x,-.055,c.z,mat(tint),{roomId:r.id});floors.push(floor);
  for(let n=0;n<r.h*4;n++){const z=r.y-8+n/4;box(group,r.w-.2,.003,.012,c.x,.008,z,mat('#92765b'));}
  wall('x',r.y,r.x,r.x+r.w,r);wall('x',r.y+r.h,r.x,r.x+r.w,r);wall('z',r.x,r.y,r.y+r.h,r);wall('z',r.x+r.w,r.y,r.y+r.h,r);
  const roomLabel=label(r.name.toUpperCase(),'#334853',Math.min(r.w*.78,4.6));roomLabel.position.set(c.x,.16,r.y-8+.6);roomLabel.userData={roomId:r.id};group.add(roomLabel);
  // A small reading table is the consistent anchor in every themed room.
  const deskX=r.x-10+.65,deskZ=r.y-8+r.h-.65;
  box(group,1,.1,.65,deskX,.76,deskZ,wood);for(const dx of [-.35,.35])box(group,.08,.72,.08,deskX+dx,.36,deskZ+.2,mat('#445763'));
  for(let n=0;n<3;n++)box(group,.35,.055,.23,deskX,.84+n*.055,deskZ,mat(n===1?r.color:'#e5dcc8'));
  const ideas=house.ideas.filter(i=>i.roomId===r.id);const cols=Math.min(3,Math.max(1,Math.ceil(Math.sqrt(ideas.length*r.w/r.h)))),rows=Math.ceil(ideas.length/cols);
  ideas.forEach((idea,index)=>{
   const col=index%cols,row=Math.floor(index/cols),x=r.x-10+(.5+col)/cols*r.w,z=r.y-8+1.4+(.5+row)/Math.max(1,rows)*(r.h-2.15);
   const data={ideaId:idea.id,roomId:r.id},base=box(group,.65,.46,.65,x,.23,z,mat('#eceae5'),data);objects.push(base);
   let geometry,rotation=null;if(idea.cue==='crystal')geometry=new THREE.OctahedronGeometry(.43);if(idea.cue==='sphere')geometry=new THREE.SphereGeometry(.34,24,16);if(idea.cue==='ring')geometry=new THREE.TorusGeometry(.32,.095,14,40);if(idea.cue==='book'){geometry=new THREE.BoxGeometry(.54,.13,.4);rotation=[.1,0,.13];}
   const object=new THREE.Mesh(geometry,mat(r.color,.3,.18));object.position.set(x,.93,z);if(rotation)object.rotation.set(...rotation);object.castShadow=true;object.userData=data;group.add(object);objects.push(object);
   const title=label(idea.title,'#1d3744',Math.min(r.w/cols*.93,3.3));title.position.set(x,1.53,z);title.userData=data;group.add(title);objects.push(title);
  });
 }
 return {group,walls,floors,objects};
}
export function createScene(container,onPick){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#cdd8dc');scene.fog=new THREE.Fog('#cdd8dc',35,75);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;container.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(43,1,.05,150),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.08;controls.minDistance=5;controls.maxDistance=48;
 scene.add(new THREE.HemisphereLight('#eaf5ff','#b8a48d',2.4));const sun=new THREE.DirectionalLight('#fff1d6',3.1);sun.position.set(-12,25,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.normalBias=.035;scene.add(sun);
 box(scene,27,.18,23,0,-.21,0,mat('#b3c5c9'));const grid=new THREE.GridHelper(26,26,'#9db6bd','#abc1c6');grid.position.y=-.105;scene.add(grid);
 const stick=createJoystick(document.getElementById('joystick'),document.getElementById('joystick-thumb'));
 let house=null,built=null,walk=false,yaw=0,pitch=0,selected=null,last=0,look=null;
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const dispose=group=>group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});
 function rebuild(){if(built){scene.remove(built.group);dispose(built.group);}built=buildHouse(house,walk);scene.add(built.group);}
 function overview(){controls.enabled=true;walk=false;pitch=0;camera.position.set(14,16,15);controls.target.set(-1,0,-3);controls.update();stick.reset();if(house)rebuild();}
 function enterRoom(id){const r=house.rooms.find(r=>r.id===id)||house.rooms[0];selected=r.id;if(walk){camera.position.copy(roomCenter(r));camera.position.y=1.65;yaw=0;pitch=0;camera.rotation.set(pitch,yaw,0,'YXZ');}else{const target=roomCenter(r),delta=target.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(target);}stick.reset();}
 function setWalk(value){if(value===walk)return;walk=value;controls.enabled=!walk;stick.reset();rebuild();if(walk)enterRoom(selected||house.rooms[0].id);else overview();}
 function canStand(x,z){return canStandAt(house,built.walls,x,z);}
 const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});observer.observe(container);
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;look={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};if(walk)renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId)return;const dx=e.clientX-look.lastX,dy=e.clientY-look.lastY;if(Math.hypot(e.clientX-look.x,e.clientY-look.y)>6)look.moved=true;if(walk){yaw-=dx*.005;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-.85,.85);camera.rotation.set(pitch,yaw,0,'YXZ');}look.lastX=e.clientX;look.lastY=e.clientY;});
 renderer.domElement.addEventListener('pointerup',e=>{if(!look||look.id!==e.pointerId)return;const click=!look.moved;look=null;if(!click||!built)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...built.objects,...built.floors],false)[0];if(hit)onPick(hit.object.userData);});
 renderer.domElement.addEventListener('pointercancel',()=>{look=null;});
 function animate(now){const dt=Math.min((now-last)/1000||0,.05);last=now;const {x,y}=stick.state;if(house&&(x||y)){
  if(walk){const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),delta=forward.multiplyScalar(y*dt*2.7).add(right.multiplyScalar(x*dt*2.7));const nx=camera.position.x+delta.x,nz=camera.position.z+delta.z;if(canStand(nx,camera.position.z))camera.position.x=nx;if(canStand(camera.position.x,nz))camera.position.z=nz;}
  else{const f=controls.target.clone().sub(camera.position);f.y=0;f.normalize();const r=new THREE.Vector3(-f.z,0,f.x),delta=f.multiplyScalar(y*dt*8).add(r.multiplyScalar(x*dt*8));camera.position.add(delta);controls.target.add(delta);}
 }if(!walk)controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);}
 overview();requestAnimationFrame(animate);
 return {load(next){house=next;selected=house.rooms.some(r=>r.id===selected)?selected:house.rooms[0].id;rebuild();if(walk){const r=house.rooms.find(r=>r.id===selected);if(!canStand(camera.position.x,camera.position.z))enterRoom(r.id);}},select:enterRoom,setWalk,reset(){if(walk)enterRoom(selected);else overview();},get walking(){return walk;},roomAt(){if(!house)return null;return house.rooms.find(r=>camera.position.x+10>r.x&&camera.position.x+10<r.x+r.w&&camera.position.z+8>r.y&&camera.position.z+8<r.y+r.h)?.id||null;}};
}
