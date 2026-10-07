// Local designer contributions are data, never executable code or remote links.
export const DESIGN_LIMITS=Object.freeze({bytes:12*1024*1024,objects:24,nodes:512,meshes:128,primitives:256,vertices:200000,triangles:200000,materials:128,images:32,textures:64,imagePixels:16777216,lights:4,drawCalls:512});
export const DESIGN_ACTIONS=['read','question','experiment','reflect'];
export const isAssetId=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
export function validateDesignObjects(input,rooms){
 if(!Array.isArray(input)||input.length>DESIGN_LIMITS.objects)throw Error('A home can display up to 24 designer objects.');
 const roomIds=new Set(rooms.map(room=>room.id)),ids=new Set();
 return input.map(item=>{
  if(!item||!identifier(item.id)||ids.has(item.id))throw Error('Every designer object needs a unique identifier.');ids.add(item.id);
  if(typeof item.title!=='string'||!item.title.trim()||item.title.length>100)throw Error('Designer titles need 1–100 characters.');
  if(!isAssetId(item.assetId))throw Error('Choose an imported local GLB asset.');
  if(!['room','garden'].includes(item.placement)||!['object','house'].includes(item.kind))throw Error('Choose an object in a room or a garden exhibit.');
  if(item.placement==='room'&&!roomIds.has(item.roomId))throw Error('Choose a room for the designer object.');
  if(item.kind==='house'&&item.placement!=='garden')throw Error('Imported houses belong in the garden as exhibits.');
  const action=item.action??'reflect',note=item.note??'',scale=item.scale??1,rotation=item.rotation??0,position=item.position??[0,0,0];
  if(!DESIGN_ACTIONS.includes(action))throw Error('Choose reading, questioning, experimenting or reflection.');
  if(typeof note!=='string'||note.length>6000)throw Error('Designer notes must be under 6,000 characters.');
  if(!finite(scale,.05,8)||!finite(rotation,-Math.PI,Math.PI))throw Error('Keep the object scale between 0.05 and 8 and rotation within one turn.');
  if(!Array.isArray(position)||position.length!==3||!finite(position[0],-40,40)||!finite(position[1],-2,8)||!finite(position[2],-40,40))throw Error('Keep the object position inside the local exhibit area.');
  return {id:item.id,title:item.title.trim(),assetId:item.assetId,placement:item.placement,kind:item.kind,...(item.placement==='room'?{roomId:item.roomId}:{}),action,note,scale,rotation,position:[...position]};
 });
}

const ALLOWED_EXTENSIONS=new Set(['KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_ior','KHR_materials_specular','KHR_materials_transmission','KHR_materials_volume','KHR_materials_sheen','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_emissive_strength','KHR_texture_transform','KHR_materials_pbrSpecularGlossiness','EXT_texture_webp','KHR_lights_punctual']);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function list(value,name,limit){if(value===undefined)return [];if(!Array.isArray(value)||value.length>limit)throw Error(`The GLB has too many or invalid ${name}.`);return value;}
function integer(value,min,max,message){if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(message);return value;}
function extensionCheck(value,depth=0){
 if(depth>64)throw Error('The GLB metadata is nested too deeply.');
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('The GLB metadata contains a non-finite number.');
 if(!value||typeof value!=='object')return;
 for(const [key,entry] of Object.entries(value)){
  if(key==='uri')throw Error('Export a self-contained GLB with embedded geometry and images; external or encoded URLs are not accepted.');
  if(['script','scripts','javascript'].includes(key.toLowerCase()))throw Error('Designer imports cannot contain scripts.');
  if(key==='extensions'){
   if(!object(entry)||Object.keys(entry).some(name=>!ALLOWED_EXTENSIONS.has(name)))throw Error('Export the GLB without compression or unsupported extensions.');
  }
  extensionCheck(entry,depth+1);
 }
}
function imageDimensions(bytes,mime){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(mime==='image/png'){
  if(bytes.length<24||view.getUint32(0)!==0x89504e47||view.getUint32(4)!==0x0d0a1a0a||view.getUint32(12)!==0x49484452)throw Error('The embedded PNG is invalid.');
  return [view.getUint32(16),view.getUint32(20)];
 }
 if(mime==='image/jpeg'){
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)throw Error('The embedded JPEG is invalid.');
  let offset=2;
  while(offset+3<bytes.length){
   if(bytes[offset++]!==255)throw Error('The embedded JPEG header is invalid.');
   while(offset<bytes.length&&bytes[offset]===255)offset++;
   const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;
   if(offset+2>bytes.length)break;const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<8)break;return [view.getUint16(offset+5),view.getUint16(offset+3)];}offset+=length;
  }
  throw Error('The embedded JPEG dimensions could not be read.');
 }
 // WebP dimensions use either the extended, lossless or lossy bitstream header.
 if(bytes.length<30||view.getUint32(0,true)!==0x46464952||view.getUint32(8,true)!==0x50424557)throw Error('The embedded WebP is invalid.');
 const kind=view.getUint32(12,true);
 if(kind===0x58385056)return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];
 if(kind===0x4c385056&&bytes[20]===0x2f){const bits=view.getUint32(21,true);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
 if(kind===0x20385056&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)return [view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff];
 throw Error('The embedded WebP dimensions could not be read.');
}

/** Inspect bytes before GLTFLoader sees them. No browser or filesystem is needed. */
export function validateGlb(input){
 const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
 if(!bytes||bytes.byteLength<20||bytes.byteLength>DESIGN_LIMITS.bytes)throw Error('Choose a self-contained GLB file no larger than 12 MiB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw Error('Choose a valid GLB version 2 file.');
 let offset=12,json=null,binary=null,chunks=0;
 while(offset<bytes.length){
  if(offset+8>bytes.length)throw Error('The GLB chunk header is incomplete.');
  const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
  if(length%4||offset+length>bytes.length)throw Error('The GLB chunk length is invalid.');
  const chunk=bytes.subarray(offset,offset+length);offset+=length;
  if(chunks===0&&type===0x4e4f534a){try{json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(chunk));}catch{throw Error('The GLB JSON chunk is invalid.');}}
  else if(chunks===1&&type===0x004e4942)binary=chunk;
  else throw Error('Use one GLB JSON chunk followed by one embedded binary chunk.');
  chunks++;
 }
 if(!object(json)||!object(json.asset)||json.asset.version!=='2.0'||!binary)throw Error('The GLB needs version 2 geometry embedded in its binary chunk.');
 extensionCheck(json);
 const lights=list(json.extensions?.KHR_lights_punctual?.lights,'lights',DESIGN_LIMITS.lights);
 for(const light of lights){if(!object(light)||!['point','spot','directional'].includes(light.type)||(light.intensity!==undefined&&!finite(light.intensity,0,10000))||(light.color!==undefined&&(!Array.isArray(light.color)||light.color.length!==3||light.color.some(value=>!finite(value,0,1)))))throw Error('Keep GLB lights within the local display limits.');}
 for(const name of [...list(json.extensionsUsed,'extensions',32),...list(json.extensionsRequired,'required extensions',32)])if(!ALLOWED_EXTENSIONS.has(name))throw Error('Export the GLB without compression or unsupported extensions.');
 if(json.animations!==undefined||json.skins!==undefined)throw Error('Export a static GLB without animations or skins for this exhibit.');
 const buffers=list(json.buffers,'buffers',1);
 if(buffers.length!==1||!object(buffers[0]))throw Error('The GLB needs one embedded binary buffer.');
 integer(buffers[0].byteLength,1,binary.length,'The embedded buffer length is invalid.');
 if(binary.length-buffers[0].byteLength>3)throw Error('The GLB binary padding is invalid.');
 const bufferViews=list(json.bufferViews,'buffer views',1024),accessors=list(json.accessors,'accessors',1024);
 for(const item of bufferViews){
  if(!object(item)||item.buffer!==0)throw Error('The GLB buffer view is invalid.');
  integer(item.byteOffset??0,0,buffers[0].byteLength,'The GLB buffer offset is invalid.');integer(item.byteLength,1,buffers[0].byteLength,'The GLB buffer view length is invalid.');
  if((item.byteOffset??0)+item.byteLength>buffers[0].byteLength)throw Error('The GLB buffer view exceeds its embedded buffer.');
  if(item.byteStride!==undefined&&(item.byteStride%4||item.byteStride<4||item.byteStride>252))throw Error('The GLB vertex stride is invalid.');
 }
 const components={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
 for(const item of accessors){
  if(!object(item)||!components[item.componentType]||!types[item.type]||item.sparse!==undefined)throw Error('Export GLB accessors without sparse or unsupported geometry.');
  const target=bufferViews[integer(item.bufferView,0,bufferViews.length-1,'The GLB accessor buffer view is invalid.')];
  const count=integer(item.count,1,DESIGN_LIMITS.vertices*3,'The GLB accessor count exceeds the geometry budget.'),element=components[item.componentType]*types[item.type];
  const start=integer(item.byteOffset??0,0,target.byteLength,'The GLB accessor offset is invalid.'),stride=target.byteStride??element;
  if(((target.byteOffset??0)+start)%components[item.componentType]||stride%components[item.componentType])throw Error('The GLB accessor component alignment is invalid.');
  if(stride<element||start+(count-1)*stride+element>target.byteLength)throw Error('The GLB accessor exceeds its buffer view.');
  for(const bounds of [item.min,item.max])if(bounds!==undefined&&(!Array.isArray(bounds)||bounds.length!==types[item.type]||bounds.some(value=>!Number.isFinite(value))))throw Error('The GLB accessor bounds are invalid.');
  if(item.componentType===5126){const source=new DataView(binary.buffer,binary.byteOffset,binary.byteLength),base=(target.byteOffset??0)+start;for(let row=0;row<count;row++)for(let component=0;component<types[item.type];component++)if(!finite(source.getFloat32(base+row*stride+component*4,true),-100000,100000))throw Error('The GLB contains invalid or excessively large vertex values.');}
 }
 const materials=list(json.materials,'materials',DESIGN_LIMITS.materials),images=list(json.images,'images',DESIGN_LIMITS.images),textures=list(json.textures,'textures',DESIGN_LIMITS.textures);
 let imagePixels=0;
 for(const item of images){
  if(!object(item)||!['image/png','image/jpeg','image/webp'].includes(item.mimeType))throw Error('Embed PNG, JPEG or WebP images in the GLB.');
  const target=bufferViews[integer(item.bufferView,0,bufferViews.length-1,'The embedded image buffer view is invalid.')],start=target.byteOffset??0;
  const [width,height]=imageDimensions(binary.subarray(start,start+target.byteLength),item.mimeType);imagePixels+=width*height;
  if(width<1||height<1||width>4096||height>4096||imagePixels>DESIGN_LIMITS.imagePixels)throw Error('Keep embedded textures within a total of 16 million pixels and 4096 pixels per side.');
 }
 for(const item of textures){if(!object(item))throw Error('The GLB texture is invalid.');const source=item.source??item.extensions?.EXT_texture_webp?.source;integer(source,0,images.length-1,'The GLB texture image is invalid.');}
 const meshes=list(json.meshes,'meshes',DESIGN_LIMITS.meshes),meshBudget=[],checkedPositions=new Set();let primitives=0,meshVertices=0,meshTriangles=0;
 if(!meshes.length)throw Error('The GLB needs at least one visible mesh.');
 for(const mesh of meshes){
  const parts=list(mesh?.primitives,'mesh primitives',DESIGN_LIMITS.primitives);if(!parts.length)throw Error('The GLB mesh needs geometry.');let vertices=0,triangles=0;
  for(const part of parts){
   if(++primitives>DESIGN_LIMITS.primitives)throw Error('The GLB has too many mesh primitives.');
   if(!object(part)||!object(part.attributes)||(part.mode??4)!==4||part.targets!==undefined)throw Error('Export static triangle geometry without morph targets.');
   const position=accessors[integer(part.attributes.POSITION,0,accessors.length-1,'Every GLB primitive needs positions.')];
   if(position.type!=='VEC3'||position.componentType!==5126)throw Error('GLB positions must be floating-point 3D vectors.');
   if(!checkedPositions.has(part.attributes.POSITION)){
    if(!position.min||!position.max)throw Error('GLB positions need accurate minimum and maximum bounds.');
    const target=bufferViews[position.bufferView],base=(target.byteOffset??0)+(position.byteOffset??0),stride=target.byteStride??12,source=new DataView(binary.buffer,binary.byteOffset,binary.byteLength),low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    for(let row=0;row<position.count;row++)for(let axis=0;axis<3;axis++){const value=source.getFloat32(base+row*stride+axis*4,true);low[axis]=Math.min(low[axis],value);high[axis]=Math.max(high[axis],value);}
    for(let axis=0;axis<3;axis++)if(Math.abs(low[axis]-position.min[axis])>1e-4*Math.max(1,Math.abs(low[axis]))||Math.abs(high[axis]-position.max[axis])>1e-4*Math.max(1,Math.abs(high[axis])))throw Error('The GLB declared bounds do not match its vertex geometry.');
    checkedPositions.add(part.attributes.POSITION);
   }
   for(const [name,index] of Object.entries(part.attributes)){const accessor=accessors[integer(index,0,accessors.length-1,'The GLB vertex attribute is invalid.')];if(accessor.count!==position.count||name.startsWith('JOINTS_')||name.startsWith('WEIGHTS_'))throw Error('Export static matching vertex attributes without skeletal data.');}
   let indices=position.count;
   if(part.indices!==undefined){const accessor=accessors[integer(part.indices,0,accessors.length-1,'The GLB index accessor is invalid.')];if(accessor.type!=='SCALAR'||![5121,5123,5125].includes(accessor.componentType))throw Error('GLB triangle indices must be unsigned integers.');indices=accessor.count;const source=new DataView(binary.buffer,binary.byteOffset,binary.byteLength),target=bufferViews[accessor.bufferView],start=(target.byteOffset??0)+(accessor.byteOffset??0),size=components[accessor.componentType],stride=target.byteStride??size;for(let row=0;row<indices;row++){const at=start+row*stride,index=size===1?source.getUint8(at):size===2?source.getUint16(at,true):source.getUint32(at,true);if(index>=position.count)throw Error('A GLB triangle index points outside its vertex array.');}}
   if(indices%3)throw Error('The GLB triangle index count is invalid.');
   if(part.material!==undefined)integer(part.material,0,materials.length-1,'The GLB material reference is invalid.');
   vertices+=position.count;triangles+=indices/3;
  }
  meshBudget.push({vertices,triangles,drawCalls:parts.length});
  meshVertices+=vertices;meshTriangles+=triangles;
 }
 if(meshVertices>DESIGN_LIMITS.vertices||meshTriangles>DESIGN_LIMITS.triangles)throw Error('Keep all exhibit meshes under 200,000 vertices and 200,000 triangles.');
 const nodes=list(json.nodes,'nodes',DESIGN_LIMITS.nodes),scenes=list(json.scenes,'scenes',32);if(!nodes.length||!scenes.length)throw Error('The GLB needs a scene containing its mesh.');
 const parents=new Set();let vertices=0,triangles=0,drawCalls=0;
 for(const node of nodes){
  if(!object(node)||node.skin!==undefined||node.weights!==undefined)throw Error('Export static GLB nodes without skeletal or morph data.');
  for(const [name,size] of [['matrix',16],['translation',3],['rotation',4],['scale',3]])if(node[name]!==undefined&&(!Array.isArray(node[name])||node[name].length!==size||node[name].some(value=>!finite(value,-100000,100000))))throw Error('The GLB node transform is invalid.');
  if(node.matrix&&(node.matrix[3]!==0||node.matrix[7]!==0||node.matrix[11]!==0||node.matrix[15]!==1))throw Error('GLB node matrices must be affine transforms.');
  if(node.rotation&&Math.abs(node.rotation.reduce((total,value)=>total+value*value,0)-1)>1e-4)throw Error('GLB node rotations must be normalized quaternions.');
  if(node.extensions?.KHR_lights_punctual!==undefined)integer(node.extensions.KHR_lights_punctual.light,0,lights.length-1,'The GLB light reference is invalid.');
  if(node.mesh!==undefined){const budget=meshBudget[integer(node.mesh,0,meshes.length-1,'The GLB mesh reference is invalid.')];vertices+=budget.vertices;triangles+=budget.triangles;drawCalls+=budget.drawCalls;}
  for(const child of list(node.children,'child nodes',DESIGN_LIMITS.nodes)){integer(child,0,nodes.length-1,'The GLB child node is invalid.');if(parents.has(child))throw Error('A GLB node cannot have more than one parent.');parents.add(child);}
 }
 if(vertices<3||vertices>DESIGN_LIMITS.vertices||triangles>DESIGN_LIMITS.triangles)throw Error('Keep the exhibit under 200,000 vertices and 200,000 triangles.');
 if(drawCalls>DESIGN_LIMITS.drawCalls)throw Error('Keep the exhibit within 512 instanced mesh primitives (draw calls). Combine objects sharing a material before exporting.');
 const visited=new Set(),visiting=new Set();function visit(index,depth){if(depth>64||visiting.has(index))throw Error('The GLB node hierarchy is cyclic or too deep.');if(visited.has(index))return;visiting.add(index);for(const child of nodes[index].children??[])visit(child,depth+1);visiting.delete(index);visited.add(index);}
 for(let index=0;index<nodes.length;index++)visit(index,0);
 for(const scene of scenes){if(!object(scene))throw Error('The GLB scene is invalid.');const roots=list(scene.nodes,'scene roots',DESIGN_LIMITS.nodes),seen=new Set();for(const index of roots){integer(index,0,nodes.length-1,'The GLB scene root is invalid.');if(seen.has(index)||parents.has(index))throw Error('The GLB scene root is duplicated or also a child.');seen.add(index);}}
 const active=integer(json.scene??0,0,scenes.length-1,'The GLB active scene is invalid.');
 const visible=new Set();function visibleNode(index){if(visible.has(index))return;visible.add(index);for(const child of nodes[index].children??[])visibleNode(child);}for(const index of scenes[active].nodes??[])visibleNode(index);
 if(![...visible].some(index=>nodes[index].mesh!==undefined))throw Error('The active GLB scene needs a visible mesh.');
 return {bytes:bytes.byteLength,meshes:meshes.length,nodes:nodes.length,vertices,triangles,drawCalls,materials:materials.length,images:images.length};
}
