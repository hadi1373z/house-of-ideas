import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/local.mjs';
import {createDailyReviewService,reviewDueDays} from '../server/daily-review.mjs';
import {clone,starter} from '../web/model.js';
import {initialNeighborhood} from '../web/neighborhood.js';
import {initialCityNetwork} from '../web/city-network.js';
import {visitRoom,reviewDay,decideReview} from '../web/socrates.js';

const houseWithVisit = date => {
  const house = visitRoom(starter(), date, 'math');
  house.learning.enabled = true;
  return house;
};
const neighborhoodWithVisit = date => {
  const result = initialNeighborhood(houseWithVisit(date), {now: '2024-01-01T10:00:00Z'});
  result.cityNetwork = initialCityNetwork();
  result.activeId = result.homes[0].id;
  return result;
};

// The exact Prague cutoff follows winter/summer offsets, including both DST
// transition dates. A UTC-hour or host-timezone shortcut would fail these.
for (const [date,before,due] of [
  ['2024-01-02','2024-01-02T19:59:59Z','2024-01-02T20:00:00Z'],
  ['2024-07-02','2024-07-02T18:59:59Z','2024-07-02T19:00:00Z'],
  ['2024-03-31','2024-03-31T18:59:59Z','2024-03-31T19:00:00Z'],
  ['2024-10-27','2024-10-27T19:59:59Z','2024-10-27T20:00:00Z'],
]) {
  const input = neighborhoodWithVisit(date), earlier = clone(input.homes[0]);
  assert.deepEqual(reviewDueDays(input,before),input);
  const reviewed = reviewDueDays(input,due);
  assert.equal(reviewed.homes.at(-1).house.learning.days[0].review.status,'pending');
  assert.equal(reviewed.activeId,input.activeId);
  assert.deepEqual(reviewed.homes[0],earlier);
  assert.deepEqual(reviewed.cityNetwork,input.cityNetwork);
  assert.deepEqual(reviewed.homes.at(-1).house.ideas,input.homes.at(-1).house.ideas);
  assert.deepEqual(reviewDueDays(reviewed,due),reviewed);
  assert.deepEqual(input.homes[0],earlier,'The review helper does not mutate its input.');
}
const disabled = neighborhoodWithVisit('2024-01-02');
disabled.homes.at(-1).house.learning.enabled = false;
assert.deepEqual(reviewDueDays(disabled,'2024-01-03T22:00:00Z'),disabled);
const idle = initialNeighborhood(starter());
idle.homes.at(-1).house.learning = {version:1,enabled:true,days:[]};
assert.deepEqual(reviewDueDays(idle,'2024-01-03T22:00:00Z'),idle);

// Cancellation stops future work and waits for an already-running transaction.
let callback, cancelled = 0, unreferenced = 0, calls = 0, delay = false, release;
const handle = {unref(){unreferenced++;}};
const memory = {revision:0,neighborhood:idle};
const service = createDailyReviewService({
  read:()=>memory,now:()=>new Date('2024-01-03T22:00:00Z'),intervalMs:25,
  schedule(fn,interval){assert.equal(interval,25);callback=fn;return handle;},
  cancel(value){assert.equal(value,handle);cancelled++;},
  async review(){calls++;if(delay)await new Promise(resolve=>{release=resolve;});},
});
await service.start();assert.equal(unreferenced,1);assert.equal(calls,1);
delay=true;const pending=callback();assert.equal(callback(),pending,'Overlapping ticks share the current transaction.');
let stopped=false;const closing=service.close().then(()=>{stopped=true;});
await new Promise(resolve=>setImmediate(resolve));assert.equal(stopped,false);assert.equal(cancelled,1);
await callback();assert.equal(calls,2,'A stopped clock cannot queue another write.');
release();await pending;await closing;assert.equal(service.status().running,false);
const errorService=createDailyReviewService({read:()=>memory,review:async()=>{throw Error('PRIVATE JOURNAL AND FILE PATH');},now:()=>new Date('2024-01-03T22:00:00Z'),schedule:()=>handle,cancel(){}});
await errorService.start();assert.ok(errorService.status().lastError);assert.equal(JSON.stringify(errorService.status()).includes('PRIVATE'),false);await errorService.close();

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-local-daily-'));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data'),file=path.join(dataDir,'house.json');
await fs.mkdir(webDir);await fs.mkdir(dataDir);await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Daily review fixture</body>');
let network=neighborhoodWithVisit('2024-01-01');
let latest=network.homes.at(-1).house;
latest=visitRoom(latest,'2024-01-02','work');
latest=visitRoom(latest,'2023-12-30','art');
latest=reviewDay(latest,'2023-12-30');
latest=decideReview(latest,'socrates-2023-12-30','approve','2023-12-31');
network.homes.at(-1).house=latest;
const originalHome=clone(network.homes[0]),originalCities=clone(network.cityNetwork),approved=clone(latest.learning.days.find(day=>day.date==='2023-12-30').review),ideas=clone(latest.ideas);
await fs.writeFile(file,JSON.stringify({version:2,revision:7,neighborhood:network},null,2));
let instant=new Date('2024-01-02T19:59:00Z'),tick,timerStops=0,externalCalls=0,running,session;
const raw=(pathname,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
  const url=new URL(running.url);
  const request=http.request({hostname:url.hostname,port:url.port,path:pathname,method,headers,agent:false},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');resolve({status:response.statusCode,headers:response.headers,text,json:JSON.parse(text)});});
  });request.on('error',reject);request.end(body);
});
const api=(pathname,method='GET',body)=>raw(pathname,{method,headers:{...(session?{Cookie:session.cookie}:{}),...(method==='GET'?{}:{Origin:running.url,'X-Local-CSRF':session?.csrf,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function boot(){const result=await api('/api/config');session={cookie:result.headers['set-cookie'][0].split(';')[0],csrf:result.json.csrfToken};}
const start=()=>startServer({dataDir,webDir,port:0,maxPort:0,env:{},now:()=>instant,reviewIntervalMs:40,scheduleReview(fn,interval){assert.equal(interval,40);tick=fn;return handle;},cancelReview(value){assert.equal(value,handle);timerStops++;},fetchImpl:async()=>{externalCalls++;throw Error('Daily reviews must remain offline.');}});
try {
  running=await start();await boot();
  let saved=(await api('/api/house')).json;
  assert.equal(saved.revision,8,'Startup catches up the recorded previous day once.');
  assert.deepEqual(saved.neighborhood.homes[0],originalHome);
  assert.deepEqual(saved.house,originalHome.house,'Opening the server does not switch away from an older home.');
  assert.deepEqual(saved.neighborhood.cityNetwork,originalCities);
  let days=saved.neighborhood.homes.at(-1).house.learning.days;
  assert.equal(days.find(day=>day.date==='2024-01-01').review.status,'pending');
  assert.equal(days.find(day=>day.date==='2024-01-02').review,undefined,'Today is not reviewed before 21:00 Prague.');
  assert.deepEqual(days.find(day=>day.date==='2023-12-30').review,approved,'The server never applies an approved owner decision.');
  assert.deepEqual(saved.neighborhood.homes.at(-1).house.ideas,ideas);
  let status=(await api('/api/review/status')).json;
  assert.deepEqual(status,{running:true,timezone:'Europe/Prague',hour:21,mode:'local',latestHomeId:network.homes.at(-1).id,revision:8,pendingCount:1,lastCheckedAt:instant.toISOString()});
  assert.equal((await raw('/api/review/status',{method:'POST'})).status,405);
  assert.equal((await raw('/api/review/status',{headers:{Origin:'https://attacker.invalid'}})).status,403);
  const unchanged=await fs.readFile(file,'utf8');await tick();assert.equal(await fs.readFile(file,'utf8'),unchanged,'No due review does not rewrite the saved file.');
  instant=new Date('2024-01-02T20:00:00Z');await Promise.all([tick(),tick()]);
  saved=(await api('/api/house')).json;assert.equal(saved.revision,9);assert.equal(saved.neighborhood.homes.length,2,'Pending critiques never build a house.');
  assert.deepEqual(saved.neighborhood.homes[0],originalHome);assert.deepEqual(saved.neighborhood.cityNetwork,originalCities);assert.equal(saved.neighborhood.activeId,originalHome.id);
  status=(await api('/api/review/status')).json;assert.equal(status.pendingCount,2);assert.equal(status.revision,9);
  assert.equal(JSON.stringify(status).includes('reflection'),false,'Status returns aggregate facts, not personal review text.');
  const reviewedBytes=await fs.readFile(file,'utf8');await tick();assert.equal(await fs.readFile(file,'utf8'),reviewedBytes);
  let result=await api('/api/neighborhood/select','POST',{homeId:network.homes.at(-1).id,revision:saved.revision});assert.equal(result.status,200);saved=result.json;
  latest=visitRoom(saved.house,'2024-01-03','questions');
  result=await api('/api/house','PUT',{house:latest,revision:saved.revision});assert.equal(result.status,200);saved=(await api('/api/house')).json;
  instant=new Date('2024-01-03T20:00:00Z');
  const reviewInProgress=tick();
  const stale=clone(saved.house);stale.rooms[0].purpose='A stale tab draft must never replace the saved review.';
  const staleSave=api('/api/house','PUT',{house:stale,revision:saved.revision});
  await reviewInProgress;assert.equal((await staleSave).status,409,'A concurrent tab uses CAS and cannot overwrite a background critique.');
  saved=(await api('/api/house')).json;assert.equal(saved.neighborhood.homes.at(-1).house.learning.days.find(day=>day.date==='2024-01-03').review.status,'pending');
  assert.equal(saved.house.rooms[0].purpose.includes('stale tab'),false);assert.deepEqual(saved.neighborhood.homes[0],originalHome);assert.deepEqual(saved.neighborhood.cityNetwork,originalCities);
  const persisted=await fs.readFile(file,'utf8');const beforeStop=timerStops;await running.close();assert.equal(timerStops,beforeStop+1);running=undefined;await tick();assert.equal(await fs.readFile(file,'utf8'),persisted);
  running=await start();await boot();assert.equal(await fs.readFile(file,'utf8'),persisted,'Restart keeps the full neighbourhood and does not repeat existing reviews.');
  assert.deepEqual((await api('/api/house')).json,saved);assert.equal(externalCalls,0);
} finally {
  if(running)await running.close();
  assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('house-local-daily-'));
  await fs.rm(temporary,{recursive:true,force:true});
}
console.log('Verified local daily review: Prague/DST cutoff, startup catch-up, offline pending-only work, enabled/activity gates, latest-home isolation, unchanged archived houses/cities/decisions, no-op file persistence, CAS conflicts, aggregate status, restart and graceful timer shutdown.');
