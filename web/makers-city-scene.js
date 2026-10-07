// A separate, metre-scale district for reading, trying ideas and living together.
// Cargo displays can be layered onto the three reserved anchors by the caller.
import {BOOKS} from './books.js';

export function buildMakersCity(THREE,{cargo}={}) {
 if(!THREE?.Group)throw Error('Build Makers City with the Three.js geometry API.');
 const group=new THREE.Group();group.name='Makers City';
 const houses=[],colliders=[],materials=new Map(),geometries=new Map(),textures=new Set(),instances=new Map();let disposed=false;
 const bounds={minX:-18,maxX:18,minZ:-16,maxZ:16},spawn={x:-13.5,z:0,yaw:-Math.PI/2},guideAnchor={x:0,z:0,yaw:0};
 const anchors=[
  {id:'library',label:'Library exhibition corner',x:-6.5,y:0,z:-6.3,yaw:0,radius:.8,approach:{x:-7.75,z:-6.3,yaw:-Math.PI/2}},
  {id:'workshop',label:'Workshop exhibition corner',x:11.5,y:0,z:-9.2,yaw:0,radius:.8,approach:{x:10.25,z:-9.2,yaw:-Math.PI/2}},
  {id:'plaza',label:'Makers plaza exhibition',x:4,y:0,z:1,yaw:0,radius:.8,approach:{x:2.75,z:1,yaw:-Math.PI/2}},
 ];
 const material=(tone,basic=false)=>{const key=(basic?'basic:':'standard:')+tone;if(!materials.has(key))materials.set(key,basic?new THREE.MeshBasicMaterial({color:tone,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:tone,roughness:.82}));return materials.get(key);};
 const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
 const box=(parent,w,h,d,x,y,z,tone,data)=>{const mesh=new THREE.Mesh(geometry(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),material(tone));mesh.position.set(x,y,z);if(data||parent.userData.cityAction)mesh.userData={...(data||parent.userData)};parent.add(mesh);return mesh;};
 const cylinder=(parent,r,h,x,y,z,tone)=>{const mesh=new THREE.Mesh(geometry(`cylinder:${r}:${h}`,()=>new THREE.CylinderGeometry(r,r,h,20)),material(tone));mesh.position.set(x,y,z);if(parent.userData.cityAction)mesh.userData={...parent.userData};parent.add(mesh);return mesh;};
 const sphere=(parent,r,x,y,z,tone)=>{const mesh=new THREE.Mesh(geometry('sphere:'+r,()=>new THREE.SphereGeometry(r,14,10)),material(tone));mesh.position.set(x,y,z);if(parent.userData.cityAction)mesh.userData={...parent.userData};parent.add(mesh);return mesh;};
 const point=(house,x,z)=>({x:house.cx+house.direction*x,z:house.cz+house.direction*z});
 function collision(house,x,z,w,d,label){const p=house?point(house,x,z):{x,z};colliders.push({minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2,label});}
 function instanceBox(parent,w,h,d,x,y,z,tone){if(!instances.has(tone))instances.set(tone,[]);instances.get(tone).push({parent,matrix:new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d))});}
 function label(parent,title,w,h,x,y,z,rotation=0,data={}){
  const mesh=new THREE.Mesh(geometry('label-plane',()=>new THREE.PlaneGeometry(1,1)),material('#344a49',true));mesh.position.set(x,y,z);mesh.scale.set(w,h,1);mesh.rotation.y=rotation;mesh.userData={...data,label:data.label||title};parent.add(mesh);
  if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#344a49';ctx.fillRect(0,0,768,192);ctx.fillStyle='#fff4da';ctx.font='600 46px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(title).slice(0,60),384,96,714);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.set('label:'+materials.size,mat);mesh.material=mat;}}
  return mesh;
 }
 function action(house,node,data,target,stand){
  const p=point(house,stand.x,stand.z),aim=point(house,target.x,target.z),lookAt={x:aim.x,y:target.y,z:aim.z},yaw=Math.atan2(p.x-aim.x,p.z-aim.z),anchor={x:p.x,y:0,z:p.z,yaw};
  const metadata={...data,anchor,lookAt};node.userData={...node.userData,...metadata};node.traverse(child=>{const childData=child.userData;if(child.isMesh&&(!childData.cityAction||(childData.cityAction===data.cityAction&&childData.activity===data.activity&&childData.bookId===data.bookId)))child.userData={...childData,...metadata};});house.approaches.push({...metadata,x:p.x,z:p.z,yaw});return node;
 }
 function roof(style){return geometry('roof:'+style,()=>{
  const hip=style==='hip',height=style==='high'?4.95:4.45,halfRidge=hip?1.65:3.86,shift=style==='offset'?.7:0;
  const points=[[-4.38,3,-3.86],[4.38,3,-3.86],[4.38,3,3.86],[-4.38,3,3.86],[shift,height,-halfRidge],[shift,height,halfRidge]],faces=[[4,1,0],[5,2,1],[4,5,1],[5,3,2],[4,0,3],[5,4,3],[2,3,0],[1,2,0]],positions=faces.flatMap(face=>face.flatMap(i=>points[i]));
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.computeVertexNormals();return result;
 });}
 function windowWall(){return geometry('window-wall',()=>{const shape=new THREE.Shape();shape.moveTo(-4,0);shape.lineTo(-1,0);shape.lineTo(-1,3);shape.lineTo(-4,3);shape.closePath();const hole=new THREE.Path();hole.moveTo(-3.15,1.05);hole.lineTo(-3.15,2.15);hole.lineTo(-1.75,2.15);hole.lineTo(-1.75,1.05);hole.closePath();shape.holes.push(hole);const result=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});result.translate(0,0,3.41);return result;});}
 function hall(id,name,cx,cz,direction,wallTone,roofTone,style){
  const home=new THREE.Group();home.name=name;home.position.set(cx,0,cz);home.rotation.y=direction<0?Math.PI:0;group.add(home);
  const house={id,name,label:name,cx,cz,direction,group:home,minX:cx-4,maxX:cx+4,minZ:cz-3.5,maxZ:cz+3.5,approaches:[]};houses.push(house);
  box(home,8,.08,7,0,-.04,0,'#cabb9f');box(home,8,3,.18,0,1.5,-3.5,wallTone);collision(house,0,-3.5,8,.18,'Back wall');
  for(const x of [-4,4]){box(home,.18,3,7,x,1.5,0,wallTone);collision(house,x,0,.18,7,'Side wall');}
  home.add(new THREE.Mesh(windowWall(),material(wallTone)));collision(house,-2.5,3.5,3,.18,'Glazed front wall');box(home,3,3,.18,2.5,1.5,3.5,wallTone);collision(house,2.5,3.5,3,.18,'Front wall');box(home,2,.65,.18,0,2.675,3.5,'#8b7862');
  const glass=new THREE.Mesh(geometry('window-glass',()=>new THREE.PlaneGeometry(1.39,1.09)),material('#c4d9d5',true));glass.position.set(-2.45,1.6,3.515);home.add(glass);glass.material.transparent=true;glass.material.opacity=.35;
  for(const x of [-3.2,-1.7])box(home,.07,1.25,.055,x,1.6,3.615,'#685744');for(const y of [.975,2.225])box(home,1.57,.065,.055,-2.45,y,3.615,'#685744');box(home,.045,1.14,.045,-2.45,1.6,3.625,'#685744');
  const roofMesh=new THREE.Mesh(roof(style),material(roofTone));roofMesh.name=name+' roof';home.add(roofMesh);
  label(home,name,2.75,.39,0,2.62,3.615);for(const x of [-1.06,1.06])box(home,.1,2.37,.1,x,1.185,3.64,'#685744');box(home,2.27,.11,.1,0,2.37,3.64,'#685744');box(home,1.95,.035,.5,0,.0175,3.66,'#daceb5');
  const doorway=point(house,0,4.2),inside=point(house,0,2.3);house.entry={...doorway,yaw:direction>0?0:Math.PI};house.spawnInside={...inside,yaw:direction>0?0:Math.PI};
  box(group,2,.025,2.4,cx,.0025,cz+direction*4.6,'#d8ceb6');return house;
 }
 function table(house,x,z,w,d,height=.8){const node=new THREE.Group();node.position.set(x,0,z);house.group.add(node);box(node,w,.09,d,0,height,0,'#9a7956');box(node,w-.16,.065,d-.14,0,height-.13,0,'#6c5945');for(const a of [-w/2+.1,w/2-.1])for(const b of [-d/2+.1,d/2-.1])instanceBox(node,.07,height-.1,.07,a,(height-.1)/2,b,'#68543f');collision(house,x,z,w,d,'Table');return node;}
 function chair(house,x,z,rotation=0,tone='#8c9d8a'){
  const node=new THREE.Group();node.position.set(x,0,z);node.rotation.y=rotation;house.group.add(node);box(node,.7,.15,.72,0,.47,0,tone);box(node,.68,.62,.12,0,.78,-.3,tone);for(const a of [-.33,.33])box(node,.1,.21,.66,a,.65,0,'#8c765e');box(node,.51,.07,.52,0,.58,.025,'#ded2bb');for(const a of [-.27,.27])for(const b of [-.26,.26])instanceBox(node,.055,.4,.055,a,.2,b,'#675440');collision(house,x,z,.78,.78,'Chair');return node;
 }
 function cup(parent,x,y,z){const node=new THREE.Group();node.position.set(x,y,z);parent.add(node);cylinder(node,.072,.016,0,0,0,'#eee3cc');cylinder(node,.055,.105,0,.062,0,'#e7d8b8');cylinder(node,.046,.006,0,.115,0,'#785b40');const handle=new THREE.Mesh(geometry('cup-handle',()=>new THREE.TorusGeometry(.035,.01,8,18)),material('#e7d8b8'));handle.position.set(.067,.065,0);node.add(handle);return node;}
 function book(house,parent,reading,x,y,z,stand,flat=false){
  const node=new THREE.Group();node.position.set(x,y,z);parent.add(node);const width=flat?.31:.28,height=flat?.07:.4,depth=flat?.38:.27;
  box(node,width,height,depth,0,0,0,'#667e88');box(node,width-.024,height-.024,depth-.025,.004,0,.003,'#eadfc6');box(node,width,.012,depth,0,height/2-.006,0,'#667e88');box(node,.024,height,depth,-width/2+.012,0,0,'#667e88');
  if(!flat)label(node,reading.title,.24,.16,0,.02,depth/2+.006,0,{cityAction:'read',bookId:reading.id,label:'Read '+reading.title});
  const local=parent===house.group?{x,y,z}:parent.position.clone().add(new THREE.Vector3(x,y,z));
  return action(house,node,{cityAction:'read',bookId:reading.id,label:'Read '+reading.title},{x:local.x,y:local.y+.02,z:local.z},stand);
 }
 function journal(house,parent,x,y,z,stand,labelText){const node=new THREE.Group();node.position.set(x,y,z);parent.add(node);box(node,.38,.035,.29,0,0,0,'#e7dec8');box(node,.018,.039,.3,0,0,0,'#8b7457');for(let line=0;line<4;line++)instanceBox(node,.12,.002,.008,-.09,.02,-.09+line*.055,'#83928c');const p=parent.position;return action(house,node,{cityAction:'activity',activity:'reflect',label:labelText},{x:p.x+x,y:y+.03,z:p.z+z},stand);}
 function plant(house,x,z){const parent=house?house.group:group;cylinder(parent,.2,.28,x,.14,z,'#a47859');cylinder(parent,.19,.015,x,.288,z,'#675444');for(let leaf=0;leaf<4;leaf++){const a=leaf*2.2,node=sphere(parent,.14,x+Math.sin(a)*.16,.48+(leaf%2)*.13,z+Math.cos(a)*.13,'#6b8a6d');node.scale.set(.65,1.5,.6);}collision(house,x,z,.48,.48,'Plant pot');}

 box(group,36,.06,32,0,-.045,0,'#a9b596');box(group,31,.035,8,0,-.0075,0,'#cfc4ad');group.add(new THREE.AmbientLight('#fff0d8',.45));
 for(const z of [-3.7,3.7])for(let paver=0;paver<16;paver++)instanceBox(group,1.7,.025,.22,-13.5+paver*1.8,.013,z,'#b8aa91');
 const library=hall('makers-library','Library',-9,-8,1,'#e9e2cf','#616f78','high');
 const workshop=hall('makers-workshop','Workshop',9,-8,1,'#d9dfd1','#906d52','offset');
 const dialogue=hall('makers-dialogue','Dialogue House',0,9,-1,'#e6d8d0','#687b69','hip');

 // Library shelves carry the six existing, original offline readings. Filler
 // volumes are decorative instances so each selectable book remains distinct.
 for(let bay=0;bay<3;bay++){
  const x=(bay-1)*2.2;box(library.group,1.75,2.2,.055,x,1.15,-3.37,'#79634b');for(const edge of [-.85,.85])box(library.group,.075,2.23,.39,x+edge,1.15,-3.2,'#9b7e57');for(const y of [.32,1.08,1.89])box(library.group,1.75,.047,.4,x,y,-3.18,'#9b7e57');
  for(let filler=0;filler<6;filler++)for(const shelf of [.35,1.92])instanceBox(library.group,.105,.32+(filler%2)*.035,.25,x-.65+filler*.24,shelf+.17,-3.15,['#84988d','#a88d82','#8596a5'][filler%3]);
  for(let side=0;side<2;side++){const reading=BOOKS[bay*2+side],bx=x+(side===0?-.43:.43);book(library,library.group,reading,bx,1.32,-3.11,{x:bx,z:-1.75});}
 }
 const readingDesk=table(library,0,.1,1.65,.72,.81);journal(library,readingDesk,-.27,.88,0,{x:0,z:1.1},'Reflect on your reading');cup(readingDesk,.34,.865,-.12);
 const readingChair=chair(library,-2.65,.9,0,'#819a8b');action(library,readingChair,{cityAction:'activity',activity:'sit',label:'Sit in the library reading chair'},{x:-2.65,y:.8,z:.65},{x:-2.65,z:1.8});
 const librarySide=table(library,-1.75,.8,.45,.45,.59),readingTea=cup(librarySide,0,.645,0);action(library,readingTea,{cityAction:'activity',activity:'tea',label:'Pause for tea between readings'},{x:-1.75,y:.76,z:.8},{x:-1.2,z:1.35});plant(library,-3.2,2.55);
 label(library.group,'Read • Question • Revisit',2.3,.28,0,2.55,-3.375,Math.PI);

 const workbench=table(workshop,-1.9,0,2.5,1.2,.89);action(workshop,workbench,{cityAction:'activity',activity:'experiment',label:'Run a small idea experiment'},{x:-1.9,y:.95,z:.35},{x:-1.9,z:1.35});
 cylinder(workbench,.13,.025,0,.955,.35,'#c3a261');cylinder(workbench,.12,.3,-.25,1.07,-.25,'#859da3');cylinder(workbench,.065,.17,-.25,1.3,-.25,'#cfccac');sphere(workbench,.11,.22,1.04,-.28,'#ad8170');box(workbench,.3,.15,.29,.6,1.02,-.2,'#8e9b7a');
 book(workshop,workbench,BOOKS.find(b=>b.id==='practice'),-.74,.975,.25,{x:-2.64,z:1.4},true);book(workshop,workbench,BOOKS.find(b=>b.id==='counterexamples'),.71,.975,.26,{x:-1.19,z:1.4},true);
 const board=new THREE.Group();board.position.set(0,1.69,-3.27);workshop.group.add(board);box(board,2.75,1.47,.12,0,0,0,'#7f6b52');box(board,2.56,1.28,.025,0,0,.075,'#d6d0b8');label(board,'Prediction → Test → Observation',2.38,.24,0,.36,.095);for(let card=0;card<3;card++){box(board,.55,.42,.012,-.77+card*.77,-.16,.096,['#a6b8af','#ceb48e','#b2afc4'][card]);box(board,.35,.017,.012,-.77+card*.77,-.08,.108,'#6f817c');}action(workshop,board,{cityAction:'activity',activity:'question',label:'Question an assumption at the idea board'},{x:0,y:1.7,z:-3.15},{x:0,z:-1.6});
 box(workshop.group,1.55,.94,.55,-2.65,.47,-2.93,'#968267');for(const x of [-3,-2.3]){box(workshop.group,.63,.76,.035,x,.48,-2.632,'#c6b799');cylinder(workshop.group,.025,.012,x,.48,-2.607,'#7c705c').rotation.x=Math.PI/2;}collision(workshop,-2.65,-2.93,1.55,.55,'Workshop cabinet');
 const workJournal=table(workshop,-2.8,2.3,.72,.54,.65);journal(workshop,workJournal,0,.72,0,{x:-1.6,z:2.3},'Record what changed after your experiment');plant(workshop,3.2,2.65);
 for(let tool=0;tool<5;tool++){instanceBox(workshop.group,.12,.36,.065,1.3+tool*.42,1.6,3.38,'#75664f');instanceBox(workshop.group,.27,.065,.065,1.3+tool*.42,1.82,3.38,'#a69980');}

 const talkTable=table(dialogue,0,-.3,.68,.68,.56),tea=cup(talkTable,0,.615,0);action(dialogue,tea,{cityAction:'activity',activity:'tea',label:'Share a pause for tea'},{x:0,y:.73,z:-.3},{x:0,z:.7});
 for(const side of [-1,1]){const seat=chair(dialogue,side*1.7,-.3,side<0?Math.PI/2:-Math.PI/2,'#9caaa0');action(dialogue,seat,{cityAction:'activity',activity:'sit',label:side<0?'Take one perspective in dialogue':'Take the other perspective in dialogue'},{x:side*1.7,y:.83,z:-.3},{x:side*.85,z:-.3});}
 const discussion=new THREE.Group();dialogue.group.add(discussion);box(discussion,2.5,.99,.085,0,1.89,-3.29,'#8b7660');label(discussion,'What would change your mind?',2.28,.77,0,1.89,-3.235);action(dialogue,discussion,{cityAction:'activity',activity:'question',label:'Find a fair question for another viewpoint'},{x:0,y:1.89,z:-3.22},{x:0,z:-1.8});
 const sofa=new THREE.Group();sofa.position.set(-2.5,0,1.5);dialogue.group.add(sofa);box(sofa,1.45,.29,.73,0,.4,0,'#9b9188');box(sofa,1.4,.58,.13,0,.73,-.29,'#9b9188');for(const x of [-.67,.67])box(sofa,.14,.32,.72,x,.66,0,'#b0a091');for(const x of [-.31,.31])box(sofa,.53,.1,.51,x,.6,.02,'#ddd0b7');for(const x of [-.58,.58])for(const z of [-.26,.26])instanceBox(sofa,.06,.28,.06,x,.14,z,'#685745');collision(dialogue,-2.5,1.5,1.47,.76,'Reading sofa');action(dialogue,sofa,{cityAction:'activity',activity:'sit',label:'Rest in the dialogue house reading nook'},{x:-2.5,y:.87,z:1.3},{x:-2.5,z:2.65});book(dialogue,sofa,BOOKS.find(b=>b.id==='care'),-.48,.855,.07,{x:-2.5,z:2.65},true);
 const reflection=table(dialogue,2.5,1.7,.78,.57,.73);journal(dialogue,reflection,0,.8,0,{x:1.55,z:1.7},'Reflect before returning home');book(dialogue,reflection,BOOKS.find(b=>b.id==='dialogue'),.19,.86,-.04,{x:2.5,z:2.65},true);
 box(dialogue.group,1.2,1.17,.28,2.7,.595,-3.11,'#c5b49b');box(dialogue.group,.84,.67,.045,2.7,.4,-2.946,'#4d5146');box(dialogue.group,1.35,.075,.38,2.7,1.19,-3.08,'#8b7355');for(let log=0;log<3;log++)instanceBox(dialogue.group,.67,.07,.06,2.7,.14+log*.07,-2.91,'#89704d');collision(dialogue,2.7,-3.11,1.35,.38,'Fireplace');plant(dialogue,-3.2,-2.65);

 for(const x of [-14,14])for(const z of [-3,3])plant(null,x,z);
 const travel={cityAction:'travel',label:'Travel to another city',anchor:{x:-14.8,y:0,z:0,yaw:Math.PI/2},lookAt:{x:-16,y:1.55,z:0}};
 for(const z of [-1.22,1.22]){box(group,.22,2.48,.22,-16,1.24,z,'#617b71',travel);collision(null,-16,z,.22,.22,'Travel gate post');}box(group,.24,.22,2.66,-16,2.38,0,'#617b71',travel);label(group,'Travel to another city',2.24,.36,-15.865,2.38,0,Math.PI/2,travel);label(group,'Choose your destination',1.62,.44,-15.864,1.5,0,Math.PI/2,travel);
 group.updateMatrixWorld(true);
 for(const [tone,parts] of instances){const batch=new THREE.InstancedMesh(geometry('instance-box',()=>new THREE.BoxGeometry(1,1,1)),material(tone),parts.length);for(let i=0;i<parts.length;i++)batch.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(parts[i].parent.matrixWorld,parts[i].matrix));batch.instanceMatrix.needsUpdate=true;group.add(batch);}
 group.updateMatrixWorld(true);
 const canStand=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>bounds.minX+.22&&x<bounds.maxX-.22&&z>bounds.minZ+.22&&z<bounds.maxZ-.22&&!colliders.some(c=>x>c.minX-.22&&x<c.maxX+.22&&z>c.minZ-.22&&z<c.maxZ+.22);
 const insideAt=(x,z)=>houses.find(h=>x>h.minX+.16&&x<h.maxX-.16&&z>h.minZ+.16&&z<h.maxZ-.16)?.name||null;
 return {group,bounds,spawn,guideAnchor,houses,targets:[group],anchors,colliders,canStand,insideAt,entryFor(id){const house=houses.find(h=>h.id===id);return house?{...house.spawnInside}:null;},dispose(){if(disposed)return;disposed=true;for(const texture of textures)texture.dispose();for(const mat of new Set(materials.values()))mat.dispose();for(const geom of new Set(geometries.values()))geom.dispose();group.clear();}};
}
