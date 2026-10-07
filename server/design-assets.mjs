import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {validateGlb,isAssetId} from '../web/design-objects.js';

function failure(message,status=400){const error=new Error(message);error.status=status;return error;}
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
/** SHA256-addressed immutable GLBs, stored beside (never inside) house JSON. */
export async function createDesignAssetStore(dataDir){
 await fs.mkdir(path.resolve(dataDir),{recursive:true});
 const root=await fs.realpath(path.resolve(dataDir)),folder=path.join(root,'designs');
 await fs.mkdir(folder,{recursive:true});
 async function guard(){const stat=await fs.lstat(folder);if(stat.isSymbolicLink()||!stat.isDirectory()||!samePath(await fs.realpath(folder),folder))throw failure('The local designer asset folder must be a real directory.',409);}
 await guard();
 async function read(id){
  if(!isAssetId(id))throw failure('Choose a valid local designer asset identifier.');await guard();
  const file=path.join(folder,`${id}.glb`);let stat;
  try{stat=await fs.lstat(file);}catch(error){if(error.code==='ENOENT')throw failure('This designer asset is not stored on this computer.',404);throw error;}
  if(stat.isSymbolicLink()||!stat.isFile()||!samePath(await fs.realpath(file),file))throw failure('Designer assets cannot be symbolic links or directories.',409);
  if(stat.size>12*1024*1024)throw failure('The stored designer asset exceeds the local size limit.',409);
  const bytes=await fs.readFile(file);
  if(createHash('sha256').update(bytes).digest('hex')!==id)throw failure('The stored designer asset changed. Import its original GLB again.',409);
  validateGlb(bytes);return bytes;
 }
 return {
  async import(input){
   const bytes=input instanceof Uint8Array?Buffer.from(input):input instanceof ArrayBuffer?Buffer.from(new Uint8Array(input)):null;
   let summary;try{summary=validateGlb(bytes);}catch(error){throw failure(error.message);}
   const id=createHash('sha256').update(bytes).digest('hex');await guard();
   const file=path.join(folder,`${id}.glb`),temporary=path.join(folder,`.upload-${randomBytes(16).toString('hex')}.tmp`);
   const handle=await fs.open(temporary,'wx',0o600);
   try{await handle.writeFile(bytes);await handle.sync();}catch(error){await handle.close();await fs.unlink(temporary).catch(()=>{});throw error;}await handle.close();
   try{await guard();await fs.link(temporary,file);}catch(error){if(error.code!=='EEXIST')throw error;await read(id);}finally{await fs.unlink(temporary).catch(()=>{});}
   return {id,...summary};
  },
  read,
  async has(id){try{await read(id);return true;}catch(error){if(error.status===404)return false;throw error;}},
 };
}
