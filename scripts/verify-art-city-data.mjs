import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ARTISTS} from '../web/art-city-data.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'web');
const original=await fs.readFile(path.join(web,'artists-websites.html'));
const html=original.toString('utf8');
const credits=JSON.parse(await fs.readFile(path.join(web,'art-city','credits.json'),'utf8'));
const expected=[
  ['monet','Claude Monet'],['kandinsky','Wassily Kandinsky'],['van-gogh','Vincent van Gogh'],
  ['hokusai','Katsushika Hokusai'],['rodin','Auguste Rodin'],['hilma-af-klint','Hilma af Klint'],
  ['mondrian','Piet Mondrian'],['lange','Dorothea Lange'],['morris','William Morris'],['klee','Paul Klee'],
];
const scripts=source=>[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const jsonScript=(source,id)=>{
  const matches=scripts(source).filter(match=>new RegExp(`\\bid="${id}"`).test(match[1]));
  assert.equal(matches.length,1,`One ${id} source record is retained.`);
  return JSON.parse(matches[0][2]);
};
const decode=source=>source.replace(/&(?:#(x[\da-f]+|\d+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,numeric,named)=>numeric?String.fromCodePoint(numeric[0].toLowerCase()==='x'?parseInt(numeric.slice(1),16):Number(numeric)):{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[named.toLowerCase()]);
const visible=source=>decode(source.replace(/<br\b[^>]*>/gi,' ').replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim();
const field=(source,pattern,label)=>{
  const match=source.match(pattern);
  assert.ok(match,`The source includes ${label}.`);
  return visible(match[1]);
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sites=jsonScript(html,'preview-data');
const embedded=jsonScript(html,'embedded-art-data');
assert.deepEqual(ARTISTS.map(({id,name})=>[id,name]),expected,'The source artist names and order are exact.');
assert.deepEqual(Object.keys(sites),expected.map(([id])=>id));
assert.equal(credits.version,1);
assert.equal(credits.sourceRepository,'https://github.com/hadi1373z/artist-galleries');
assert.equal(credits.sourceCommit,'7161f1c420328386046ef6413c04a51868be38de');
assert.equal(sha(original),'5fa732497902c19009f7164612846345c513888f2f21436f1bb93dd8cca168d6','All original website content and interactions remain byte identical.');
assert.equal(credits.originalHtmlSha256,sha(original));
assert.equal(credits.originalHtmlBytes,original.length);
assert.deepEqual(credits.artists.map(({id,name})=>[id,name]),expected);
const nestedHashes=new Set();
const localFiles=new Set();
let totalBytes=0;
for(const artist of ARTISTS){
  assert.match(artist.color,/^#[a-f\d]{6}$/i);
  assert.match(artist.background,/^#[a-f\d]{6}$/i);
  assert.ok(artist.description.length>20&&artist.approach.length>40,`${artist.id} has its own looking approach.`);
  assert.equal(artist.websiteUrl,`https://hadi1373z.github.io/artist-galleries/#${artist.id}`);
  const site=sites[artist.id],pages=jsonScript(site,'page-data');
  const attribution=credits.artists.find(record=>record.id===artist.id);
  assert.equal(attribution.creditsHtml,pages.credits.html,'The entire original source and image-credit page is preserved.');
  assert.equal(attribution.offlineWebsiteUrl,`./artists-websites.html#${artist.id}`);
  assert.equal(Object.keys(pages).length,13,'All thirteen views are available inside each offline website.');
  assert.equal(artist.works.length,6);
  const routeKeys=Object.keys(pages).filter(key=>key.startsWith('works/'));
  assert.deepEqual(artist.works.map(work=>work.id),routeKeys.map(key=>key.slice(6)));
  assert.equal(attribution.works.length,6);
  for(const work of artist.works){
    const page=pages[`works/${work.id}`].html;
    const embeddedKey=`${artist.id}_${work.id}`;
    const attributed=attribution.works.find(record=>record.id===work.id);
    for(const key of ['title','date','medium','imageUrl','alt','description','sourceUrl','rights','rightsUrl','citation','dimensions','collection']){
      assert.ok(typeof work[key]==='string'&&work[key].length>0,`${embeddedKey} retains ${key}.`);
      assert.equal(attributed[key],work[key]);
    }
    assert.equal(work.title,field(page,/<h1>([\s\S]*?)<\/h1>/,'title'));
    assert.equal(work.date,field(page,/<dt>Date<\/dt><dd>([\s\S]*?)<\/dd>/,'date'));
    assert.equal(work.medium,field(page,/<dt>Medium<\/dt><dd>([\s\S]*?)<\/dd>/,'medium'));
    assert.equal(work.description,field(page,/<p class="description">([\s\S]*?)<\/p>/,'description'));
    assert.equal(work.alt,decode(page.match(/<img\b[^>]*\balt="([^"]+)"/)[1]));
    assert.equal(work.sourceUrl,decode(page.match(/\bdata-source="([^"]+)"/)[1]));
    assert.equal(work.citation,decode(page.match(/\bdata-citation="([^"]+)"/)[1]));
    assert.equal(work.rights,field(page,/<div class="source-note">([\s\S]*?)<br>/,'original attribution'));
    assert.equal(work.rightsUrl,decode(page.match(/<div class="source-note">[\s\S]*?<a href="([^"]+)"/)[1]));
    assert.match(work.sourceUrl,/^https:\/\//);
    assert.match(work.rightsUrl,/^https:\/\//);
    assert.equal(work.imageUrl,`./art-city/artworks/${embeddedKey}.webp`);
    assert.ok(!localFiles.has(work.imageUrl),'No artwork file is accidentally reused for another record.');
    localFiles.add(work.imageUrl);
    const file=path.resolve(web,work.imageUrl);
    assert.equal(path.dirname(file),path.join(web,'art-city','artworks'),'Artwork paths stay inside the bundled gallery folder.');
    const bytes=await fs.readFile(file);
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.equal(bytes.readUInt32LE(4)+8,bytes.length,'The extracted WebP is complete.');
    assert.deepEqual(bytes,Buffer.from(embedded[embeddedKey],'base64'),'The artwork is extracted without recompression or substitution.');
    assert.equal(attributed.sha256,sha(bytes));
    assert.equal(attributed.bytes,bytes.length);
    totalBytes+=bytes.length;
  }
  for(const match of scripts(site)){
    if(/\btype="application\/json"/i.test(match[1]))continue;
    assert.ok(!/\bsrc\s*=/i.test(match[1]),'Offline artist sites require no remote script.');
    assert.ok(!match[2].includes('embedded-art:'),'Hydration does not change executable script hashes.');
    nestedHashes.add(`sha256-${createHash('sha256').update(match[2]).digest('base64')}`);
  }
  assert.ok(!/<(?:img|script|link)\b[^>]*(?:src|href)="https?:\/\//i.test(site),'Images, scripts, and styles remain offline.');
}
assert.equal(localFiles.size,60);
assert.equal(Object.keys(embedded).length,60);
assert.equal((await fs.readdir(path.join(web,'art-city','artworks'))).length,60);
assert.equal(totalBytes,21472498);
assert.deepEqual([...nestedHashes].sort(),[...credits.nestedExecutableScriptHashes].sort(),'The server can allow only the two exact nested website scripts.');

// Exercise the original offline hub rather than only checking serialized records.
const eventHandlers=new Map(),elementHandlers=new Map();
const frame={contentWindow:{},srcdoc:'',removeAttribute(name){if(name==='srcdoc')this.srcdoc='';}};
const hub={hidden:false},viewer={hidden:true};
const picker={value:'',get selectedOptions(){return [{text:ARTISTS.find(artist=>artist.id===this.value)?.name}];},addEventListener(type,callback){elementHandlers.set(`picker:${type}`,callback);}};
const back={addEventListener(type,callback){elementHandlers.set(`back:${type}`,callback);}};
const elements={'preview-data':{textContent:JSON.stringify(sites)},'embedded-art-data':{textContent:JSON.stringify(embedded)},hub,viewer,'artist-frame':frame,'artist-picker':picker,back};
const document={title:'',getElementById(id){assert.ok(elements[id],`Known source element ${id}`);return elements[id];}};
let fragment='';
const location={get hash(){return fragment;},set hash(value){fragment=value&&!value.startsWith('#')?`#${value}`:value;}};
let createdImages=0;
const context=vm.createContext({document,location,Uint8Array,Blob,Map,atob,URL:{createObjectURL(blob){assert.equal(blob.type,'image/webp');createdImages++;return `blob:local-art/${createdImages}`;}},window:{scrollTo(){},addEventListener(type,callback){eventHandlers.set(type,callback);}},fetch(){throw Error('The bundled gallery should not fetch remote data.');}});
for(const match of scripts(html))if(!/\btype="application\/json"/i.test(match[1]))vm.runInContext(match[2],context);
assert.equal(hub.hidden,false);
for(const artist of ARTISTS){
  location.hash=`#${artist.id}`;eventHandlers.get('hashchange')();
  assert.equal(hub.hidden,true);assert.equal(viewer.hidden,false);
  assert.equal(frame.title,`${artist.name} website`);
  assert.equal(document.title,`${artist.name} — Ten ways of looking`);
  assert.ok(frame.srcdoc.includes(`<title>${artist.name}</title>`));
  assert.ok(!frame.srcdoc.includes('embedded-art:'),'Every route and activity receives local artwork URLs.');
  const routes=jsonScript(frame.srcdoc,'page-data');
  assert.equal(Object.keys(routes).length,13);
  assert.ok(Object.values(routes).every(page=>!page.html.includes('embedded-art:')));
}
assert.equal(createdImages,60,'All views share exactly one local Blob for each embedded artwork.');
location.hash='#monet';eventHandlers.get('hashchange')();
assert.equal(createdImages,60,'Revisiting a house reuses its local artwork images.');
picker.value='klee';elementHandlers.get('picker:change')();assert.equal(location.hash,'#klee');eventHandlers.get('hashchange')();
assert.equal(frame.title,'Paul Klee website');
eventHandlers.get('message')({source:frame.contentWindow,data:{type:'artist-home'}});assert.equal(location.hash,'');eventHandlers.get('hashchange')();
assert.equal(viewer.hidden,true);assert.equal(frame.srcdoc,'');
location.hash='#monet';eventHandlers.get('hashchange')();elementHandlers.get('back:click')();assert.equal(location.hash,'');
console.log('Art city: ten exact artist identities, sixty unchanged local WebPs, complete source attribution, 130 offline views, image hydration and original gallery navigation passed.');
