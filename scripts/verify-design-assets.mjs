import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createDesignAssetStore} from '../server/design-assets.mjs';
import {triangleGlb} from './verify-design-fixture.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'house-designer-assets-'));
assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()),'Recursive cleanup stays inside the named temporary test directory.');
try{
 const bytes=triangleGlb(),id=createHash('sha256').update(bytes).digest('hex'),dataDir=path.join(root,'data'),store=await createDesignAssetStore(dataDir);
 assert.equal(await store.has('a'.repeat(64)),false);
 const imported=await store.import(bytes);assert.equal(imported.id,id);assert.equal(imported.bytes,bytes.length);assert.equal(imported.triangles,1);
 assert.deepEqual(await store.read(id),bytes);assert.equal(await store.has(id),true);
 const repeated=await Promise.all(Array.from({length:8},()=>store.import(new Uint8Array(bytes))));assert.ok(repeated.every(value=>value.id===id));
 assert.deepEqual(await fs.readdir(path.join(dataDir,'designs')),[`${id}.glb`],'Concurrent identical imports have one immutable file and no temporary leftovers.');
 assert.deepEqual(await (await createDesignAssetStore(dataDir)).read(id),bytes,'The imported contribution survives a restart.');
 await assert.rejects(()=>store.read('../house.json'),/valid local/);
 await assert.rejects(()=>store.read('f'.repeat(64)),error=>error.status===404);
 await assert.rejects(()=>store.import(triangleGlb(json=>json.buffers[0].uri='https://example.com/buffer.bin')),/self-contained/);
 assert.equal((await fs.readdir(path.join(dataDir,'designs'))).length,1,'Rejected input never writes an asset.');
 await fs.writeFile(path.join(dataDir,'designs',`${id}.glb`),Buffer.from('tampered'));
 await assert.rejects(()=>store.read(id),error=>error.status===409&&/changed/.test(error.message));
 await assert.rejects(()=>store.import(bytes),/changed/);
 assert.deepEqual(await fs.readdir(path.join(dataDir,'designs')),[`${id}.glb`],'A corrupt existing file is preserved for recovery, never silently overwritten.');
 await fs.unlink(path.join(dataDir,'designs',`${id}.glb`));await store.import(bytes);
 // NTFS junctions do not need Developer Mode, unlike Windows file symlinks.
 const linkedData=path.join(root,'linked'),outside=path.join(root,'outside');await fs.mkdir(linkedData);await fs.mkdir(outside);await fs.symlink(outside,path.join(linkedData,'designs'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(()=>createDesignAssetStore(linkedData),/real directory/);
 assert.deepEqual(await fs.readdir(outside),[],'An asset folder link cannot redirect writes outside local storage.');
 if(process.platform!=='win32'){
  await fs.unlink(path.join(dataDir,'designs',`${id}.glb`));await fs.writeFile(path.join(outside,'asset.glb'),bytes);await fs.symlink(path.join(outside,'asset.glb'),path.join(dataDir,'designs',`${id}.glb`));await assert.rejects(()=>store.read(id),/symbolic links/);
 }
 console.log('Designer storage: immutable SHA256 assets, deduplicated concurrent imports, restart, tamper checks, rejected writes and symlink guard passed.');
}finally{await fs.unlink(path.join(root,'linked','designs')).catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
