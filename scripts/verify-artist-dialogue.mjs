import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ARTISTS} from '../web/art-city-data.js';
import {legacyStarter,clone} from '../web/model.js';
import {initialNeighborhood,selectEdition,createEdition} from '../web/neighborhood.js';
import {initialCityNetwork,validateCityNetwork,packBook,packIdea,placeCargo,removePlacement,recordCityVisit,saveCityNote,exportTravelPack,importTravelPack,CITY_LIMITS} from '../web/city-network.js';
import {ARTIST_DIALOGUE_LIMITS,ARTIST_RESIDENT_NOTE,artistOpening,artistQuestions,artistConversation,converseWithArtist} from '../web/artist-dialogue.js';
import {startServer} from '../server/local.mjs';

const date='2026-10-08T11:30:00.000Z',snapshot=value=>JSON.stringify(value);
const original=initialCityNetwork(),oldBytes=snapshot(original);
assert.ok(!Object.hasOwn(validateCityNetwork(original),'artistConversations'),'Validation does not migrate a saved network simply by reading it.');
assert.ok(!Object.hasOwn(validateCityNetwork(undefined),'artistConversations'));
assert.ok(ARTIST_RESIDENT_NOTE.includes('interpretive')&&ARTIST_RESIDENT_NOTE.includes('offline'));
assert.deepEqual(ARTIST_DIALOGUE_LIMITS,{messages:80,text:2000,bytes:512*1024});
const voices=new Set();let network=packBook(original,'assumptions');network=saveCityNote(network,'artists','Keep this earlier observation.',{now:date});
const earlierLearning=snapshot({cargo:network.cargo,notes:network.notes,placements:network.placements});
for(const artist of ARTISTS){
  const [work,nextWork]=artist.works;
  assert.deepEqual(artistConversation(network,artist.id),[]);
  assert.ok(artistOpening(artist.id,work.id).includes(work.title));
  const questions=artistQuestions(artist.id,work.id);assert.equal(questions.length,3);assert.ok(questions[0].includes(work.title));assert.ok(questions[1].includes('practice'));assert.ok(questions[2].includes('room'));
  const earlierNetwork=network,before=snapshot(network),exactUser=`  What can I notice in ${work.title}?\nKeep my original wording.  `;
  network=converseWithArtist(network,{artistId:artist.id,text:exactUser,workId:work.id,date});assert.equal(snapshot(earlierNetwork),before);
  const messages=artistConversation(network,artist.id);assert.equal(messages.length,2);assert.equal(messages[0].text,exactUser);assert.equal(messages[0].date,date);assert.equal(messages[0].workId,work.id);assert.equal(messages[1].role,'artist');
  assert.ok(messages[1].text.includes(work.title)&&messages[1].text.includes(work.description),'An artist resident looks at a work in their own house, using its preserved description.');
  assert.ok(messages[1].text.includes('?')&&messages[1].text.includes('practice'));voices.add(messages[1].text);
  messages[0].text='Changed detached read';assert.equal(artistConversation(network,artist.id)[0].text,exactUser);
  const beforeSecond=artistConversation(network,artist.id);network=converseWithArtist(network,{artistId:artist.id,text:questions[1],workId:nextWork.id,date});
  assert.deepEqual(artistConversation(network,artist.id).slice(0,2),beforeSecond);assert.ok(artistConversation(network,artist.id).at(-1).text.includes(nextWork.title));
  network=converseWithArtist(network,{artistId:artist.id,text:questions[2],workId:work.id,date});assert.match(artistConversation(network,artist.id).at(-1).text,/before changing your house/);
  const identityReply=converseWithArtist(network,{artistId:artist.id,text:'Who are you? Did you really say this quote?',date}).artistConversations[artist.id].at(-1).text;
  assert.ok(identityReply.includes(artist.name)&&identityReply.includes('interpretive')&&identityReply.includes('historical quotations'));
}
assert.equal(voices.size,10,'All ten residents have distinct grounded observation and practice.');
assert.equal(snapshot(original),oldBytes,'Dialogue never mutates the original document.');
assert.equal(snapshot({cargo:network.cargo,notes:network.notes,placements:network.placements}),earlierLearning,'Artist discussion retains all carried objects, city notes and placements.');
assert.equal(Object.keys(network.artistConversations).length,10);
assert.deepEqual(validateCityNetwork(network),network);
const contextual=converseWithArtist(network,{artistId:'monet',text:'I notice blue, but I am not sure whether it is sky or water.',date});
assert.match(artistConversation(contextual,'monet').at(-1).text,/You bring up blue/,'Free-form observations guide a visible-evidence follow-up.');
const comparison=converseWithArtist(network,{artistId:'monet',text:'How could I compare another version?',date});
assert.match(artistConversation(comparison,'monet').at(-1).text,/earlier observation/,'The resident connects a later comparison to the saved earlier conversation.');
const rooms=converseWithArtist(network,{artistId:'morris',text:'What ideas do you have for our houses and shelves?',date});
assert.match(artistConversation(rooms,'morris').at(-1).text,/repairability/,'Free-form plural house-design questions receive the artist’s practical room study.');
const making=converseWithArtist(network,{artistId:'klee',text:'I would like to try drawing something.',date});
assert.match(artistConversation(making,'klee').at(-1).text,/A small practice/);
const homes=initialNeighborhood(legacyStarter(),{now:date});homes.cityNetwork=network;
assert.deepEqual(selectEdition(homes,'home-2').cityNetwork.artistConversations,network.artistConversations);
assert.deepEqual(createEdition(homes).cityNetwork.artistConversations,network.artistConversations,'A new neighbouring home retains independent artist conversations.');

// Learning collections remain portable without silently publishing private chats.
const exported=exportTravelPack(network);assert.ok(!Object.hasOwn(exported.network,'artistConversations'));
assert.deepEqual(exported.network.cargo,network.cargo);assert.deepEqual(exported.network.notes,network.notes);
assert.deepEqual(importTravelPack(network,exported),network,'Importing a collection preserves every local artist exchange.');
const privateIncoming=clone(exported);privateIncoming.network.artistConversations=network.artistConversations;
const beforePrivateImport=snapshot(network);assert.throws(()=>importTravelPack(network,privateIncoming),/private artist conversations/);assert.equal(snapshot(network),beforePrivateImport,'A collection with private conversations is rejected atomically instead of silently dropping incoming history.');
const conversationsBefore=clone(network.artistConversations);
let transported=packIdea(network,{id:'artist-study',title:'A drawing study to carry',text:'Keep this independent from my conversations.',cue:'sphere'});
transported=packBook(transported,'practice');
for(const cityId of ['home','artists','makers']){
  transported=recordCityVisit(transported,cityId,{now:date});
  transported=placeCargo(transported,transported.cargo[0].id,cityId,'library');
  transported=saveCityNote(transported,cityId,'A new note in '+cityId,{now:date});
}
transported=removePlacement(transported,transported.placements[0].id);
transported=importTravelPack(transported,exportTravelPack(original));
assert.deepEqual(transported.artistConversations,conversationsBefore,'Every city visit, copied book/idea, display, removal, note and old collection import retains every artist conversation.');

for(const options of [
  {artistId:'socrates',text:'Hello'}, {artistId:'monet',text:''}, {artistId:'monet',text:' '.repeat(10)},
  {artistId:'monet',text:'x'.repeat(ARTIST_DIALOGUE_LIMITS.text+1)}, {artistId:'monet',text:'Hello',workId:ARTISTS[1].works[0].id},
  {artistId:'monet',text:'Hello',date:'2026-02-30T10:00:00.000Z'}, {artistId:'monet',text:'Hello',date:'today'},
  {artistId:'monet',text:'Hello',script:'execute'},null,[],
]){const before=snapshot(network);assert.throws(()=>converseWithArtist(network,options));assert.equal(snapshot(network),before);}
assert.throws(()=>artistOpening('foreign'),/known artist house/);assert.throws(()=>artistConversation(network,'foreign'),/known artist house/);
assert.throws(()=>artistQuestions('monet','unknown'),/own gallery/);
for(const mutate of [
  n=>{n.artistConversations=null;},n=>{n.artistConversations=[];},n=>{n.artistConversations.foreign=[];},
  n=>{n.artistConversations.monet[0].provider='online';},n=>{n.artistConversations.monet[0].role='socrates';},
  n=>{n.artistConversations.monet[0].id='../escape';},n=>{n.artistConversations.monet[0].date='yesterday';},
  n=>{n.artistConversations.monet[0].text='x'.repeat(CITY_LIMITS.artistMessageText+1);},
  n=>{n.artistConversations.monet[0].workId=ARTISTS[1].works[0].id;},n=>{n.artistConversations.monet.pop();},
  n=>{n.artistConversations.kandinsky[0].id=n.artistConversations.monet[0].id;},
]){const invalid=clone(network);mutate(invalid);assert.throws(()=>validateCityNetwork(invalid));}

let full=initialCityNetwork();for(let i=0;i<CITY_LIMITS.artistMessages/2;i++)full=converseWithArtist(full,{artistId:'monet',text:'Help me observe.',date});
const fullBefore=snapshot(full);assert.throws(()=>converseWithArtist(full,{artistId:'monet',text:'Keep all earlier observations.',date}),/at most 80 messages/);assert.equal(snapshot(full),fullBefore);assert.equal(artistConversation(full,'monet')[0].text,'Help me observe.');
const oversized=initialCityNetwork();oversized.artistConversations={};
for(const artist of ARTISTS.slice(0,4))oversized.artistConversations[artist.id]=Array.from({length:80},(_,index)=>({id:`${artist.id}-large-${index}`,role:index%2?'artist':'user',date,text:'x'.repeat(2000)}));
assert.throws(()=>validateCityNetwork(oversized),/512 KiB/);

// Use a temporary offline server to verify actual persistence, restart and CAS.
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-artist-conversations-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data'),file=path.join(dataDir,'house.json');
await fs.mkdir(webDir);await fs.mkdir(dataDir);await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Artist conversation fixture</body>');
const personal=legacyStarter();personal.personalMetadata={original:'Keep the whole home document.'};const neighborhood=initialNeighborhood(personal,{now:date});
const bytes=JSON.stringify({version:2,revision:3,neighborhood},null,4)+'\n';await fs.writeFile(file,bytes);
let server,externalCalls=0;
const launch=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{},fetchImpl:async()=>{externalCalls++;throw Error('Artist residents must work offline.');}});
try{
  server=await launch();const get=async route=>{const response=await fetch(server.url+route);assert.equal(response.status,200);return response.json();};
  const configResponse=await fetch(server.url+'/api/config'),config=await configResponse.json();
  const headers={'Content-Type':'application/json',Origin:server.url,Cookie:configResponse.headers.get('set-cookie').split(';')[0],'X-Local-CSRF':config.csrfToken};
  const homeBefore=(await get('/api/house')).neighborhood.homes;
  await get('/api/cities');assert.equal(await fs.readFile(file,'utf8'),bytes,'Opening artist conversations never writes an absent optional field.');
  const response=await fetch(server.url+'/api/cities',{method:'PUT',headers,body:JSON.stringify({revision:3,cityNetwork:network})});assert.equal(response.status,200);const saved=await response.json();
  assert.deepEqual(saved.cityNetwork,network);assert.deepEqual(saved.neighborhood.homes,homeBefore);assert.equal(saved.revision,4);
  const stored=await fs.readFile(file);const stale=await fetch(server.url+'/api/cities',{method:'PUT',headers,body:JSON.stringify({revision:3,cityNetwork:original})});assert.equal(stale.status,409);assert.deepEqual(await fs.readFile(file),stored);
  const invalid=clone(network);invalid.artistConversations.monet[0].role='socrates';const rejected=await fetch(server.url+'/api/cities',{method:'PUT',headers,body:JSON.stringify({revision:4,cityNetwork:invalid})});assert.equal(rejected.status,400);assert.deepEqual(await fs.readFile(file),stored);
  await server.close();server=null;server=await launch();const restarted=await get('/api/house');assert.deepEqual(restarted.neighborhood.cityNetwork,network);assert.deepEqual(restarted.neighborhood.homes,homeBefore);assert.equal(restarted.revision,4);
  assert.equal(externalCalls,0,'Ten artist conversations make no online provider calls.');
}finally{await server?.close();assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));await fs.rm(temporary,{recursive:true,force:true});}
console.log('Artist residents: ten distinct grounded offline voices, selected works and practices, optional lossless histories, preserved homes and learning collections, bounded strict validation, private collection exports, CAS and durable local restart passed.');
