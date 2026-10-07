import {BOOKS} from './books.js';

// Shared domestic objects live in public stations. Frozen personal homes and
// the first artists' galleries keep their original furnishing geometry.
export function buildCityFacilities(THREE,{cityId,origin={x:25,z:0},anchors:provided}={}){
 const group=new THREE.Group(),obstacles=[],materials=new Map(),geometries=new Map(),textures=[];let disposed=false;
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return materials.get(color);};
 const box=(w,h,d,x,y,z,color,data)=>{const key=[w,h,d].join(':');if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));const mesh=new THREE.Mesh(geometries.get(key),material(color));mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;if(data)mesh.userData=data;group.add(mesh);return mesh;};
 const plaque=(text,x,y,z,width,data)=>{box(width,.3,.08,x,y,z,'#e7d9bd',data);if(typeof document==='undefined')return;const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#e7d9bd';ctx.fillRect(0,0,768,96);ctx.fillStyle='#293f3c';ctx.font='600 35px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.slice(0,48),384,48,740);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width-.04,.26),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(x,y,z+.046);if(data)mesh.userData=data;group.add(mesh);};
 const block=(x,z,w,d,label)=>obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,label});
 const anchors=provided||[{id:'library',label:'Travel library',x:origin.x-1,z:origin.z-1.2},{id:'table',label:'Learning table',x:origin.x+1,z:origin.z-1.2},{id:'plaza',label:'Travel plaza',x:origin.x+1,z:origin.z+1.3}].map(a=>({...a,y:0,radius:.8,approach:{x:a.x,z:a.z+1.15,yaw:0}}));
 if(!provided){
  const {x,z}=origin,wide=cityId==='artists';
  // Readings and the activity table stay behind the exhibition racks, with a
  // clear aisle between them. Copies cannot hide the station's own books.
  box(3.6,.07,wide?11:8,x,-.035,z,'#c8bfa8');
  const depth=wide?11:8,half=1.95,rise=.8,slope=Math.hypot(half,rise);
  for(const side of [-1,1]){const roof=box(slope,.12,depth+.4,x+side*half/2,2.65+rise/2,z,'#596d68');roof.rotation.z=-side*Math.atan2(rise,half);roof.userData={cityRoof:true};}
  for(const dx of [-1.65,1.65])for(const dz of [-depth/2+.18,depth/2-.18]){box(.12,2.6,.12,x+dx,1.3,z+dz,'#7a6550');block(x+dx,z+dz,.12,.12,'Station post');}
  const library={x:x-1,z:z-3.2},table={x:x+1,z:z-3.2};
  box(1.35,1.4,.25,library.x,.7,library.z-.25,'#8b6e51');block(library.x,library.z-.25,1.35,.25,'City bookshelf');
  const reading=(book,index)=>({cityAction:'read',bookId:book.id,label:'Read '+book.title,anchor:{x:library.x-.49+index*.195,z:library.z+.4,yaw:0},lookAt:{x:library.x-.49+index*.195,y:1,z:library.z-.035}});
  for(let i=0;i<BOOKS.length;i++)box(.16,.32,.2,library.x-.49+i*.195,1.0,library.z-.035,['#557c75','#c09153','#6a7188'][i%3],reading(BOOKS[i],i));
  plaque('Books for an examined life',library.x,1.59,library.z-.02,1.6,{...reading(BOOKS[0],0),label:'Choose a book'});
  const experiment={cityAction:'activity',activity:'experiment',label:'Test an idea at the city table',anchor:{x:table.x,z:table.z+.95,yaw:0},lookAt:{x:table.x,y:.82,z:table.z}};
  box(1.1,.1,.65,table.x,.76,table.z,'#9b7955',experiment);block(table.x,table.z,1.1,.65,'Learning table');
  for(const dx of [-.4,.4])for(const dz of [-.22,.22])box(.06,.7,.06,table.x+dx,.35,table.z+dz,'#806749');
  box(.35,.015,.25,table.x,.82,table.z,'#ece1c7',{...experiment,label:'Write a prediction and test it'});
  const seat={cityAction:'activity',activity:'tea',label:'Take tea in the city',anchor:{x:x-.8,z:z+1.65},lookAt:{x:x-1.45,y:.73,z:z+.85},height:1.12};
  box(.55,.13,.48,x-.8,.47,z+.65,'#6e8978',seat);box(.55,.55,.08,x-.8,.8,z+.41,'#8b755a',seat);block(x-.8,z+.65,.55,.48,'City chair');
  box(.35,.05,.35,x-1.45,.62,z+.85,'#af9473',seat);box(.1,.15,.1,x-1.45,.72,z+.85,'#eee5d2',seat);block(x-1.45,z+.85,.35,.35,'Tea side table');
  const travel={cityAction:'travel',label:'Travel to another city and carry your collection'};
  plaque('Travel · books · ideas · city journal',x,2.22,z+depth/2,3.15,travel);
 }
 group.updateMatrixWorld(true);
 return {group,anchors,obstacles,dispose(){if(disposed)return;disposed=true;for(const t of textures)t.dispose();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();group.traverse(o=>{if(o.isMesh&&o.material.map){o.geometry.dispose();o.material.dispose();}});group.clear();}};
}

export function buildCityCargo(THREE,network,cityId,anchors){
 const group=new THREE.Group(),obstacles=[],materials=new Map(),geometries=new Map();let disposed=false;
 const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.12}));return materials.get(color);};
 const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
 for(const anchor of anchors){const placed=(network?.placements||[]).filter(p=>p.cityId===cityId&&p.anchorId===anchor.id);if(!placed.length)continue;
  // Face the visitor's safe approach, including the sideways Makers corners.
  // Four columns and two rows fit inside the declared 0.8 m cargo footprint.
  const x=anchor.x,z=anchor.z,approach=anchor.approach||{x,z:z+1.15},yaw=Math.atan2(approach.x-x,approach.z-z),rack=new THREE.Group();rack.position.set(x,0,z);rack.rotation.y=yaw;group.add(rack);
  const stand=new THREE.Mesh(geometry('stand',()=>new THREE.BoxGeometry(1.28,.08,.36)),mat('#bca77e'));stand.position.y=.72;rack.add(stand);for(const dx of [-.54,.54]){const leg=new THREE.Mesh(geometry('leg',()=>new THREE.BoxGeometry(.06,.68,.26)),mat('#917951'));leg.position.set(dx,.34,0);rack.add(leg);}
  const halfX=Math.abs(Math.cos(yaw))*.64+Math.abs(Math.sin(yaw))*.18,halfZ=Math.abs(Math.sin(yaw))*.64+Math.abs(Math.cos(yaw))*.18;obstacles.push({minX:x-halfX,maxX:x+halfX,minZ:z-halfZ,maxZ:z+halfZ,label:'Travel collection stand'});
  placed.forEach((p,index)=>{const cargo=network.cargo.find(c=>c.id===p.cargoId);if(!cargo)return;const cue=cargo.type==='book'?'book':cargo.cue,key=cue||'crystal';const shape=geometry(key,()=>key==='book'?new THREE.BoxGeometry(.19,.27,.1):key==='ring'?new THREE.TorusGeometry(.1,.022,8,16):key==='sphere'?new THREE.SphereGeometry(.12,12,8):new THREE.OctahedronGeometry(.14));const mesh=new THREE.Mesh(shape,mat(cargo.type==='book'?'#46756e':cargo.action==='experiment'?'#c69854':'#808ab0'));mesh.position.set(-.42+(index%4)*.28,.95+Math.floor(index/4)*.36,0);mesh.castShadow=true;const lookAt={x:x+Math.cos(yaw)*mesh.position.x,y:mesh.position.y+(key==='ring'?.1:0),z:z-Math.sin(yaw)*mesh.position.x};mesh.userData={cargoId:cargo.id,placementId:p.id,label:cargo.title+' · carried copy',cityId,anchorId:anchor.id,anchor:{x:approach.x,z:approach.z,yaw},lookAt};rack.add(mesh);});
 }
 group.updateMatrixWorld(true);return {group,obstacles,dispose(){if(disposed)return;disposed=true;for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();group.clear();}};
}
