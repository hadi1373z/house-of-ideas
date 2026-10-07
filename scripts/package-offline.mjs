import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const execFileAsync=promisify(execFile),SCRIPT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const IGNORE=new Set(['.git','.openai','node_modules','data','dist','outputs','work']);
const WEB_EXT=new Set(['.html','.js','.mjs','.css','.svg','.txt','.png','.jpg','.jpeg','.webp','.ico','.woff2']);
const DOC_EXT=new Set(['.md','.txt','.html','.css','.svg','.png','.jpg','.jpeg','.webp','.pdf']);
const secretName=name=>name.startsWith('.')||/^(?:credentials|secrets|tokens|api[-_]?keys)(?:[._-]|$)/i.test(name)||/^\.env(?:[._-]|$)/i.test(name);
function contained(parent,child){const relative=path.relative(parent,child);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
async function exists(file){try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function copyTree(source,destination,allowed,files,relative=''){
 await fs.mkdir(destination,{recursive:true});for(const entry of await fs.readdir(source,{withFileTypes:true})){if(IGNORE.has(entry.name)||secretName(entry.name)||entry.isSymbolicLink())continue;const from=path.join(source,entry.name),to=path.join(destination,entry.name),rel=path.join(relative,entry.name);if(entry.isDirectory())await copyTree(from,to,allowed,files,rel);else if(entry.isFile()&&allowed.has(path.extname(entry.name).toLowerCase())){await fs.copyFile(from,to);files.push(rel.replaceAll(path.sep,'/'));}}
}
export async function packageOffline({sourceDir=SCRIPT_ROOT,outputDir,nodeExe=process.execPath,licensePath}={}){
 if(!outputDir)throw Error('Choose the offline output folder with --output.');sourceDir=await fs.realpath(path.resolve(sourceDir));outputDir=path.resolve(outputDir);nodeExe=await fs.realpath(path.resolve(nodeExe));licensePath=path.resolve(licensePath||path.join(sourceDir,'offline','LICENSE-node.txt'));
 if(outputDir===sourceDir||contained(outputDir,sourceDir)||contained(path.join(sourceDir,'web'),outputDir)||contained(path.join(sourceDir,'server'),outputDir))throw Error('Use an output folder separate from the application source.');
 if(path.basename(nodeExe).toLowerCase()!=='node.exe')throw Error('Supply the Windows Node executable using --node.');
 const binary=await fs.open(nodeExe,'r');try{const header=Buffer.alloc(2);await binary.read(header,0,2,0);if(header.toString('ascii')!=='MZ')throw Error('The runtime must be a Windows executable.');}finally{await binary.close();}
 const {stdout}=await execFileAsync(nodeExe,['--version'],{windowsHide:true});const version=stdout.trim();if(version!=='v24.19.0')throw Error('This package includes the Node v24.19.0 license. Supply that matching Windows runtime.');
 const license=await fs.readFile(licensePath,'utf8');if(!license.startsWith('Node.js is licensed for use as follows:')||license.length<50000)throw Error('Include the complete Node v24.19.0 license and third-party notices.');
 const required=['web/index.html','web/app.js','web/vendor/three.module.js','server/local.mjs','server/gpt.mjs','server/launch.mjs','Start House.vbs','Stop House.vbs'];for(const file of required)await fs.access(path.join(sourceDir,file));
 if(await exists(path.join(outputDir,'data','.house-server.lock')))throw Error('Stop this offline house before replacing its program files. Its data folder is preserved.');
 if(await exists(outputDir)){const entries=await fs.readdir(outputDir);if(entries.length&&!entries.includes('.house-offline-package.json'))throw Error('The output folder is not an existing House of Ideas package. Choose an empty folder.');}
 await fs.mkdir(outputDir,{recursive:true});const files=[];
 await copyTree(path.join(sourceDir,'web'),path.join(outputDir,'web'),WEB_EXT,files,'web');
 await fs.mkdir(path.join(outputDir,'server'),{recursive:true});for(const file of ['local.mjs','gpt.mjs','launch.mjs']){await fs.copyFile(path.join(sourceDir,'server',file),path.join(outputDir,'server',file));files.push('server/'+file);}
 if(await exists(path.join(sourceDir,'docs')))await copyTree(path.join(sourceDir,'docs'),path.join(outputDir,'docs'),DOC_EXT,files,'docs');
 for(const file of ['README.md','OFFLINE.md','Start House.vbs','Stop House.vbs'])if(await exists(path.join(sourceDir,file))){await fs.copyFile(path.join(sourceDir,file),path.join(outputDir,file));files.push(file);}
 const htmlPath=path.join(outputDir,'web','index.html'),html=await fs.readFile(htmlPath,'utf8');await fs.writeFile(htmlPath,html.replace(/<body(?:\s[^>]*)?>/i,'<body data-mode="local">'));
 await fs.mkdir(path.join(outputDir,'runtime'),{recursive:true});await fs.copyFile(nodeExe,path.join(outputDir,'runtime','node.exe'));await fs.writeFile(path.join(outputDir,'runtime','LICENSE-node.txt'),license);files.push('runtime/node.exe','runtime/LICENSE-node.txt');
 await fs.writeFile(path.join(outputDir,'package.json'),JSON.stringify({name:'house-of-ideas-offline',private:true,type:'module',scripts:{start:'node server/launch.mjs'}},null,2)+'\n');files.push('package.json');
 await fs.writeFile(path.join(outputDir,'Read me first.txt'),'House of Ideas — Offline Windows Edition\r\n\r\nDouble-click Start House.vbs to open your house in the default browser.\r\nDouble-click Stop House.vbs when you want to stop the local server.\r\nNo installation, npm, account, or Internet connection is required.\r\n\r\nYour house is saved beside these files in data\\house.json.\r\nKeep the entire folder together. Copy data to back up your house.\r\nProgram updates preserve data; stop the house before updating.\r\nIf opening fails, read data\\launcher.log for the local address or error.\r\n\r\nSocrates uses offline dialogue by default. GPT is an optional online\r\nconnection configured in the house, using your own API account.\r\nSee OFFLINE.md for controls, privacy, backups, and optional GPT.\r\n');files.push('Read me first.txt');
 const nodeSha256=createHash('sha256').update(await fs.readFile(nodeExe)).digest('hex'),manifest={edition:'House of Ideas Offline for Windows',createdAt:new Date().toISOString(),nodeVersion:version,nodeSha256,nodeLicenseSource:'https://raw.githubusercontent.com/nodejs/node/v24.19.0/LICENSE',files:files.sort()};
 await fs.writeFile(path.join(outputDir,'.house-offline-package.json'),JSON.stringify(manifest,null,2)+'\n');return {outputDir,files:files.length,nodeVersion:version,nodeSha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),options={};for(let n=0;n<args.length;n+=2){const key={'--source':'sourceDir','--output':'outputDir','--node':'nodeExe','--license':'licensePath'}[args[n]];if(!key||!args[n+1])throw Error('Use --source <folder>, --output <folder>, --node <node.exe>, and optionally --license <file>.');options[key]=args[n+1];}process.stdout.write(JSON.stringify(await packageOffline(options))+'\n');}
 catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
