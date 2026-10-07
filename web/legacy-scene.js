import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sharedEdge} from './model.js';
import {createJoystick} from './joystick.js';
import {houseBounds,entranceFor,roomAtPoint,reachableIds,walkingRoute,canExploreAt,stepAlongPath,findWalkingPath} from './navigation.js';

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
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));sprite.scale.set(scale,scale/6,1);sprite.renderOrder=5;return sprite;
}
const bounds=houseBounds;
const layoutSignature=house=>JSON.stringify({rooms:house.rooms.map(({id,x,y,w,h})=>({id,x,y,w,h})),doors:house.doors});
function outside(house,r,axis,fixed,mid){const epsilon=.02;return !house.rooms.some(other=>other!==r&&(axis==='x'?mid>other.x&&mid<other.x+other.w&&((fixed===r.y&&fixed-epsilon>other.y&&fixed-epsilon<other.y+other.h)||(fixed===r.y+r.h&&fixed+epsilon>other.y&&fixed+epsilon<other.y+other.h)):mid>other.y&&mid<other.y+other.h&&((fixed===r.x&&fixed-epsilon>other.x&&fixed-epsilon<other.x+other.w)||(fixed===r.x+r.w&&fixed+epsilon>other.x&&fixed+epsilon<other.x+other.w))));}
function windowFrame(group,axis,fixed,center,side){
 const frame=mat('#344e48'),glass=new THREE.MeshStandardMaterial({color:'#a4c5c7',roughness:.08,metalness:.08,transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide}),cream=mat('#fff4df'),x=axis==='x'?center-10:fixed-10+side*.025,z=axis==='z'?center-8:fixed-8+side*.025;
 const orient=(w,h,d,y,m,offset=0)=>box(group,axis==='x'?w:d,h,axis==='z'?w:d,x+(axis==='x'?offset:0),y,z+(axis==='z'?offset:0),m);
 for(const offset of [-.77,.77])orient(.09,1.2,.2,1.65,frame,offset);
 for(const y of [1.08,2.22])orient(1.64,.09,.2,y,cream);
 const pane=orient(1.44,1.04,.014,1.65,glass);pane.castShadow=false;pane.receiveShadow=false;
 orient(.055,1.12,.19,1.65,cream);orient(1.52,.055,.19,1.65,cream);orient(1.75,.08,.34,1.02,cream);
 for(const direction of [-1,1]){const sx=x+(axis==='x'?direction*.96:0),sz=z+(axis==='z'?direction*.96:0);box(group,axis==='x'?.28:.13,1.15,axis==='z'?.28:.13,sx,1.65,sz,frame);}
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
  bookshelf(group,x+.9,z+.28,Math.min(r.w*.3,1.5),r.color);chair(group,x+r.w-.9,z+r.h-1.1,'#75968b');cylinder(group,.37,.47,x+r.w-1.75,.235,z+r.h-1.1,wood);
 }else if(/question|philos|reflect/.test(theme)){
  const seatX=x+r.w-1.4;chair(group,seatX-.6,z+1.2,r.color);chair(group,seatX+.55,z+1.2,'#d7bd83');cylinder(group,.45,.6,seatX,.3,z+1.7,wood);cylinder(group,.5,.08,seatX,.64,z+1.7,cream);
 }else if(/connect|together/.test(theme)){
  const lounge=new THREE.Group();lounge.position.set(x+r.w-.5,0,z+r.h/2);lounge.rotation.y=-Math.PI/2;group.add(lounge);box(lounge,2.5,.65,.78,0,.46,0,accent);box(lounge,2.5,.62,.2,0,.85,-.34,accent);for(const dx of [-.7,.7])box(lounge,.48,.15,.48,dx,.84,.01,cream);cylinder(lounge,.6,.42,0,.21,.86,wood);
 }else{
  box(group,1.55,1,.13,c.x,1.55,z+.13,wood);box(group,1.42,.88,.15,c.x,1.55,z+.15,cream);for(const dx of [-.65,.65])box(group,.06,1.05,.06,c.x+dx,.525,z+.13,wood);for(let n=0;n<6;n++)box(group,.27,.23,.02,c.x-.5+(n%3)*.5,1.32+Math.floor(n/3)*.4,z+.24,mat(['#cc9f65',r.color,'#a7baa5'][n%3]));
 }
 if(walk){const plaque=label(r.name,'#253c35',Math.min(r.w*.68,3.2));plaque.position.set(c.x,2.4,z+.32);group.add(plaque);}
}
function architecture(group,house,enclosed){
 const b=bounds(house),wood=mat('#654e3b'),stucco=mat('#f0e4ce'),roof=mat('#a35d48'),roofEdge=mat('#713f34'),stone=mat('#d6d2c2');
 box(group,b.w+.35,.23,b.d+.35,b.cx,-.16,b.cz,stone);
 const entrance=entranceFor(house),doorX=entrance.x,doorZ=entrance.z+.075;
 box(group,2.2,.13,1.7,doorX,-.01,doorZ+.65,stone);box(group,2.5,.1,.45,doorX,-.08,doorZ+1.65,stone);
 for(let n=0;n<6;n++)box(group,1.5,.055,.62,doorX,-.07,doorZ+2.1+n*.7,mat(n%2?'#d8d0bd':'#e5ddca'));
 plant(group,doorX-1.43,doorZ+1,.72);plant(group,doorX+1.43,doorZ+1,.72);
 for(const side of [-1,1]){const px=b.cx+side*(b.w/2+1.3),pz=b.cz+1;box(group,1.4,.23,b.d*.7,px,-.07,pz,mat('#988f72'));for(let n=0;n<6;n++)plant(group,px,pz-b.d*.29+n*b.d*.1,.46);}
 if(!enclosed)return;
 // An actual open leaf sits beside the empty, traversable front doorway.
 const leaf=new THREE.Group();leaf.position.set(doorX-.74,0,doorZ);leaf.rotation.y=-Math.PI*.47;group.add(leaf);box(leaf,1.4,2.16,.1,.7,1.08,0,mat('#375e54'));for(const y of [.58,1.47])box(leaf,1.13,.65,.025,.7,y,.065,mat('#4b7163'));sphere(leaf,.065,1.2,1.13,.1,mat('#d6b56f',.3,.6));
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
 const group=new THREE.Group(),interior=new THREE.Group(),walls=[],floors=[],objects=[],ceilings=[],entry=entranceFor(house);group.add(interior);interior.visible=!exterior||walk;
 const wallMaterial=mat('#f0e4ce'),trim=mat('#c8af8a'),height=walk||exterior?2.8:.78;
 const edges=house.doors.map(d=>({edge:sharedEdge(house.rooms.find(r=>r.id===d.a),house.rooms.find(r=>r.id===d.b)),...d})),wallKeys=new Set();
 function wall(axis,fixed,lo,hi,room){
  const relevant=edges.filter(d=>(d.a===room.id||d.b===room.id)&&d.edge?.axis===axis&&d.edge.fixed===fixed);
  const holes=relevant.map(d=>{const center=(d.edge.lo+d.edge.hi)/2;return [center-.75,center+.75];});if(axis==='x'&&fixed===entry.z+8&&room.id===entry.roomId)holes.push([entry.x+10-.75,entry.x+10+.75]);holes.sort((a,b)=>a[0]-b[0]);
  const segments=[];let cursor=lo;for(const [a,b] of holes){if(a>cursor)segments.push([cursor,a]);cursor=Math.max(cursor,b);}if(cursor<hi)segments.push([cursor,hi]);
  for(const [a,b] of segments){const key=[axis,fixed,a,b].join(':');if(wallKeys.has(key)||b-a<.02)continue;wallKeys.add(key);const center=(a+b)/2,x=axis==='x'?center-10:fixed-10,z=axis==='z'?center-8:fixed-8;
   const window=(walk||exterior)&&b-a>=2.8&&outside(house,room,axis,fixed,center);
   const wallBox=(from,to,bottom,top)=>{const m=(from+to)/2;return box(group,axis==='x'?to-from:.15,top-bottom,axis==='z'?to-from:.15,axis==='x'?m-10:x,(top+bottom)/2,axis==='z'?m-8:z,wallMaterial);};
   if(window){wallBox(a,center-.76,0,height);wallBox(center+.76,b,0,height);wallBox(center-.76,center+.76,0,1.08);wallBox(center-.76,center+.76,2.22,height);const side=axis==='x'?(fixed===room.y?-1:1):(fixed===room.x?-1:1);windowFrame(group,axis,fixed,center,side);}else wallBox(a,b,0,height);
   box(group,axis==='x'?b-a+.03:.2,.06,axis==='z'?b-a+.03:.2,x,height+.03,z,trim);box(group,axis==='x'?b-a:.17,.15,axis==='z'?b-a:.17,x,.08,z,mat('#cab79a'));walls.push({axis,fixed,lo:a,hi:b});
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
  if(!walk){const roomLabel=label(r.name.toUpperCase(),'#334d42',Math.min(r.w*.78,4.6));roomLabel.position.set(c.x,.15,r.y-8+.6);roomLabel.userData={roomId:r.id};interior.add(roomLabel);}furniture(interior,r,walk);
  if(walk||exterior){const ceiling=box(group,r.w+.025,.13,r.h+.025,c.x,2.865,c.z,mat('#efe5d2'));ceiling.userData={ceiling:true,roomId:r.id};ceilings.push(ceiling);box(group,.065,.15,.065,c.x,2.68,c.z,mat('#735f47'));const lampMaterial=new THREE.MeshStandardMaterial({color:'#f1d69e',emissive:'#f5c47b',emissiveIntensity:.7,roughness:.6});sphere(group,.19,c.x,2.55,c.z,lampMaterial);const lamp=new THREE.PointLight('#ffdcab',10,8,2);lamp.position.set(c.x,2.5,c.z);group.add(lamp);}
  const ideas=house.ideas.filter(i=>i.roomId===r.id),cols=Math.min(3,Math.max(1,Math.ceil(Math.sqrt(ideas.length*r.w/r.h)))),rows=Math.ceil(ideas.length/cols);
  ideas.forEach((idea,index)=>{
   const col=index%cols,row=Math.floor(index/cols),x=r.x-10+(.5+col)/cols*r.w,z=r.y-8+1.4+(.5+row)/Math.max(1,rows)*(r.h-2.15),data={ideaId:idea.id,roomId:r.id};
   const base=box(interior,.65,.46,.65,x,.23,z,mat('#eceae5'),data);objects.push(base);
   let geometry,rotation=null;if(idea.cue==='crystal')geometry=new THREE.OctahedronGeometry(.43);if(idea.cue==='sphere')geometry=new THREE.SphereGeometry(.34,24,16);if(idea.cue==='ring')geometry=new THREE.TorusGeometry(.32,.095,14,40);if(idea.cue==='book'){geometry=new THREE.BoxGeometry(.54,.13,.4);rotation=[.1,0,.13];}
   const object=new THREE.Mesh(geometry,mat(r.color,.3,.18));object.position.set(x,.93,z);if(rotation)object.rotation.set(...rotation);object.castShadow=true;object.userData=data;interior.add(object);objects.push(object);
   const title=label(idea.title,'#1d3744',Math.min(r.w/cols*.93,3.3));title.position.set(x,1.53,z);title.userData=data;interior.add(title);objects.push(title);
  });
 }
 // Approved additions get separate free floor slots. Existing furnishings are
 // soft obstacles; door openings and previously installed additions stay clear.
 const installedBounds=[],baseBounds=[];interior.updateMatrixWorld(true);interior.traverse(o=>{if(o.isMesh){const b=new THREE.Box3().setFromObject(o);if(b.max.y>.1)baseBounds.push(b);}});
 const overlaps=(a,b,padding=0)=>a.min.x<b.max.x+padding&&a.max.x>b.min.x-padding&&a.min.z<b.max.z+padding&&a.max.z>b.min.z-padding;
 for(const feature of house.resident?.roomFeatures||[]){const r=house.rooms.find(room=>room.id===feature.roomId);if(!r)continue;const x=0,z=0,wood=mat('#93714e'),linen=mat('#e4d7be'),accent=mat(r.color);const installed=new THREE.Group();installed.userData={featureId:feature.id,roomId:r.id};interior.add(installed);
  if(feature.type==='reflection_lamp'){cylinder(installed,.23,.05,x,.03,z,wood);cylinder(installed,.035,1.65,x,.87,z,wood);const shade=new THREE.Mesh(new THREE.CylinderGeometry(.18,.38,.32,20),linen);shade.position.set(x,1.7,z);installed.add(shade);sphere(installed,.1,x,1.6,z,new THREE.MeshStandardMaterial({color:'#f1d69e',emissive:'#eab466',emissiveIntensity:1}));const glow=new THREE.PointLight('#ffd49a',3,3,2);glow.position.set(x,1.45,z);installed.add(glow);}
  if(feature.type==='question_board'){box(installed,1.15,1.03,.11,x,1.38,z,wood);box(installed,1.02,.9,.13,x,1.38,z-.015,linen);for(const dx of [-.44,.44])box(installed,.07,.9,.07,x+dx,.45,z,wood);for(let n=0;n<3;n++)box(installed,.2,.16,.02,x-.3+n*.3,1.36,z-.09,accent);}
  if(feature.type==='experiment_table'){box(installed,1.25,.1,.75,x,.73,z,wood);for(const dx of [-.47,.47])for(const dz of [-.23,.23])box(installed,.06,.68,.06,x+dx,.34,z+dz,wood);sphere(installed,.15,x-.3,.94,z,accent);cylinder(installed,.12,.32,x+.25,.94,z,linen);}
  if(feature.type==='discussion_circle'){chair(installed,x-.4,z, r.color);chair(installed,x+.38,z-.65,'#b69b77');cylinder(installed,.36,.44,x-.25,.22,z-.5,wood);}
  const local=new THREE.Box3().setFromObject(installed),size=local.getSize(new THREE.Vector3()),center=local.getCenter(new THREE.Vector3()),left=r.x-10,top=r.y-8;
  const portals=house.doors.filter(d=>d.a===r.id||d.b===r.id).map(d=>sharedEdge(r,house.rooms.find(room=>room.id===(d.a===r.id?d.b:d.a)))).filter(Boolean);
  if(r.id===entry.roomId)portals.push({axis:'x',fixed:entry.z+8,lo:entry.x+10-.75,hi:entry.x+10+.75,entry:true});
  const doorBounds=portals.map(edge=>{const c=(edge.lo+edge.hi)/2;return edge.axis==='x'?{min:{x:c-10-.8,z:edge.fixed-8-.48},max:{x:c-10+.8,z:edge.fixed-8+.48}}:{min:{x:edge.fixed-10-.48,z:c-8-.8},max:{x:edge.fixed-10+.48,z:c-8+.8}};});
  const base=baseBounds.filter(b=>b.max.x>left&&b.min.x<left+r.w&&b.max.z>top&&b.min.z<top+r.h),preferred={question_board:[.18,.24],reflection_lamp:[.83,.8],experiment_table:[.73,.25],discussion_circle:[.3,.7]}[feature.type]||[.5,.5];
  let placement=null;
  for(let attempt=0;attempt<8&&!placement;attempt++){
   const scale=Math.min(1,Math.min(r.w,r.h)/5)*Math.pow(.87,attempt),hw=size.x*scale/2,hd=size.z*scale/2,minX=left+.16+hw,maxX=left+r.w-.16-hw,minZ=top+.16+hd,maxZ=top+r.h-.16-hd;
   const xs=[minX,maxX,THREE.MathUtils.clamp(left+r.w*preferred[0],minX,maxX)],zs=[minZ,maxZ,THREE.MathUtils.clamp(top+r.h*preferred[1],minZ,maxZ)];for(let px=minX;px<=maxX;px+=.28)xs.push(px);for(let pz=minZ;pz<=maxZ;pz+=.28)zs.push(pz);
   let best=null;for(const px of xs)for(const pz of zs){const b={min:{x:px-hw,z:pz-hd},max:{x:px+hw,z:pz+hd}};if(installedBounds.some(other=>overlaps(b,other,.04))||doorBounds.some(door=>overlaps(b,door)))continue;
    const overlapArea=base.reduce((sum,other)=>sum+(overlaps(b,other)?Math.max(0,Math.min(b.max.x,other.max.x)-Math.max(b.min.x,other.min.x))*Math.max(0,Math.min(b.max.z,other.max.z)-Math.max(b.min.z,other.min.z)):0),0),score=overlapArea*100+Math.hypot(px-(left+r.w*preferred[0]),pz-(top+r.h*preferred[1]));
    if(!best||score<best.score)best={px,pz,scale,score,b};
   }placement=best;
  }
  if(placement){installed.scale.set(placement.scale,Math.max(.8,placement.scale),placement.scale);installed.position.set(placement.px-center.x*placement.scale,0,placement.pz-center.z*placement.scale);installedBounds.push(placement.b);installed.userData.anchor={x:placement.px,z:placement.pz};}
  else{interior.remove(installed);}
 }
 architecture(group,house,exterior||walk);return {group,walls,floors,objects,ceilings,entrance:entry};
}

function socratesVisitor(){
 const group=new THREE.Group(),robe=mat('#e6dfc8'),skin=mat('#bb9478'),hair=mat('#d0d0c1'),sandals=mat('#6d5238'),limbs=[];
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.33,.71,18),robe);torso.position.y=.88;torso.castShadow=true;group.add(torso);
 const sash=box(group,.1,.66,.48,.09,1.02,0,mat('#b79662'));sash.rotation.z=-.18;
 for(const direction of [-1,1]){const arm=new THREE.Group();arm.position.set(direction*.245,1.2,0);group.add(arm);cylinder(arm,.085,.42,0,-.2,0,robe);sphere(arm,.071,0,-.43,-.02,skin);limbs.push({part:arm,sign:direction});
  const leg=new THREE.Group();leg.position.set(direction*.13,.57,0);group.add(leg);cylinder(leg,.072,.38,0,-.18,0,skin);box(leg,.17,.07,.29,0,-.41,-.05,sandals);limbs.push({part:leg,sign:-direction});
 }
 const head=new THREE.Group();head.position.y=1.49;group.add(head);sphere(head,.205,0,0,0,skin);const beard=sphere(head,.15,0,-.11,-.11,hair);beard.scale.set(1,1.23,.7);sphere(head,.14,0,.045,.11,hair);for(const side of [-1,1]){sphere(head,.064,side*.178,.024,0,hair);sphere(head,.043,side*.082,.016,-.177,mat('#eee9d7'));sphere(head,.021,side*.082,.012,-.212,mat('#2e352d'));}sphere(head,.047,0,-.016,-.211,skin);
 const halo=new THREE.Mesh(new THREE.RingGeometry(.37,.42,40),new THREE.MeshBasicMaterial({color:'#d4b46c',side:THREE.DoubleSide,transparent:true,opacity:.7}));halo.rotation.x=-Math.PI/2;halo.position.y=.019;group.add(halo);
 const name=label('Socrates','#674e28',1.45);name.position.set(0,1.98,0);if(name.material)name.material.depthTest=true;group.add(name);
 group.traverse(o=>{o.userData={resident:true};});return {group,limbs,head};
}

export function createScene(container,onPick){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#dce6df');scene.fog=new THREE.Fog('#dce6df',46,100);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;container.append(renderer.domElement);
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Explore the house. Use W A S D or arrow keys to walk, drag to look, and press E near Socrates to talk.');canvas.style.outlineOffset='-3px';
 const camera=new THREE.PerspectiveCamera(62,1,.045,150),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.06;controls.minDistance=5;controls.maxDistance=55;controls.enabled=false;
 scene.add(new THREE.HemisphereLight('#edf6ef','#9a8a6b',1.8));const sun=new THREE.DirectionalLight('#ffedcf',3.3);sun.position.set(-14,23,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.normalBias=.035;scene.add(sun);
 box(scene,70,.18,70,0,-.35,0,mat('#b8c7a7'));box(scene,38,.075,36,-1,-.215,0,mat('#c4d0b5'));
 for(const [x,z,size] of [[-14,-10,1.4],[12,-11,1.35],[-15,8,1.4],[13,8,1.4]]){cylinder(scene,.17,2.1,x,.75,z,mat('#786448'));sphere(scene,size,x,2.55,z,mat('#799674'));sphere(scene,size*.7,x+.5,3,z+.3,mat('#91a584'));}
 const stick=createJoystick(document.getElementById('joystick'),document.getElementById('joystick-thumb')),resident=socratesVisitor(),visitor=resident.group;scene.add(visitor);
 let house=null,built=null,walk=true,exterior=false,yaw=0,pitch=0,selected=null,last=0,look=null,firstPersonPosition=null,layout=null;
 let path=[],playerPath=[],targetRoomId=null,residentRoomId=null,residentTalking=false,summoning=false,pause=4,patrolIndex=0,walkingTime=0,visitCallback=null,active=true;
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),held=new Set();ray.camera=camera;
 const dispose=group=>group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});
 function roomAt(){return house?roomAtPoint(house,camera.position.x,camera.position.z):null;}
 function canStand(x,z){return house&&built&&canExploreAt(house,built.walls,x,z);}
 function resetInput(){held.clear();stick.reset();look=null;playerPath=[];}
 function faceDirection(){camera.rotation.set(pitch,yaw,0,'YXZ');}
 function spawnOutside(){if(!house)return;const e=entranceFor(house);camera.position.set(e.x,1.65,e.z+5);yaw=0;pitch=0;faceDirection();firstPersonPosition=camera.position.clone();resetInput();}
 function overview(){if(!house)return;const b=bounds(house),distance=Math.max(14,b.w*.8,b.d*.9);camera.fov=43;camera.updateProjectionMatrix();camera.position.set(b.cx+distance*.88,exterior?distance*.72:distance,b.cz+distance*1.04);controls.target.set(b.cx,exterior?1.3:0,b.cz);controls.update();resetInput();}
 function rebuild(){if(!house)return;if(built){scene.remove(built.group);dispose(built.group);}built=buildHouse(house,walk,exterior);scene.add(built.group);if(!canStand(visitor.position.x,visitor.position.z)){const c=roomCenter(house.rooms.find(r=>r.id===residentRoomId)||house.rooms[0]);visitor.position.copy(c);residentRoomId=roomAtPoint(house,c.x,c.z);path=[];pause=2;}visitor.visible=true;}
 function planVisit(id,target){const next=walkingRoute(house,{x:visitor.position.x,z:visitor.position.z},id,target);if(!next.length)return false;path=next;targetRoomId=id;pause=0;return true;}
 function enterRoom(id){if(!house)return;const r=house.rooms.find(r=>r.id===id)||house.rooms[0];selected=r.id;if(walk){camera.position.copy(roomCenter(r));camera.position.y=1.65;yaw=0;pitch=0;faceDirection();firstPersonPosition=camera.position.clone();}else if(!exterior){const target=roomCenter(r),delta=target.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(target);}resetInput();}
 function setWalk(value){value=Boolean(value);if(value===walk)return;if(walk)firstPersonPosition=camera.position.clone();walk=value;exterior=false;controls.enabled=!walk;resetInput();rebuild();if(walk){camera.fov=62;camera.updateProjectionMatrix();if(firstPersonPosition&&canStand(firstPersonPosition.x,firstPersonPosition.z))camera.position.copy(firstPersonPosition);else spawnOutside();faceDirection();}else overview();}
 function setExterior(value){if(value){if(!walk)setWalk(true);spawnOutside();}else if(walk)setWalk(false);}
 function enterHouse(){if(!house)return false;if(!walk)setWalk(true);const e=entranceFor(house);if(roomAt())return true;playerPath=findWalkingPath(house,built.walls,camera.position,{x:e.x,z:e.z-1});return playerPath.length>0;}
 function lineOfSight(){if(!built)return false;const from=camera.position.clone(),to=visitor.position.clone().add(new THREE.Vector3(0,1.1,0)),delta=to.sub(from),distance=delta.length();ray.set(from,delta.normalize());const hits=ray.intersectObjects(built.group.children,true).filter(h=>h.object.geometry&&!h.object.material?.transparent);return !hits.length||hits[0].distance>distance-.18;}
 function residentState(){const distance=house?Math.hypot(camera.position.x-visitor.position.x,camera.position.z-visitor.position.z):Infinity;return {roomId:residentRoomId,targetRoomId,activity:residentTalking?'talking':path.length&&pause<=0?'walking':'observing',near:Boolean(walk&&distance<=3.2&&lineOfSight()),distance:Number.isFinite(distance)?distance:null,talking:residentTalking,summoning,position:{x:visitor.position.x,z:visitor.position.z}};}
 function talk(){if(residentState().near)onPick({resident:true,roomId:residentRoomId});}
 function summonResident(){if(!house)return false;residentTalking=false;const playerRoom=roomAt(),e=entranceFor(house);if(playerRoom){const r=house.rooms.find(r=>r.id===playerRoom),target={x:THREE.MathUtils.clamp(camera.position.x-Math.sin(yaw)*1.2,r.x-10+.5,r.x+r.w-10-.5),z:THREE.MathUtils.clamp(camera.position.z-Math.cos(yaw)*1.2,r.y-8+.5,r.y+r.h-8-.5)};if(!canStand(target.x,target.z)){target.x=roomCenter(r).x;target.z=roomCenter(r).z;}summoning=planVisit(playerRoom,target);}else{path=findWalkingPath(house,built.walls,visitor.position,{x:camera.position.x-Math.sin(yaw)*1.8,z:camera.position.z-Math.cos(yaw)*1.8});targetRoomId=null;pause=0;summoning=path.length>0;}return summoning;}
 const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});observer.observe(container);
 const keys={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
 canvas.addEventListener('keydown',e=>{if(keys[e.code]){e.preventDefault();held.add(keys[e.code]);}if(e.code==='KeyE'&&!e.repeat){e.preventDefault();talk();}});
 canvas.addEventListener('keyup',e=>{if(keys[e.code]){e.preventDefault();held.delete(keys[e.code]);}});canvas.addEventListener('blur',()=>held.clear());window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(!active)resetInput();});
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus({preventScroll:true});look={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};if(walk)canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId)return;const dx=e.clientX-look.lastX,dy=e.clientY-look.lastY;if(Math.hypot(e.clientX-look.x,e.clientY-look.y)>6)look.moved=true;if(walk){yaw-=dx*.005;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.12,1.12);faceDirection();}look.lastX=e.clientX;look.lastY=e.clientY;});
 canvas.addEventListener('pointerup',e=>{if(!look||look.id!==e.pointerId)return;const click=!look.moved;look=null;if(!click||!built)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects([visitor,built.group],true);for(const hit of hits){const data=hit.object.userData;if(data.resident){if(!walk||residentState().near)onPick({resident:true,roomId:residentRoomId});break;}if(data.ideaId||data.roomId){onPick(data);break;}if(hit.object.geometry&&!hit.object.material?.transparent)break;}});
 canvas.addEventListener('pointercancel',()=>{look=null;});
 function moveResident(dt){if(!house)return;residentRoomId=roomAtPoint(house,visitor.position.x,visitor.position.z);const dx=camera.position.x-visitor.position.x,dz=camera.position.z-visitor.position.z,near=walk&&Math.hypot(dx,dz)<2.25&&lineOfSight();let moved=0;
  if(residentTalking||(near&&!summoning)){visitor.rotation.y=Math.atan2(-dx,-dz);resident.head.rotation.y=0;}
  else if(path.length){if(pause>0)pause-=dt;else{const step=stepAlongPath(visitor.position,path,dt*.9,canStand);moved=step.moved;if(step.heading!==null)visitor.rotation.y=step.heading;if(step.finished){summoning=false;residentRoomId=roomAtPoint(house,visitor.position.x,visitor.position.z);pause=5;targetRoomId=null;if(residentRoomId&&visitCallback)visitCallback({roomId:residentRoomId,position:{x:visitor.position.x,z:visitor.position.z}});}}}
  else{pause-=dt;if(pause<=0){const start=residentRoomId||entranceFor(house).roomId,reachable=reachableIds(house,start),available=house.rooms.filter(r=>reachable.includes(r.id)).map(r=>r.id);patrolIndex=(patrolIndex+1)%available.length;let next=available[patrolIndex];if(next===start&&available.length>1){patrolIndex=(patrolIndex+1)%available.length;next=available[patrolIndex];}if(!planVisit(next)){pause=5;}}}
  if(moved)walkingTime+=dt*6;for(const limb of resident.limbs)limb.part.rotation.x=moved?Math.sin(walkingTime)*.31*limb.sign:limb.part.rotation.x*.82;visitor.position.y=moved?Math.abs(Math.sin(walkingTime))*.017:0;
 }
 function animate(now){const dt=Math.min((now-last)/1000||0,.05);last=now;if(active&&house){let x=stick.state.x+Number(held.has('right'))-Number(held.has('left')),y=stick.state.y+Number(held.has('up'))-Number(held.has('down')),length=Math.max(1,Math.hypot(x,y));x/=length;y/=length;
  if(x||y){playerPath=[];if(walk){const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),delta=forward.multiplyScalar(y*dt*2.7).add(right.multiplyScalar(x*dt*2.7)),nx=camera.position.x+delta.x,nz=camera.position.z+delta.z;if(canStand(nx,camera.position.z))camera.position.x=nx;if(canStand(camera.position.x,nz))camera.position.z=nz;firstPersonPosition=camera.position.clone();}else{const f=controls.target.clone().sub(camera.position);f.y=0;f.normalize();const r=new THREE.Vector3(-f.z,0,f.x),delta=f.multiplyScalar(y*dt*8).add(r.multiplyScalar(x*dt*8));camera.position.add(delta);controls.target.add(delta);}}
  else if(walk&&playerPath.length){const step=stepAlongPath(camera.position,playerPath,dt*2.1,canStand);if(step.heading!==null){const angle=Math.atan2(Math.sin(step.heading-yaw),Math.cos(step.heading-yaw));yaw+=angle*Math.min(1,dt*6);faceDirection();}firstPersonPosition=camera.position.clone();}
  moveResident(dt);
 }if(!walk)controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);}
 requestAnimationFrame(animate);
 return {load(next){const first=!house,newLayout=layoutSignature(next);if(layout&&layout!==newLayout){path=[];targetRoomId=null;pause=2;playerPath=[];}layout=newLayout;house=next;selected=house.rooms.some(r=>r.id===selected)?selected:entranceFor(house).roomId;if(first){const e=entranceFor(house);visitor.position.set(e.x-.4,0,e.z+1.5);residentRoomId=null;path=walkingRoute(house,visitor.position,e.roomId);targetRoomId=e.roomId;pause=4;}rebuild();if(first){if(walk)spawnOutside();else overview();}else if(walk&&!canStand(camera.position.x,camera.position.z))spawnOutside();if(path.some(p=>p.roomId&&!house.rooms.some(r=>r.id===p.roomId))){path=[];pause=2;}},select:enterRoom,setWalk,setExterior,setSocrates(){visitor.visible=true;},setResidentTalking(value){residentTalking=Boolean(value);if(residentTalking)resetInput();},residentState,summonResident,onResidentVisit(callback){visitCallback=typeof callback==='function'?callback:null;},setResidentObserver(callback){visitCallback=typeof callback==='function'?callback:null;},restoreResidentState(state){if(!state?.position||!canStand(state.position.x,state.position.z))return false;visitor.position.set(state.position.x,0,state.position.z);residentRoomId=roomAtPoint(house,visitor.position.x,visitor.position.z);path=[];pause=3;return true;},enterHouse,startOutside(){if(!walk)setWalk(true);spawnOutside();},enterOutside(){if(!walk)setWalk(true);spawnOutside();},reset(){if(walk)spawnOutside();else overview();},get walking(){return walk;},get exterior(){return walk&&!roomAt();},roomAt,playerState(){return {roomId:roomAt(),position:{x:camera.position.x,z:camera.position.z},yaw,pitch,outside:!roomAt(),entering:playerPath.length>0};}};
}
