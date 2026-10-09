import * as THREE from './vendor/three.module.js';
import {sharedEdge} from './model.js';
import {houseBounds,entranceFor,roomAtPoint,reachableIds,walkingRoute,canExploreAt,canOccupy,stepAlongPath,findWalkingPath} from './navigation.js';
import {buildInterior,toggleHomeLight} from './residence-interior-v1.js';
import {ideaDisplays} from './idea-display.js';
import {floorOf,roomBrightness,paintingWork} from './residence-data.js';

const toWorld=(x,y)=>new THREE.Vector3(x-10,0,y-8);
export function roomCenter(r){return toWorld(r.x+r.w/2,r.y+r.h/2);}
export function canStandAt(house,walls,x,z){const gx=x+10,gz=z+8,inside=house.rooms.some(r=>gx>=r.x&&gx<=r.x+r.w&&gz>=r.y&&gz<=r.y+r.h);if(!inside)return false;return !walls.some(w=>{const dist=w.axis==='x'?Math.abs(gz-w.fixed):Math.abs(gx-w.fixed),along=w.axis==='x'?gx:gz;return dist<.2&&along>w.lo-.2&&along<w.hi+.2;});}
const mat=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const surfaceTextures=new Map();
function surface(type,color,repeatX=1,repeatY=1){
 const material=mat(color,type==='wood'?.62:.88);if(typeof document==='undefined')return material;
 const cacheKey=[type,color,repeatX,repeatY].join(':');if(surfaceTextures.has(cacheKey)){material.color.set('#ffffff');material.map=material.bumpMap=surfaceTextures.get(cacheKey);material.bumpScale=type==='clay'?.028:type==='wood'?.008:.007;return material;}
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');let seed=913;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};ctx.fillStyle=color;ctx.fillRect(0,0,512,512);
 if(type==='wood')for(let row=0;row<8;row++){const y=row*64;ctx.fillStyle=`rgba(${120+random()*50},${83+random()*30},${48+random()*25},.24)`;ctx.fillRect(0,y,512,64);for(let n=0;n<28;n++){ctx.beginPath();ctx.strokeStyle=`rgba(73,47,24,${.025+random()*.075})`;ctx.lineWidth=.4+random();let gy=y+random()*62;ctx.moveTo(0,gy);for(let x=0;x<=512;x+=24)ctx.lineTo(x,gy+Math.sin(x*.028+n)*1.7);ctx.stroke();}ctx.strokeStyle='rgba(74,49,29,.38)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();const joint=(row%3)*170+45;ctx.fillStyle='rgba(75,45,22,.35)';ctx.fillRect(joint,y,1,64);}
 else if(type==='clay'||type==='stone'){const rows=type==='clay'?12:4,cols=type==='clay'?10:5,cw=512/cols,ch=512/rows;for(let row=0;row<rows;row++)for(let col=-1;col<=cols;col++){const shade=random()*35,offset=row%2?cw/2:0;ctx.fillStyle=type==='clay'?`rgb(${135+shade},${74+shade*.7},${52+shade*.5})`:`rgb(${156+shade},${151+shade},${139+shade})`;ctx.fillRect(col*cw+offset+1,row*ch+1,cw-2,ch-2);ctx.strokeStyle='rgba(255,243,215,.09)';ctx.strokeRect(col*cw+offset+2,row*ch+2,cw-4,ch-4);}}
 for(let n=0;n<12000;n++){const alpha=type==='plaster'?.025:.05;ctx.fillStyle=random()>.5?`rgba(255,255,255,${alpha})`:`rgba(45,32,21,${alpha})`;ctx.fillRect(random()*512,random()*512,1+random()*2,1+random()*2);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeatX,repeatY);texture.anisotropy=8;texture.userData.retainedSurface=true;surfaceTextures.set(cacheKey,texture);material.color.set('#ffffff');material.map=texture;material.bumpMap=texture;material.bumpScale=type==='clay'?.028:type==='wood'?.008:.007;material.userData.procedural=true;return material;
}
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
function windowFrame(group,axis,fixed,center,side,width=1.52){
 const frame=surface('wood','#c2ab87'),glass=new THREE.MeshStandardMaterial({color:'#c5d9d9',roughness:.07,metalness:.14,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide}),cream=mat('#eee6d7'),shutter=surface('wood','#52664e'),x=axis==='x'?center-10:fixed-10+side*.025,z=axis==='z'?center-8:fixed-8+side*.025;
 const orient=(w,h,d,y,m,offset=0)=>box(group,axis==='x'?w:d,h,axis==='z'?w:d,x+(axis==='x'?offset:0),y,z+(axis==='z'?offset:0),m);
 for(const offset of [-width/2,width/2])orient(.075,1.2,.2,1.65,frame,offset);
 for(const y of [1.08,2.22])orient(width+.09,.09,.2,y,cream);
 const pane=orient(width-.07,1.04,.014,1.65,glass);pane.castShadow=false;pane.receiveShadow=false;pane.userData={window:true};
 orient(.045,1.12,.19,1.65,cream);orient(width,.04,.19,1.65,cream);orient(width+.3,.075,.35,1.015,cream);
 for(const direction of [-1,1]){const sx=x+(axis==='x'?direction*(width/2+.23):0),sz=z+(axis==='z'?direction*(width/2+.23):0);box(group,axis==='x'?.31:.11,1.15,axis==='z'?.31:.11,sx,1.65,sz,shutter);for(let n=0;n<7;n++)box(group,axis==='x'?.29:.13,.014,axis==='z'?.29:.13,sx,1.2+n*.14,sz,mat('#687a5d'));}
 const inside=-side*.17,linen=surface('plaster','#f3ebd9');linen.side=THREE.DoubleSide;
 for(const direction of [-1,1]){const cloth=new THREE.PlaneGeometry(.28,1.3,14,4),positions=cloth.attributes.position;for(let n=0;n<positions.count;n++)positions.setZ(n,Math.sin(positions.getX(n)*94)*.035);cloth.computeVertexNormals();const curtain=new THREE.Mesh(cloth,linen);curtain.position.set(x+(axis==='x'?direction*(width/2-.1):inside),1.65,z+(axis==='z'?direction*(width/2-.1):inside));if(axis==='z')curtain.rotation.y=Math.PI/2;curtain.castShadow=true;curtain.userData={curtain:true};group.add(curtain);}
 beam(group,new THREE.Vector3(x+(axis==='x'?-width/2-.18:inside),2.34,z+(axis==='z'?-width/2-.18:inside)),new THREE.Vector3(x+(axis==='x'?width/2+.18:inside),2.34,z+(axis==='z'?width/2+.18:inside)),.021,mat('#76614a'));
}
function plant(group,x,z,size=.5){const terracotta=mat('#a96548'),leaf=mat('#5e8462');cylinder(group,size*.48,size*.55,x,size*.275,z,terracotta);for(let n=0;n<3;n++){const a=n*2.1;sphere(group,size*.48,x+Math.cos(a)*size*.22,size*.7+Math.abs(Math.sin(a))*size*.25,z+Math.sin(a)*size*.22,leaf);}}
function physicalPlaque(group,text,w,x,y,z){
 box(group,w,.18,.045,x,y,z,mat('#81694e'));if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#e8dfcb';ctx.fillRect(0,0,512,96);ctx.fillStyle='#554832';ctx.font='500 34px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,49,480);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const face=new THREE.Mesh(new THREE.PlaneGeometry(w-.045,.145),new THREE.MeshBasicMaterial({map:texture}));face.position.set(x,y,z+.025);group.add(face);
}
function flowerBed(group,x,z,w,d){const soil=mat('#77654e'),leaf=mat('#617451');box(group,w,.08,d,x,-.09,z,soil);for(let n=0;n<Math.max(4,Math.floor(w*d*5));n++){const fx=x-w/2+.16+(n*.47)%(w-.24),fz=z-d/2+.12+(n*.31)%(d-.18);cylinder(group,.024,.24,fx,.12,fz,leaf);const petals=mat(['#e2cd8d','#d39981','#c0c5ad'][n%3]);for(let p=0;p<4;p++){const a=p*Math.PI/2;sphere(group,.06,fx+Math.cos(a)*.05,.26,fz+Math.sin(a)*.05,petals);}}}
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
function architecture(group,house,enclosed,obstacles=[]){
 const b=bounds(house),e=entranceFor(house),floor=house.residenceFloor||0;
 if(floor===0)box(group,b.w+.22,.2,b.d+.22,b.cx,-.15,b.cz,mat('#bdb09b'));
 let door=null;
 if(floor===0){
  box(group,3.1,.12,1.6,e.x,-.01,e.z+.8,mat('#c6bda8'));for(let n=0;n<12;n++)box(group,1.5,.04,.6,e.x,-.06,e.z+1.9+n*.62,mat('#c6bda8'));
  plant(group,e.x-1.3,e.z+.9,.52);plant(group,e.x+1.3,e.z+.9,.52);obstacles.push({minX:e.x-1.58,maxX:e.x-1.02,minZ:e.z+.62,maxZ:e.z+1.18,label:'Porch planter'},{minX:e.x+1.02,maxX:e.x+1.58,minZ:e.z+.62,maxZ:e.z+1.18,label:'Porch planter'});
  if(enclosed){const leaf=new THREE.Group();leaf.position.set(e.x-.74,0,e.z+.075);group.add(leaf);box(leaf,1.43,2.13,.095,.715,1.065,0,mat('#58614c'));box(leaf,1.08,.37,.028,.715,1.77,.061,mat('#ccd9d5'));sphere(leaf,.05,1.2,1.08,.1,mat('#c4ad74'));leaf.traverse(o=>o.userData={door:true,label:'Front door'});door={leaf,x:e.x,z:e.z+.075,open:false};physicalPlaque(group,'Socrates · House of Ideas',1.9,e.x+1.75,1.5,e.z+.13);}
 }
 if(enclosed){for(const roofRoom of house.residenceRoofRooms||[null]){const rb=roofRoom?bounds({rooms:[roofRoom]}):b;
  if(floor<(house.residenceFloors||1)-1){box(group,rb.w-.08,.12,rb.d-.08,rb.cx,2.985,rb.cz,surface('clay','#a98a6c',rb.w/2,rb.d/2),{roof:true,flatRoof:true});continue;}
  const half=rb.d/2+.28,rise=Math.min(2.7,Math.max(1.15,rb.d*.23)),angle=Math.atan2(rise,half),length=Math.hypot(half,rise),roofY=3.05;
  for(const side of [-1,1]){const roof=box(group,rb.w+.36,.15,length,rb.cx,roofY+rise/2,rb.cz+side*half/2,surface('clay','#ab7151',(rb.w+.36)/2,length/2),{roof:true});roof.rotation.x=side*angle;}
  const shape=new THREE.Shape();shape.moveTo(-rb.d/2,2.85);shape.lineTo(rb.d/2,2.85);shape.lineTo(0,roofY+rise-.08);shape.closePath();for(const x of [rb.minX,rb.maxX]){const gable=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false}),mat('#e4d5ba'));gable.rotation.y=Math.PI/2;gable.position.set(x,0,rb.cz);gable.userData={roof:true};group.add(gable);}}
 }
 return door;
}
function buildFloor(house,walk=false,exterior=false){
 const group=new THREE.Group(),interior=new THREE.Group(),walls=[],floors=[],objects=[],ceilings=[],obstacles=[],interactions=[],entry=entranceFor(house);group.add(interior);interior.visible=!exterior||walk;
 const wallMaterial=surface('plaster','#e9e0cf',3,2),trim=mat('#eee7d9'),skirting=surface('wood','#a8916e'),height=walk||exterior?2.8:.78;
 const edges=house.doors.map(d=>({edge:sharedEdge(house.rooms.find(r=>r.id===d.a),house.rooms.find(r=>r.id===d.b)),...d})),wallKeys=new Set();
 function wall(axis,fixed,lo,hi,room){
  const relevant=edges.filter(d=>(d.a===room.id||d.b===room.id)&&d.edge?.axis===axis&&d.edge.fixed===fixed);
  const holes=relevant.map(d=>{const center=(d.edge.lo+d.edge.hi)/2;return [center-.75,center+.75];});if(!house.residenceFloor&&axis==='x'&&fixed===entry.z+8&&room.id===entry.roomId)holes.push([entry.x+10-.75,entry.x+10+.75]);holes.sort((a,b)=>a[0]-b[0]);
  const segments=[];let cursor=lo;for(const [a,b] of holes){if(a>cursor)segments.push([cursor,a]);cursor=Math.max(cursor,b);}if(cursor<hi)segments.push([cursor,hi]);
  for(const [a,b] of segments){const key=[axis,fixed,a,b].join(':');if(wallKeys.has(key)||b-a<.02)continue;wallKeys.add(key);const center=(a+b)/2,x=axis==='x'?center-10:fixed-10,z=axis==='z'?center-8:fixed-8;
   const paintingWall=(house.residencePaintingPlacements||[]).some(p=>p.axis===axis&&p.fixed===fixed&&p.center>a&&p.center<b),window=!paintingWall&&(walk||exterior)&&b-a>=2.2&&outside(house,room,axis,fixed,center),windowWidth=Math.min(1.6,b-a-1.1);
   const wallBox=(from,to,bottom,top)=>{const m=(from+to)/2;return box(group,axis==='x'?to-from:.15,top-bottom,axis==='z'?to-from:.15,axis==='x'?m-10:x,(top+bottom)/2,axis==='z'?m-8:z,wallMaterial,{roomId:room.id});};
   if(window){const half=windowWidth/2;wallBox(a,center-half,0,height);wallBox(center+half,b,0,height);wallBox(center-half,center+half,0,1.08);wallBox(center-half,center+half,2.22,height);const side=axis==='x'?(fixed===room.y?-1:1):(fixed===room.x?-1:1);windowFrame(group,axis,fixed,center,side,windowWidth);}else wallBox(a,b,0,height);
   box(group,axis==='x'?b-a+.03:.2,.06,axis==='z'?b-a+.03:.2,x,height+.03,z,trim);box(group,axis==='x'?b-a:.17,.11,axis==='z'?b-a:.17,x,.055,z,skirting);walls.push({axis,fixed,lo:a,hi:b});
  }
  for(const [a,b] of holes){const key='door:'+axis+fixed+':'+a;if(wallKeys.has(key))continue;wallKeys.add(key);const c=(a+b)/2,x=axis==='x'?c-10:fixed-10,z=axis==='z'?c-8:fixed-8;
   if(walk||exterior)box(group,axis==='x'?1.5:.18,.65,axis==='z'?1.5:.18,x,2.475,z,wallMaterial);
   box(group,axis==='x'?1.5:.18,.025,axis==='z'?1.5:.18,x,.04,z,mat('#e0b46c'));
   for(const direction of [-1,1])box(group,axis==='x'?.09:.19,Math.min(height,2.15),axis==='z'?.09:.19,x+(axis==='x'?direction*.75:0),Math.min(height,2.15)/2,z+(axis==='z'?direction*.75:0),trim);
  }
 }
 for(const r of house.rooms){
  const c=roomCenter(r),tile=r.id==='work'||r.id==='learning',floor=box(group,r.w-.03,.12,r.h-.03,c.x,-.055,c.z,surface(tile?'stone':'wood',tile?'#c4bcaa':'#b19a73',r.w/(tile?2.2:3),r.h/(tile?2.2:2)),{roomId:r.id});floors.push(floor);
  wall('x',r.y,r.x,r.x+r.w,r);wall('x',r.y+r.h,r.x,r.x+r.w,r);wall('z',r.x,r.y,r.y+r.h,r);wall('z',r.x+r.w,r.y,r.y+r.h,r);
  if(!walk){const roomLabel=label(r.name.toUpperCase(),'#334d42',Math.min(r.w*.78,4.6));roomLabel.position.set(c.x,.15,r.y-8+.6);roomLabel.userData={roomId:r.id};interior.add(roomLabel);}const domestic=buildInterior(house,r,THREE,{walk});domestic.group.userData.roomId=r.id;interior.add(domestic.group);obstacles.push(...domestic.obstacles);interactions.push(...domestic.interactions);
  if(walk||exterior){const ceiling=box(group,r.w+.025,.13,r.h+.025,c.x,2.865,c.z,surface('plaster','#f2eadc',2,2));ceiling.userData={ceiling:true,roomId:r.id};ceilings.push(ceiling);cylinder(group,.22,.065,c.x,2.73,c.z,mat('#766a55'));cylinder(group,.17,.045,c.x,2.69,c.z,new THREE.MeshStandardMaterial({color:'#f3e6c5',emissive:'#ffdfac',emissiveIntensity:.8,roughness:.5}));const lamp=new THREE.PointLight('#ffe1b5',5.5,8,2);lamp.position.set(c.x,2.58,c.z);lamp.userData={roomId:r.id,roomLight:true};group.add(lamp);}
  const display=ideaDisplays(house,r);for(const cabinet of display.cabinets){const rack=new THREE.Group();rack.position.set(cabinet.x,0,cabinet.z);rack.rotation.y=cabinet.yaw;interior.add(rack);const wood=surface('wood','#9c7d57');box(rack,cabinet.width,2.2,.035,0,1.15,-cabinet.depth/2,wood);for(const dx of [-cabinet.width/2,cabinet.width/2])box(rack,.025,2.24,cabinet.depth,dx,1.14,0,wood);for(const y of [.1,.55,1.17,1.79,2.24])box(rack,cabinet.width,.035,cabinet.depth,0,y,0,wood);obstacles.push({...cabinet,roomId:r.id,label:'Idea display cabinet'});}
  display.slots.forEach(slot=>{
   const {idea,x,z,y,scale}=slot,data={ideaId:idea.id,roomId:r.id};
   const base=slot.pedestal?box(interior,.65,.46,.65,x,.23,z,surface('wood','#b1a080'),data):box(interior,.4,.025,.32,x,slot.shelf+.027,z,mat('#bda785'),data);objects.push(base);if(slot.pedestal)obstacles.push({minX:x-.33,maxX:x+.33,minZ:z-.33,maxZ:z+.33,roomId:r.id,label:idea.title});
   let geometry,rotation=null;if(idea.cue==='crystal')geometry=new THREE.OctahedronGeometry(.43);if(idea.cue==='sphere')geometry=new THREE.SphereGeometry(.34,24,16);if(idea.cue==='ring')geometry=new THREE.TorusGeometry(.32,.095,14,40);if(idea.cue==='book'){geometry=new THREE.BoxGeometry(.54,.13,.4);rotation=[.1,0,.13];}
   const object=new THREE.Mesh(geometry,idea.cue==='book'?mat('#e4dbc5'):mat(r.color,.28,.2));object.position.set(x,y,z);object.scale.setScalar(scale);if(rotation)object.rotation.set(...rotation);object.castShadow=true;object.userData=data;interior.add(object);objects.push(object);
   if(idea.cue==='book'){for(const direction of [-1,1])box(object,.575,.017,.43,0,direction*.078,0,mat(r.color));box(object,.028,.17,.43,-.276,0,0,mat(r.color));for(let n=0;n<4;n++)box(object,.49,.003,.007,.015,-.035+n*.023,.203,mat('#bdb397'));for(let n=0;n<3;n++)box(object,.27-n*.03,.003,.012,.04,.09,-.075+n*.055,mat('#cab886'));}
   if(idea.cue==='sphere'){for(const tilt of [0,Math.PI/2]){const band=new THREE.Mesh(new THREE.TorusGeometry(.343,.01,6,36),mat('#b6a47c',.35,.5));band.rotation.x=tilt;object.add(band);}}
   object.traverse(part=>{part.userData=data;});const title=label(idea.title,'#1d3744',display.dense?.85:Math.min(r.w/3*.93,3.3));title.position.set(x,y+.6*scale,z);title.userData=data;title.visible=!walk;interior.add(title);objects.push(title);
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
  for(const area of house.residenceKeepouts||[])if(area.roomId===r.id)doorBounds.push({min:{x:area.minX-.2,z:area.minZ-.2},max:{x:area.maxX+.7,z:area.maxZ+.2}});
  for(const action of interactions){const data=action.userData||action;if(data.roomId===r.id&&data.anchor)doorBounds.push({min:{x:data.anchor.x-.34,z:data.anchor.z-.34},max:{x:data.anchor.x+.34,z:data.anchor.z+.34}});}
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
  if(placement){installed.scale.set(placement.scale,Math.max(.8,placement.scale),placement.scale);installed.position.set(placement.px-center.x*placement.scale,0,placement.pz-center.z*placement.scale);installedBounds.push(placement.b);installed.userData.anchor={x:placement.px,z:placement.pz};obstacles.push({minX:placement.b.min.x,maxX:placement.b.max.x,minZ:placement.b.min.z,maxZ:placement.b.max.z,roomId:r.id,label:feature.type});}
  else{interior.remove(installed);}
 }
 const frontDoor=architecture(group,house,exterior||walk,obstacles);return {group,walls,floors,objects,ceilings,obstacles,interactions,frontDoor,entrance:entry};
}

export const FLOOR_HEIGHT=3.4;
export function floorHouse(house,level=0){const rooms=house.rooms.filter(r=>floorOf(r)===level),ids=new Set(rooms.map(r=>r.id));return {...house,rooms,doors:house.doors.filter(d=>ids.has(d.a)&&ids.has(d.b)),ideas:house.ideas.filter(i=>ids.has(i.roomId)),resident:house.resident?{...house.resident,roomFeatures:(house.resident.roomFeatures||[]).filter(f=>ids.has(f.roomId))}:undefined,residenceFloor:level,residenceFloors:house.residence?.floors||1};}
export function stairLanding(house,stairs,level){
 const a=house.rooms.find(r=>r.id===stairs.a),b=house.rooms.find(r=>r.id===stairs.b);if(!a||!b||![floorOf(a),floorOf(b)].includes(level))return null;
 const left=Math.max(a.x,b.x)-10,right=Math.min(a.x+a.w,b.x+b.w)-10,top=Math.max(a.y,b.y)-8,bottom=Math.min(a.y+a.h,b.y+b.h)-8,x=(left+right)/2,z=(top+bottom)/2;
 return {x:x+.5,z,centerX:x,centerZ:z,floor:level,roomId:floorOf(a)===level?a.id:b.id,toFloor:floorOf(a)===level?floorOf(b):floorOf(a),stairsId:stairs.id};
}
function cutSlab(mesh,room,cuts){
 if(!cuts.length)return;const width=room.w-.025,depth=room.h-.025,thickness=.13,cx=room.x+room.w/2-10,cz=room.y+room.h/2-8,shape=new THREE.Shape();shape.moveTo(-width/2,-depth/2);shape.lineTo(width/2,-depth/2);shape.lineTo(width/2,depth/2);shape.lineTo(-width/2,depth/2);shape.closePath();
 for(const cut of cuts){const x=cut.centerX-.4-cx,z=-(cut.centerZ-cz),w=.78,d=1.78;if(Math.abs(x)+w/2>=width/2||Math.abs(z)+d/2>=depth/2)continue;const hole=new THREE.Path();hole.moveTo(x-w/2,z-d/2);hole.lineTo(x-w/2,z+d/2);hole.lineTo(x+w/2,z+d/2);hole.lineTo(x+w/2,z-d/2);hole.closePath();shape.holes.push(hole);}
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.translate(0,-thickness/2,0);mesh.geometry.dispose();mesh.geometry=geometry;mesh.userData.stairwell=true;
}
function roomOfNode(node){for(let n=node;n;n=n.parent)if(n.userData.roomId)return n.userData.roomId;return null;}
function applyBrightness(built,house){
 const copies=new Map();built.group.traverse(node=>{const room=house.rooms.find(r=>r.id===roomOfNode(node));if(!room)return;const fraction=roomBrightness(room)/100;node.userData.brightness=roomBrightness(room);
 if(node.isPointLight){node.intensity*=fraction*1.3;node.userData.configuredIntensity=node.intensity;return;}if(!node.material)return;const single=Array.isArray(node.material)?node.material:[node.material],next=single.map(material=>{const key=room.id+':'+material.uuid;if(!copies.has(key)){const copy=material.clone();copy.color?.multiplyScalar(.2+fraction*.8);if(copy.emissiveIntensity){copy.emissiveIntensity*=fraction;node.userData.configuredEmissive=copy.emissiveIntensity;}copies.set(key,copy);}return copies.get(key);});node.material=Array.isArray(node.material)?next:next[0];
 });
}
export function paintingPlacements(house,room){
 const entry=entranceFor(house),edges=[{axis:'z',fixed:room.x+room.w,lo:room.y,hi:room.y+room.h,side:-1},{axis:'x',fixed:room.y,lo:room.x,hi:room.x+room.w,side:1},{axis:'z',fixed:room.x,lo:room.y,hi:room.y+room.h,side:1},{axis:'x',fixed:room.y+room.h,lo:room.x,hi:room.x+room.w,side:-1}],result=[];let workIndex=0;
 for(const wall of edges){
  const holes=house.doors.filter(d=>d.a===room.id||d.b===room.id).map(d=>sharedEdge(room,house.rooms.find(r=>r.id===(d.a===room.id?d.b:d.a)))).filter(edge=>edge?.axis===wall.axis&&edge.fixed===wall.fixed).map(edge=>{const center=(edge.lo+edge.hi)/2;return [center-.75,center+.75];});if(!house.residenceFloor&&wall.axis==='x'&&wall.fixed===entry.z+8&&room.id===entry.roomId)holes.push([entry.x+10-.75,entry.x+10+.75]);holes.sort((a,b)=>a[0]-b[0]);
  const spans=[];let cursor=wall.lo;for(const [a,b] of holes){if(a>cursor)spans.push([cursor,a]);cursor=Math.max(cursor,b);}if(cursor<wall.hi)spans.push([cursor,wall.hi]);
  for(const [lo,hi]of spans){const available=Math.max(0,Math.floor((hi-lo-.18)/1.15)),count=Math.min(available,(room.paintings||[]).length-workIndex);for(let n=0;n<count;n++)result.push({...wall,lo,hi,roomId:room.id,workId:room.paintings[workIndex++],center:lo+(n+.5)*(hi-lo)/count});if(workIndex===(room.paintings||[]).length)return result;}
 }
 return result;
}
function painting(group,room,placement){
 const {workId,axis,fixed,center,side}=placement,work=paintingWork(workId);if(!work)return null;const data={homeAction:'painting',workId,roomId:room.id,label:'Inspect “'+work.title+'”',paintingWall:{axis,fixed,center,lo:placement.lo,hi:placement.hi}},x=axis==='z'?fixed-10+side*.115:center-10,z=axis==='x'?fixed-8+side*.115:center-8,root=new THREE.Group();root.position.set(x,1.72,z);root.rotation.y=axis==='z'?side*Math.PI/2:side>0?0:Math.PI;root.userData=data;group.add(root);
 box(root,1.04,.98,.075,0,0,0,mat('#806144'),data);box(root,.91,.85,.04,0,0,.044,mat('#f6eee1'),data);const face=new THREE.Mesh(new THREE.PlaneGeometry(.81,.75),new THREE.MeshBasicMaterial({color:'#c3c0a2',toneMapped:false}));face.position.z=.07;face.userData=data;root.add(face);
 if(typeof document!=='undefined'){const texture=new THREE.TextureLoader().load(work.imageUrl);texture.colorSpace=THREE.SRGBColorSpace;face.material.map=texture;face.material.color.set('#ffffff');}
 return data;
}
export function buildHouse(house,walk=false,exterior=false){
 const group=new THREE.Group(),levels=[],objects=[],floors=[],ceilings=[],interactions=[],stairGroups=[];const count=house.residence?.floors||1;
 for(let level=0;level<count;level++){
  const projected=floorHouse(house,level);if(!projected.rooms.length)continue;const landings=(house.stairs||[]).map(s=>stairLanding(house,s,level)).filter(Boolean);projected.residenceRoofRooms=projected.rooms.filter(room=>!house.rooms.some(upper=>floorOf(upper)>level&&upper.x<room.x+room.w&&upper.x+upper.w>room.x&&upper.y<room.y+room.h&&upper.y+upper.h>room.y));projected.residenceKeepouts=landings.map(p=>({roomId:p.roomId,minX:p.centerX-.8,maxX:p.centerX,minZ:p.centerZ-.9,maxZ:p.centerZ+.9}));projected.residencePaintingPlacements=projected.rooms.flatMap(room=>paintingPlacements(projected,room));for(const p of projected.residencePaintingPlacements){const along=p.center-(p.axis==='z'?8:10),fixed=p.fixed-(p.axis==='z'?10:8);projected.residenceKeepouts.push(p.axis==='z'?{roomId:p.roomId,minX:Math.min(fixed,fixed+p.side*.55),maxX:Math.max(fixed,fixed+p.side*.55),minZ:along-.6,maxZ:along+.6}:{roomId:p.roomId,minX:along-.6,maxX:along+.6,minZ:Math.min(fixed,fixed+p.side*.55),maxZ:Math.max(fixed,fixed+p.side*.55)});}const built=buildFloor(projected,walk,exterior);built.group.position.y=level*FLOOR_HEIGHT;built.group.userData.floor=level;group.add(built.group);if(level>0){const masonry=mat('#e9e0cf');for(const room of projected.rooms){const c=roomCenter(room);for(const side of [-1,1]){box(built.group,room.w+.14,.6,.18,c.x,-.285,c.z+side*room.h/2,masonry,{floor:level,structural:true});box(built.group,.18,.6,room.h+.14,c.x+side*room.w/2,-.285,c.z,masonry,{floor:level,structural:true});}}}
  for(const mesh of [...built.floors,...built.ceilings]){const room=projected.rooms.find(r=>r.id===mesh.userData.roomId),cuts=landings.filter(c=>c.roomId===room?.id&&(mesh.userData.ceiling?c.toFloor>level:c.toFloor<level)).filter((c,index,all)=>all.findIndex(other=>other.centerX===c.centerX&&other.centerZ===c.centerZ)===index);if(room)cutSlab(mesh,room,cuts);}
  built.group.traverse(node=>{if(node.userData.roof&&!walk&&!exterior)node.visible=false;});
  for(const placement of projected.residencePaintingPlacements){const room=projected.rooms.find(r=>r.id===placement.roomId),data=painting(built.group,room,placement);if(data)built.interactions.push(data);}
  built.group.traverse(node=>{if(node.userData.homeAction){node.userData.floor=level;if(Number.isFinite(node.userData.height))node.userData.height+=level*FLOOR_HEIGHT;}});applyBrightness(built,projected);for(const item of built.interactions){item.floor=level;if(item.height!==undefined)item.height+=level*FLOOR_HEIGHT;}
  built.obstacles=built.obstacles.map(o=>({...o,floor:level}));built.walls=built.walls.map(w=>({...w,floor:level}));levels[level]={...built,house:projected};objects.push(...built.objects);floors.push(...built.floors);ceilings.push(...built.ceilings);interactions.push(...built.interactions);
 }
 for(const stairs of house.stairs||[]){const a=house.rooms.find(r=>r.id===stairs.a),b=house.rooms.find(r=>r.id===stairs.b);if(!a||!b)continue;const low=Math.min(floorOf(a),floorOf(b)),high=low+1,landing=stairLanding(house,stairs,low),root=new THREE.Group();root.position.y=low*FLOOR_HEIGHT;group.add(root);stairGroups.push({group:root,low,high});
  const stone=mat('#c5b699'),rail=mat('#6f5a42'),sx=landing.centerX-.4,sz=landing.centerZ;for(let n=0;n<14;n++){const h=(n+1)*FLOOR_HEIGHT/14;box(root,.74,.16,.135,sx,h-.08,sz+.84-n*.127,stone,{stairsId:stairs.id,stairStep:true});}
  beam(root,new THREE.Vector3(sx-.38,.85,sz+.84),new THREE.Vector3(sx-.38,FLOOR_HEIGHT+.85,sz-.81),.027,rail);
  for(const level of [low,high]){const toFloor=level===low?high:low,mark=label(level===low?'UPSTAIRS ↑':'DOWNSTAIRS ↓','#263d34',1.05);mark.position.set(landing.centerX+.46,(level-low)*FLOOR_HEIGHT+1.17,sz+(level===low?.75:-.75)+.075);root.add(mark);const data={homeAction:'stairs',stairsId:stairs.id,fromFloor:level,toFloor,roomId:stairLanding(house,stairs,level).roomId,label:toFloor>level?'Go upstairs · floor '+(toFloor+1):'Go downstairs · floor '+(toFloor+1)},panel=box(root,.57,.32,.12,landing.centerX+.46,(level-low)*FLOOR_HEIGHT+1.15,sz+(level===low?.75:-.75),mat('#bcc49c'),data);mark.userData=data;levels[level].interactions.push(data);interactions.push(data);levels[level].obstacles.push({floor:level,roomId:data.roomId,minX:sx-.4,maxX:sx+.4,minZ:sz-.9,maxZ:sz+.9,label:'Staircase'});objects.push(panel);}
 }
 let currentFloor=0;function setFloor(level){if(!levels[level])return false;currentFloor=level;for(const [id,built]of levels.entries())if(built)built.group.visible=walk||exterior||id===level;for(const stair of stairGroups)stair.group.visible=walk||exterior||stair.low===level||stair.high===level;return true;}setFloor(0);
 return {group,levels,objects,floors,ceilings,interactions,toggleLight:id=>toggleHomeLight(group,id),frontDoor:levels[0]?.frontDoor||null,entrance:levels[0]?.entrance,setFloor,get floor(){return currentFloor;},get walls(){return levels[currentFloor]?.walls||[];},get obstacles(){return levels[currentFloor]?.obstacles||[];},get navigationHouse(){return levels[currentFloor]?.house||house;},roomInventory(id){return interactions.filter(item=>item.roomId===id);}};
}
