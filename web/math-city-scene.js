// A new mathematics district. This renderer owns its geometry; saved personal
// houses and artist houses continue using their existing, versioned renderers.
import {MATH_BUILDING,MATH_FLOORS,MATH_CONCEPTS} from './math-city-data.js';

export function buildMathCity(THREE,{network,floor=0}={}) {
 if(!THREE?.Group)throw Error('Build Mathematics City with the Three.js geometry API.');
 if(!Number.isInteger(floor)||floor<0||floor>=MATH_BUILDING.floors)throw Error('Choose a mathematics floor from 0 to 7.');
 const group=new THREE.Group();group.name='Mathematics City';
 const height=floor*MATH_BUILDING.floorHeight,materials=new Map(),geometries=new Map(),textures=new Set(),instances=new Map(),colliders=[],approaches=[],seats=[];let disposed=false;
 const bounds=floor===0?{minX:-25,maxX:25,minZ:-18,maxZ:36}:{minX:-12,maxX:12,minZ:-10,maxZ:8};
 const floorInfo=MATH_FLOORS.find(item=>item.index===floor),floorTone=['#b39459','#718fa0','#85996f','#907aa0','#739c97','#ad8168','#7997b0','#a29063'][floor];
 const material=(tone,basic=false)=>{const key=(basic?'basic:':'standard:')+tone;if(!materials.has(key))materials.set(key,basic?new THREE.MeshBasicMaterial({color:tone,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:tone,roughness:.8}));return materials.get(key);};
 const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
 const box=(w,h,d,x,y,z,tone,data)=>{const node=new THREE.Mesh(geometry(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),material(tone));node.position.set(x,y,z);if(data)node.userData={...data};group.add(node);return node;};
 const cylinder=(r,h,x,y,z,tone)=>{const node=new THREE.Mesh(geometry(`cylinder:${r}:${h}`,()=>new THREE.CylinderGeometry(r,r,h,24)),material(tone));node.position.set(x,y,z);group.add(node);return node;};
 const instanceBox=(w,h,d,x,y,z,tone)=>{if(!instances.has(tone))instances.set(tone,[]);instances.get(tone).push(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d)));};
 const collision=(x,z,w,d,label)=>colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,label,floor});
 function plaque(title,w,h,x,y,z,rotation=0,data={},tone='#263f48'){
  const node=new THREE.Mesh(geometry('plaque',()=>new THREE.PlaneGeometry(1,1)),material(tone,true));node.scale.set(w,h,1);node.position.set(x,y,z);node.rotation.y=rotation;node.userData={label:title,...data};group.add(node);
  if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=tone;ctx.fillRect(0,0,1024,256);ctx.fillStyle='#fff4dc';ctx.font='600 54px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(title).slice(0,65),512,128,970);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.set('plaque:'+materials.size,mat);node.material=mat;}}
  return node;
 }
 function action(node,data,stand,target){
  const yaw=Math.atan2(stand.x-target.x,stand.z-target.z),anchor={x:stand.x,y:height,z:stand.z,yaw},lookAt={x:target.x,y:height+target.y,z:target.z},metadata={...data,mathFloor:floor,anchor,lookAt};
  node.userData={...node.userData,...metadata};approaches.push({...metadata,x:anchor.x,z:anchor.z,yaw});return node;
 }
 function panel(title,w,h,x,y,z,stand,data,rotation=0){const node=plaque(title,w,h,x,height+y,z,rotation);return action(node,{label:title,...data},stand,{x,y,z});}
 function glass(w,h,x,y,z,rotation=0){const node=new THREE.Mesh(geometry('glass',()=>new THREE.PlaneGeometry(1,1)),material('#abc7ca'));node.position.set(x,y,z);node.rotation.y=rotation;node.scale.set(w,h,1);node.material.transparent=true;node.material.opacity=.27;node.material.side=THREE.DoubleSide;node.userData.window=true;group.add(node);return node;}

 // The full exterior remains visible on every visit. Repeated facade parts are
 // instanced; only the selected floor receives furniture and interaction data.
 box(50,.12,54,0,-.1,9,'#aab59a');box(30,.035,27,0,-.025,22,'#d4c8af');
 for(let index=0;index<MATH_BUILDING.floors;index++){
  const y=index*MATH_BUILDING.floorHeight,tone=index%2?'#e8e2d3':'#f0e9d8';
  const slab=box(24,.22,18,0,y-.11,-1,'#c9c0ad');slab.name='Mathematics floor '+index;slab.userData={mathLevel:index,floorSurface:true};
  for(const z of [-10,8]){
   for(const x of [-12,-7,-2,2,7,12])instanceBox(.36,3.75,.35,x,y+1.875,z,'#7e8b83');
   for(const x of [-9.5,-4.5,4.5,9.5]){instanceBox(4.64,1,.25,x,y+.5,z,tone);instanceBox(4.64,.85,.25,x,y+3.225,z,tone);glass(4.48,1.95,x,y+1.94,z+(z>0?.02:-.02));instanceBox(.075,2,.08,x,y+1.97,z+(z>0?.04:-.04),'#8c9f96');}
   if(index>0||z<0){instanceBox(3.64,1,.25,0,y+.5,z,tone);instanceBox(3.64,.85,.25,0,y+3.225,z,tone);glass(3.48,1.95,0,y+1.94,z+(z>0?.02:-.02));}
   else instanceBox(3.64,1,.25,0,y+3.2,z,tone);
   instanceBox(24.45,.25,.58,0,y+3.8,z,'#596e70');
  }
  for(const x of [-12,12]){
   for(const z of [-10,-6,-2,2,6,8])instanceBox(.35,3.75,.36,x,y+1.875,z,'#7e8b83');
   for(const z of [-8,-4,0,4]){instanceBox(.25,1,3.64,x,y+.5,z,tone);instanceBox(.25,.85,3.64,x,y+3.225,z,tone);glass(3.48,1.95,x+(x>0?.02:-.02),y+1.94,z,Math.PI/2);}
   instanceBox(.28,3.7,1.65,x,y+1.85,7,'#e8e2d3');instanceBox(.58,.25,18.45,x,y+3.8,-1,'#596e70');
  }
  plaque(`${index+1} · ${MATH_FLOORS.find(item=>item.index===index)?.name||'Mathematics'}`,7,.48,0,y+3.43,8.32,0,{},'#395f63');
 }
 const roofGeometry=geometry('pitched-roof',()=>{const p=[[-12.9,32,-10.9],[12.9,32,-10.9],[12.9,32,8.9],[-12.9,32,8.9],[0,36,-10.9],[0,36,8.9]],faces=[[4,1,0],[5,2,1],[4,5,1],[5,3,2],[4,0,3],[5,4,3],[2,3,0],[1,2,0]],result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(faces.flatMap(face=>face.flatMap(i=>p[i])),3));result.computeVertexNormals();return result;});
 const roof=new THREE.Mesh(roofGeometry,material('#425f68'));roof.name='Mathematics building roof';roof.userData.roof=true;group.add(roof);
 const roofCeiling=box(25.8,.24,19.8,0,31.95,-1,'#425f68');roofCeiling.name='Mathematics roof ceiling';roofCeiling.userData.roof=true;
 for(const x of [-2.22,2.22]){box(.38,3.15,.7,x,1.575,8.35,'#b59b69');if(floor===0)collision(x,8.35,.38,.7,'Entrance column');}box(5.4,.27,2.1,0,3.15,8.45,'#9b8f70');
 plaque('THE MATHEMATICS ATLAS',5.3,.58,0,2.74,9.52);plaque('Eight floors of ideas · Enter here',4.9,.4,0,2.27,9.52);
 box(3.95,.028,6.7,0,.006,11.25,'#e8d8b8');
 const plazaSculpture=new THREE.Mesh(geometry('plaza-torus',()=>new THREE.TorusGeometry(1.18,.13,12,40)),material('#b6995c'));plazaSculpture.position.set(-8,2.1,16);plazaSculpture.rotation.x=.65;group.add(plazaSculpture);cylinder(.85,.55,-8,.275,16,'#717d74');
 const polyhedron=new THREE.Mesh(geometry('plaza-polyhedron',()=>new THREE.IcosahedronGeometry(1.15,0)),material('#7597a0'));polyhedron.position.set(8,2,16);group.add(polyhedron);cylinder(.85,.55,8,.275,16,'#717d74');
 if(floor===0){collision(-8,16,2.6,2.6,'Torus sculpture');collision(8,16,2.6,2.6,'Geometric sculpture');}

 // Collision and meaningful interior are scoped to the selected physical level.
 collision(0,-10,24,.3,'Back facade');for(const x of [-12,12])collision(x,-1,.3,18,'Side facade');
 if(floor===0){for(const x of [-7,7])collision(x,8,10,.3,'Front facade');}else collision(0,8,24,.3,'Front facade');
 for(const x of [-3,3])for(const part of [{z:-6,d:8},{z:5,d:6}]){box(.16,3.48,part.d,x,height+1.74,part.z,'#e5dfcc');collision(x,part.z,.16,part.d,'Room partition');}
 for(const x of [-3,3]){plaque(x<0?'Library & thinking rooms':'Exploration laboratory',3,.36,x+(x<0?-.08:.08),height+2.65,0,x<0?Math.PI/2:-Math.PI/2,{},'#536e68');}
 box(5.7,.028,16,0,height+.014,-1,'#b6a486');box(4,.025,2.2,0,height+.028,5,'#bfad8a');
 const floorLandings=MATH_FLOORS.map(item=>({floor:item.index,index:item.index,id:item.id,name:item.name,x:9.6,y:item.index*MATH_BUILDING.floorHeight,z:5,yaw:-Math.PI/2}));
 box(4.35,.024,4.2,9.5,height+.012,5,'#b9c8bf');
 box(.24,3.35,3.4,11.65,height+1.675,5,'#425f65');collision(11.65,5,.24,3.4,'Lift controls');
 plaque('LIFT · Choose a floor',2.9,.37,11.51,height+2.95,5,-Math.PI/2);
 let button=0;for(const destination of MATH_FLOORS){if(destination.index===floor)continue;const z=4.16+(button%2)*1.7,y=.68+Math.floor(button/2)*.54;panel(`${destination.index+1} · ${destination.name}`,1.54,.43,11.5,y,z,{x:9.6,z:5},{mathAction:'floor',targetFloor:destination.index},-Math.PI/2);button++;}
 plaque('Explicit floor transfers · E / select',3.1,.24,11.49,height+.3,5,-Math.PI/2);
 // A labelled stair landing complements the lift. These steps are an honest
 // landmark, not a claim that continuous stair climbing has been implemented.
 for(let step=0;step<5;step++)box(1.7,.18+step*.17,.44,5.7,height+(.18+step*.17)/2,6.2-step*.43,'#a19a83');collision(5.7,5.34,1.7,2.45,'Stair landmark');
 for(const x of [4.72,6.68])box(.055,1.3,2.45,x,height+1.05,5.34,'#6a8177');
 if(floor>0)panel('Stair landing · level '+floor,2.05,.44,5.7,1.53,7.18,{x:5.7,z:7.4},{mathAction:'floor',targetFloor:floor-1});
 if(floor<MATH_BUILDING.floors-1)panel('Stair landing · level '+(floor+2),2.05,.44,5.7,2.1,7.18,{x:5.7,z:7.4},{mathAction:'floor',targetFloor:floor+1});

 const atlasFrame=box(5.6,2.65,.17,0,height+1.78,-9.61,'#29454e');atlasFrame.userData={mathFloor:floor};
 const atlas=panel('ATLAS OF IDEAS',5.27,1.58,0,1.99,-9.508,{x:0,z:-7.4},{mathAction:'atlas',floorIndex:floor});
 // The wall terminal previews the local floor's real topics. Opening it uses
 // the full accessible Atlas reader supplied by the application coordinator.
 if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#193d46';ctx.fillRect(0,0,1536,768);ctx.fillStyle='#e9cf8b';ctx.font='600 72px Georgia';ctx.fillText('ATLAS OF IDEAS',85,116);ctx.fillStyle='#cfddd4';ctx.font='38px Georgia';ctx.fillText(`${floor+1} / 8 · ${floorInfo?.name||'Mathematics'}`,85,182);const topics=MATH_CONCEPTS.filter(item=>item.floor===floor).slice(0,3);for(let i=0;i<topics.length;i++){const x=95+i*478;ctx.fillStyle='#40676d';ctx.fillRect(x,310,430,224);ctx.fillStyle='#f3e7c8';ctx.font='600 34px Georgia';const words=topics[i].title.split(' ');let line='',row=0;for(const word of words){if((line+' '+word).length>23){ctx.fillText(line,x+26,373+row*47);line=word;row++;}else line+=(line?' ':'')+word;}ctx.fillText(line,x+26,373+row*47);ctx.fillStyle='#abc4b5';ctx.font='29px Georgia';ctx.fillText('Question · Explore · Try',x+26,496);}ctx.fillStyle='#e9cf8b';ctx.font='36px Georgia';ctx.fillText('Select this monitor to explore the miniature Atlas',85,657);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.set('atlas-screen',mat);atlas.material=mat;}}
 panel(`Explore ${floorInfo?.name||'mathematics'}`,5.15,.47,0,.97,-9.507,{x:0,z:-7.4},{mathAction:'atlas',floorIndex:floor});
 plaque('Select the screen to open the miniature atlas',5.2,.32,0,height+3.32,-9.49);
 for(let node=0;node<5;node++){const x=-1.8+node*.9,y=.09+(node%2)*.1;instanceBox(.3,.025,.19,x,height+.875+y,-9.32,['#a2b9a9','#bba578','#889eac'][node%3]);}
 atlas.userData.screen=true;
 plaque(`${floor+1} / 8 · ${floorInfo?.name||'Mathematics'}`,5.3,.47,0,height+3.25,2.04);

 function table(x,z,w,d){box(w,.12,d,x,height+.85,z,'#ac8d61');for(const dx of [-w/2+.13,w/2-.13])for(const dz of [-d/2+.13,d/2-.13])instanceBox(.09,.79,.09,x+dx,height+.395,z+dz,'#796a52');collision(x,z,w,d,'Mathematics table');}
 function chair(x,z){box(.7,.13,.7,x,height+.47,z,'#879d92');box(.68,.65,.1,x,height+.83,z-.3,'#879d92');for(const dx of [-.27,.27])for(const dz of [-.27,.27])instanceBox(.07,.42,.07,x+dx,height+.21,z+dz,'#76674f');collision(x,z,.72,.75,'Reading chair');seats.push({x,z,height:height+1.12,stand:{x,z:z+1.1}});}
 for(const x of [-10.1,-7.2]){box(2.25,2.55,.09,x,height+1.275,-9.51,'#715f47');for(const y of [.2,.9,1.65,2.4])instanceBox(2.25,.06,.47,x,height+y,-9.32,'#ae9468');for(const dx of [-1.08,1.08])instanceBox(.08,2.55,.47,x+dx,height+1.275,-9.32,'#ae9468');for(let shelf=0;shelf<3;shelf++)for(let book=0;book<7;book++)instanceBox(.17,.4+(book%3)*.055,.29,x-.87+book*.28,height+.45+shelf*.73,-9.25,['#7b9790','#af8d72','#8c91a8'][book%3]);collision(x,-9.29,2.25,.55,'Library shelves');}
 table(-7.8,3.9,2.5,1.3);chair(-9.8,4);chair(-5.8,4);plaque('READ · QUESTION · TRY · RETURN',5.9,.37,-7.6,height+2.8,-9.47);
 table(8,-4.2,2.7,1.5);box(.8,.045,.65,-7.8,height+.945,3.9,'#e2d7bd');box(.05,.05,.7,-7.8,height+.95,3.9,'#8d7457');
 const concepts=MATH_CONCEPTS.filter(item=>item.floor===floor).slice(0,3);
 if(concepts[0]){const concept=concepts[0],book=box(.42,.56,.34,-8.65,height+1.25,-9.19,'#b39a65');action(book,{mathAction:'concept',conceptId:concept.id,label:'Read '+concept.title},{x:-8.65,z:-7.3},{x:-8.65,y:1.25,z:-9.005});panel(concept.title,2.75,.46,-8.65,1.72,-9.03,{x:-8.65,z:-7.3},{mathAction:'concept',conceptId:concept.id});}
 if(concepts[1]){const concept=concepts[1];box(5.2,2.1,.12,8,height+1.8,-9.6,'#b89d76');panel(concept.title,4.94,1.87,8,1.8,-9.527,{x:8,z:-7.6},{mathAction:'concept',conceptId:concept.id});}
 if(concepts[2]){const concept=concepts[2],shape=new THREE.Mesh(geometry('concept-shape:'+floor,()=>floor%3===0?new THREE.IcosahedronGeometry(.47,0):floor%3===1?new THREE.TorusGeometry(.4,.12,12,30):new THREE.SphereGeometry(.43,18,12)),material(floorTone));shape.position.set(8,height+1.42,-4.2);action(shape,{mathAction:'concept',conceptId:concept.id,label:'Explore '+concept.title},{x:8,z:-2.65},{x:8+(floor%3===1?.35:0),y:1.42,z:-4.2});group.add(shape);panel(concept.title,2.55,.4,8,1.16,-3.43,{x:8,z:-2.65},{mathAction:'concept',conceptId:concept.id});}
 group.add(new THREE.AmbientLight('#fff0d4',.58));for(const x of [-7,7]){const light=new THREE.PointLight('#fff2d8',1.15,18,2);light.position.set(x,height+3,-1);group.add(light);}

 if(floor===0){const travel={cityAction:'travel',label:'Travel to another city'};for(const z of [15,17]){box(.3,2.8,.3,-20,1.4,z,'#4e7374');collision(-20,z,.3,.3,'City travel gate');}box(.35,.3,2.3,-20,2.73,16,'#4e7374');const gate=plaque('TRAVEL TO ANOTHER CITY',2.6,.5,-19.82,2.7,16,Math.PI/2);action(gate,travel,{x:-18.4,z:16},{x:-19.82,y:2.7,z:16});const sign=plaque('Personal home · Artists · Makers',2.9,.65,-19.82,1.8,16,Math.PI/2);action(sign,travel,{x:-18.4,z:16},{x:-19.82,y:1.8,z:16});}
 for(const [tone,parts] of instances){const mesh=new THREE.InstancedMesh(geometry('instance-box',()=>new THREE.BoxGeometry(1,1,1)),material(tone),parts.length);parts.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));mesh.instanceMatrix.needsUpdate=true;group.add(mesh);}
 group.updateMatrixWorld(true);
 const canStand=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>bounds.minX+.22&&x<bounds.maxX-.22&&z>bounds.minZ+.22&&z<bounds.maxZ-.22&&!colliders.some(c=>x>c.minX-.22&&x<c.maxX+.22&&z>c.minZ-.22&&z<c.maxZ+.22);
 const insideAt=(x,z)=>x>-11.8&&x<11.8&&z>-9.8&&z<7.8?'math-building':null;
 const floorSpawn={x:0,y:height,z:5.3,yaw:0},spawn=floor===0?{x:0,y:0,z:32.8,yaw:0,pitch:.44}:{...floorSpawn},guideAnchor={x:0,y:height,z:3.3,yaw:0};
 const entry={x:0,y:0,z:9.6,yaw:0},spawnInside={x:0,y:height,z:5.3,yaw:0},building={id:'math-building',name:'Mathematics Atlas',group,minX:-12,maxX:12,minZ:-10,maxZ:8,entry,spawnInside,approaches};
 const anchors=[{id:'library',label:'Mathematics library corner',x:-8,y:height,z:.7,yaw:0,radius:.8,approach:{x:-6.5,z:.7,yaw:Math.PI/2}},{id:'table',label:'Mathematics exploration corner',x:8,y:height,z:.7,yaw:0,radius:.8,approach:{x:6.5,z:.7,yaw:-Math.PI/2}},...(floor===0?[{id:'plaza',label:'Mathematics city plaza',x:0,y:0,z:15,yaw:0,radius:.8,approach:{x:0,z:16.5,yaw:0}}]:[])];
 return {group,targets:[group],bounds,spawn,floorSpawn,guideAnchor,houses:[building],building,anchors,colliders,approaches,floor,index:floor,height,floorHeight:height,floors:floorLandings,landings:floorLandings,landmark:guideAnchor,anchor:guideAnchor,canStand,insideAt,canTeleport(x,z,y=height){if(typeof x==='object'&&x){const p=x;return Math.abs(p.y-height)<.25&&canStand(p.x,p.z);}return Number.isFinite(y)&&Math.abs(y-height)<.25&&canStand(x,z);},seatAt(x,z){return seats.find(seat=>Math.hypot(x-seat.x,z-seat.z)<.55)||null;},entryFor(id){return id==='math-building'?{...spawnInside}:null;},dispose(){if(disposed)return;disposed=true;for(const texture of textures)texture.dispose();for(const mat of new Set(materials.values()))mat.dispose();for(const geom of new Set(geometries.values()))geom.dispose();group.clear();}};
}
