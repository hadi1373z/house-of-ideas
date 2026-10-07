import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sharedEdge} from './model.js';
import {createJoystick} from './joystick.js';

const toWorld=(x,y)=>new THREE.Vector3(x-10,0,y-8);
export function roomCenter(r){return toWorld(r.x+r.w/2,r.y+r.h/2);}
export function canStandAt(house,walls,x,z){const gx=x+10,gz=z+8,inside=house.rooms.some(r=>gx>=r.x&&gx<=r.x+r.w&&gz>=r.y&&gz<=r.y+r.h);if(!inside)return false;return !walls.some(w=>{const dist=w.axis==='x'?Math.abs(gz-w.fixed):Math.abs(gx-w.fixed),along=w.axis==='x'?gx:gz;return dist<.2&&along>w.lo-.2&&along<w.hi+.2;});}
const mat=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(group,w,h,d,x,y,z,material,data){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;if(data)o.userData=data;group.add(o);return o;}
function sphere(group,r,x,y,z,material){const o=new THREE.Mesh(new THREE.SphereGeometry(r,20,12),material);o.position.set(x,y,z);o.castShadow=true;group.add(o);return o;}
function cylinder(group,r,h,x,y,z,material){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;}
function beam(group,a,b,r,material){const delta=b.clone().sub(a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),material);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());o.castShadow=true;group.add(o);return o;}
function label(text,color,scale=3){
 if(typeof document==='undefined')return new THREE.Group();
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.font='600 44px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text.length>30?text.slice(0,28)+'…':text,384,64,740);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(scale,scale/6,1);sprite.renderOrder=5;return sprite;
}
function bounds(house){const minX=Math.min(...house.rooms.map(r=>r.x))-10,maxX=Math.max(...house.rooms.map(r=>r.x+r.w))-10,minZ=Math.min(...house.rooms.map(r=>r.y))-8,maxZ=Math.max(...house.rooms.map(r=>r.y+r.h))-8;return {minX,maxX,minZ,maxZ,w:maxX-minX,d:maxZ-minZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2};}
function outside(house,r,axis,fixed,mid){const epsilon=.02;return !house.rooms.some(other=>other!==r&&(axis==='x'?mid>other.x&&mid<other.x+other.w&&((fixed===r.y&&fixed-epsilon>other.y&&fixed-epsilon<other.y+other.h)||(fixed===r.y+r.h&&fixed+epsilon>other.y&&fixed+epsilon<other.y+other.h)):mid>other.y&&mid<other.y+other.h&&((fixed===r.x&&fixed-epsilon>other.x&&fixed-epsilon<other.x+other.w)||(fixed===r.x+r.w&&fixed+epsilon>other.x&&fixed+epsilon<other.x+other.w))));}
function windowFrame(group,axis,fixed,center,side){
 const frame=mat('#344e48'),glass=mat('#87b5c1',.12,.25),cream=mat('#fff4df'),x=axis==='x'?center-10:fixed-10+side*.086,z=axis==='z'?center-8:fixed-8+side*.086;
 const orient=(w,h,d,y,m)=>box(group,axis==='x'?w:d,h,axis==='z'?w:d,x,y,z,m);
 orient(1.52,1.27,.13,1.7,cream);orient(1.34,1.1,.15,1.7,frame);orient(1.14,.92,.17,1.7,glass);orient(.055,1.08,.19,1.7,cream);orient(1.3,.055,.19,1.7,cream);orient(1.68,.085,.34,1.06,cream);
 for(const direction of [-1,1]){const sx=x+(axis==='x'?direction*.93:0),sz=z+(axis==='z'?direction*.93:0);box(group,axis==='x'?.28:.13,1.15,axis==='z'?.28:.13,sx,1.7,sz,frame);}
}
function plant(group,x,z,size=.5){const terracotta=mat('#a96548'),leaf=mat('#5e8462');cylinder(group,size*.48,size*.55,x,size*.275,z,terracotta);for(let n=0;n<3;n++){const a=n*2.1;sphere(group,size*.48,x+Math.cos(a)*size*.22,size*.7+Math.abs(Math.sin(a))*size*.25,z+Math.sin(a)*size*.22,leaf);}}
function chair(group,x,z,color){const wood=mat('#99704c'),fabric=mat(color);box(group,.55,.13,.55,x,.48,z,fabric);box(group,.55,.6,.1,x,.81,z+.25,fabric);for(const dx of [-.2,.2])for(const dz of [-.2,.2])box(group,.055,.45,.055,x+dx,.225,z+dz,wood);}
function bookshelf(group,x,z,width,color){const wood=mat('#9a7652');box(group,width,1.8,.3,x,.9,z,wood);for(const y of [.4,.9,1.4]){box(group,width+.04,.055,.4,x,y,z+.05,mat('#eddcc1'));for(let n=0;n<Math.floor(width*7);n++)box(group,.08,.28+(n%3)*.04,.21,x-width/2+.1+n*.14,y+.19,z+.18,mat([color,'#d6ad62','#526e69','#e4d4ac'][n%4]));}}
function furniture(group,r,walk){
 const x=r.x-10,z=r.y-8,c=roomCenter(r),wood=mat('#9a7652'),cream=mat('#eadfca'),accent=mat(r.color);
 const rug=box(group,Math.min(r.w-1,3.7),.018,Math.min(r.h-1,2.6),c.x,.015,c.z,mat(new THREE.Color(r.color).lerp(new THREE.Color('#ede2ca'),.55)));rug.userData={roomId:r.id};
 const deskX=x+.85,deskZ=z+r.h-.8;
 box(group,1.25,.11,.72,deskX,.76,deskZ,wood);for(const dx of [-.45,.45])for(const dz of [-.23,.23])box(group,.07,.72,.07,deskX+dx,.36,deskZ+dz,wood);
 chair(group,deskX,deskZ-.67,r.color);for(let n=0;n<3;n++)box(group,.34,.055,.24,deskX+.25,.84+n*.055,deskZ,mat(n===1?r.color:'#e5dcc8'));
 plant(group,x+r.w-.47,z+.48,.44);
 const theme=(r.id+' '+r.name).toLowerCase();
 if(/math|proof|pattern/.test(theme)){
  box(group,2.3,1.3,.11,c.x,1.5,z+.15,wood);box(group,2.15,1.15,.13,c.x,1.5,z+.17,mat('#304a43'));for(const dx of [-.93,.93])box(group,.075,.86,.075,c.x+dx,.43,z+.15,wood);
  const chalk=mat('#eee8d4');beam(group,new THREE.Vector3(c.x-.65,1.13,z+.25),new THREE.Vector3(c.x+.6,1.15,z+.25),.017,chalk);beam(group,new THREE.Vector3(c.x+.6,1.15,z+.25),new THREE.Vector3(c.x-.1,1.92,z+.25),.017,chalk);beam(group,new THREE.Vector3(c.x-.1,1.92,z+.25),new THREE.Vector3(c.x-.65,1.13,z+.25),.017,chalk);
 }else if(/art|image|design/.test(theme)){
  const ex=x+r.w-.9,ez=z+r.h-.85;beam(group,new THREE.Vector3(ex-.45,.04,ez),new THREE.Vector3(ex,1.95,ez+.05),.035,wood);beam(group,new THREE.Vector3(ex+.45,.04,ez),new THREE.Vector3(ex,1.95,ez+.05),.035,wood);box(group,.95,.95,.09,ex,1.3,ez-.04,cream);box(group,.68,.65,.02,ex,1.3,ez-.095,accent);sphere(group,.19,ex-.12,1.36,ez-.11,mat('#e7c26e'));
 }else if(/learning|read|knowledge/.test(theme)){
  bookshelf(group,c.x,z+.28,Math.min(r.w-1.5,3.6),r.color);chair(group,x+r.w-.9,z+r.h-1.1,'#75968b');cylinder(group,.37,.47,x+r.w-1.75,.235,z+r.h-1.1,wood);
 }else if(/question|philos|reflect/.test(theme)){
  chair(group,c.x-.8,z+.85,r.color);chair(group,c.x+.65,z+.85,'#d7bd83');cylinder(group,.55,.6,c.x-.05,.3,z+1.1,wood);cylinder(group,.65,.08,c.x-.05,.64,z+1.1,cream);
 }else if(/connect|together/.test(theme)){
  box(group,2.5,.65,.78,c.x,.46,z+.74,accent);box(group,2.5,.62,.2,c.x,.85,z+.4,accent);for(const dx of [-.7,.7])box(group,.48,.15,.48,c.x+dx,.84,z+.75,cream);cylinder(group,.6,.42,c.x,.21,z+1.6,wood);
 }else{
  box(group,1.55,1,.13,c.x,1.55,z+.13,wood);box(group,1.42,.88,.15,c.x,1.55,z+.15,cream);for(const dx of [-.65,.65])box(group,.06,1.05,.06,c.x+dx,.525,z+.13,wood);for(let n=0;n<6;n++)box(group,.27,.23,.02,c.x-.5+(n%3)*.5,1.32+Math.floor(n/3)*.4,z+.24,mat(['#cc9f65',r.color,'#a7baa5'][n%3]));
 }
 if(walk){const plaque=label(r.name,'#253c35',Math.min(r.w*.68,3.2));plaque.position.set(c.x,2.4,z+.32);group.add(plaque);}
}
function architecture(group,house,exterior){
 const b=bounds(house),wood=mat('#654e3b'),stucco=mat('#f0e4ce'),roof=mat('#a35d48'),roofEdge=mat('#713f34'),stone=mat('#d6d2c2');
 box(group,b.w+.35,.23,b.d+.35,b.cx,-.16,b.cz,stone);
 const frontRooms=house.rooms.filter(r=>r.y+r.h-8===b.maxZ),entry=frontRooms.sort((a,c)=>Math.abs(roomCenter(a).x-b.cx)-Math.abs(roomCenter(c).x-b.cx))[0],doorX=roomCenter(entry).x,doorZ=b.maxZ+.1;
 box(group,2.2,.13,1.7,doorX,-.01,doorZ+.65,stone);box(group,2.5,.1,.45,doorX,-.08,doorZ+1.65,stone);
 for(let n=0;n<6;n++)box(group,1.5,.055,.62,doorX,-.07,doorZ+2.1+n*.7,mat(n%2?'#d8d0bd':'#e5ddca'));
 plant(group,doorX-1.43,doorZ+1,.72);plant(group,doorX+1.43,doorZ+1,.72);
 for(const side of [-1,1]){const px=b.cx+side*(b.w/2+1.3),pz=b.cz+1;box(group,1.4,.23,b.d*.7,px,-.07,pz,mat('#988f72'));for(let n=0;n<6;n++)plant(group,px,pz-b.d*.29+n*b.d*.1,.46);}
 if(!exterior)return;
 box(group,1.46,2.35,.15,doorX,1.17,doorZ,wood);box(group,1.16,2.14,.17,doorX,1.08,doorZ+.08,mat('#375e54'));for(const y of [.62,1.47])box(group,.88,.64,.04,doorX,y,doorZ+.18,mat('#4b7163'));sphere(group,.065,doorX+.4,1.16,doorZ+.24,mat('#d6b56f',.3,.6));
 box(group,2.3,.18,1.55,doorX,2.62,doorZ+.5,roof);for(const dx of [-.98,.98])box(group,.11,2.52,.11,doorX+dx,1.26,doorZ+1.1,wood);
 for(const dx of [-.93,.93]){box(group,.15,.32,.18,doorX+dx,1.92,doorZ+.17,wood);box(group,.11,.22,.2,doorX+dx,1.92,doorZ+.21,mat('#eed89d'));}
 const sign=label('HOUSE OF IDEAS','#faf3de',3.3);sign.position.set(doorX,2.96,doorZ+.3);group.add(sign);
 const half=b.d/2+.55,rise=Math.min(3.2,Math.max(1.8,b.d*.24)),angle=Math.atan2(rise,half),length=Math.hypot(half,rise),roofY=2.98;
 for(const side of [-1,1]){
  const plane=box(group,b.w+1.1,.17,length,b.cx,roofY+rise/2,b.cz+side*half/2,roof);plane.rotation.x=side*angle;
  for(let n=1;n<Math.ceil(b.w*1.4);n++){const x=b.minX-.4+n*.72;beam(group,new THREE.Vector3(x,roofY+rise+.105,b.cz),new THREE.Vector3(x,roofY+.105,b.cz+side*half),.011,roofEdge);}
  for(let n=1;n<Math.ceil(length*2);n++){const t=n/Math.ceil(length*2);beam(group,new THREE.Vector3(b.minX-.54,roofY+rise*(1-t)+.105,b.cz+side*half*t),new THREE.Vector3(b.maxX+.54,roofY+rise*(1-t)+.105,b.cz+side*half*t),.014,roofEdge);}
  box(group,b.w+1.18,.2,.17,b.cx,roofY,b.cz+side*half,wood);
 }
 beam(group,new THREE.Vector3(b.minX-.65,roofY+rise,b.cz),new THREE.Vector3(b.maxX+.65,roofY+rise,b.cz),.14,roofEdge);
 const shape=new THREE.Shape();shape.moveTo(-b.d/2,2.79);shape.lineTo(b.d/2,2.79);shape.lineTo(0,roofY+rise-.1);shape.closePath();
 for(const x of [b.minX-.04,b.maxX+.04]){const gable=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}),stucco);gable.rotation.y=Math.PI/2;gable.position.set(x,0,b.cz);gable.castShadow=true;group.add(gable);beam(group,new THREE.Vector3(x,2.84,b.cz-b.d/2),new THREE.Vector3(x,roofY+rise,b.cz),.075,wood);beam(group,new THREE.Vector3(x,2.84,b.cz+b.d/2),new THREE.Vector3(x,roofY+rise,b.cz),.075,wood);}
 const chimneyX=b.minX+Math.min(2,b.w*.25),chimneyZ=b.cz-b.d*.22;box(group,.72,1.8,.85,chimneyX,roofY+rise+.06,chimneyZ,mat('#ac8064'));box(group,.92,.14,1.05,chimneyX,roofY+rise+.96,chimneyZ,stone);box(group,.56,.035,.64,chimneyX,roofY+rise+1.045,chimneyZ,mat('#514d44'));
}
export function buildHouse(house,walk=false,exterior=false){
 const group=new THREE.Group(),interior=new THREE.Group(),walls=[],floors=[],objects=[];group.add(interior);interior.visible=!exterior;
 const wallMaterial=mat('#f0e4ce'),trim=mat('#c8af8a'),height=walk||exterior?2.8:.78;
 const edges=house.doors.map(d=>({edge:sharedEdge(house.rooms.find(r=>r.id===d.a),house.rooms.find(r=>r.id===d.b)),...d})),wallKeys=new Set();
 function wall(axis,fixed,lo,hi,room){
  const relevant=edges.filter(d=>(d.a===room.id||d.b===room.id)&&d.edge?.axis===axis&&d.edge.fixed===fixed);
  const holes=relevant.map(d=>{const center=(d.edge.lo+d.edge.hi)/2;return [center-.75,center+.75];}).sort((a,b)=>a[0]-b[0]);
  const segments=[];let cursor=lo;for(const [a,b] of holes){if(a>cursor)segments.push([cursor,a]);cursor=Math.max(cursor,b);}if(cursor<hi)segments.push([cursor,hi]);
  for(const [a,b] of segments){const key=[axis,fixed,a,b].join(':');if(wallKeys.has(key)||b-a<.02)continue;wallKeys.add(key);const center=(a+b)/2,x=axis==='x'?center-10:fixed-10,z=axis==='z'?center-8:fixed-8;
   box(group,axis==='x'?b-a:.15,height,axis==='z'?b-a:.15,x,height/2,z,wallMaterial);box(group,axis==='x'?b-a+.03:.2,.06,axis==='z'?b-a+.03:.2,x,height+.03,z,trim);box(group,axis==='x'?b-a:.17,.15,axis==='z'?b-a:.17,x,.08,z,mat('#cab79a'));walls.push({axis,fixed,lo:a,hi:b});
   if((walk||exterior)&&b-a>=2.4&&outside(house,room,axis,fixed,center)){const side=axis==='x'?(fixed===room.y?-1:1):(fixed===room.x?-1:1);windowFrame(group,axis,fixed,center,side);}
  }
  for(const [a,b] of holes){const key='door:'+axis+fixed+':'+a;if(wallKeys.has(key))continue;wallKeys.add(key);const c=(a+b)/2,x=axis==='x'?c-10:fixed-10,z=axis==='z'?c-8:fixed-8;
   if(walk||exterior)box(group,axis==='x'?1.5:.18,.65,axis==='z'?1.5:.18,x,2.475,z,wallMaterial);
   box(group,axis==='x'?1.5:.18,.025,axis==='z'?1.5:.18,x,.04,z,mat('#e0b46c'));
   for(const direction of [-1,1])box(group,axis==='x'?.09:.19,Math.min(height,2.15),axis==='z'?.09:.19,x+(axis==='x'?direction*.75:0),Math.min(height,2.15)/2,z+(axis==='z'?direction*.75:0),trim);
  }
 }
 for(const r of house.rooms){
  const c=roomCenter(r),tint=new THREE.Color(r.color).lerp(new THREE.Color('#dcd3c1'),.83),floor=box(group,r.w-.03,.12,r.h-.03,c.x,-.055,c.z,mat(tint),{roomId:r.id});floors.push(floor);
  const board=mat('#b9a17e');for(let n=0;n<r.h*4;n++)box(interior,r.w-.2,.003,.012,c.x,.008,r.y-8+n/4,board);
  wall('x',r.y,r.x,r.x+r.w,r);wall('x',r.y+r.h,r.x,r.x+r.w,r);wall('z',r.x,r.y,r.y+r.h,r);wall('z',r.x+r.w,r.y,r.y+r.h,r);
  const roomLabel=label(r.name.toUpperCase(),'#334d42',Math.min(r.w*.78,4.6));roomLabel.position.set(c.x,.15,r.y-8+.6);roomLabel.userData={roomId:r.id};interior.add(roomLabel);furniture(interior,r,walk);
  const ideas=house.ideas.filter(i=>i.roomId===r.id),cols=Math.min(3,Math.max(1,Math.ceil(Math.sqrt(ideas.length*r.w/r.h)))),rows=Math.ceil(ideas.length/cols);
  ideas.forEach((idea,index)=>{
   const col=index%cols,row=Math.floor(index/cols),x=r.x-10+(.5+col)/cols*r.w,z=r.y-8+1.4+(.5+row)/Math.max(1,rows)*(r.h-2.15),data={ideaId:idea.id,roomId:r.id};
   const base=box(interior,.65,.46,.65,x,.23,z,mat('#eceae5'),data);objects.push(base);
   let geometry,rotation=null;if(idea.cue==='crystal')geometry=new THREE.OctahedronGeometry(.43);if(idea.cue==='sphere')geometry=new THREE.SphereGeometry(.34,24,16);if(idea.cue==='ring')geometry=new THREE.TorusGeometry(.32,.095,14,40);if(idea.cue==='book'){geometry=new THREE.BoxGeometry(.54,.13,.4);rotation=[.1,0,.13];}
   const object=new THREE.Mesh(geometry,mat(r.color,.3,.18));object.position.set(x,.93,z);if(rotation)object.rotation.set(...rotation);object.castShadow=true;object.userData=data;interior.add(object);objects.push(object);
   const title=label(idea.title,'#1d3744',Math.min(r.w/cols*.93,3.3));title.position.set(x,1.53,z);title.userData=data;interior.add(title);objects.push(title);
  });
 }
 architecture(group,house,exterior);return {group,walls,floors,objects};
}
function socratesVisitor(){
 const group=new THREE.Group(),robe=mat('#ece6d3'),skin=mat('#bb9270'),hair=mat('#d5d1bf');
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.19,.34,.92,16),robe);body.position.y=.65;body.castShadow=true;group.add(body);sphere(group,.22,0,1.36,0,skin);sphere(group,.16,0,1.25,-.13,hair);sphere(group,.15,0,1.43,.1,hair);for(const direction of [-1,1]){beam(group,new THREE.Vector3(direction*.19,.96,0),new THREE.Vector3(direction*.34,.72,-.03),.09,robe);sphere(group,.07,direction*.34,.69,-.03,skin);}box(group,.18,.07,.28,-.13,.09,-.06,mat('#71583c'));box(group,.18,.07,.28,.13,.09,-.06,mat('#71583c'));
 const halo=new THREE.Mesh(new THREE.RingGeometry(.38,.46,40),new THREE.MeshBasicMaterial({color:'#d7b468',side:THREE.DoubleSide,transparent:true,opacity:.85}));halo.rotation.x=-Math.PI/2;halo.position.y=.03;group.add(halo);const name=label('SOCRATES','#6c5023',2);name.position.set(0,1.91,0);group.add(name);return group;
}
export function createScene(container,onPick){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#dce6df');scene.fog=new THREE.Fog('#dce6df',46,100);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(43,1,.05,150),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.06;controls.minDistance=5;controls.maxDistance=55;
 scene.add(new THREE.HemisphereLight('#edf6ef','#9a8a6b',2.2));const sun=new THREE.DirectionalLight('#ffedcf',3.4);sun.position.set(-14,23,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.normalBias=.035;scene.add(sun);
 box(scene,60,.18,60,0,-.35,0,mat('#b8c7a7'));box(scene,29,.075,26,-1,-.215,-1,mat('#c4d0b5'));
 for(const [x,z,size] of [[-14,-10,1.4],[12,-11,1.35],[-15,8,1.4],[13,8,1.4]]){cylinder(scene,.17,2.1,x,.75,z,mat('#786448'));sphere(scene,size,x,2.55,z,mat('#799674'));sphere(scene,size*.7,x+.5,3,z+.3,mat('#91a584'));}
 const stick=createJoystick(document.getElementById('joystick'),document.getElementById('joystick-thumb')),visitor=socratesVisitor();scene.add(visitor);visitor.visible=false;
 let house=null,built=null,walk=false,exterior=true,socratic=false,yaw=0,pitch=0,selected=null,last=0,look=null;
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const dispose=group=>group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});
 function moveVisitor(){visitor.visible=socratic&&!exterior;if(!house)return;const r=house.rooms.find(r=>r.id===selected)||house.rooms[0],c=roomCenter(r);visitor.position.set(c.x+.8,0,c.z+.6);visitor.userData={roomId:r.id,socrates:true};}
 function rebuild(){if(!house)return;if(built){scene.remove(built.group);dispose(built.group);}built=buildHouse(house,walk,exterior);scene.add(built.group);moveVisitor();}
 function overview(){controls.enabled=true;walk=false;pitch=0;const b=house?bounds(house):{cx:-1,cz:-3,w:18,d:10},distance=Math.max(14,b.w*.8,b.d*.9);camera.position.set(b.cx+distance*.88,exterior?distance*.72:distance,b.cz+distance*1.04);controls.target.set(b.cx,exterior?1.3:0,b.cz);controls.update();stick.reset();if(house)rebuild();}
 function enterRoom(id){if(!house)return;const r=house.rooms.find(r=>r.id===id)||house.rooms[0];selected=r.id;if(walk){camera.position.copy(roomCenter(r));camera.position.y=1.65;yaw=0;pitch=0;camera.rotation.set(pitch,yaw,0,'YXZ');}else if(!exterior){const target=roomCenter(r),delta=target.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(target);}moveVisitor();stick.reset();}
 function setWalk(value){if(value===walk&&(!value||!exterior))return;walk=Boolean(value);if(walk)exterior=false;controls.enabled=!walk;stick.reset();rebuild();if(walk)enterRoom(selected||house.rooms[0].id);else overview();}
 function setExterior(value){exterior=Boolean(value);walk=false;overview();}
 function canStand(x,z){return canStandAt(house,built.walls,x,z);}
 const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});observer.observe(container);
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;look={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};if(walk)renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId)return;const dx=e.clientX-look.lastX,dy=e.clientY-look.lastY;if(Math.hypot(e.clientX-look.x,e.clientY-look.y)>6)look.moved=true;if(walk){yaw-=dx*.005;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-.85,.85);camera.rotation.set(pitch,yaw,0,'YXZ');}look.lastX=e.clientX;look.lastY=e.clientY;});
 renderer.domElement.addEventListener('pointerup',e=>{if(!look||look.id!==e.pointerId)return;const click=!look.moved;look=null;if(!click||!built)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(exterior?built.floors:[...built.objects,...built.floors],false)[0];if(hit)onPick(hit.object.userData);});
 renderer.domElement.addEventListener('pointercancel',()=>{look=null;});
 function animate(now){const dt=Math.min((now-last)/1000||0,.05);last=now;const {x,y}=stick.state;if(house&&(x||y)){
  if(walk){const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),delta=forward.multiplyScalar(y*dt*2.7).add(right.multiplyScalar(x*dt*2.7));const nx=camera.position.x+delta.x,nz=camera.position.z+delta.z;if(canStand(nx,camera.position.z))camera.position.x=nx;if(canStand(camera.position.x,nz))camera.position.z=nz;}
  else{const f=controls.target.clone().sub(camera.position);f.y=0;f.normalize();const r=new THREE.Vector3(-f.z,0,f.x),delta=f.multiplyScalar(y*dt*8).add(r.multiplyScalar(x*dt*8));camera.position.add(delta);controls.target.add(delta);}
 }if(!walk)controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);}
 overview();requestAnimationFrame(animate);
 return {load(next){const first=!house;house=next;selected=house.rooms.some(r=>r.id===selected)?selected:house.rooms[0].id;rebuild();if(first&&!walk)overview();if(walk&&!canStand(camera.position.x,camera.position.z))enterRoom(selected);},select:enterRoom,setWalk,setExterior,setSocrates(value){socratic=Boolean(value);moveVisitor();},reset(){if(walk)enterRoom(selected);else overview();},get walking(){return walk;},get exterior(){return exterior;},roomAt(){if(!house)return null;return house.rooms.find(r=>camera.position.x+10>r.x&&camera.position.x+10<r.x+r.w&&camera.position.z+8>r.y&&camera.position.z+8<r.y+r.h)?.id||null;}};
}
