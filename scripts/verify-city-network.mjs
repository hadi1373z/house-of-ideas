import assert from 'node:assert/strict';
import {BOOKS} from '../web/books.js';
import {legacyStarter,clone} from '../web/model.js';
import {CITIES,CITY_ANCHORS,CITY_LIMITS,initialCityNetwork,validateCityNetwork,packIdea,packBook,
  placeCargo,removePlacement,recordCityVisit,saveCityNote,exportTravelPack,importTravelPack,
  exportCollection,importCollection} from '../web/city-network.js';

const before=value=>JSON.stringify(value),date='2026-10-08T09:30:00.000Z';
assert.deepEqual(CITIES.map(city=>city.id),['home','artists','makers','mathematics']);
assert.deepEqual(CITY_ANCHORS,{home:['library','table','plaza'],artists:['library','table','plaza'],makers:['library','workshop','plaza'],mathematics:['library','table','plaza']});
for(const city of CITIES){assert.ok(city.name&&city.description);assert.deepEqual(city.anchors.map(anchor=>anchor.id),CITY_ANCHORS[city.id]);assert.ok(city.anchors.every(anchor=>anchor.label));}
assert.equal(CITY_LIMITS.travelPackBytes,2*1024*1024);
let network=initialCityNetwork();
assert.deepEqual(validateCityNetwork(network),network);
assert.deepEqual(validateCityNetwork(undefined),network);
const normalized=validateCityNetwork(network);normalized.cargo.push({});assert.equal(network.cargo.length,0,'Validation returns a detached document.');
const house=legacyStarter(),idea={id:'local-claim',roomId:'math',title:'A useful claim',text:'First find a counterexample.\nKeep the original wording.',cue:'ring',sourceHomeTitle:'My preserved home',sourceRoomName:'Study'};
house.ideas.push(idea);const savedHouse=before(house),initial=before(network);
network=packIdea(network,idea);assert.equal(before(house),savedHouse,'Packing carries a copy without changing the source home or its idea.');assert.equal(initial,before(initialCityNetwork()));
assert.deepEqual(network.cargo[0],{id:'cargo-1',type:'idea',title:idea.title,text:idea.text,cue:'ring',action:'question',sourceHomeTitle:'My preserved home',sourceRoomName:'Study',sourceIdeaId:'local-claim'});
const oldNetwork=before(network),book=clone(BOOKS[0]),sourceBook=before(book);
network=packBook(network,{...book,sourceHomeTitle:'My current home',sourceRoomName:'Library'});
assert.equal(before(book),sourceBook);assert.equal(JSON.parse(oldNetwork).cargo.length,1);
assert.equal(network.cargo[1].bookId,book.id);assert.equal(network.cargo[1].title,book.title);assert.equal(network.cargo[1].text,[...book.pages,book.question].join('\n\n'));
assert.equal(network.cargo[1].action,'read');assert.equal(network.cargo[1].cue,'book');
network=packIdea(network,{title:'Predict and observe',text:'Compare two arrangements.',cue:'sphere',type:'activity'});assert.equal(network.cargo.at(-1).type,'activity');assert.equal(network.cargo.at(-1).action,'experiment');
const contents=before(network.cargo);
network=placeCargo(network,'cargo-1','artists','table');network=placeCargo(network,'cargo-1','makers','workshop');network=placeCargo(network,'cargo-2','home','library');
assert.equal(before(network.cargo),contents,'Placing display copies keeps every carried object available for the next city.');
assert.deepEqual(network.placements.map(item=>[item.cargoId,item.cityId,item.anchorId]),[['cargo-1','artists','table'],['cargo-1','makers','workshop'],['cargo-2','home','library']]);
assert.equal(new Set(network.placements.map(item=>item.id)).size,3);
const placed=before(network);network=removePlacement(network,'placement-1');assert.equal(JSON.parse(placed).placements.length,3);assert.equal(network.placements.length,2);assert.equal(before(network.cargo),contents,'Removing a display does not remove its transportable source.');
assert.throws(()=>removePlacement(network,'not-there'),/displayed city object/);
assert.throws(()=>placeCargo(network,'unknown','home','library'),/travel bag/);
assert.throws(()=>placeCargo(network,'cargo-1','outside','library'),/city/);
assert.throws(()=>placeCargo(network,'cargo-1','makers','table'),/landmark/);
assert.throws(()=>packBook(network,'not-an-offline-book'),/known offline/);
assert.throws(()=>packIdea(network,{...idea,action:'execute'}),/cue and function/);
assert.throws(()=>packIdea(network,{...idea,cue:'javascript'}),/cue and function/);
assert.throws(()=>packIdea(network,{...idea,text:'a'.repeat(6001)}),/6000/);

network=recordCityVisit(network,'artists',{now:date});network=recordCityVisit(network,'artists',{now:'2026-10-08T12:30:00+02:00'});
assert.equal(network.visits.artists,2);assert.equal(network.lastVisits.artists,'2026-10-08T10:30:00.000Z');assert.equal(network.visits.home,0);
network=saveCityNote(network,'artists','A circle changes its meaning when its neighbours change.',{now:date});
network=saveCityNote(network,'makers','Predict the outcome before moving the table.',{now:'2026-10-08T10:00:00.000Z'});
assert.deepEqual(network.notes.map(note=>[note.cityId,note.date]),[['artists',date],['makers','2026-10-08T10:00:00.000Z']]);
assert.equal(before(house),savedHouse,'City learning has a separate journal and cannot rewrite any home history.');
assert.throws(()=>saveCityNote(network,'home','',{now:date}),/City journal entry/);
assert.throws(()=>saveCityNote(network,'home','x'.repeat(2001),{now:date}),/2000/);
assert.throws(()=>saveCityNote(network,'home','bad date',{now:'2026-02-30T09:00:00.000Z'}),/ISO/);
assert.throws(()=>recordCityVisit(network,'home',{now:'today'}),/ISO/);
const maximumVisits=clone(network);maximumVisits.visits.home=CITY_LIMITS.visits;const visitSnapshot=before(maximumVisits);assert.throws(()=>recordCityVisit(maximumVisits,'home',{now:date}),/visit counts/);assert.equal(before(maximumVisits),visitSnapshot);

// Limits fail before committing; no least-recent item is silently discarded.
let full=initialCityNetwork();for(let i=0;i<64;i++)full=packIdea(full,{title:'Keep '+i,text:'Original '+i,cue:'crystal'});
let preserved=before(full);assert.throws(()=>packIdea(full,idea),/64 carried objects/);assert.equal(before(full),preserved);assert.equal(full.cargo[0].text,'Original 0');
let landmark=packBook(initialCityNetwork(),BOOKS[0]);for(let i=0;i<8;i++)landmark=placeCargo(landmark,'cargo-1','home','library');
preserved=before(landmark);assert.throws(()=>placeCargo(landmark,'cargo-1','home','library'),/8 display copies/);assert.equal(before(landmark),preserved);
landmark=placeCargo(landmark,'cargo-1','artists','library');assert.equal(landmark.placements.length,9,'A full home landmark does not fill another city’s library.');
let journal=initialCityNetwork();for(let i=0;i<120;i++)journal=saveCityNote(journal,CITIES[i%3].id,'Entry '+i,{now:date});
preserved=before(journal);assert.throws(()=>saveCityNote(journal,'home','Do not discard the first note',{now:date}),/120 city journal entries/);assert.equal(before(journal),preserved);assert.equal(journal.notes[0].text,'Entry 0');

const pack=exportTravelPack(network),roundTrip=importTravelPack(initialCityNetwork(),JSON.stringify(pack));
assert.deepEqual(roundTrip,network,'A portable collection preserves exact carried text, provenance, placements, notes and visit metadata.');
assert.equal(exportCollection,exportTravelPack);assert.equal(importCollection,importTravelPack);
pack.network.cargo[0].text='Changed export';assert.notEqual(network.cargo[0].text,'Changed export','An export is detached from saved state.');
assert.deepEqual(importTravelPack(network,exportTravelPack(network)),network,'Importing your own collection again is idempotent.');

// Independent computers begin with cargo-1/placement-1/note-1. Preserve both
// records and remap foreign references instead of overwriting an identity.
let local=packIdea(initialCityNetwork(),{title:'Local thought',text:'Keep this one.',cue:'book'});
local=placeCargo(local,'cargo-1','home','library');local=saveCityNote(local,'home','Local journal',{now:date});local=recordCityVisit(local,'home',{now:date});
let incoming=packBook(initialCityNetwork(),BOOKS[1]);incoming=placeCargo(incoming,'cargo-1','artists','table');incoming=saveCityNote(incoming,'artists','Imported journal',{now:date});incoming=recordCityVisit(incoming,'artists',{now:date});
const localBefore=before(local),incomingBefore=before(incoming),merged=importTravelPack(local,exportTravelPack(incoming));
assert.equal(before(local),localBefore);assert.equal(before(incoming),incomingBefore);
assert.equal(merged.cargo.length,2);assert.equal(merged.cargo[0].text,'Keep this one.');assert.equal(merged.cargo[1].bookId,'assumptions');
assert.equal(merged.placements[1].cargoId,merged.cargo[1].id);assert.notEqual(merged.placements[0].id,merged.placements[1].id);
assert.equal(merged.notes.length,2);assert.deepEqual(merged.notes.map(note=>note.text),['Local journal','Imported journal']);assert.notEqual(merged.notes[0].id,merged.notes[1].id);
assert.equal(merged.visits.home,1);assert.equal(merged.visits.artists,1);assert.deepEqual(importTravelPack(merged,exportTravelPack(incoming)),merged,'A remapped collection also imports idempotently.');
let copies=packBook(initialCityNetwork(),BOOKS[1]);copies=packBook(copies,BOOKS[1]);
copies=placeCargo(copies,'cargo-1','artists','table');copies=placeCargo(copies,'cargo-1','artists','table');copies=placeCargo(copies,'cargo-2','makers','library');
copies=saveCityNote(copies,'artists','Repeated observation',{now:date});copies=saveCityNote(copies,'artists','Repeated observation',{now:date});
const mergedCopies=importTravelPack(local,exportTravelPack(copies));
assert.equal(mergedCopies.cargo.length,3,'Separate imported cargo identities remain separate even when their content is identical.');
assert.equal(mergedCopies.placements.length,4,'Two identical display copies are both retained through ID collisions.');
assert.equal(mergedCopies.notes.length,3,'Two deliberately repeated journal entries remain separate.');
assert.equal(mergedCopies.placements.filter(item=>item.cityId==='artists').length,2);
assert.deepEqual(importTravelPack(mergedCopies,exportTravelPack(copies)),mergedCopies,'Repeat imports preserve the exact multiplicity of remapped copies.');
preserved=before(full);assert.throws(()=>importTravelPack(full,exportTravelPack(incoming)),/64 carried objects/);assert.equal(before(full),preserved,'An import overflow never partly applies notes or placements.');
const foreignLandmark=packBook(initialCityNetwork(),BOOKS[1]);foreignLandmark.placements=[{id:'foreign-display',cargoId:'cargo-1',cityId:'home',anchorId:'library'}];
assert.throws(()=>importTravelPack(landmark,exportTravelPack(foreignLandmark)),/8 display copies/);

for(const mutate of [
  n=>{n.version=2;},n=>{n.provider='gpt';},n=>{n.cargo[0].url='https://example.com/model.glb';},
  n=>{n.cargo[0].script='run()';},n=>{n.cargo[0].type='house-package';},n=>{n.cargo[1].bookId='unknown';},
  n=>{n.cargo[1].sourceHomeTitle='x'.repeat(101);},n=>{n.cargo[0].id='../escape';},n=>{n.cargo.push({...n.cargo[0]});},
  n=>{n.placements[0].cargoId='missing';},n=>{n.placements[0].anchorId='http://outside';},
  n=>{n.notes[0].date='2026-10-08';},n=>{n.notes[0].cityId='foreign';},n=>{n.visits.home=-1;},
]){
  const invalid=clone(network);mutate(invalid);assert.throws(()=>validateCityNetwork(invalid));
  assert.throws(()=>importTravelPack(network,{format:'house-of-ideas-travel-pack',version:1,network:invalid}));
}
assert.throws(()=>importTravelPack(network,'{'),/valid travel collection JSON/);
assert.throws(()=>importTravelPack(network,' '.repeat(CITY_LIMITS.travelPackBytes+1)),/under 2 MiB/);
assert.throws(()=>importTravelPack(network,{format:'other-package',version:1,network}),/supported/);
assert.throws(()=>importTravelPack(network,{format:'house-of-ideas-travel-pack',version:1,network,externalUrl:'https://example.com'}),/unsupported field/);
const executable=JSON.parse('{"format":"house-of-ideas-travel-pack","version":1,"__proto__":{"polluted":true}}');assert.throws(()=>importTravelPack(network,executable));assert.equal({}.polluted,undefined);
assert.equal(before(house),savedHouse);
console.log('City network: four validated destinations, independent cargo copies and city journals, immutable transports, placement capacity, lossless collision remapping, portable round trips, overflow preservation and defensive imports passed.');
