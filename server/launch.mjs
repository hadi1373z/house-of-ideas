import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startServer} from './local.mjs';

const execFileAsync=promisify(execFile);
const APP_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const loopbackURL=value=>typeof value==='string'&&/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(value)&&Number(new URL(value).port)<=65535;

export async function readServerLock(dataDir){
 let lock;try{lock=JSON.parse(await fs.readFile(path.join(dataDir,'.house-server.lock'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw Error('The house lock could not be read. The data folder has been preserved.');}
 if(!Number.isInteger(lock.pid)||lock.pid<=0||typeof lock.token!=='string'||!/^([a-f0-9]{32}|[a-f0-9]{64})$/.test(lock.token)||(lock.url!==null&&!loopbackURL(lock.url)))throw Error('The house lock is invalid. The data folder has been preserved.');
 return lock;
}
function alive(pid){try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}
export async function verifyServerLock(lock,{fetchImpl=globalThis.fetch}={}){
 if(!lock||!loopbackURL(lock.url)||!alive(lock.pid))return false;
 try{const response=await fetchImpl(lock.url+'/api/launcher/health',{headers:{'x-house-launch-token':lock.token},signal:AbortSignal.timeout(1800),redirect:'error'});if(!response.ok)return false;const health=await response.json();return health.pid===lock.pid&&health.token===lock.token&&health.url===lock.url;}
 catch{return false;}
}
export async function findExistingServer(dataDir,{waitMs=6000,fetchImpl=globalThis.fetch}={}){
 const deadline=Date.now()+waitMs;
 do{const lock=await readServerLock(dataDir);if(!lock||!alive(lock.pid))return null;if(await verifyServerLock(lock,{fetchImpl}))return lock;if(Date.now()>=deadline)throw Error('A process holds this house lock, but its local server could not be verified. The data folder has been preserved.');await delay(150);}while(true);
}
async function appendLog(dataDir,event,details=''){
 await fs.mkdir(dataDir,{recursive:true});await fs.appendFile(path.join(dataDir,'launcher.log'),`${new Date().toISOString()} ${event}${details?' '+details:''}\n`,{mode:0o600});
}
function safeFailure(message){if(/lock is invalid/.test(message))return 'Invalid server lock; preserve data/.house-server.lock before repair.';if(/lock could not be read/.test(message))return 'Unreadable server lock; preserve the data folder before repair.';if(/could not be verified/.test(message))return 'Existing lock process did not verify as this house; no process was stopped.';if(/saved local house could not be read/i.test(message))return 'Saved house could not be read; preserve data/house.json before repair.';if(/port/.test(message))return 'Could not open a local port; close the previous house and retry.';if(/finishing its save/.test(message))return 'House is finishing its save; wait before restarting.';return 'Launcher failed; saved data preserved. Check runtime/server files and folder permissions.';}
export async function openDefaultBrowser(url){
 if(!loopbackURL(url))throw Error('Use the verified local house address.');
 if(process.platform!=='win32')throw Error('Use this Windows edition on Windows, or open the local address in your browser.');
 const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 // URL is restricted to a literal loopback origin; no shell content can enter it.
 await execFileAsync(powershell,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',`Start-Process -FilePath '${url}'`],{windowsHide:true,timeout:15000});
}
export async function stopHouse({rootDir=APP_ROOT,fetchImpl=globalThis.fetch,waitMs=6000}={}){
 const dataDir=path.join(path.resolve(rootDir),'data'),lock=await findExistingServer(dataDir,{waitMs,fetchImpl});
 if(!lock){await appendLog(dataDir,'stop','No running house. Saved data preserved.');return {stopped:false};}
 const response=await fetchImpl(lock.url+'/api/launcher/stop',{method:'POST',headers:{'x-house-launch-token':lock.token},signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!response.ok)throw Error('The verified house did not accept a graceful stop. Saved data preserved.');
 const result=await response.json();if(result.ok!==true)throw Error('The house did not confirm its graceful stop. Saved data preserved.');
 const deadline=Date.now()+waitMs;while(Date.now()<deadline){const current=await readServerLock(dataDir);if(!current||current.token!==lock.token){await appendLog(dataDir,'stopped',`pid=${lock.pid}; saved data preserved.`);return {stopped:true};}await delay(100);}
 throw Error('The house is finishing its save. Wait a moment before starting it again.');
}
export async function launchHouse({rootDir=APP_ROOT,openBrowser=true,openUrl=openDefaultBrowser,fetchImpl=globalThis.fetch,serverOptions={}}={}){
 rootDir=path.resolve(rootDir);const dataDir=path.join(rootDir,'data');let existing=await findExistingServer(dataDir,{fetchImpl});
 if(existing){await appendLog(dataDir,'reused',`${existing.url}; pid=${existing.pid}`);if(openBrowser)await openUrl(existing.url);return {reused:true,url:existing.url};}
 let running;
 try{running=await startServer({...serverOptions,dataDir,webDir:path.join(rootDir,'web')});}
 catch(error){existing=await findExistingServer(dataDir,{waitMs:6000,fetchImpl});if(!existing)throw error;await appendLog(dataDir,'reused',`${existing.url}; pid=${existing.pid}`);if(openBrowser)await openUrl(existing.url);return {reused:true,url:existing.url};}
 const lock=await readServerLock(dataDir);if(!lock||!await verifyServerLock(lock,{fetchImpl})){await running.close();throw Error('The local house started but its launcher identity could not be verified.');}
 await appendLog(dataDir,'started',`${running.url}; pid=${process.pid}`);
 let closing=false;const close=async()=>{if(closing)return;closing=true;await running.close();await appendLog(dataDir,'closed','Saved data preserved.');};
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{close().then(()=>{process.exitCode=0;}).catch(()=>{process.exitCode=1;});});
 if(openBrowser){try{await openUrl(running.url);}catch{await appendLog(dataDir,'browser','Open the started local URL above in your default browser.');}}
 return {reused:false,url:running.url,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const stop=process.argv.includes('--stop');
 try{const result=stop?await stopHouse():await launchHouse({openBrowser:!process.argv.includes('--no-browser')&&process.env.HOUSE_NO_BROWSER!=='1'});process.stdout.write(JSON.stringify(stop?result:{url:result.url,reused:result.reused})+'\n');}
 catch(error){const dataDir=path.join(APP_ROOT,'data'),message=safeFailure(error.message||'');await appendLog(dataDir,'error',message).catch(()=>{});process.stderr.write(`${message}\nSee data/launcher.log.\n`);process.exitCode=1;}
}
