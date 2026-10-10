import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

export const MAX_HOSTED_ASSET_BYTES=25*1024*1024;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const originalHydration="const bytes=Uint8Array.from(atob(embeddedArt[key]),c=>c.charCodeAt(0));\n   embeddedArtUrls.set(key,URL.createObjectURL(new Blob([bytes],{type:'image/webp'})));";
const hostedHydration="const artworkUrl=embeddedArt[key];\n   if(typeof artworkUrl!=='string'||!/^\\/artist-gallery\\/[a-f0-9]{64}\\.(?:webp|png|jpg|gif|avif)$/.test(artworkUrl))throw Error('Unknown gallery artwork.');\n   embeddedArtUrls.set(key,artworkUrl);";
function rasterExtension(bytes){
 if(bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return 'webp';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(/^GIF8[79]a$/.test(bytes.subarray(0,6).toString('ascii')))return 'gif';
 if(bytes.subarray(4,8).toString('ascii')==='ftyp'&&['avif','avis'].includes(bytes.subarray(8,12).toString('ascii')))return 'avif';
 throw Error('The frozen gallery contains an unsupported raster image.');
}

// Transform only the hosted copy. The frozen self-contained source and every
// offline/Pages asset remain byte-identical, with their original credits.
export function externalizeGalleryImages(source){
 const assets=new Map(),edits=[];
 const image=(encoded)=>{
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('The frozen artwork needs canonical base64 data.');
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.toString('base64')!==encoded)throw Error('The frozen artwork base64 cannot be restored exactly.');
  if(bytes.length>MAX_HOSTED_ASSET_BYTES)throw Error('An individual gallery image exceeds the hosted asset limit.');
  const digest=sha(bytes),assetPath=`/artist-gallery/${digest}.${rasterExtension(bytes)}`;
  if(!assets.has(assetPath))assets.set(assetPath,{bytes,sha256:digest});
  return assetPath;
 };
 const block=source.match(/<script\b[^>]*\bid=["']embedded-art-data["'][^>]*>([\s\S]*?)<\/script>/i);
 if(!block)throw Error('The frozen gallery artwork block was not found.');
 const embedded=JSON.parse(block[1]);
 if(!embedded||typeof embedded!=='object'||Array.isArray(embedded)||!Object.keys(embedded).length||Object.values(embedded).some(value=>typeof value!=='string'))throw Error('Use the frozen gallery artwork dictionary.');
 const bodyOffset=block.index+block[0].indexOf('>')+1;
 let artworkCount=0;
 for(const match of block[1].matchAll(/:\s*"([A-Za-z0-9+/]+={0,2})"/g)){
  const start=bodyOffset+match.index+match[0].indexOf('"')+1;
  edits.push({start,end:start+match[1].length,replacement:image(match[1]),kind:'base64'});artworkCount++;
 }
 if(artworkCount!==Object.keys(embedded).length)throw Error('Every frozen artwork must be extracted without changing its dictionary.');
 for(const match of source.matchAll(/data:image\/(?:webp|png|jpeg|jpg|gif|avif);base64,([A-Za-z0-9+/]+={0,2})/gi)){
  const prefix=match[0].slice(0,match[0].length-match[1].length);
  edits.push({start:match.index,end:match.index+match[0].length,replacement:image(match[1]),kind:'data-url',prefix});
 }
 const hydrationOffset=source.indexOf(originalHydration);
 if(hydrationOffset<0||source.indexOf(originalHydration,hydrationOffset+1)>=0)throw Error('The frozen gallery artwork decoder changed; inspect it before building.');
 edits.push({start:hydrationOffset,end:hydrationOffset+originalHydration.length,replacement:hostedHydration,kind:'code',original:originalHydration});
 edits.sort((left,right)=>left.start-right.start);
 let cursor=0,outputOffset=0;const chunks=[],reconstruction=[];
 for(const edit of edits){
  if(edit.start<cursor)throw Error('Gallery image extraction edits overlap.');
  const unchanged=source.slice(cursor,edit.start);chunks.push(unchanged,edit.replacement);outputOffset+=unchanged.length;
  reconstruction.push({start:outputOffset,end:outputOffset+edit.replacement.length,kind:edit.kind,...(edit.kind==='code'?{original:edit.original}:{assetPath:edit.replacement,...(edit.prefix?{prefix:edit.prefix}:{})})});
  outputOffset+=edit.replacement.length;cursor=edit.end;
 }
 chunks.push(source.slice(cursor));
 const html=chunks.join('');
 if(Buffer.byteLength(html)>MAX_HOSTED_ASSET_BYTES)throw Error('The extracted gallery HTML still exceeds the hosted asset limit.');
 return {html,assets,reconstruction,artworkCount,originalSha256:sha(Buffer.from(source)),hostedSha256:sha(Buffer.from(html))};
}

export async function buildOnline(manifestFile='online/hosting.json'){
 const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
 if(!manifest.project_id||manifest.d1!=='DB')throw Error('Register the private online Site and configure its DB binding first.');
 // Keep the canonical offline and Pages builds independent from this edition.
 const out=manifestFile==='.openai/hosting.json'?'dist':'dist/online';
 const absolute=path.resolve(out),expected=path.resolve('dist');
 if(absolute!==expected&&!absolute.startsWith(expected+path.sep))throw Error('Invalid build directory.');
 await fs.rm(absolute,{recursive:true,force:true});
 await fs.mkdir(path.join(out,'server'),{recursive:true});
 await fs.mkdir(path.join(out,'.openai'),{recursive:true});
 await fs.cp('web',path.join(out,'client'),{recursive:true});
 let html=await fs.readFile('web/index.html','utf8');
 html=html.replace(/<body(?:\s[^>]*)?>/i,'<body data-mode="hosted">');
 html=html.replace('Your house · Your learning','Your private online house');
 await fs.writeFile(path.join(out,'client','index.html'),html);
 const gallery=externalizeGalleryImages(await fs.readFile('web/artists-websites.html','utf8'));
 await fs.mkdir(path.join(out,'client','artist-gallery'),{recursive:true});
 const writes=await Promise.allSettled([...gallery.assets].map(([assetPath,asset])=>fs.writeFile(path.join(out,'client',assetPath.slice(1)),asset.bytes)));
 for(const result of writes)if(result.status==='rejected')throw result.reason;
 await fs.writeFile(path.join(out,'client','artists-websites.html'),gallery.html);
 await fs.cp('docs',path.join(out,'client','project'),{recursive:true});
 await fs.writeFile(path.join(out,'client','project','online-gallery-assets.json'),JSON.stringify({format:'house-of-ideas-hosted-gallery-assets',version:1,source:'artists-websites.html',originalSha256:gallery.originalSha256,hostedSha256:gallery.hostedSha256,artworkCount:gallery.artworkCount,assets:[...gallery.assets].map(([assetPath,asset])=>({path:assetPath,sha256:asset.sha256,bytes:asset.bytes.length}))},null,2)+'\n');
 await fs.writeFile(path.join(out,'.openai','hosting.json'),JSON.stringify(manifest,null,2)+'\n');
 await build({entryPoints:['worker/online.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'server','index.js')});
 const checkDirectory=async directory=>{
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
   const file=path.join(directory,entry.name);
   if(entry.isDirectory())await checkDirectory(file);
   else if((await fs.stat(file)).size>MAX_HOSTED_ASSET_BYTES)throw Error(`Hosted asset exceeds 25 MiB: ${path.relative(absolute,file)}`);
  }
 };
 await checkDirectory(path.join(out,'client'));
 console.log(`Built private online house and conversation archive; ${gallery.artworkCount} artworks retain exact pixels as small hosted assets. ChatGPT-plan inference remains local.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length&&!(args.length===2&&args[0]==='--manifest'))throw Error('Use --manifest <online hosting.json>.');
 await buildOnline(args[1]||'online/hosting.json');
}
