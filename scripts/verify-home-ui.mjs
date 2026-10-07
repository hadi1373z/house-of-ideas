import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initHomeUI} from '../web/home-ui.js';
import {BOOKS} from '../web/books.js';
import {starter} from '../web/model.js';

// A focused user-flow harness, independent of the full revision-aware app test.
class Element {
 constructor(tag='DIV'){this.tagName=tag;this.value='';this.children=[];this.hidden=false;this.textContent='';this.attributes={};const classes=new Set();this.classList={contains:v=>classes.has(v),toggle(v,on){const add=on??!classes.has(v);if(add)classes.add(v);else classes.delete(v);return add;}};}
 replaceChildren(...children){this.children=children;}setAttribute(key,value){this.attributes[key]=value;}
}
const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const elements=new Map(ids.map(id=>[id,new Element()]));
const $=id=>{assert.ok(elements.has(id),id);return elements.get(id);};
const listeners=new Map(),document={body:new Element('BODY'),createElement:tag=>new Element(tag.toUpperCase()),querySelector:()=>null},window={addEventListener:(event,fn)=>listeners.set(event,fn)};
const house=starter();house.ideas.push({id:'test-idea',roomId:'math',title:'A prediction',text:'The result should increase.',cue:'sphere',action:'experiment'});
let readOnly=false,selected='math',playerRoom=null,fail=false,saveCalls=0,lastSave=null,editCalls=0,reflectionCalls=0,seats=[],stands=0,resolveSave=null,defer=false,visited=null;
const scene={seatAt:data=>seats.push(data),stand:()=>stands++,playerState:()=>({seated:false,roomId:playerRoom}),residentState:()=>({near:false})};
const ui=initHomeUI({$,document,window,scene,getHouse:()=>house,getSelected:()=>selected,selectRoom:id=>{selected=id;},openIdea:()=>editCalls++,reflect:()=>reflectionCalls++,async saveReflection(roomId,answer){saveCalls++;lastSave={roomId,answer};if(fail)throw Error('Disk unavailable');if(defer)await new Promise(resolve=>{resolveSave=resolve;});},visitHome:id=>{visited=id;},getNeighborhood:()=>({activeId:'old',homes:[{id:'old',title:'Earlier home'},{id:'new',title:'Current home'}]}),forkHome(){},isReadOnly:()=>readOnly});

// A physical book opens its own original reading and cycles real pages.
for(const book of BOOKS){ui.interact({homeAction:'read',bookId:book.id,roomId:'math'});assert.equal($('activity-title').textContent,book.title);assert.ok($('activity-text').textContent.includes(book.pages[0]));$('activity-next').onclick();assert.ok($('activity-text').textContent.includes(book.pages[1]));}
ui.inspectIdea('test-idea');assert.equal($('activity-title').textContent,'A prediction');assert.match($('activity-text').textContent,/The result should increase/);assert.match($('activity-text').textContent,/prediction, an observable result/);

// Sitting targets the fixture's safe anchor and standing closes the activity.
const anchor={x:1,z:2},lookAt={x:2,z:2};ui.interact({homeAction:'sit',roomId:'questions',anchor,lookAt});assert.equal(seats.at(-1).anchor,anchor);assert.equal(seats.at(-1).lookAt,lookAt);$('activity-close').onclick();assert.equal($('home-activity').hidden,true);assert.equal(stands,1);

// A failed durable save retains the actual answer, allowing the reader to retry.
ui.interact({homeAction:'read',bookId:'definitions',roomId:'math'});$('activity-answer').value='Keep this draft';fail=true;await $('activity-save').onclick();assert.equal($('activity-answer').value,'Keep this draft');assert.match($('activity-feedback').textContent,/Disk unavailable/);fail=false;await $('activity-save').onclick();assert.deepEqual(lastSave,{roomId:'math',answer:'Keep this draft'});assert.equal($('activity-answer').value,'');

// A save from one physical object must not erase a newer draft at another.
ui.interact({homeAction:'read',bookId:'definitions',roomId:'math'});$('activity-answer').value='First answer';defer=true;const pending=$('activity-save').onclick();assert.equal(typeof resolveSave,'function');ui.interact({homeAction:'read',bookId:'practice',roomId:'work'});$('activity-answer').value='Second answer, still being written';resolveSave();await pending;defer=false;assert.deepEqual(lastSave,{roomId:'math',answer:'First answer'});assert.equal($('activity-answer').value,'Second answer, still being written','Completing an earlier save must preserve the current activity draft');

// Choosing another book in the same reader also changes the activity identity.
ui.interact({homeAction:'read',bookId:'definitions',roomId:'math'});$('activity-answer').value='A shared phrase';defer=true;const oldBookSave=$('activity-save').onclick();$('activity-book-select').value='dialogue';$('activity-book-select').onchange();$('activity-answer').value='A shared phrase';resolveSave();await oldBookSave;defer=false;assert.equal($('activity-title').textContent,BOOKS.find(book=>book.id==='dialogue').title);assert.equal($('activity-answer').value,'A shared phrase','Even equal text in a new book is a distinct draft');

// Preserved houses retain reading, but never expose or invoke mutating actions.
readOnly=true;const callsBefore=saveCalls;ui.interact({homeAction:'read',bookId:'care',roomId:'math'});assert.equal($('activity-answer-label').hidden,true);assert.equal($('activity-save').hidden,true);$('activity-answer').value='Cannot change the old home';await $('activity-save').onclick();assert.equal(saveCalls,callsBefore);ui.inspectIdea('test-idea');assert.equal($('activity-edit').hidden,true);$('activity-edit').onclick();assert.equal(editCalls,0);ui.interact({homeAction:'journal',roomId:'math'});assert.equal(editCalls,0);assert.equal(document.body.classList.contains('journal-open'),true);ui.renderNeighborhood();assert.equal($('home-readonly').hidden,false);$('home-history').children[1].onclick();assert.equal(visited,'new');

// Typing the journal shortcut in a text field cannot change the spatial UI.
const before=document.body.classList.contains('journal-open');listeners.get('keydown')({target:{tagName:'TEXTAREA'},key:'j',preventDefault(){throw Error('Typing must remain typing');}});assert.equal(document.body.classList.contains('journal-open'),before);

// The journal belongs to the room physically entered, without moving the camera.
playerRoom='art';ui.journal(false);ui.journal(true);assert.equal(selected,'art');playerRoom=null;ui.journal(false);ui.journal(true);assert.equal(selected,'art','Opening the journal outdoors preserves the last real room');
console.log('Verified physical readings, useful idea actions, seating/standing, failed-save retention, concurrent activity drafts, and preserved-home reading without edits.');
