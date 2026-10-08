import assert from 'node:assert/strict';
import {initialCityNetwork,validateCityNetwork,saveCityNote,exportCollection,importCollection} from '../web/city-network.js';
import {converseWithArtist} from '../web/artist-dialogue.js';
import {proposeArtistHome,decideArtistHome,artistImprovementBrief} from '../web/artist-homes.js';
import {initArtistHomesUI} from '../web/artist-homes-ui.js';
import {ARTISTS} from '../web/art-city-data.js';

const initial=initialCityNetwork();assert.equal(Object.hasOwn(validateCityNetwork(initial),'artistHomes'),false);
assert.throws(()=>proposeArtistHome(initial,'monet'),/Talk with/);
let network=saveCityNote(initial,'makers','Keep my city journal.');
network=converseWithArtist(network,{artistId:'monet',text:'How can light change the way I learn here?'});
const original=JSON.stringify(network),conversation=JSON.stringify(network.artistConversations);
network=proposeArtistHome(network,'monet');assert.equal(network.artistHomes.proposals[0].decision,'pending');assert.equal(network.artistHomes.editions.length,0);
assert.equal(JSON.stringify(network.artistConversations),conversation);assert.equal(JSON.stringify(proposeArtistHome(network,'monet')),JSON.stringify(network),'Same exchange never duplicates a design.');
const edited={title:'A changing light study',reason:'Compare observations in a garden palette.',exercise:'Draw the same object twice, then describe the change.',feature:'observation-alcove',atmosphere:'garden'};
const approved=decideArtistHome(network,network.artistHomes.proposals[0].id,'approved',edited);assert.equal(approved.artistHomes.editions[0].number,2);assert.equal(approved.artistHomes.editions[0].exercise,edited.exercise);
assert.equal(JSON.stringify(approved.artistConversations),conversation);assert.equal(approved.notes[0].text,'Keep my city journal.');assert.equal(JSON.stringify(JSON.parse(original).artistConversations),conversation);
assert.throws(()=>decideArtistHome(approved,approved.artistHomes.proposals[0].id,'approved',edited),/pending/);
const brief=artistImprovementBrief(approved,'monet');assert.equal(brief.approvedEditions.length,1);assert.equal(Object.hasOwn(brief,'artistConversations'),false);assert.ok(!JSON.stringify(brief).includes('How can light'));
assert.ok(!Object.hasOwn(exportCollection(approved).network,'artistHomes'));assert.throws(()=>importCollection(initial,JSON.stringify({format:'house-of-ideas-travel-pack',version:1,network:approved})),/private/);
const invalid=structuredClone(approved);invalid.artistHomes.editions[0].number=3;assert.throws(()=>validateCityNetwork(invalid),/edition number/);
invalid.artistHomes.editions[0].number=2;invalid.artistHomes.editions[0].exercise='Different';assert.throws(()=>validateCityNetwork(invalid),/approved/);
let each=initial;
for(const a of ARTISTS){each=converseWithArtist(each,{artistId:a.id,text:'How would you make this house closer to your practice?'});each=proposeArtistHome(each,a.id);const p=each.artistHomes.proposals.at(-1);each=decideArtistHome(each,p.id,'approved');}
assert.equal(each.artistHomes.editions.length,10);assert.ok(new Set(each.artistHomes.editions.map(e=>e.feature+e.atmosphere)).size>=6,'Artists propose varied spatial learning practices.');
const elements=new Map();class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.value='';this.textContent='';this.open=false;this.listeners=new Map();this.attributes={};}
 set id(v){this._id=v;elements.set(v,this);}get id(){return this._id;}
 append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];}
 setAttribute(key,value){this.attributes[key]=value;}addEventListener(name,handler){this.listeners.set(name,handler);}
 showModal(){this.open=true;}close(){this.open=false;this.listeners.get('close')?.();}
 click(){this.clicked=true;}remove(){this.removed=true;}
}
const document={body:new Element('body'),createElement:tag=>new Element(tag)},visits=[];
let saves=0,fail=false,saving=false,saveWait=null,remoteNetwork=null,reloadFails=false,reloads=0,downloadedBlob=null;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const browserWindow={URL:{createObjectURL(blob){downloadedBlob=blob;return'blob:test';},revokeObjectURL(){}},setTimeout(fn){fn();}};
const ui=initArtistHomesUI({document,window:browserWindow,getNetwork:()=>network,isSaving:()=>saving,
 async saveNetwork(next){
  saves++;saving=true;ui.render();
  try{if(saveWait)await saveWait.promise;if(fail)throw Error('Revision changed.');network=validateCityNetwork(next);ui.render();}
  finally{saving=false;ui.render();}
 },
 async reload(){reloads++;saving=true;ui.render();try{if(reloadFails)return false;if(remoteNetwork)network=validateCityNetwork(remoteNetwork);ui.render();return true;}finally{saving=false;ui.render();}},
 visit:(...args)=>visits.push(args)});
ui.show('monet');assert.equal(saves,0,'Opening review never writes or approves.');assert.equal(elements.get('artist-house-title').value,network.artistHomes.proposals[0].title);
const form=document.body.children[0].children.find(n=>n.tagName==='form');
elements.get('artist-house-title').value='Owner edited title';fail=true;form.onsubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,0));assert.equal(network.artistHomes.editions.length,0);assert.equal(elements.get('artist-house-title').value,'Owner edited title');assert.match(elements.get('artist-house-status').textContent,/Revision changed/);
fail=false;form.onsubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,0));assert.equal(network.artistHomes.editions.length,1);assert.equal(network.artistHomes.editions[0].title,'Owner edited title');
assert.equal(elements.get('artist-house-export').disabled,false,'Export is enabled immediately after approval, after busy clears');
const buttons=elements.get('artist-house-editions').children;buttons[0].onclick();buttons[1].onclick();assert.deepEqual(visits,[['monet',undefined],['monet','artist-house-1']]);
ui.show('monet','artist-house-1');assert.match(elements.get('artist-house-status').textContent,/Try this:/);

// Each selected proposal keeps its exact owner draft through root renders, native close and artist switches.
network=converseWithArtist(network,{artistId:'monet',text:'A second private conversation.'});network=proposeArtistHome(network,'monet');
const secondProposal=network.artistHomes.proposals.at(-1).id;
network=converseWithArtist(network,{artistId:'monet',text:'A third private conversation.'});network=proposeArtistHome(network,'monet');
const thirdProposal=network.artistHomes.proposals.at(-1).id;
network=converseWithArtist(network,{artistId:'klee',text:'An unrelated Klee conversation.'});network=proposeArtistHome(network,'klee');
ui.show('monet');assert.equal(elements.get('artist-house-proposal').value,secondProposal);
const ownerDraft={title:'  My exact second design  ',reason:'\n  Keep these details.\nDo not reset this draft.\n',exercise:'Compare a view twice.\nRecord the difference.',feature:'material-table',atmosphere:'quiet'};
for(const[key,value]of Object.entries(ownerDraft)){elements.get('artist-house-'+key).value=value;elements.get('artist-house-'+key).oninput();}
network=saveCityNote(network,'artists','An unrelated city save.');ui.render();
for(const[key,value]of Object.entries(ownerDraft))assert.equal(elements.get('artist-house-'+key).value,value);
elements.get('artist-house-proposal').value=thirdProposal;elements.get('artist-house-proposal').onchange();
elements.get('artist-house-title').value='My third design draft';elements.get('artist-house-title').oninput();
elements.get('artist-homes-dialog').close();ui.show('monet');
assert.equal(elements.get('artist-house-proposal').value,thirdProposal);assert.equal(elements.get('artist-house-title').value,'My third design draft');
ui.show('klee');elements.get('artist-house-title').value='My Klee design draft';elements.get('artist-house-title').oninput();
ui.show('monet');assert.equal(elements.get('artist-house-proposal').value,thirdProposal);assert.equal(elements.get('artist-house-title').value,'My third design draft');
elements.get('artist-house-proposal').value=secondProposal;elements.get('artist-house-proposal').onchange();
for(const[key,value]of Object.entries(ownerDraft))assert.equal(elements.get('artist-house-'+key).value,value);

// The real coordinator renders as soon as saving starts; a conflict still keeps every owner field.
fail=true;await form.onsubmit({preventDefault(){}});
for(const[key,value]of Object.entries(ownerDraft))assert.equal(elements.get('artist-house-'+key).value,value);
assert.equal(elements.get('artist-house-reload').hidden,false);assert.equal(network.artistHomes.editions.length,1);
reloadFails=true;await elements.get('artist-house-reload').onclick();
assert.match(elements.get('artist-house-status').textContent,/could not be reloaded/);
for(const[key,value]of Object.entries(ownerDraft))assert.equal(elements.get('artist-house-'+key).value,value);
reloadFails=false;remoteNetwork=saveCityNote(network,'makers','The other window’s saved note.');
await elements.get('artist-house-reload').onclick();
assert.equal(reloads,2);assert.equal(elements.get('artist-house-reload').hidden,true);
assert.ok(network.notes.some(note=>note.text==='The other window’s saved note.'));
for(const[key,value]of Object.entries(ownerDraft))assert.equal(elements.get('artist-house-'+key).value,value);

// Reloading an idea already approved elsewhere hides its editor instead of approving another idea.
fail=true;await form.onsubmit({preventDefault(){}});
remoteNetwork=decideArtistHome(network,secondProposal,'approved');
await elements.get('artist-house-reload').onclick();
assert.equal(form.hidden,true);assert.match(elements.get('artist-house-status').textContent,/already approved/);
assert.equal(network.artistHomes.editions.length,2);
assert.equal(elements.get('artist-house-proposal').value,'');
elements.get('artist-house-proposal').value=thirdProposal;elements.get('artist-house-proposal').onchange();
assert.equal(form.hidden,false);assert.equal(elements.get('artist-house-title').value,'My third design draft');

// An in-flight save cannot clear a different artist's current draft.
fail=false;saveWait=deferred();const savingThird=form.onsubmit({preventDefault(){}});
ui.show('klee');assert.equal(elements.get('artist-house-title').value,'My Klee design draft');
saveWait.resolve();await savingThird;saveWait=null;
assert.equal(elements.get('artist-house-title').value,'My Klee design draft');assert.equal(network.artistHomes.editions.length,3);
ui.show('monet');assert.equal(elements.get('artist-house-export').disabled,false);
const beforeDuplicate=saves;await elements.get('artist-house-draft').onclick();
assert.equal(saves,beforeDuplicate,'A previously decided exchange never creates a fake review or extra write');
assert.match(elements.get('artist-house-status').textContent,/Talk with the artist again/);

// Downloaded briefs disclose their approved fields and exclude unrelated drafts and transcripts.
elements.get('artist-house-export').onclick();const downloaded=JSON.parse(await downloadedBlob.text());
assert.equal(downloaded.approvedEditions.length,3);assert.equal(Object.hasOwn(downloaded,'artistConversations'),false);
assert.ok(!JSON.stringify(downloaded).includes('A second private conversation.'));
assert.ok(!JSON.stringify(downloaded).includes('My Klee design draft'));
assert.match(document.body.children[0].children.at(-1).textContent,/approved titles, reasons and exercises/);
assert.equal(elements.get('artist-house-status').attributes['aria-live'],'polite');
console.log('Artist house approvals and review UI verified: preserved editions, exact owner drafts, coordinator renders, proposal/artist switches, explicit reload and private approved exports.');
