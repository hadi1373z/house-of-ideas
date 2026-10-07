import assert from 'node:assert/strict';
import {ARTISTS} from '../web/art-city-data.js';
import {starter,legacyStarter,validateHouse} from '../web/model.js';
import {createResident,validateResident,converse,proposeCritique,decideProposal,pendingProposals} from '../web/resident.js';

const options={now:'2026-10-08T12:00:00.000Z'};
const message=(artist,work,question='Which detail supports my interpretation?')=>`We are visiting ${artist.name}’s gallery in Artists’ City, looking at ${work.title}. ${question} Help me turn this observation into one learning activity for my Study.`;
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Offline art discussion must not make model or network calls.');};
const home=starter();home.ideas.push({id:'saved-note',roomId:'math',title:'My observation practice',text:'Keep my original notes.',cue:'book',action:'read'});
home.resident=createResident();home.resident.memory.values=['I value careful observation.'];home.resident.memory.rooms=[{roomId:'math',visits:2,lastVisitedAt:options.now}];
const before=structuredClone(home);
let count=0;
for(const artist of ARTISTS)for(const work of artist.works){
 const prompt=message(artist,work,'Could this idea improve my house? Please install a question board.'),result=converse(home,'math',prompt,options),reply=result.resident.messages.at(-1);
 assert.equal(reply.source,'local');assert.equal(reply.concept,'evidence');assert.ok(reply.text.includes(artist.name));assert.ok(reply.text.includes(work.title));assert.ok(reply.text.includes(work.description),'The response uses the actual catalog note.');
 assert.match(reply.text,/saved gallery note/);assert.match(reply.text,/Which visible detail can you actually point to/);assert.match(reply.text,/alternative interpretation/);assert.match(reply.text,/five minutes/);assert.match(reply.text,/Next visit:/);assert.match(reply.text,/My observation practice/);assert.match(reply.text,/Study/);
 assert.doesNotMatch(reply.text,/I see|I can see|the artist intended|Socrates said|I propose/);
 assert.equal(result.resident.messages.length,2);assert.equal(result.resident.messages[0].text,prompt);assert.equal(pendingProposals(result).length,0);assert.deepEqual(result.resident.roomFeatures,[]);assert.deepEqual(result.ideas,home.ideas);assert.deepEqual(result.rooms,home.rooms);assert.deepEqual(result.doors,home.doors);assert.deepEqual(result.resident.memory.values,home.resident.memory.values);assert.deepEqual(result.resident.memory.rooms,home.resident.memory.rooms);assert.equal(result.resident.memory.lastConcept,'evidence');assert.deepEqual(validateResident(result.resident,result),result.resident);assert.deepEqual(validateHouse(result),result);count++;
}
assert.equal(count,60);assert.deepEqual(home,before,'Art discussion leaves its input document untouched.');

// Earlier messages, explicit decisions and furniture survive an art visit.
let history=converse(home,'math','I want to learn how to question an assumption.',options);
history=proposeCritique(history,'math',options);history=decideProposal(history,history.resident.proposals[0].id,'approve',options);
const saved=structuredClone(history),monet=ARTISTS.find(a=>a.id==='monet'),water=monet.works.find(w=>w.id==='water-lilies');
history=converse(history,'math',message(monet,water),options);assert.deepEqual(history.resident.messages.slice(0,-2),saved.resident.messages);assert.deepEqual(history.resident.proposals,saved.resident.proposals);assert.deepEqual(history.resident.roomFeatures,saved.resident.roomFeatures);assert.deepEqual(history.resident.memory.values,saved.resident.memory.values);assert.deepEqual(history.ideas,saved.ideas);
assert.ok(converse(home,'math',message(monet,water).replaceAll('’',"'"),options).resident.messages.at(-1).text.includes(water.description),'Straight-apostrophe hand edits still match exact catalog pairs.');

// A title must belong to the named artist; mere artist mentions do not trigger
// the gallery path, and unrecognized works never acquire invented art facts.
for(const prompt of [message(monet,{title:'An unknown painting'},'Suggest an improvement to my house.'),message(monet,ARTISTS.find(a=>a.id==='klee').works[0]),message({name:'Unknown Artist'},water)]){
 const result=converse(home,'math',prompt,options);assert.match(result.resident.messages.at(-1).text,/cannot match.*saved city catalog/);assert.equal(result.resident.proposals.length,0);assert.equal(result.resident.observations.length,0);assert.equal(result.resident.roomFeatures.length,0);assert.ok(!result.resident.messages.at(-1).text.includes(water.description));
}
const general=converse(home,'math','What would Claude Monet ask about an assumption?',options);assert.equal(general.resident.messages.at(-1).concept,'assumptions');assert.match(general.resident.messages.at(-1).text,/Let us/);assert.doesNotMatch(general.resident.messages.at(-1).text,/saved gallery note/);

// The oldest house format needs no migration or new resident schema. Its
// snapshot and existing journal remain unchanged while a derived reply works.
const old=legacyStarter();old.resident={version:1};old.learning={version:1,days:[]};const archived=structuredClone(old),oldReply=converse(old,'art',message(monet,water),options);assert.deepEqual(old,archived);assert.equal(oldReply.resident.version,1);assert.deepEqual(oldReply.learning,old.learning);assert.deepEqual(oldReply.ideas,old.ideas);assert.deepEqual(oldReply.rooms,old.rooms);assert.ok(oldReply.resident.messages.at(-1).text.includes(old.rooms.find(r=>r.id==='art').name));assert.doesNotThrow(()=>validateHouse(oldReply));
globalThis.fetch=originalFetch;
console.log('Artist City resident passed: 60 attributed catalog discussions, concrete observation/interpretation exercises, selected-room practice and next-visit tests, history preservation, unknown-work fallback, archival compatibility and no network or automatic proposals.');
