import {STORE_OBJECTS} from './object-store.js';
import {storePreview} from './object-store-preview.js';

// Fixed, public displays; visiting or inspecting never changes a saved house.
const normalObjects=STORE_OBJECTS.filter(item=>!item.audioUrl),musicObjects=STORE_OBJECTS.filter(item=>item.audioUrl);
export const MARKET_STALLS = Object.freeze(STORE_OBJECTS.map(item=>{
 const index=(item.audioUrl?musicObjects:normalObjects).indexOf(item),x=item.audioUrl?-39+(index%2)*5.4:(index%8-3.5)*5.4,z=item.audioUrl?21-Math.floor(index/2)*6:24-Math.floor(index/8)*6;
 return Object.freeze({id:item.id,title:item.title,category:item.category,x,z,approach:{x,z:z+2,yaw:0}});
}));

export function buildObjectMarket(THREE,{loadPreview=storePreview}={}){
 const group=new THREE.Group(),colliders=[],materials=new Map(),geometries=new Map(),textures=[],displays=new Map();
 const bounds={minX:-48,maxX:27,minZ:-42,maxZ:39},spawn={x:0,z:34.5,yaw:0},guideAnchor={x:5.5,z:32};
 let disposed=false,active=false,queue=[],loading=0;
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);};
 const box=(w,h,d,x,y,z,color,data)=>{const key=[w,h,d].join(':');if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));const mesh=new THREE.Mesh(geometries.get(key),material(color));mesh.position.set(x,y,z);if(data)mesh.userData=data;group.add(mesh);return mesh;};
 function sign(text,x,y,z,width,data){box(width,.4,.1,x,y,z,'#eadfc5',data);if(typeof document==='undefined')return;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#eadfc5';ctx.fillRect(0,0,512,64);ctx.fillStyle='#243d36';ctx.font='600 26px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,32,490);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);const plane=new THREE.PlaneGeometry(width-.03,.38),mat=new THREE.MeshBasicMaterial({map:texture});const face=new THREE.Mesh(plane,mat);face.position.set(x,y,z+.056);if(data)face.userData=data;group.add(face);}
 box(75,.12,81,-10.5,-.08,-1.5,'#9cae86');box(45,.035,72,0,.005,-4,'#d6c6a5');
 for(let row=0;row<Math.ceil(normalObjects.length/8);row++)box(45,.015,2.4,0,.03,26-row*6,'#eadfc5');
 box(2.2,.025,78,0,.045,-1.5,'#e7d7b6');box(20,.035,36,-36,.005,10,'#d6c6a5');box(69,.035,2.4,-10,.04,30,'#eadfc5');sign('LISTENING GARDEN · 10 original songs',-36,3.1,26,9);for(const x of [-40.6,-31.4])box(.18,3.2,.18,x,1.6,26,'#665844');
 sign('OBJECT MARKET · Open-air collection',0,3.6,29,8);
 sign('Walk the aisles · E to inspect · M for the map',0,2.85,29,8);
 const catalogue={cityAction:'store-catalogue',label:'Browse market catalogue & sources'};
 sign('CATALOGUE & SOURCES · E',-6.4,1.5,30,3.5,catalogue);
 box(.16,1.5,.16,-6.4,.75,30,'#665844');
 colliders.push({minX:-6.6,maxX:-6.2,minZ:29.8,maxZ:30.2,label:'Catalogue stand'});
 for(const x of [-4.3,4.3])box(.22,3.8,.22,x,1.9,29,'#665844');
 sign('Furniture & curiosities',-12,3.1,25.7,7);
 sign('Paintings beyond · follow the avenue',12,3.1,25.7,8);
 for(const stall of MARKET_STALLS){
  const item=STORE_OBJECTS.find(i=>i.id===stall.id),data={cityAction:'store-object',storeObjectId:item.id,label:(item.audioUrl?'Play ':'Inspect ')+item.title};
  const display=new THREE.Group();display.position.set(stall.x,0,stall.z);display.userData=data;group.add(display);
  const width=item.type==='painting'?2.4:2.7,depth=item.type==='painting'?.6:2.3;
  box(width,.2,depth,stall.x,.1,stall.z,'#a48762',data);
  colliders.push({minX:stall.x-width/2,maxX:stall.x+width/2,minZ:stall.z-depth/2,maxZ:stall.z+depth/2,label:item.title});
  sign(item.title,stall.x,.55,stall.z+depth/2+.02,3.5,data);
  sign(item.category,stall.x,2.8,stall.z-.8,3.6,data);
  for(const side of [-1,1])box(.09,2.85,.09,stall.x+side*1.55,1.425,stall.z-.8,'#665844',data);
  // A physical source plaque remains usable even while the exhibit loads.
  const plaque=box(.55,.65,.08,stall.x+1.8,.95,stall.z+.7,'#5c7d73',data);
  colliders.push({minX:plaque.position.x-.28,maxX:plaque.position.x+.28,minZ:plaque.position.z-.1,maxZ:plaque.position.z+.1,label:'Source plaque'});
  displays.set(item.id,{item,stall,display,model:null,pending:false,wanted:false,error:false});
 }
 const travel={cityAction:'travel',label:'Travel to another city'};
 sign('RETURN / CITY TRAVEL',0,2.1,37,6,travel);box(6,.12,.2,0,.06,37,'#617b71',travel);
 for(const x of [-25,25])for(const z of [-30,-18,-6,6,18,30]){box(.6,.65,.6,x,.33,z,'#8c7658');box(1.3,1.8,1.3,x,1.45,z,'#58765b');colliders.push({minX:x-.7,maxX:x+.7,minZ:z-.7,maxZ:z+.7,label:'Garden tree'});}
 const canStand=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>bounds.minX+.22&&x<bounds.maxX-.22&&z>bounds.minZ+.22&&z<bounds.maxZ-.22&&!colliders.some(c=>x>c.minX-.22&&x<c.maxX+.22&&z>c.minZ-.22&&z<c.maxZ+.22);
 function release(entry){if(!entry.model)return;entry.display.remove(entry.model.group);entry.model.dispose();entry.model.release?.();entry.model=null;}
 function pump(){while(!disposed&&active&&loading<2&&queue.length){const entry=queue.shift();if(entry.pending||entry.model||!entry.wanted||entry.error)continue;entry.pending=true;loading++;Promise.resolve().then(()=>loadPreview(entry.item)).then(model=>{
   if(disposed||!active||!entry.wanted){model.dispose();model.release?.();return;}
   const holder=new THREE.Group(),size=model.size||new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3()),factor=entry.item.type==='painting'?1.35:(entry.item.type==='model'?entry.item.scale:entry.item.type==='idea'?.6:2.2)/Math.max(size.x,size.y,size.z);
   holder.add(model.group);holder.scale.setScalar(factor);holder.updateMatrixWorld(true);const bottom=new THREE.Box3().setFromObject(holder).min.y;holder.position.y=.22-bottom;holder.userData={cityAction:'store-object',storeObjectId:entry.item.id,label:(entry.item.audioUrl?'Play ':'Inspect ')+entry.item.title};entry.display.add(holder);entry.model={...model,group:holder};
  }).catch(()=>{entry.error=true;}).finally(()=>{entry.pending=false;loading--;pump();});}}
 function update(point){if(disposed)return;active=true;const nearby=[...displays.values()].map(entry=>({entry,d:Math.hypot(point.x-entry.stall.x,point.z-entry.stall.z)})).filter(v=>v.d<15).sort((a,b)=>a.d-b.d).slice(0,10);const ids=new Set(nearby.map(v=>v.entry.item.id));for(const entry of displays.values()){entry.wanted=ids.has(entry.item.id);if(!entry.wanted)release(entry);}queue=nearby.map(v=>v.entry);pump();}
 function suspend(){active=false;queue=[];for(const entry of displays.values()){entry.wanted=false;entry.error=false;release(entry);}}
 return {group,bounds,spawn,guideAnchor,colliders,stalls:MARKET_STALLS,canStand,insideAt:()=> 'Open-air Object Market',update,suspend,
  entryFor(id){return MARKET_STALLS.find(s=>s.id===id)?.approach||null;},
  dispose(){if(disposed)return;disposed=true;suspend();const owned=new Set([...textures,...materials.values(),...geometries.values()]);group.traverse(o=>{if(o.geometry)owned.add(o.geometry);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])owned.add(mat);});for(const resource of owned)resource.dispose();group.clear();}
 };
}
