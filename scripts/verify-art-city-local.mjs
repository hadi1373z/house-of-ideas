import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ARTISTS} from '../web/art-city-data.js';
import {startServer} from '../server/local.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const webDir=path.join(root,'web');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-art-city-http-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()),'Cleanup stays inside the named temporary test directory.');
assert.ok(path.basename(temporary).startsWith('house-art-city-http-'));
const dataDir=path.join(temporary,'data');
let running,externalCalls=0;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const directives=response=>new Map(response.headers.get('content-security-policy').split(';').map(value=>value.trim().split(/\s+/)).filter(value=>value.length).map(([name,...values])=>[name,values]));
async function get(route,method='GET'){
  const response=await fetch(running.url+route,{method});
  assert.equal(response.status,200,`${method} ${route} is served by the local house.`);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  return response;
}
try{
  running=await startServer({webDir,dataDir,port:0,maxPort:0,env:{},fetchImpl:async()=>{externalCalls++;throw Error('Art city HTTP checks must stay offline.');}});
  assert.equal(running.server.address().address,'127.0.0.1');
  const before=await (await get('/api/house')).json();
  const savedBytes=await fs.readFile(path.join(dataDir,'house.json'));
  const original=await fs.readFile(path.join(webDir,'artists-websites.html'));
  const sourceCredits=await fs.readFile(path.join(webDir,'art-city','credits.json'));
  const credits=JSON.parse(sourceCredits.toString('utf8'));

  const gallery=await get('/artists-websites.html');
  assert.equal(gallery.headers.get('content-type'),'text/html; charset=utf-8');
  assert.equal(gallery.headers.get('content-length'),String(original.length));
  const galleryBytes=Buffer.from(await gallery.arrayBuffer());
  assert.deepEqual(galleryBytes,original,'The server preserves the complete frozen original gallery file.');
  assert.equal(sha(galleryBytes),'5fa732497902c19009f7164612846345c513888f2f21436f1bb93dd8cca168d6');
  assert.equal(sha(galleryBytes),credits.originalHtmlSha256);
  const policy=directives(gallery);
  const galleryScripts=policy.get('script-src');
  assert.ok(galleryScripts.includes("'self'"));
  assert.ok(!galleryScripts.includes("'unsafe-inline'"),'The gallery allows exact scripts without opening inline execution.');
  assert.ok(!galleryScripts.includes("'unsafe-eval'"));
  const outerHashes=[...original.toString('utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match=>!/\bsrc\s*=/i.test(match[1])&&match[2].length)
    .map(match=>`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  const nested=credits.nestedExecutableScriptHashes.map(hash=>`'${hash}'`);
  assert.deepEqual([...new Set(nested)].sort(),[
    "'sha256-P2NgFkkvB2nT8+Gcww4KSudslToyPVnLCOMYsc3jqgM='",
    "'sha256-2of+j0tuBOoInGV4aZpG2vYvSxW56VLKIe+9ExZ1xjQ='",
  ].sort(),'Only the two frozen nested website scripts are authorised.');
  assert.deepEqual(galleryScripts.filter(value=>value!=="'self'").sort(),[...outerHashes,...nested].sort(),'Gallery CSP has exactly its original inline scripts and two inherited frame scripts.');
  assert.deepEqual(policy.get('connect-src'),["'self'"],'Viewing offline galleries cannot fetch remote collection data automatically.');
  assert.ok(policy.get('img-src').includes('blob:'),'Embedded artwork hydration can display local Blob images.');

  const main=await get('/');
  const mainPolicy=directives(main);
  assert.deepEqual(mainPolicy.get('frame-ancestors'),["'none'"],'The main house keeps its frame protection.');
  assert.ok(!mainPolicy.get('script-src').includes("'unsafe-inline'"));
  assert.ok(nested.every(hash=>!mainPolicy.get('script-src').includes(hash)),'Gallery script exceptions do not spill into the house.');
  await main.arrayBuffer();
  const moduleResponse=await get('/art-city-data.js');
  assert.equal(moduleResponse.headers.get('content-type'),'text/javascript; charset=utf-8');
  assert.deepEqual(directives(moduleResponse).get('script-src'),["'self'"]);
  assert.deepEqual(Buffer.from(await moduleResponse.arrayBuffer()),await fs.readFile(path.join(webDir,'art-city-data.js')));

  let servedImages=0,totalBytes=0;
  for(const artist of ARTISTS){
    await Promise.all(artist.works.map(async work=>{
      const pathname='/'+work.imageUrl.slice(2);
      const source=await fs.readFile(path.join(webDir,work.imageUrl));
      const response=await get(pathname);
      assert.equal(response.headers.get('content-type'),'image/webp');
      assert.equal(response.headers.get('content-length'),String(source.length));
      assert.deepEqual(directives(response).get('script-src'),["'self'"],'Image responses never inherit gallery script exceptions.');
      const actual=Buffer.from(await response.arrayBuffer());
      assert.deepEqual(actual,source,`${artist.name} / ${work.title} serves the exact local artwork bytes.`);
      const attribution=credits.artists.find(record=>record.id===artist.id).works.find(record=>record.id===work.id);
      assert.equal(sha(actual),attribution.sha256);
      assert.equal(actual.length,attribution.bytes);
      servedImages++;totalBytes+=actual.length;
    }));
  }
  assert.equal(servedImages,60);
  assert.equal(totalBytes,21472498);
  const imageHead=await get('/'+ARTISTS[0].works[0].imageUrl.slice(2),'HEAD');
  assert.equal(imageHead.headers.get('content-type'),'image/webp');
  assert.equal((await imageHead.arrayBuffer()).byteLength,0);
  const galleryHead=await get('/artists-websites.html','HEAD');
  assert.deepEqual(directives(galleryHead).get('script-src'),galleryScripts);
  assert.equal(galleryHead.headers.get('content-length'),String(original.length));
  assert.equal((await galleryHead.arrayBuffer()).byteLength,0);
  const creditResponse=await get('/art-city/credits.json');
  assert.equal(creditResponse.headers.get('content-type'),'application/json; charset=utf-8');
  assert.deepEqual(directives(creditResponse).get('script-src'),["'self'"]);
  assert.deepEqual(Buffer.from(await creditResponse.arrayBuffer()),sourceCredits,'Every original source and reuse credit is available offline.');

  assert.deepEqual(await (await get('/api/house')).json(),before,'Reading the city, galleries and images leaves every home and its revision unchanged.');
  assert.deepEqual(await fs.readFile(path.join(dataDir,'house.json')),savedBytes,'City visits do not rewrite persisted house bytes.');
  assert.equal(externalCalls,0,'Artist house browsing makes no API or model calls.');
  console.log('Art city HTTP: frozen offline websites, exact gallery-only CSP hashes, all 60 WebP responses, credits, HEAD responses and unchanged house persistence passed.');
}finally{
  await running?.close();
  assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
  await fs.rm(temporary,{recursive:true,force:true});
}
