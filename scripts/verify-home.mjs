import assert from 'node:assert/strict';
import {starter,legacyStarter,validateHouse,clone,reachableRooms,IDEA_ACTIONS,defaultIdeaAction} from '../web/model.js';
import {MAX_HOMES,initialNeighborhood,validateNeighborhood,createEdition,selectEdition,saveEdition} from '../web/neighborhood.js';
import {converse,proposeCritique,decideProposal,observeRoom} from '../web/resident.js';
import {visitRoom,reflect} from '../web/socrates.js';

const now='2026-10-07T10:00:00.000Z',options={now};
const home=starter(),old=legacyStarter();
assert.deepEqual(home.rooms.map(room=>[room.id,room.name]),[
 ['math','Study'],['art','Bedroom'],['work','Kitchen'],['questions','Living room'],['learning','Entrance hall'],['connections','Library'],
]);
assert.equal(home.rooms.length,6);assert.equal(home.doors.length,7);
assert.deepEqual(home.doors,old.doors);
assert.deepEqual(home.rooms.map(({id,x,y,w,h,color})=>({id,x,y,w,h,color})),old.rooms.map(({id,x,y,w,h,color})=>({id,x,y,w,h,color})));
assert.equal(reachableRooms(home,'learning').size,6);
assert.deepEqual(validateHouse(home),home);
assert.ok(home.rooms.every(room=>room.purpose.length>100&&room.purpose.length<=400));

const fresh=initialNeighborhood(undefined,options);
assert.equal(fresh.homes.length,2);assert.equal(fresh.activeId,'home-2');
assert.deepEqual(fresh.homes[0].house,old);assert.equal(fresh.homes[0].edition,'legacy');
assert.deepEqual(fresh.homes[1].house,home);assert.equal(fresh.homes[1].edition,'inhabited');
assert.deepEqual(validateNeighborhood(fresh),fresh);

let personal=clone(old);
personal.ideas.push({id:'personal-note',roomId:'math',title:'A proof',text:'Keep my reasoning.',cue:'book'});
personal=reflect(visitRoom(personal,'2026-10-07','math'),'2026-10-07','math','My own explanation.');
personal=converse(personal,'math','I want to understand my assumptions.',options);
personal=observeRoom(personal,'math',options);
personal=proposeCritique(personal,'math',options);
personal=decideProposal(personal,personal.resident.proposals[0].id,'approve',options);
personal.localMetadata={keep:'whole document'};
const before=clone(personal),neighborhood=initialNeighborhood(personal,options);
assert.deepEqual(personal,before,'Building next door does not alter the old house.');
assert.deepEqual(neighborhood.homes[0].house,personal,'Old notes, journal, conversation and furnishings survive as a complete snapshot.');
const current=neighborhood.homes[1].house;
for(const key of ['ideas','learning','resident','localMetadata'])assert.deepEqual(current[key],personal[key],`${key} also survives in the new home.`);
assert.equal(current.rooms[0].name,'Study');
current.ideas[0].text='A new thought';
assert.equal(neighborhood.homes[0].house.ideas[0].text,'Keep my reasoning.','Homes do not share nested documents.');

const custom=clone(personal);
custom.rooms[0].name='My proof room';custom.rooms[0].purpose='Personal project';custom.rooms[0].color='#abcdef';
custom.rooms[5].x=13;custom.rooms[5].w=5;custom.doors=custom.doors.filter(door=>door.a!=='connections'&&door.b!=='connections');
const customized=initialNeighborhood(custom,options);
assert.deepEqual(customized.homes[0].house,custom);
assert.deepEqual(customized.homes[1].house.rooms[0],custom.rooms[0]);
assert.deepEqual(customized.homes[1].house.rooms.map(({id,x,y,w,h})=>({id,x,y,w,h})),custom.rooms.map(({id,x,y,w,h})=>({id,x,y,w,h})));
assert.deepEqual(customized.homes[1].house.doors,custom.doors);
assert.deepEqual(customized.homes[1].house.ideas,custom.ideas);

const visited=selectEdition(fresh,'home-1');
assert.equal(visited.activeId,'home-1');assert.equal(fresh.activeId,'home-2');
assert.throws(()=>saveEdition(visited,old,options),/older home is preserved/);
assert.throws(()=>selectEdition(fresh,'missing'),/Choose a home/);
const fork=createEdition(visited,undefined,{now,title:'My next home'});
assert.equal(fork.homes.length,3);assert.equal(fork.activeId,'home-3');assert.equal(fork.homes[2].title,'My next home');
assert.deepEqual(fork.homes[0].house,old);assert.deepEqual(fork.homes[2].house,old);
fork.homes[2].house.rooms[0].name='Different';assert.equal(fork.homes[0].house.rooms[0].name,'Mathematics');

const conversation=converse(home,'math','I value careful reasoning.',options);
const dialogSaved=saveEdition(fresh,conversation,options);
assert.equal(dialogSaved.homes.length,2,'Dialogue updates the latest house without creating a building.');
assert.equal(dialogSaved.homes[1].house.resident.messages.length,2);
assert.deepEqual(fresh.homes[1].house,home,'Saves are pure.');
const notes=clone(conversation);notes.ideas.push({id:'note',roomId:'math',title:'Think',text:'Observe the claim.',cue:'ring'});
const notesSaved=saveEdition(dialogSaved,notes,options);
assert.equal(notesSaved.homes.length,3,'Adding a physical idea object preserves the previous scene.');
assert.deepEqual(notesSaved.homes[1].house,conversation);
const textEdit=clone(notes);textEdit.ideas[0].text='A more careful explanation.';textEdit.ideas[0].title='Careful thought';
assert.equal(saveEdition(notesSaved,textEdit,options).homes.length,3,'Editing written notes keeps the physical edition.');
const moved=clone(notes);moved.ideas[0].roomId='art';
const movedSaved=saveEdition(notesSaved,moved,options);
assert.equal(movedSaved.homes.length,4);assert.equal(movedSaved.homes[2].house.ideas[0].roomId,'math');
assert.equal(movedSaved.homes[3].house.ideas[0].roomId,'art');
const dailyBook=clone(notes);dailyBook.ideas.push({id:'socratic-2026-10-07',roomId:'math',title:'Daily experiment',text:'A user-approved learning exercise.',cue:'book'});
const dailySaved=saveEdition(notesSaved,dailyBook,options);
assert.equal(dailySaved.homes.length,4,'An approved daily learning book creates a neighboring edition.');
assert.equal(dailySaved.homes[2].house.ideas.length,1);assert.equal(dailySaved.homes[3].house.ideas.length,2);
const functionEdit=clone(notes);functionEdit.ideas[0].action='reflect';
assert.equal(saveEdition(notesSaved,functionEdit,options).homes.length,4,'An object function change preserves its old behavior next door.');
const explicitFallback=clone(notes);explicitFallback.ideas[0].action='question';
assert.equal(saveEdition(notesSaved,explicitFallback,options).homes.length,3,'Making the default function explicit does not change the scene.');
const recolored=clone(notes);recolored.rooms[0].color='#abcdef';
const rebuilt=saveEdition(notesSaved,recolored,options);
assert.equal(rebuilt.homes.length,4);assert.equal(rebuilt.activeId,'home-4');
assert.deepEqual(rebuilt.homes[2].house,notes,'A visible change preserves the whole previous edition.');
const furnishingProposal=proposeCritique(conversation,'math',options);
const furnished=decideProposal(furnishingProposal,furnishingProposal.resident.proposals[0].id,'approve',options);
assert.equal(saveEdition(dialogSaved,furnished,options).homes.length,3,'Approved installed furniture creates a new home.');
const purpose=clone(conversation);purpose.rooms[0].purpose='A new written description.';
assert.equal(saveEdition(dialogSaved,purpose,options).homes.length,2,'Text descriptions do not create spatial editions.');
const reordered=clone(conversation);reordered.rooms.reverse();reordered.doors.reverse();
assert.equal(saveEdition(dialogSaved,reordered,options).homes.length,2,'Equivalent room and door ordering does not create an edition.');

const full=clone(fresh);
while(full.homes.length<MAX_HOMES){const id=`home-${full.homes.length+1}`;full.homes.push({id,title:id,createdAt:now,edition:'inhabited',house:clone(home)});}
full.activeId=full.homes.at(-1).id;
const fullBefore=clone(full);
assert.throws(()=>createEdition(full,undefined,options),/no old home was removed/);
assert.deepEqual(full,fullBefore);
assert.throws(()=>validateNeighborhood({...fresh,activeId:'missing'}),/Choose a home/);
assert.throws(()=>validateNeighborhood({...fresh,homes:[fresh.homes[0],fresh.homes[0]]}),/unique identifier/);
assert.throws(()=>createEdition(fresh,undefined,{title:''}),/home title/);

assert.deepEqual(IDEA_ACTIONS,['read','question','experiment','reflect']);
assert.deepEqual(['book','ring','sphere','crystal'].map(defaultIdeaAction),IDEA_ACTIONS);
const idea={id:'object',roomId:'math',title:'An object',text:'It serves a purpose.',cue:'book'};
assert.deepEqual(validateHouse({...home,ideas:[idea]}).ideas[0],idea,'Old objects keep their compatible stored shape.');
for(const action of IDEA_ACTIONS)assert.equal(validateHouse({...home,ideas:[{...idea,action}]}).ideas[0].action,action);
assert.throws(()=>validateHouse({...home,ideas:[{...idea,action:'execute-code'}]}),/reading, questioning/);
console.log('Verified domestic defaults, preserved neighboring editions, whole-document isolation, read-only visits, spatial history, capacity preservation and functional idea objects.');
