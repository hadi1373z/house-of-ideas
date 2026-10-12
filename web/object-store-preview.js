import * as THREE from './vendor/three.module.js';
import {parseDesign} from './design-scene.js';
import {storeAssetUrl} from './object-store.js';
import {starter} from './model.js';
import {constructionDraft,addConstructionObject} from './construction-data.js';
import {buildHouse} from './residence-scene-v1.js';
import {extractObjectPreview} from './object-preview.js';
export async function storePreview(item){
 if(item.type==='model'){const response=await fetch(storeAssetUrl(item.assetId));if(!response.ok)throw Error('The bundled model could not be opened.');const model=await parseDesign(await response.arrayBuffer());model.group.position.y=-model.size.y/2;let disposed=false;return {...model,dispose(){if(disposed)return;disposed=true;const resources=new Set();model.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();model.group.clear();}};}
 if(item.type==='painting'){const texture=await new THREE.TextureLoader().loadAsync(item.imageUrl);texture.colorSpace=THREE.SRGBColorSpace;const group=new THREE.Group(),geometry=new THREE.BoxGeometry(1.65,1.2,.08),frame=new THREE.MeshStandardMaterial({color:'#6e5130'}),plane=new THREE.PlaneGeometry(1.5,1.05),material=new THREE.MeshBasicMaterial({map:texture});group.add(new THREE.Mesh(geometry,frame));const face=new THREE.Mesh(plane,material);face.position.z=.045;group.add(face);return {group,size:new THREE.Vector3(1.65,1.2,.08),dispose(){for(const r of [geometry,frame,plane,material,texture])r.dispose();group.clear();}};}
 let house=constructionDraft(starter()),itemData;const roomId=house.rooms[0].id;
 if(item.type==='idea'){house.ideas=[{id:'store-preview',roomId,title:item.title,text:'',cue:item.cue,action:'read'}];itemData={ideaId:'store-preview'};}
 else{house=addConstructionObject(house,roomId,item.id);itemData={featureId:house.resident.roomFeatures.at(-1).id};}
 const built=buildHouse(house,true,true);const preview=extractObjectPreview(built.group,itemData);const geometries=new Set(),materials=new Set(),textures=new Set();built.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});preview.release=()=>{for(const r of [...geometries,...materials,...textures])r.dispose();built.group.clear();};return preview;
}
