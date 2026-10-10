import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {externalizeGalleryImages,MAX_HOSTED_ASSET_BYTES,buildOnline} from './build-online.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFile='web/artists-websites.html',sourceBytes=await fs.readFile(sourceFile),source=sourceBytes.toString('utf8');
assert.ok(sourceBytes.length>MAX_HOSTED_ASSET_BYTES,'Regression fixture is the oversized frozen gallery.');
const transformed=externalizeGalleryImages(source);
assert.equal(transformed.artworkCount,60);assert.equal(transformed.assets.size,61,'Sixty exact artworks and one shared GIF placeholder.');
assert.ok(Buffer.byteLength(transformed.html)<1024*1024);
assert.ok(!transformed.html.includes('data:image/'));
assert.ok(!transformed.html.includes('atob(embeddedArt[key])'));
const artworkBlock=transformed.html.match(/<script\b[^>]*\bid=["']embedded-art-data["'][^>]*>([\s\S]*?)<\/script>/i),artworkUrls=JSON.parse(artworkBlock[1]);
const executable=[...transformed.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match=>!match[1].includes('application/json'));
for(const script of executable)new vm.Script(script[2]);
const galleryContext=vm.createContext({document:{getElementById:id=>{assert.equal(id,'embedded-art-data');return {textContent:artworkBlock[1]};}}});
vm.runInContext(executable[0][2],galleryContext);
for(const [id,assetPath] of Object.entries(artworkUrls))assert.equal(vm.runInContext(`hydrateArtwork(${JSON.stringify(`<img src="embedded-art:${id}">`)})`,galleryContext),`<img src="${assetPath}">`);
assert.throws(()=>vm.runInContext('hydrateArtwork("embedded-art:missing-artwork")',galleryContext),/Unknown gallery artwork/);
for(const [assetPath,asset] of transformed.assets){
 assert.match(assetPath,/^\/artist-gallery\/[a-f0-9]{64}\.(webp|gif)$/);
 assert.equal(hash(asset.bytes),asset.sha256);assert.ok(assetPath.includes(asset.sha256));assert.ok(asset.bytes.length<MAX_HOSTED_ASSET_BYTES);
}

await buildOnline();
const output='dist/online/client',hosted=await fs.readFile(path.join(output,'artists-websites.html'),'utf8');
assert.equal(hosted,transformed.html);
const rebuilt=[],cursor={value:0};
for(const edit of transformed.reconstruction){
 rebuilt.push(hosted.slice(cursor.value,edit.start));
 if(edit.kind==='code')rebuilt.push(edit.original);
 else{
  const bytes=await fs.readFile(path.join(output,edit.assetPath.slice(1)));
  assert.equal(hash(bytes),transformed.assets.get(edit.assetPath).sha256);
  rebuilt.push((edit.prefix||'')+bytes.toString('base64'));
 }
 cursor.value=edit.end;
}
rebuilt.push(hosted.slice(cursor.value));
assert.equal(rebuilt.join(''),source,'Hosted HTML and emitted raster files reconstruct every original source byte, including credits, scripts and image pixels.');
assert.deepEqual(await fs.readFile(sourceFile),sourceBytes,'Online build never rewrites the canonical/offline gallery.');
const metadata=JSON.parse(await fs.readFile(path.join(output,'project','online-gallery-assets.json'),'utf8'));
assert.equal(metadata.originalSha256,hash(sourceBytes));assert.equal(metadata.hostedSha256,hash(Buffer.from(hosted)));
let maximum=0,files=0;
const scan=async directory=>{
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())await scan(file);
  else{const bytes=(await fs.stat(file)).size;maximum=Math.max(maximum,bytes);files++;assert.ok(bytes<=MAX_HOSTED_ASSET_BYTES,`${file} fits hosted static asset limit`);}
 }
};
await scan(output);
console.log(JSON.stringify({result:'Hosted gallery extraction passed; frozen source and artwork pixels are exact.',sourceBytes:sourceBytes.length,hostedHtmlBytes:Buffer.byteLength(hosted),artworks:transformed.artworkCount,assets:transformed.assets.size,files,largestAssetBytes:maximum}));
