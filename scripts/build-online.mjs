import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';

const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--manifest'))throw Error('Use --manifest <online hosting.json>.');
const manifestFile=args[1]||'online/hosting.json';
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
await fs.cp('docs',path.join(out,'client','project'),{recursive:true});
await fs.writeFile(path.join(out,'.openai','hosting.json'),JSON.stringify(manifest,null,2)+'\n');
await build({entryPoints:['worker/online.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'server','index.js')});
console.log('Built private online house and conversation archive; ChatGPT-plan inference remains local.');
