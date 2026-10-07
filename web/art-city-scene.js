// A walkable, fictional artists' neighbourhood. The supplied catalog owns the
// artwork titles and images; these buildings make places to explore them.
export function buildArtCity(THREE,artists,{artworkUrl}={}){
 if(!THREE?.Group||!Array.isArray(artists)||artists.length<1||artists.length>10)throw Error('Build the artist city with one to ten catalog artists.');
 const ids=new Set();for(const artist of artists)if(!artist||typeof artist.id!=='string'||ids.has(artist.id)){throw Error('Each city house needs a unique catalog artist.');}else ids.add(artist.id);
 const group=new THREE.Group();group.name='Artist City';
 const houses=[],colliders=[],materials=new Map(),geometries=new Map(),textures=new Map(),disposedTextures=new WeakSet(),artMeshes=[],legMatrices=[],brushMatrices=[];
 const bounds={minX:-28,maxX:28,minZ:-17,maxZ:17},spawn={x:-24,z:0,yaw:-Math.PI/2},guideAnchor={x:0,z:0,yaw:-Math.PI/2};let disposed=false;
 const color=(value,fallback)=>typeof value==='string'&&/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(value)?value:fallback;
 const material=(tone,kind='standard')=>{const key=kind+tone;if(!materials.has(key))materials.set(key,kind==='basic'?new THREE.MeshBasicMaterial({color:tone,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:tone,roughness:.86}));return materials.get(key);};
 const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
 function box(parent,w,h,d,x,y,z,tone,data){const mesh=new THREE.Mesh(geometry(['box',w,h,d].join(':'),()=>new THREE.BoxGeometry(w,h,d)),material(tone));mesh.position.set(x,y,z);if(data)mesh.userData={...data};parent.add(mesh);return mesh;}
 function worldPoint(house,x,z){const direction=house.row===0?1:-1;return {x:house.cx+direction*x,z:house.cz+direction*z};}
 function collision(house,x,z,w,d,label){const p=worldPoint(house,x,z);colliders.push({minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2,label});}
 function addLeg(house,x,y,z,w,h,d){const p=worldPoint(house,x,z),matrix=new THREE.Matrix4().compose(new THREE.Vector3(p.x,y,p.z),new THREE.Quaternion(),new THREE.Vector3(w,h,d));legMatrices.push(matrix);}
 function localMatrix(house,x,y,z,rotation){const p=worldPoint(house,x,z),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y+(house.row===1?Math.PI:0),rotation.z));return new THREE.Matrix4().compose(new THREE.Vector3(p.x,y,p.z),q,new THREE.Vector3(1,1,1));}
 function plaque(parent,title,w,h,x,y,z,rotation,data,tone='#263d3e'){
  const mesh=new THREE.Mesh(geometry('label-plane',()=>new THREE.PlaneGeometry(1,1)),material(tone,'basic'));mesh.scale.set(w,h,1);mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.userData={...data,label:data?.label||title};parent.add(mesh);
  if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=tone;ctx.fillRect(0,0,768,192);ctx.fillStyle='#fff7e9';ctx.font='600 46px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(title).slice(0,55),384,96,716);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.set('label:'+textures.size,texture);const labelMaterial=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.set('label:'+materials.size,labelMaterial);mesh.material=labelMaterial;}}
  return mesh;
 }
 function roofGeometry(style){return geometry('roof:'+style,()=>{
  const tall=style==='high'?4.7:style==='hip'?4.1:4.35,ridge=style==='hip'?1.45:3.36,shift=style==='offset'?.4:0,w=style==='eaves'?4.05:3.83;
  const p=[[-w,3,-3.36],[w,3,-3.36],[w,3,3.36],[-w,3,3.36],[shift,tall,-ridge],[shift,tall,ridge]],faces=[[4,1,0],[5,2,1],[4,5,1],[5,3,2],[4,0,3],[5,4,3],[2,3,0],[1,2,0]],vertices=faces.flatMap(face=>face.flatMap(index=>p[index]));
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));result.computeVertexNormals();return result;
 });}
 function windowWallGeometry(){return geometry('window-wall',()=>{const outer=new THREE.Shape();outer.moveTo(-3.5,0);outer.lineTo(-.9,0);outer.lineTo(-.9,3);outer.lineTo(-3.5,3);outer.closePath();const hole=new THREE.Path();hole.moveTo(-2.83,1.1);hole.lineTo(-2.83,2.12);hole.lineTo(-1.57,2.12);hole.lineTo(-1.57,1.1);hole.closePath();outer.holes.push(hole);const result=new THREE.ExtrudeGeometry(outer,{depth:.18,bevelEnabled:false});result.translate(0,0,2.91);return result;});}
 function windowFrameGeometry(){return geometry('window-frame',()=>{const shape=new THREE.Shape();shape.moveTo(-.72,-.59);shape.lineTo(.72,-.59);shape.lineTo(.72,.59);shape.lineTo(-.72,.59);shape.closePath();const hole=new THREE.Path();hole.moveTo(-.6,-.47);hole.lineTo(-.6,.47);hole.lineTo(.6,.47);hole.lineTo(.6,-.47);hole.closePath();shape.holes.push(hole);return new THREE.ShapeGeometry(shape);});}
 function localImageUrl(value){
  if(typeof value!=='string'||value.length>1200||value.includes('\\')||value.split(/[/?#]/).includes('..'))return null;
  if(/^blob:/i.test(value))return value;
  // The catalog's bundled raster assets are local to the offline app or Pages.
  // A source link belongs in the inspector, rather than an automatic request.
  if(/^(?:\.\/|\/)?[a-z0-9_.\-/]+\.(?:jpe?g|png|webp)$/i.test(value)&&!value.includes('//'))return value;
  return null;
 }
 function fitArt(mesh,width,height){const image=mesh.material.map?.image,ratio=Number(image?.width)/Number(image?.height);if(!Number.isFinite(ratio)||ratio<=0){mesh.scale.set(width,height,1);return;}if(width/height>ratio)mesh.scale.set(height*ratio,height,1);else mesh.scale.set(width,width/ratio,1);}
 function disposeTexture(texture){if(!disposedTextures.has(texture)){disposedTextures.add(texture);texture.dispose();}}
 function loadArtwork(mesh,artist,work){
  let requested;try{requested=artworkUrl?artworkUrl(artist,work):work.imageUrl||work.image;}catch{requested=null;}
  const url=localImageUrl(requested);mesh.userData.imageStatus=url?'loading':'unavailable';
  if(!url)return;if(typeof document==='undefined'){mesh.userData.imageStatus='offline-placeholder';return;}mesh.userData.imageUrl=url;
  if(!textures.has(url))try{const texture=new THREE.TextureLoader().load(url,loaded=>{loaded.colorSpace=THREE.SRGBColorSpace;if(disposed){disposeTexture(loaded);return;}for(const frame of artMeshes)if(frame.userData.imageUrl===url){frame.material.map=loaded;frame.material.color.set('#ffffff');frame.material.needsUpdate=true;frame.userData.imageStatus='ready';fitArt(frame,1.4,1.06);}},undefined,()=>{if(!disposed)for(const frame of artMeshes)if(frame.userData.imageUrl===url){frame.userData.imageStatus='unavailable';frame.material.map=null;frame.material.needsUpdate=true;}});texture.colorSpace=THREE.SRGBColorSpace;textures.set(url,texture);}catch{mesh.userData.imageStatus='unavailable';return;}
  mesh.material.map=textures.get(url);if(mesh.material.map?.image?.width){mesh.userData.imageStatus='ready';mesh.material.color.set('#ffffff');}fitArt(mesh,1.4,1.06);
 }
 function addWork(house,artist,work,index,position,rotation,approach){
  const frame=new THREE.Group();frame.name='Artwork '+work.id;frame.position.set(position.x,1.62,position.z);frame.rotation.y=rotation;frame.userData={artistId:artist.id,workId:work.id,label:String(work.title||work.id).slice(0,180)};house.group.add(frame);
  box(frame,1.63,1.28,.07,0,0,0,'#64513c',frame.userData);
  const mat=new THREE.MeshBasicMaterial({color:'#eee9dd',side:THREE.DoubleSide});materials.set('work:'+artist.id+':'+index,mat);
  const painting=new THREE.Mesh(geometry('art-plane',()=>new THREE.PlaneGeometry(1,1)),mat);painting.position.z=.044;painting.scale.set(1.4,1.06,1);painting.userData={...frame.userData};frame.add(painting);artMeshes.push(painting);loadArtwork(painting,artist,work);
  const p=worldPoint(house,approach.x,approach.z),target=worldPoint(house,position.x,position.z);house.approaches.push({artistId:artist.id,workId:work.id,x:p.x,z:p.z,yaw:Math.atan2(p.x-target.x,p.z-target.z),lookAt:{x:target.x,y:1.62,z:target.z}});
 }
 function facadeDetails(house,artist,accent){
  const parent=house.group,data={artistId:artist.id,artAction:'profile',label:'Discover '+house.name+'’s approach'};let layer=0;
  const panel=(w,h,x,y,tone,turn=0)=>{const mesh=box(parent,w,h,.045,x,y,3.13,tone,data);mesh.rotation.z=turn;return mesh;};
  const circle=(radius,x,y,tone,ring=false)=>{const mesh=new THREE.Mesh(geometry((ring?'ring:':'circle:')+radius,()=>ring?new THREE.RingGeometry(radius*.72,radius,24):new THREE.CircleGeometry(radius,24)),material(tone,'basic'));mesh.position.set(x,y,3.17+(++layer)*.005);mesh.userData={...data};parent.add(mesh);return mesh;};
  // These architectural studies are invented teaching details, not reproductions
  // or claims about the artists' historical homes.
  switch(artist.id){
   case 'monet':{
    box(parent,1.5,.24,.36,-2.2,.2,3.37,'#6e7960',data);collision(house,-2.2,3.37,1.5,.36,'Flower planter');
    for(let flower=0;flower<4;flower++){const x=-2.7+flower*.33;box(parent,.026,.24,.026,x,.43,3.45,'#5b7957',data);const bloom=circle(.085,x,.56,['#d09bb2','#ead1a0','#baa3d0','#eac4a4'][flower]);bloom.position.z=3.47;}
    break;
   }
   case 'kandinsky':panel(1.45,1.16,2.2,1.62,'#d5c7a9');circle(.37,2.07,1.64,'#3c6684');circle(.23,2.42,1.83,'#c79848');circle(.15,2.4,1.4,'#9d534f');panel(1.5,.045,2.19,1.72,'#414547',.6);break;
   case 'van-gogh':circle(.5,2.2,1.66,'#cfaa55');circle(.29,2.2,1.66,'#906b3c');for(let ray=0;ray<4;ray++)panel(.09,1.36,2.2,1.66,'#cfaa55',ray*Math.PI/4);circle(.26,2.2,1.66,'#806844');break;
   case 'hokusai':for(const y of [.65,1.28,1.91,2.55])panel(2.24,.11,2.2,y,'#67564a');panel(.12,2.06,1.36,1.61,'#67564a');panel(.12,2.06,3.04,1.61,'#67564a');break;
   case 'rodin':{
    box(parent,.58,.55,.48,-2.2,.3,3.47,'#7d796f',data);collision(house,-2.2,3.47,.58,.48,'Sculpture study plinth');
    const torso=new THREE.Mesh(geometry('sculpture-torso',()=>new THREE.DodecahedronGeometry(.27)),material('#646957'));torso.position.set(-2.2,.83,3.47);torso.scale.set(.85,1.35,.75);torso.userData={...data};parent.add(torso);
    const head=new THREE.Mesh(geometry('sculpture-head',()=>new THREE.IcosahedronGeometry(.16,1)),material('#646957'));head.position.set(-2.2,1.25,3.47);head.userData={...data};parent.add(head);break;
   }
   case 'hilma-af-klint':panel(1.48,1.5,2.2,1.6,'#d7b99b');circle(.44,2.2,1.69,'#bd8e91',true);circle(.24,2.2,1.97,'#eee0b3');circle(.25,2.2,1.39,'#6f93a1');circle(.12,2.2,1.69,'#ad9672');break;
   case 'mondrian':panel(1.7,1.38,2.2,1.65,'#303639');panel(.88,.75,1.86,1.9,'#b45d4c');panel(.59,.75,2.65,1.9,'#f2eee3');panel(.88,.43,1.86,1.23,'#e5c970');panel(.59,.43,2.65,1.23,'#597ba5');break;
   case 'lange':for(let frame=0;frame<3;frame++){panel(.53,1.08,1.55+frame*.65,1.65,'#6b6b64');panel(.41,.78,1.55+frame*.65,1.69,['#bab8ac','#9c9e97','#d1cec2'][frame]);}break;
   case 'morris':for(let motif=0;motif<6;motif++){const x=1.55+(motif%3)*.62,y=1.35+Math.floor(motif/3)*.6;panel(.38,.38,x,y,accent,Math.PI/4);circle(.1,x,y,'#d6c8a2');}break;
   case 'klee':for(let tile=0;tile<6;tile++)panel(.54,.5,1.58+(tile%3)*.62,1.34+Math.floor(tile/3)*.58,['#ad856c','#cdb26e','#9c665e','#83a1a1','#b795a0','#768a6d'][tile]);break;
  }
 }
 box(group,56,.08,34,0,-.08,0,'#a8b797');box(group,53,.06,7,0,-.01,0,'#cdc4ae');
 group.add(new THREE.AmbientLight('#fff4e4',.45));
 const roofStyles=['gable','offset','high','eaves','hip','high','gable','hip','eaves','offset'],roofColors=['#62766f','#424d61','#936e50','#394f68','#696967','#774f5d','#6b6973','#646e6f','#55736b','#857367'];
 for(let index=0;index<artists.length;index++){
  const artist=artists[index],row=Math.floor(index/5),cx=(index%5-2)*10,cz=row===0?-9:9,houseGroup=new THREE.Group();houseGroup.name=String(artist.name||artist.id);houseGroup.position.set(cx,0,cz);houseGroup.rotation.y=row===1?Math.PI:0;group.add(houseGroup);
  const house={id:artist.id,artistId:artist.id,name:artist.name||artist.id,row,cx,cz,group:houseGroup,minX:cx-3.5,maxX:cx+3.5,minZ:cz-3,maxZ:cz+3,approaches:[]};houses.push(house);
  const accent=color(artist.color,'#7c927b'),wallTone=color(artist.background,'#ece8dd');
  box(houseGroup,7,.08,6,0,-.04,0,index%2?'#c8bba4':'#d6cbb6');
  box(houseGroup,7,3,.18,0,1.5,-3,wallTone);collision(house,0,-3,7,.18,'Back wall');
  for(const x of [-3.5,3.5]){box(houseGroup,.18,3,6,x,1.5,0,wallTone);collision(house,x,0,.18,6,'Side wall');}
  const left=new THREE.Mesh(windowWallGeometry(),material(wallTone));houseGroup.add(left);collision(house,-2.2,3,2.6,.18,'Glazed front wall');
  box(houseGroup,2.6,3,.18,2.2,1.5,3,wallTone);collision(house,2.2,3,2.6,.18,'Front wall');
  const enter={artistId:artist.id,artAction:'enter',label:'Enter '+house.name+'’s house'};
  box(houseGroup,1.8,.75,.18,0,2.625,3,accent,enter);
  const roof=new THREE.Mesh(roofGeometry(roofStyles[index]),material(roofColors[index]));houseGroup.add(roof);
  const windowFrame=new THREE.Mesh(windowFrameGeometry(),material('#f3ede0','basic'));windowFrame.position.set(-2.2,1.61,3.115);houseGroup.add(windowFrame);
  const glass=new THREE.Mesh(geometry('window-glass',()=>new THREE.PlaneGeometry(1.23,1)),new THREE.MeshStandardMaterial({color:'#bed7dc',roughness:.14,metalness:.1,transparent:true,opacity:.3,side:THREE.DoubleSide}));materials.set('glass:'+index,glass.material);glass.position.set(-2.2,1.61,3.025);houseGroup.add(glass);
  box(houseGroup,2.75,.44,.08,0,2.45,3.15,'#263d3e',{artistId:artist.id,artAction:'profile',label:'Explore '+house.name});
  plaque(houseGroup,house.name,2.63,.35,0,2.45,3.196,0,{artistId:artist.id,artAction:'profile',label:'About '+house.name});
  box(houseGroup,1.7,.035,.5,0,.0175,3.2,'#d6c6ac',enter);
  box(houseGroup,2.05,.11,.68,0,.47,.5,'#725d48',{artistId:artist.id,artAction:'profile',label:'Reflect on '+house.name+'’s work'});collision(house,0,.5,2.05,.68,'Gallery bench');
  for(const x of [-.82,.82])for(const z of [.27,.73])addLeg(house,x,.23,z,.12,.43,.12);
  box(houseGroup,1.3,.1,.68,2.03,.77,1.65,'#8a7156',{artistId:artist.id,artAction:'profile',label:'Try '+house.name+'’s approach'});collision(house,2.03,1.65,1.3,.68,'Artist worktable');
  for(const x of [1.51,2.55])for(const z of [1.43,1.87])addLeg(house,x,.38,z,.11,.73,.11);
  const palette=new THREE.Mesh(geometry('palette',()=>new THREE.CylinderGeometry(.2,.2,.025,16)),material(accent));palette.scale.z=.7;palette.position.set(1.84,.84,1.65);palette.userData={artistId:artist.id,artAction:'profile',label:'Explore '+house.name+'’s artistic practice'};houseGroup.add(palette);
  facadeDetails(house,artist,accent);
  for(let brush=0;brush<3;brush++)brushMatrices.push(localMatrix(house,2.2+brush*.06,.837,1.65,{x:Math.PI/2,y:.3+brush*.18,z:0}));
  const works=Array.isArray(artist.works)?artist.works.slice(0,6):[];
  const positions=[{x:-2.05,z:-2.85},{x:0,z:-2.85},{x:2.05,z:-2.85},{x:-3.35,z:-1.35},{x:-3.35,z:.65},{x:3.35,z:-.65}],turns=[0,0,0,Math.PI/2,Math.PI/2,-Math.PI/2],approaches=[{x:-2.05,z:-1.45},{x:0,z:-1.45},{x:2.05,z:-1.45},{x:-2,z:-1.35},{x:-2,z:.65},{x:2,z:-.65}];
  for(let work=0;work<works.length;work++)addWork(house,artist,works[work],work,positions[work],turns[work],approaches[work]);
  const door=worldPoint(house,0,3),inside=worldPoint(house,0,1.85);house.entry={x:door.x,z:door.z+(row===0?.7:-.7),yaw:row===0?0:Math.PI};house.spawnInside={x:inside.x,z:inside.z,yaw:row===0?0:Math.PI,artistId:artist.id};
  box(group,1.7,.025,2.5,cx,.0025,row===0?-4.55:4.55,'#d8ceb9');
 }
 const legs=new THREE.InstancedMesh(geometry('furniture-leg',()=>new THREE.BoxGeometry(1,1,1)),material('#665745'),legMatrices.length);legMatrices.forEach((matrix,index)=>legs.setMatrixAt(index,matrix));legs.instanceMatrix.needsUpdate=true;group.add(legs);
 const brushes=new THREE.InstancedMesh(geometry('artist-brush',()=>new THREE.CylinderGeometry(.014,.014,.28,6)),material('#bd9c73'),brushMatrices.length);brushMatrices.forEach((matrix,index)=>brushes.setMatrixAt(index,matrix));brushes.instanceMatrix.needsUpdate=true;group.add(brushes);
 const returnAction={artAction:'return-home',label:'Return to your House of Ideas'};
 for(const z of [-1.12,1.12]){box(group,.23,2.2,.23,-26,1.1,z,'#536657',returnAction);colliders.push({minX:-26.115,maxX:-25.885,minZ:z-.115,maxZ:z+.115,label:'Return gate post'});}
 box(group,.25,.24,2.47,-26,2.18,0,'#536657',returnAction);plaque(group,'House of Ideas',2.18,.19,-25.864,2.18,0,Math.PI/2,returnAction);
 group.updateMatrixWorld(true);
 function canStand(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&x>bounds.minX+.22&&x<bounds.maxX-.22&&z>bounds.minZ+.22&&z<bounds.maxZ-.22&&!colliders.some(c=>x>c.minX-.22&&x<c.maxX+.22&&z>c.minZ-.22&&z<c.maxZ+.22);}
 function insideAt(x,z){return houses.find(h=>x>h.minX+.16&&x<h.maxX-.16&&z>h.minZ+.16&&z<h.maxZ-.16)?.artistId||null;}
 return {group,houses,targets:[group],bounds,spawn,guideAnchor,colliders,canStand,insideAt,entryFor(id){const house=houses.find(h=>h.artistId===id);return house?{...house.spawnInside}:null;},dispose(){if(disposed)return;disposed=true;for(const texture of new Set(textures.values()))disposeTexture(texture);for(const item of new Set(materials.values()))item.dispose();for(const item of new Set(geometries.values()))item.dispose();group.clear();}};
}
