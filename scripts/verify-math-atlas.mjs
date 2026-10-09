import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {startServer} from '../server/local.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const atlasRoot=path.join(root,'web','math-city','atlas');
const bytes=await fs.readFile(path.join(atlasRoot,'index.html'));
const html=bytes.toString('utf8');
const manifest=JSON.parse(await fs.readFile(path.join(atlasRoot,'source.json'),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(manifest.sourceCommit,'90a6dab9f7ae7b54bb34e0d7d8cabac155775e40','Refresh the verified pinned-source contract deliberately');
assert.equal(manifest.htmlSha256,'bd07240709cc2626f581556f1b272bc8e118a20a98da4ce2e3b711f3aa4d2da4');
assert.equal(sha(bytes),manifest.htmlSha256);
assert.equal(bytes.length,manifest.htmlBytes);
assert.equal(manifest.repository,'https://github.com/hadi1373z/atlas-of-ideas');
assert.equal(manifest.site,'https://hadi1373z.github.io/atlas-of-ideas/');
assert.deepEqual(manifest.runtimeDependencies,[]);
assert.match(manifest.notebook,/session-only/);
assert.match(manifest.updatePolicy,/no automatic synchronization/i);
assert.match(manifest.rights,/no license/i);

const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const catalogue=scripts.find(match=>/id="atlas-data"/.test(match[1]));
assert.ok(catalogue,'Original complete embedded catalogue');
const data=JSON.parse(catalogue[2]);
assert.equal(data.people.length,manifest.profiles);
assert.equal(data.connections.length,manifest.connections);
assert.equal(data.trails.length,manifest.readingPaths);
assert.equal(data.exploration.concepts.length,manifest.ideaLenses);
assert.equal(data.publications.length,manifest.publicUpdates);
assert.equal(data.publishing.sourceCommit,manifest.sourceCommit);
assert.equal(data.publishing.buildId,manifest.buildId);
assert.deepEqual(manifest.concepts,data.exploration.concepts.map(({id,name,start})=>({id,name,start})));
const people=new Set(data.people.map(person=>person.id));
assert.equal(people.size,data.people.length);
for(const concept of data.exploration.concepts)assert.ok(people.has(concept.start),`Preserved idea route ${concept.id}`);
for(const edge of data.connections){assert.ok(people.has(edge.source));assert.ok(people.has(edge.target));}

// Verify an offline executable document, not a shell that fetches its reader.
assert.doesNotMatch(html,/<script\b[^>]*\bsrc\s*=/i);
assert.doesNotMatch(html,/<link\b[^>]*\brel=["']stylesheet/i);
assert.doesNotMatch(html,/<(?:img|iframe|audio|video|source)\b[^>]*\bsrc=["']https?:/i);
assert.doesNotMatch(html,/@import\s/i);
assert.doesNotMatch(html,/url\(\s*["']?https?:/i);
assert.doesNotMatch(html,/<[^>]+\son(?:click|load|error|input|submit)\s*=/i);
const executable=scripts.filter(match=>!/\btype=["']application\/json["']/i.test(match[1]));
assert.equal(executable.length,1,'Exactly the original inline reader script');
for(const match of executable){
  assert.doesNotMatch(match[2],/\b(?:fetch|WebSocket|EventSource)\s*\(|\bXMLHttpRequest\b|navigator\.sendBeacon\s*\(/);
  new Script(match[2],{filename:'pinned-atlas-reader.js'});
}
const reader=executable[0][2];
assert.match(reader,/const STORAGE_KEY = 'atlas-of-ideas-v1'/);
assert.match(reader,/try\s*\{\s*state = cleanState\(JSON\.parse\(localStorage\.getItem/);
assert.match(reader,/catch \(e\) \{ storageOK = false/);
assert.match(reader,/Browser storage is unavailable\. Export a backup/);
assert.match(reader,/URL\.createObjectURL/,'Intentional local notebook backup');
assert.ok(reader.includes("view==='ideas')ideas()"),'Existing ideas overview route');
assert.ok(reader.includes("view==='idea')idea(id)"),'Existing individual idea route');

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-math-atlas-test-'));
let running,providerCalls=0;
try{
  running=await startServer({dataDir:path.join(temporary,'data'),webDir:path.join(root,'web'),port:0,env:{},fetchImpl:async()=>{providerCalls++;throw Error('No online calls in the offline Atlas test');}});
  const page=await fetch(running.url+'/math-city/atlas/index.html');
  assert.equal(page.status,200);
  assert.equal(page.headers.get('content-type'),'text/html; charset=utf-8');
  assert.equal(page.headers.get('content-length'),String(bytes.length));
  assert.equal(page.headers.get('x-content-type-options'),'nosniff');
  assert.equal(page.headers.get('cache-control'),'no-store');
  assert.equal(sha(Buffer.from(await page.arrayBuffer())),manifest.htmlSha256);
  const policy=page.headers.get('content-security-policy');
  assert.match(policy,/(?:^|;\s*)frame-ancestors 'self'(?:;|$)/,'Only the bundled Atlas is embeddable by the house');
  assert.match(policy,/object-src 'none'/);
  assert.match(policy,/base-uri 'none'/);
  assert.doesNotMatch(policy,/script-src[^;]*'unsafe-inline'/);
  for(const match of scripts.filter(match=>match[2].length)){
    const token="'sha256-"+createHash('sha256').update(match[2]).digest('base64')+"'";
    assert.ok(policy.includes(token),'Actual server authorizes exact inline bytes');
  }
  const head=await fetch(running.url+'/math-city/atlas/index.html',{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(head.headers.get('content-security-policy'),policy);
  assert.equal(await head.text(),'');
  const app=await fetch(running.url+'/');
  assert.equal(app.status,200);
  assert.match(app.headers.get('content-security-policy'),/frame-ancestors 'none'/,'The app itself remains non-embeddable');
  const source=await fetch(running.url+'/math-city/atlas/source.json');
  assert.deepEqual(await source.json(),manifest);
  assert.equal(providerCalls,0,'No GPT or external runtime request');
}finally{
  await running?.close();
  const checked=path.resolve(temporary),safeRoot=path.resolve(os.tmpdir());
  assert.ok(path.dirname(checked)===safeRoot&&path.basename(checked).startsWith('house-math-atlas-test-'));
  await fs.rm(checked,{recursive:true,force:true});
}
console.log(`Verified pinned offline Atlas: ${manifest.profiles} profiles, ${manifest.connections} connections, exact script policy and embeddable local HTTP response.`);
