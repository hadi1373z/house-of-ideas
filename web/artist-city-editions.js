import {buildArtCity} from './art-city-scene.js';
import {ARTIST_HOME_LIMITS,validateArtistDesign} from './artist-home-data.js';

// Approved homes occupy new lots. The original ten buildings and their
// colliders are read as templates, never edited or replaced by this layer.
export function buildArtistCityEditions(THREE,artists,baseCity,editions=[]){
 if(!THREE?.Group||!Array.isArray(artists)||!baseCity?.group||!Array.isArray(baseCity.houses)||!Array.isArray(editions)||editions.length>ARTIST_HOME_LIMITS.editions)throw Error('Build approved artist homes from the existing city and a bounded edition archive.');
 const ids=new Set(),catalog=new Map(artists.map(artist=>[artist.id,artist]));
 const designs=editions.map(edition=>{
  if(!edition||typeof edition!=='object'||Array.isArray(edition)||!catalog.has(edition.artistId)||typeof edition.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(edition.id)||ids.has(edition.id)||!Number.isInteger(edition.number)||edition.number<2)throw Error('Each approved home needs a distinct edition and a known artist.');
  ids.add(edition.id);const design=validateArtistDesign(Object.fromEntries(['title','reason','exercise','feature','atmosphere'].map(key=>[key,edition[key]])));
  return {...edition,...design};
 });
 const group=new THREE.Group();group.name='Approved artist homes';
 const houses=[],colliders=[],materials=new Map(),geometries=new Map(),textures=new Set(),templates=new Map(),roofs=new Map();let disposed=false;
 const bounds={...baseCity.bounds,maxZ:editions.length?23+Math.floor((editions.length-1)/5)*14+7:baseCity.bounds.maxZ};
 const material=(color,basic=false)=>{const key=color+':'+basic;if(!materials.has(key))materials.set(key,basic?new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(key);};
 const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);};
 const box=(parent,w,h,d,x,y,z,color,data)=>{const mesh=new THREE.Mesh(geometry(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),material(color));mesh.position.set(x,y,z);if(data)mesh.userData={...data};parent.add(mesh);return mesh;};
 const sphere=(parent,r,x,y,z,color,data,scale)=>{const mesh=new THREE.Mesh(geometry('sphere:'+r,()=>new THREE.SphereGeometry(r,12,8)),material(color));mesh.position.set(x,y,z);if(scale)mesh.scale.set(...scale);if(data)mesh.userData={...data};parent.add(mesh);return mesh;};
 const cylinder=(parent,r,h,x,y,z,color,data)=>{const mesh=new THREE.Mesh(geometry(`cylinder:${r}:${h}`,()=>new THREE.CylinderGeometry(r,r,h,14)),material(color));mesh.position.set(x,y,z);if(data)mesh.userData={...data};parent.add(mesh);return mesh;};
 const point=(house,x,z)=>({x:house.cx-x,z:house.cz-z});
 function collision(house,x,z,w,d,label){const p=point(house,x,z);colliders.push({minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2,label,artistEditionId:house.editionId});}
 function plaque(parent,text,w,h,x,y,z,rotation,data){
  const mesh=new THREE.Mesh(geometry('plaque',()=>new THREE.PlaneGeometry(1,1)),material('#344a45',true));mesh.position.set(x,y,z);mesh.scale.set(w,h,1);mesh.rotation.y=rotation;mesh.userData={...data};parent.add(mesh);
  if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#344a45';ctx.fillRect(0,0,768,160);ctx.fillStyle='#fff4dc';ctx.font='600 44px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(text).slice(0,60),384,80,730);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.set('plaque:'+materials.size,mat);mesh.material=mat;}}
  return mesh;
 }
 function fitCopies(texture){
  if(disposed||!texture.image)return;
  group.traverse(mesh=>{if(!mesh.isMesh||!mesh.userData.workId||mesh.geometry.type!=='PlaneGeometry'||mesh.material.map!==texture)return;const ratio=Number(texture.image.width)/Number(texture.image.height);if(!Number.isFinite(ratio)||ratio<=0)return;mesh.userData.imageStatus='ready';if(1.4/1.06>ratio)mesh.scale.set(1.06*ratio,1.06,1);else mesh.scale.set(1.4,1.4/ratio,1);});
 }
 const factoryThree={...THREE,TextureLoader:class{load(url,onLoad,progress,onError){return new THREE.TextureLoader().load(url,texture=>{onLoad(texture);fitCopies(texture);},progress,error=>{onError(error);if(!disposed)group.traverse(mesh=>{if(mesh.userData.imageUrl===url)mesh.userData.imageStatus='unavailable';});});}}};
 function template(artist){if(!templates.has(artist.id)){const city=buildArtCity(factoryThree,[artist],{artworkUrl:(_,work)=>work.imageUrl});templates.set(artist.id,{city,house:city.houses[0]});}return templates.get(artist.id);}
 function atmosphere(house,design,data){
  const parent=house.group;
  if(design.atmosphere==='garden')for(const x of [-3.94,3.94]){
   cylinder(parent,.22,.35,x,.175,2.6,'#ac8060',data);cylinder(parent,.18,.018,x,.36,2.6,'#655442',data);
   for(let i=0;i<4;i++)sphere(parent,.14,x+(i%2?-.1:.1),.59+Math.floor(i/2)*.2,2.6+(i%2?-.08:.08),'#6f8e68',data,[.75,1.45,.7]);
   collision(house,x,2.6,.48,.48,'Edition garden pot');
  }
  if(design.atmosphere==='contrast')for(const [x,tone] of [[-3.07,'#a75548'],[3.07,'#50748a']])box(parent,.22,1.1,.06,x,1.62,3.15,tone,data);
  if(design.atmosphere==='quiet'){for(const x of [-3.15,3.15])box(parent,.16,.98,.06,x,1.64,3.15,'#8b806a',data);box(parent,1.76,.065,.08,0,2.2,3.17,'#bcac8c',data);}
 }
 function study(house,design){
  const data={artistId:house.artistId,artistEditionId:house.editionId,artAction:'edition-study',label:'Try '+design.title,feature:design.feature,exercise:design.exercise};
  let target,approach;
  if(design.feature==='observation-alcove'){
   const parent=new THREE.Group();house.group.add(parent);
   box(parent,.62,.13,.6,-2.6,.48,2.15,'#8d9d86',data);box(parent,.62,.6,.09,-2.6,.79,2.43,'#8d9d86',data);
   for(const x of [-2.85,-2.35])for(const z of [1.92,2.38])box(parent,.07,.42,.07,x,.21,z,'#826f55',data);
   collision(house,-2.6,2.15,.7,.7,'Observation alcove chair');
   box(parent,.34,.055,.34,-2.6,.67,1.55,'#9c8060',data);for(const x of [-2.73,-2.47])for(const z of [1.42,1.68])box(parent,.045,.64,.045,x,.32,z,'#826f55',data);
   collision(house,-2.6,1.55,.34,.34,'Observation notes table');
   box(parent,.24,.032,.2,-2.6,.714,1.55,'#eee4c9',data);box(parent,.014,.038,.205,-2.6,.715,1.55,'#8f8062',data);
   for(let line=0;line<3;line++)box(parent,.085,.003,.009,-2.66,.733,1.495+line*.045,'#8b9a8a',data);
   plaque(house.group,'Observe, then compare',1.22,.22,-2.45,1.17,2.76,Math.PI,data);
   target={x:-2.6,y:.73,z:1.55};approach={x:-2.35,z:.92};
  }else if(design.feature==='composition-wall'){
   box(house.group,1.5,1.16,.05,2,1.83,2.85,'#7f715b',data);box(house.group,1.37,1.03,.008,2,1.83,2.819,'#e4dcc8',data);
   const tones=design.atmosphere==='contrast'?['#a85548','#c7a44e','#52798e','#65715c','#e3dbbd','#8f6167']:['#9caa8c','#c0b18f','#7f9da1','#aa907b','#d6c9ad','#99a088'];
   for(let i=0;i<6;i++)box(house.group,.34,.27,.008,1.59+(i%3)*.41,1.61+Math.floor(i/3)*.43,2.809,tones[i],data);
   plaque(house.group,'Change one interval',1.3,.18,2,1.17,2.812,Math.PI,data);
   target={x:2,y:1.83,z:2.803};approach={x:.85,z:1.9};
  }else{
   box(house.group,.42,.025,.18,2.34,.857,1.87,'#7e725b',data);
   box(house.group,.105,.027,.11,2.2,.883,1.87,'#b18b62',data);box(house.group,.105,.042,.11,2.34,.89,1.87,'#959d95',data);box(house.group,.105,.022,.11,2.48,.882,1.87,'#b2929e',data);
   for(let line=0;line<3;line++)box(house.group,.095,.003,.007,2.2,.899,1.837+line*.03,'#85663f',data);
   plaque(house.group,'Compare material and use',1.55,.2,2.15,1.22,2.82,Math.PI,data);
   target={x:2.34,y:.918,z:1.87};approach={x:.85,z:1.65};
  }
  const stand=point(house,approach.x,approach.z),aim=point(house,target.x,target.z),lookAt={x:aim.x,y:target.y,z:aim.z},anchor={x:stand.x,z:stand.z,yaw:Math.atan2(stand.x-aim.x,stand.z-aim.z)};
  house.study={...data,anchor,lookAt};house.approaches.push({...house.study,x:stand.x,z:stand.z,yaw:anchor.yaw});
  house.group.traverse(mesh=>{if(mesh.userData.artAction==='edition-study')mesh.userData={...mesh.userData,anchor,lookAt};});
 }
 function release(){if(disposed)return;disposed=true;group.traverse(object=>{if(object.isInstancedMesh)object.dispose();});for(const item of templates.values())item.city.dispose();for(const texture of textures)texture.dispose();for(const mat of new Set(materials.values()))mat.dispose();for(const geo of geometries.values())geo.dispose();group.clear();}
 try{
  if(designs.length){
   box(group,56,.08,bounds.maxZ-16.7,0,-.08,(bounds.maxZ+16.7)/2,'#abb997');
   for(const x of [-25,-15,-5,5,15,25])box(group,2.1,.06,bounds.maxZ-12,x,-.01,(bounds.maxZ+12)/2,'#cdc4ae');
   for(let row=0;row<=Math.floor((designs.length-1)/5);row++)box(group,52,.06,3.2,0,-.01,17.6+row*14,'#cdc4ae');
  }
  for(let i=0;i<designs.length;i++){
   const design=designs[i],artist=catalog.get(design.artistId),original=template(artist),cx=(i%5-2)*10,cz=23+Math.floor(i/5)*14,home=original.house.group.clone(true);home.name=artist.name+' · home '+design.number;home.position.set(cx,0,cz);home.rotation.y=Math.PI;group.add(home);
   const originalRoof=baseCity.houses.find(house=>house.artistId===artist.id)?.group.children.find(mesh=>mesh.isMesh&&mesh.geometry.type==='BufferGeometry');
   if(originalRoof){if(!roofs.has(artist.id)){const geometry=originalRoof.geometry.clone(),material=originalRoof.material.clone();geometries.set('roof:'+artist.id,geometry);materials.set('roof:'+artist.id,material);roofs.set(artist.id,{geometry,material});}const roof=home.children.find(mesh=>mesh.isMesh&&mesh.geometry.type==='BufferGeometry');if(roof){roof.geometry=roofs.get(artist.id).geometry;roof.material=roofs.get(artist.id).material;}}
   const house={...design,id:design.id,editionId:design.id,artistId:artist.id,name:artist.name,group:home,row:1,direction:-1,cx,cz,minX:cx-3.5,maxX:cx+3.5,minZ:cz-3,maxZ:cz+3,approaches:[]};houses.push(house);
   const transform=p=>({x:cx-(p.x-original.house.cx),z:cz-(p.z-original.house.cz)}),turn=yaw=>Math.atan2(Math.sin(yaw+Math.PI),Math.cos(yaw+Math.PI));
   house.entry={...transform(original.house.entry),yaw:turn(original.house.entry.yaw),artistId:artist.id,artistEditionId:design.id};
   house.spawnInside={...transform(original.house.spawnInside),yaw:turn(original.house.spawnInside.yaw),artistId:artist.id,artistEditionId:design.id};
   house.approaches=original.house.approaches.map(anchor=>({...anchor,...transform(anchor),yaw:turn(anchor.yaw),artistEditionId:design.id,lookAt:{...transform(anchor.lookAt),y:anchor.lookAt.y}}));
   home.traverse(object=>{object.userData={...object.userData,artistId:artist.id,artistEditionId:design.id};});
   for(const c of original.city.colliders){if(c.label==='Return gate post')continue;colliders.push({...c,minX:cx-(c.maxX-original.house.cx),maxX:cx-(c.minX-original.house.cx),minZ:cz-(c.maxZ-original.house.cz),maxZ:cz-(c.minZ-original.house.cz),artistEditionId:design.id});}
   const instanceTransform=new THREE.Matrix4().makeTranslation(cx,0,cz).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(-original.house.cx,0,-original.house.cz));
   for(const mesh of original.city.group.children.filter(object=>object.isInstancedMesh)){
    const copy=mesh.clone();for(let n=0;n<copy.count;n++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(n,matrix);copy.setMatrixAt(n,instanceTransform.clone().multiply(matrix));}copy.instanceMatrix.needsUpdate=true;copy.computeBoundingBox();copy.computeBoundingSphere();copy.userData={artistId:artist.id,artistEditionId:design.id,artAction:'profile',label:'Explore '+artist.name+'’s home '+design.number};group.add(copy);
   }
   box(group,1.7,.025,2.5,cx,.0025,cz-4.6,'#d8ceb9');
   const profile={artistId:artist.id,artistEditionId:design.id,artAction:'profile',label:artist.name+' · preserved home '+design.number};
   plaque(home,'Home '+design.number+' · '+design.title,2.02,.25,2.15,.6,3.2,0,profile);atmosphere(house,design,profile);study(house,design);
   home.traverse(object=>{object.userData={...object.userData,artistId:artist.id,artistEditionId:design.id};});
   home.traverse(object=>{if(object.isMesh&&object.userData.workId&&object.material.map?.image)fitCopies(object.material.map);});
  }
  group.updateMatrixWorld(true);
 }catch(error){release();throw error;}
 const fullColliders=[...(baseCity.colliders||[]),...colliders],collisionCells=new Map();
 for(const collider of fullColliders)for(let x=Math.floor((collider.minX-.22)/2);x<=Math.floor((collider.maxX+.22)/2);x++)for(let z=Math.floor((collider.minZ-.22)/2);z<=Math.floor((collider.maxZ+.22)/2);z++){const key=x+':'+z;if(!collisionCells.has(key))collisionCells.set(key,[]);collisionCells.get(key).push(collider);}
 function houseFor(artistId,editionId){return editionId?houses.find(house=>house.artistId===artistId&&house.editionId===editionId)||null:baseCity.houses.find(house=>house.artistId===artistId)||null;}
 function insideHouseAt(x,z){return [...baseCity.houses,...houses].find(house=>x>house.minX+.16&&x<house.maxX-.16&&z>house.minZ+.16&&z<house.maxZ-.16)||null;}
 function canStand(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&x>bounds.minX+.22&&x<bounds.maxX-.22&&z>bounds.minZ+.22&&z<bounds.maxZ-.22&&!(collisionCells.get(Math.floor(x/2)+':'+Math.floor(z/2))||[]).some(c=>x>c.minX-.22&&x<c.maxX+.22&&z>c.minZ-.22&&z<c.maxZ+.22);}
 return {group,targets:[group],houses,colliders,bounds,houseFor,insideHouseAt,insideAt(x,z){return insideHouseAt(x,z)?.artistId||null;},canStand,entryFor(artistId,editionId){const house=houseFor(artistId,editionId);return house?{...house.spawnInside}:null;},dispose:release};
}
