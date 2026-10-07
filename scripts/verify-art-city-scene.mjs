import assert from 'node:assert/strict';
import * as THREE from '../web/vendor/three.module.js';
import {buildArtCity} from '../web/art-city-scene.js';

const ids=['monet','kandinsky','van-gogh','hokusai','rodin','hilma-af-klint','mondrian','lange','morris','klee'];
const artists=ids.map(id=>({id,name:id,color:'#947b69',background:'#efe7d8',works:Array.from({length:6},(_,i)=>({id:`${id}-${i}`,title:`Work ${i+1}`,imageUrl:`art-city/assets/${id}-${i}.jpg`}))}));
const original=structuredClone(artists),city=buildArtCity(THREE,artists),{group,houses,canStand,bounds}=city;
assert.deepEqual(artists,original,'Architecture must not rewrite the source catalog.');
assert.equal(houses.length,10);assert.equal(new Set(houses.map(h=>h.id)).size,10);
assert.equal(city.targets[0],group);assert.equal(city.entryFor('unknown'),null);
assert.ok(canStand(city.spawn.x,city.spawn.z)&&canStand(city.guideAnchor.x,city.guideAnchor.z));
assert.equal(city.insideAt(0,0),null);assert.equal(canStand(NaN,0),false);assert.equal(canStand(0,Infinity),false);assert.equal(canStand(bounds.maxX,0),false);

// A connected walk grid reaches all entrances, interiors and artwork approach
// anchors. Straight final steps are sampled too, rather than trusting proximity.
const step=.25,nx=Math.round((bounds.maxX-bounds.minX)/step)+1,nz=Math.round((bounds.maxZ-bounds.minZ)/step)+1;
const grid=(x,z)=>({i:Math.round((x-bounds.minX)/step),j:Math.round((z-bounds.minZ)/step)});
const point=(i,j)=>({x:bounds.minX+i*step,z:bounds.minZ+j*step});
const start=grid(city.spawn.x,city.spawn.z),queue=[start.j*nx+start.i],seen=new Uint8Array(nx*nz);seen[queue[0]]=1;
for(let cursor=0;cursor<queue.length;cursor++){
 const index=queue[cursor],i=index%nx,j=Math.floor(index/nx);
 for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj,key=b*nx+a;if(a<0||b<0||a>=nx||b>=nz||seen[key])continue;const p=point(a,b);if(canStand(p.x,p.z)){seen[key]=1;queue.push(key);}}
}
function clearSegment(a,b){for(let t=0;t<=40;t++){const f=t/40;if(!canStand(a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f))return false;}return true;}
function assertReachable(anchor,message){assert.ok(canStand(anchor.x,anchor.z),message+' is a usable standing point.');const {i,j}=grid(anchor.x,anchor.z);assert.equal(seen[j*nx+i],1,message+' is reachable from the promenade.');assert.ok(clearSegment(point(i,j),anchor),message+' has an unobstructed final step.');}
const raycaster=new THREE.Raycaster();let frameCount=0;
for(const house of houses){
 const entry=city.entryFor(house.id);assert.deepEqual(entry,house.spawnInside);assert.equal(city.insideAt(entry.x,entry.z),house.id);
 assertReachable(house.entry,house.id+' outside entrance');assertReachable(entry,house.id+' inside entrance');assert.ok(clearSegment(house.entry,entry),house.id+' doorway is actually open.');
 assert.equal(house.approaches.length,6);
 assert.equal(canStand(house.cx+3.5,house.cz),false,'Solid side walls block movement.');
 const direction=house.row===0?1:-1;assert.equal(canStand(house.cx,house.cz+.5*direction),false,'The bench blocks physical passage.');
 for(const anchor of house.approaches){
  assertReachable(anchor,anchor.workId+' approach');const origin=new THREE.Vector3(anchor.x,1.62,anchor.z),target=new THREE.Vector3(anchor.lookAt.x,anchor.lookAt.y,anchor.lookAt.z);
  raycaster.set(origin,target.sub(origin).normalize());const hit=raycaster.intersectObjects(city.targets,true)[0];
  assert.ok(hit,anchor.workId+' can be selected.');assert.equal(hit.object.userData.workId,anchor.workId,anchor.workId+' is not hidden behind furniture or another frame.');
  const aim=new THREE.Vector3(-Math.sin(anchor.yaw),0,-Math.cos(anchor.yaw));assert.ok(aim.dot(raycaster.ray.direction)>.999,'Artwork approach yaw faces its work.');frameCount++;
 }
 // From above, roofs present their exterior faces; incorrectly wound triangles
 // would disappear and the ray would reach the floor or furniture instead.
 raycaster.set(new THREE.Vector3(house.cx+.8,8,house.cz),new THREE.Vector3(0,-1,0));const roofHit=raycaster.intersectObject(house.group,true)[0];assert.ok(roofHit?.point.y>3,house.id+' has a visible solid roof.');
 raycaster.set(new THREE.Vector3(house.cx+2,1.7,house.cz-4*direction),new THREE.Vector3(0,0,direction));assert.ok(raycaster.intersectObject(house.group,true)[0]?.distance<1.2,house.id+' has a solid back wall.');
}
assert.equal(frameCount,60);
let meshCount=0,instanceCount=0;const uniqueGeometry=new Set(),uniqueMaterial=new Set();
group.traverse(object=>{assert.ok(object.position.toArray().every(Number.isFinite)&&object.scale.toArray().every(Number.isFinite));if(!object.isMesh)return;meshCount++;if(object.isInstancedMesh)instanceCount+=object.count;uniqueGeometry.add(object.geometry);for(const mat of Array.isArray(object.material)?object.material:[object.material])uniqueMaterial.add(mat);for(const attribute of Object.values(object.geometry.attributes))for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)assert.ok(Number.isFinite(attribute.getComponent(i,c)));});
assert.ok(meshCount<400,`Keep the whole city below 400 draw objects, got ${meshCount}.`);assert.equal(instanceCount,110,'Small furniture parts use shared instance batches.');
assert.ok(uniqueGeometry.size<90,'Repeated frames and construction geometry are shared.');
assert.ok(group.getObjectsByProperty('isMesh',true).some(o=>o.userData.artAction==='return-home'));
for(const house of houses)assert.ok(house.group.getObjectsByProperty('isMesh',true).some(o=>o.userData.artAction==='profile'&&o.userData.artistId===house.id));
let geometryDisposals=0,materialDisposals=0;for(const geometry of uniqueGeometry)geometry.addEventListener('dispose',()=>geometryDisposals++);for(const mat of uniqueMaterial)mat.addEventListener('dispose',()=>materialDisposals++);
city.dispose();assert.equal(group.children.length,0);assert.equal(geometryDisposals,uniqueGeometry.size);assert.equal(materialDisposals,uniqueMaterial.size);city.dispose();assert.equal(geometryDisposals,uniqueGeometry.size,'Disposal is idempotent.');
assert.throws(()=>buildArtCity(THREE,[]),/one to ten/);assert.throws(()=>buildArtCity(THREE,[artists[0],artists[0]]),/unique/);

// Shared local artwork loads preserve aspect ratio, do not request source URLs,
// and clean up safely even if an image finishes after leaving the city.
const requests=[],priorDocument=globalThis.document;
globalThis.document={createElement:()=>({getContext:()=>null})};
class TextureLoader{load(url,onLoad,progress,onError){const texture=new THREE.Texture();requests.push({url,texture,onLoad,onError});return texture;}}
const stub={...THREE,TextureLoader};
const shared={...artists[0],works:artists[0].works.map(work=>({...work,imageUrl:'./art-city/artworks/shared.webp'}))};
const images=buildArtCity(stub,[shared]),paintings=images.group.getObjectsByProperty('isMesh',true).filter(o=>o.userData.workId&&o.geometry.type==='PlaneGeometry');assert.equal(requests.length,1,'Frames sharing an asset request it once.');
requests[0].texture.image={width:240,height:100};requests[0].onLoad(requests[0].texture);assert.equal(paintings.length,6);for(const art of paintings){assert.equal(art.userData.imageStatus,'ready');assert.equal(art.material.map,requests[0].texture);assert.ok(Math.abs(art.scale.x/art.scale.y-2.4)<1e-8,'Images retain their original proportions.');}
let imageDisposed=0;requests[0].texture.addEventListener('dispose',()=>imageDisposed++);images.dispose();assert.equal(imageDisposed,1);requests[0].onLoad(requests[0].texture);assert.equal(imageDisposed,1,'A late callback does not dispose the same texture twice.');
const failed=buildArtCity(stub,[shared]);requests.at(-1).onError(new Error('Missing image'));for(const art of failed.group.getObjectsByProperty('isMesh',true).filter(o=>o.userData.imageUrl)){assert.equal(art.userData.imageStatus,'unavailable');assert.equal(art.material.map,null);}failed.dispose();
const count=requests.length,external=buildArtCity(stub,[{...shared,works:shared.works.map(w=>({...w,imageUrl:'https://outside.example/art.jpg'}))}]);assert.equal(requests.length,count,'Catalog source links never trigger automatic external requests.');external.dispose();
const pending=buildArtCity(stub,[shared]),last=requests.at(-1);pending.dispose();last.onLoad(last.texture);assert.equal(pending.group.children.length,0,'A late image cannot revive a disposed neighbourhood.');
if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;
console.log(`Artist City geometry passed: 10 open-door houses, 60 reachable and selectable artworks, ${meshCount} meshes, ${uniqueGeometry.size} shared geometries.`);
