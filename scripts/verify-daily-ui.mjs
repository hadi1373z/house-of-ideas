import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initLearning} from '../web/learning-ui.js';
import {starter,validateHouse,clone} from '../web/model.js';
import {pragueDate,visitRoom,reviewDay} from '../web/socrates.js';
import {initialNeighborhood,saveEdition} from '../web/neighborhood.js';

// Actual daily UI callbacks, with a fixed next-day clock and no real timers.
// The 22:05 Prague clock also proves server mode only polls, without preparing
// a second browser-driven review after 21:00.
const RealDate=Date,realInterval=setInterval,realClearInterval=clearInterval;
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-08T20:05:00.000Z']));}static now(){return new RealDate('2026-10-08T20:05:00.000Z').valueOf();}};
const intervals=new Set();
globalThis.setInterval=fn=>{intervals.add(fn);return fn;};
globalThis.clearInterval=fn=>intervals.delete(fn);
const html=await fs.readFile('web/index.html','utf8');
// The decision footer is outside the scrolling evidence body, so neither
// approve/decline nor a failed-save message can disappear below that evidence.
const dailyMarkup=html.slice(html.indexOf('<dialog id="daily-dialog">'),html.indexOf('<dialog id="gpt-dialog">'));
assert.ok(dailyMarkup.indexOf('id="review-summary"')<dailyMarkup.indexOf('id="review-reason"'));
assert.match(dailyMarkup,/<\/div><div class="daily-review-footer"><p id="review-message"/);
class Element{
 constructor(){this.value='';this.hidden=false;this.textContent='';this.disabled=false;this.open=false;this.classList={add(){},remove(){}};}
 showModal(){this.open=true;}close(){this.open=false;}
}
function harness({kind='new',server=true,readOnly=false}={}){
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element()]));
 const $=id=>{assert.ok(elements.has(id),'Missing daily element '+id);return elements.get(id);};
 let house=starter(),selected='work',revision=8,statusCalls=0,reloads=0,saves=0,failSave=false,failReload=false;
 house=visitRoom(house,'2026-10-07',selected);
 house=reviewDay(house,'2026-10-07');
 if(kind==='legacy')delete house.learning.days[0].review.furnishing;
 house=validateHouse(house);
 let neighborhood=initialNeighborhood(house);
 house=clone(neighborhood.homes.at(-1).house);
 let saved=clone(house),savedNeighborhood=clone(neighborhood),serverState={running:true,timezone:'Europe/Prague',hour:21,mode:'local',revision,latestHomeId:neighborhood.activeId,pendingCount:1,lastCheckedAt:null};
 const events=new Map(),document={activeElement:null};
 let ui;
 const options={$,document,window:{addEventListener(name,fn){events.set(name,fn);}},getHouse:()=>house,getSelected:()=>selected,isLoaded:()=>!readOnly,isOpen:()=>true,isSaving:()=>false,async saveHouse(next){saves++;if(failSave)throw Error('Daily save unavailable');const before=neighborhood.activeId;neighborhood=saveEdition(neighborhood,validateHouse(next));house=clone(neighborhood.homes.find(home=>home.id===neighborhood.activeId).house);saved=clone(house);savedNeighborhood=clone(neighborhood);revision++;if(neighborhood.activeId!==before)ui.onEditionCreated(neighborhood.activeId);ui.render();return house;},selectRoom(id){selected=id;ui.render();},openHouse(){},scene:{setSocrates(){}},...(server?{getRevision:()=>revision,async reviewStatus(){statusCalls++;return clone(serverState);},async reloadHouse(){reloads++;if(failReload)throw Error('Daily reload unavailable');house=clone(saved);neighborhood=clone(savedNeighborhood);revision=serverState.revision;ui.onHomeChange(neighborhood.activeId);if(!readOnly)await ui.onLoad();else ui.render();return true;}}:{})};
 ui=initLearning(options);ui.onHomeChange(neighborhood.activeId);
 return {$,ui,events,get house(){return house;},get neighborhood(){return neighborhood;},get revision(){return revision;},get reloads(){return reloads;},get saves(){return saves;},get statusCalls(){return statusCalls;},get serverState(){return serverState;},set serverState(value){serverState=value;},set saved(value){saved=clone(value);savedNeighborhood.homes.find(home=>home.id===savedNeighborhood.activeId).house=clone(value);},set failSave(value){failSave=value;},set failReload(value){failReload=value;}};
}
try{
 assert.equal(pragueDate(),'2026-10-08');
 const current=harness();await current.ui.onLoad();
 const sourceHome=clone(current.neighborhood.homes.at(-1));
 const review=current.house.learning.days[0].review;
 assert.ok(review.furnishing,'New recorded activity receives a physical critique.');
 assert.equal(current.$('daily-dialog').open,true);
 assert.equal(current.$('review-furnishing').hidden,false);
 assert.equal(current.$('review-summary').hidden,false);
 assert.equal(current.$('review-exercise').hidden,true,'Practice and success test have one visible copy.');
 assert.equal(current.$('review-approve').textContent,'Build next edition');
 assert.equal(current.$('review-practice').textContent,review.furnishing.practice);
 assert.equal(current.$('review-success-test').textContent,review.furnishing.successTest);
 assert.ok(current.$('review-concept-description').textContent.length>10);
 assert.match(current.$('review-promise').textContent,/earlier houses stay available/);
 assert.match(current.$('daily-review-state').textContent,/even with this tab closed/);
 assert.equal(current.house.ideas.length,0,'Showing a critique cannot apply it.');
 // Failed approval retains the pending decision and the visible reflection.
 current.$('reflection-answer').value='A draft to test tomorrow.';current.$('reflection-answer').oninput();
 current.failSave=true;
 await current.$('review-approve').onclick();
 assert.equal(current.$('daily-dialog').open,true);
 assert.match(current.$('review-message').textContent,/unavailable/);
 assert.equal(current.$('review-approve').disabled,false);
 assert.equal(current.house.learning.days[0].review.status,'pending');
 assert.equal(current.house.ideas.length,0);
 assert.equal(current.$('reflection-answer').value,'A draft to test tomorrow.');
 assert.equal(current.neighborhood.activeId,'home-2');
 current.failSave=false;
 await current.$('review-approve').onclick();
 assert.equal(current.$('daily-dialog').open,false);
 assert.equal(current.house.learning.days[0].review.status,'applied');
 assert.equal(current.house.ideas.length,1);
 assert.equal(current.house.resident.roomFeatures.length,1);
 assert.equal(current.neighborhood.activeId,'home-3','Real daily approval creates a separate edition.');
 assert.deepEqual(current.neighborhood.homes.find(home=>home.id===sourceHome.id),sourceHome);
 assert.match(current.$('learning-message').textContent,/previous house is preserved/);
 assert.equal(current.$('reflection-answer').value,'A draft to test tomorrow.');
 // A scheduled review saved after approval changes the whole-store revision.
 // Reloading that new home must keep the unsaved reflection inherited from its
 // source home, without moving later edits back into the preserved source.
 const nextCritique=reviewDay(visitRoom(current.house,'2026-10-08','questions'),'2026-10-08');
 current.saved=nextCritique;
 current.serverState={...current.serverState,revision:current.revision+1,latestHomeId:'home-3',pendingCount:1};
 await current.ui.pollReviewStatus();
 await current.$('daily-reload').onclick();
 assert.equal(current.neighborhood.activeId,'home-3');
 assert.equal(current.$('reflection-answer').value,'A draft to test tomorrow.','An actual edition-ID change followed by reload retains the draft.');
 current.$('reflection-answer').value='A new thought in the derived house.';current.$('reflection-answer').oninput();
 current.ui.onHomeChange('home-2');current.ui.render();
 assert.equal(current.$('reflection-answer').value,'A draft to test tomorrow.','The preserved source retains its independent original draft.');
 current.ui.onHomeChange('unrelated-home');current.ui.render();
 assert.equal(current.$('reflection-answer').value,'','An unrelated visit cannot inherit another home’s draft.');
 current.ui.onHomeChange('home-3');current.ui.render();
 assert.equal(current.$('reflection-answer').value,'A new thought in the derived house.');
 current.$('socrates-panel').hidden=false;
 current.ui.onHomeChange('home-3');
 assert.equal(current.$('socrates-panel').hidden,false,'Reloading the same home does not reset the open panel.');

 const legacy=harness({kind:'legacy'});await legacy.ui.onLoad();
 assert.equal(legacy.$('review-furnishing').hidden,true);
 assert.equal(legacy.$('review-summary').hidden,true);
 assert.equal(legacy.$('review-exercise').hidden,false,'A legacy book keeps its original exercise visible.');
 assert.equal(legacy.$('review-approve').textContent,'Confirm this learning book');
 await legacy.$('review-approve').onclick();
 assert.equal(legacy.house.ideas.length,1);
 assert.equal(legacy.house.resident?.roomFeatures.length||0,0,'A saved old review remains book-only.');

 // A same-revision status has no reload notice; later activity is observed
 // without overwriting a house or reflection. Existing pending critiques alone
 // must not be mislabeled as newly generated.
 const notice=harness();await notice.ui.onLoad();
 const unchanged=clone(notice.house),saveCount=notice.saves;
 notice.$('reflection-answer').value='Keep this unfinished thought.';notice.$('reflection-answer').oninput();
 assert.equal(notice.$('daily-reload').hidden,true);
 notice.serverState={...notice.serverState,revision:notice.revision+1};
 await notice.ui.pollReviewStatus();
 assert.equal(notice.$('daily-reload').hidden,false);
 assert.match(notice.$('daily-update-notice').textContent,/Saved house activity/);
 assert.deepEqual(notice.house,unchanged);
 assert.equal(notice.saves,saveCount);
 notice.serverState={...notice.serverState,pendingCount:2};
 await notice.ui.pollReviewStatus();
 assert.equal(notice.$('daily-update-notice').textContent,'A new critique is saved. Reload to review.');
 assert.equal(notice.$('reflection-answer').value,'Keep this unfinished thought.');
 notice.failReload=true;
 await notice.$('daily-reload').onclick();
 assert.match(notice.$('learning-message').textContent,/reload unavailable/);
 assert.equal(notice.$('daily-reload').disabled,false);
 assert.equal(notice.$('reflection-answer').value,'Keep this unfinished thought.');
 notice.failReload=false;
 await notice.$('daily-reload').onclick();
 assert.equal(notice.reloads,2);
 assert.equal(notice.$('daily-reload').hidden,true);
 assert.equal(notice.$('reflection-answer').value,'Keep this unfinished thought.');
 const beforeTimerSaves=notice.saves,beforeTimerCalls=notice.statusCalls;
 await Promise.all([...intervals].map(fn=>fn()));
 // Poll callbacks resolve on the next microtask. The local browser itself must
 // never run reviewDay/saveHouse merely because its clock is after 21:00.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(notice.saves,beforeTimerSaves);
 assert.ok(notice.statusCalls>beforeTimerCalls);
 notice.serverState={...notice.serverState,lastError:'The review could not be saved.'};
 await notice.ui.pollReviewStatus();
 assert.match(notice.$('daily-review-state').textContent,/could not be checked/);
 const preserved=harness({readOnly:true});preserved.ui.render();
 preserved.serverState={...preserved.serverState,revision:preserved.revision+1};
 await preserved.ui.pollReviewStatus();
 assert.equal(preserved.statusCalls,1,'An open older house still checks the global saved revision.');
 assert.equal(preserved.$('daily-reload').hidden,false,'The saved-house reload remains available from a preserved home.');
 assert.equal(preserved.saves,0,'Checking an older home cannot write to its journal.');
 const activeTimers=intervals.size;notice.events.get('pagehide')();assert.equal(intervals.size,activeTimers-1);
 notice.events.get('pageshow')();assert.equal(intervals.size,activeTimers);
 for(const item of [current,legacy,notice,preserved])item.events.get('pagehide')();
 console.log('Verified daily critique UI: concrete furnishings and philosophy, old review compatibility, failed approval/reload drafts, real home-edition draft lineage, preserved-home status checks, explicit saved-review notices, and server-only scheduled review ownership.');
}finally{globalThis.Date=RealDate;globalThis.setInterval=realInterval;globalThis.clearInterval=realClearInterval;}
