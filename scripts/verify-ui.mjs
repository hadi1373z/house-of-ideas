import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import * as model from '../web/model.js';
import worker from '../worker/index.js';
import {initLearning} from '../web/learning-ui.js';
import {initResidentUI} from '../web/resident-ui.js';
import {initHomeUI} from '../web/home-ui.js';
import {initChatGPTUI} from '../web/chatgpt-ui.js';
import * as neighborhood from '../web/neighborhood.js';
import {pragueDate,reflect as recordReflection} from '../web/socrates.js';
// DOM-action integration harness. This checks state flows; it is not a browser/GPU test.
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.hidden=false;this.checked=false;this.textContent='';this.style={};this.attributes={};const classes=new Set();this.classList={toggle:(v,on)=>{const add=on??!classes.has(v);if(add)classes.add(v);else classes.delete(v);return add;},add:(...v)=>v.forEach(x=>classes.add(x)),remove:v=>classes.delete(v),contains:v=>classes.has(v)};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}setPointerCapture(){}showModal(){this.open=true;}close(){this.open=false;}createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}};}getScreenCTM(){return {inverse(){return {};}};}
}
const elements=new Map(),html=await fs.readFile('web/index.html','utf8');for(const match of html.matchAll(/<([^\s>]+)[^>]*\bid="([^"]+)"([^>]*)>/g)){const e=new Element(match[1]);e.hidden=match[3].includes('hidden');elements.set(match[2],e);}
const radios=model.CUES.map(value=>{const r=new Element('input');r.value=value;r.checked=value==='crystal';return r;});const saveArea=new Element();
const tools=new Map();
const document={getElementById:id=>{assert.ok(elements.has(id),'Expected element '+id);return elements.get(id);},createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),body:new Element('body'),querySelectorAll:()=>[],querySelector:selector=>{if(selector==='.save-area')return saveArea;if(selector.includes(':checked'))return radios.find(r=>r.checked);const value=selector.match(/value="([^"]+)"/)?.[1];return radios.find(r=>r.value===value);}};
const sql=new DatabaseSync(':memory:');for(const file of (await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await fs.readFile('drizzle/'+file,'utf8'));
document.modelContext={registerTool(tool){tools.set(tool.name,tool);}};
const DB={prepare(query){return {bind(...p){return {async first(){return sql.prepare(query).get(...p)||null;},async all(){return {results:sql.prepare(query).all(...p)};},async run(){return sql.prepare(query).run(...p);}};}};}};let lastHouse=null,selected=null,failSave=false;
const residentTimers=new Map();let residentVisit,pick;
// These optional panels have dedicated interaction suites. Keep this revision-
// aware house/learning harness focused on its real storage and resident flows.
const optionalPanel=()=>({async onLoad(){},render(){},refreshConfig(){},show(){},close(){},onHomeChange(){}});
const context=vm.createContext({...model,...neighborhood,initHomeUI,pragueDate,recordReflection,initLearning,ARTISTS:[],initArtCityUI:optionalPanel,initChatGPTUI:optionalPanel,initDesignerUI:optionalPanel,initResidentUI:options=>initResidentUI({...options,schedule(fn,delay){residentTimers.set(delay,fn);return delay;},cancel(){}}),document,console,crypto,window:{addEventListener(){}},setInterval(){},createScene(container,onPick){pick=onPick;return {load(h){lastHouse=model.clone(h);},select(id){selected=id;},setWalk(){},setExterior(){},setSocrates(){},onResidentVisit(callback){residentVisit=callback;},reset(){}};},async fetch(path,opts={}){if(failSave&&opts.method==='PUT')return Response.json({error:'Test save unavailable'},{status:503});return worker.fetch(new Request('https://house.test'+path,{...opts,headers:{...opts.headers,'oai-authenticated-user-id':'ui-user'}}),{DB});}});
context.AbortController=AbortController;
const source=(await fs.readFile('web/app.js','utf8')).replace(/^import .*$/gm,'');vm.runInContext(source,context);const $=id=>elements.get(id);for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal($('save-state').textContent,'All changes saved');assert.equal(lastHouse.rooms.length,6);
const submit=()=>$('idea-form').onsubmit({preventDefault(){},submitter:new Element('button')});
$('add-idea').onclick();$('idea-title').value='A proof worth remembering';$('idea-text').value='The central observation goes here.';await submit();assert.equal(lastHouse.ideas.length,1);assert.equal($('idea-dialog').open,false);
// A failed save leaves both the previously saved house and the visible draft intact.
$('add-idea').onclick();$('idea-title').value='Draft survives';failSave=true;await submit();assert.equal(lastHouse.ideas.length,1);assert.equal($('idea-title').value,'Draft survives');assert.equal($('idea-dialog').open,true);assert.match($('idea-message').textContent,/unavailable/);failSave=false;await submit();assert.equal(lastHouse.ideas.length,2);
// Draw a room, connect it, switch to the house while keeping the draft, then build.
$('plan-tab').onclick();assert.equal($('plan-workspace').hidden,false);$('draw-room').onclick();$('plan-grid').onpointerdown({button:0,pointerId:1,clientX:0,clientY:10,preventDefault(){}});$('plan-grid').onpointermove({pointerId:1,clientX:5,clientY:15});$('plan-grid').onpointerup({pointerId:1,clientX:5,clientY:15});assert.equal($('plan-w').value,5);$('plan-name').value='New connections';$('room-form').onsubmit({preventDefault(){}});assert.equal($('room-list').children.length,7);
$('door-target').value='questions';$('add-door').onclick();$('house-tab').onclick();assert.equal($('plan-workspace').hidden,true);$('room-list').children[1].onclick();assert.equal(selected,'art');assert.equal($('room-name').textContent,model.starter().rooms.find(r=>r.id==='art').name);$('plan-tab').onclick();await $('apply-plan').onclick();assert.equal(lastHouse.rooms.length,7);assert.equal(lastHouse.doors.length,8);assert.equal(lastHouse.ideas.length,2);assert.equal($('plan-workspace').hidden,true);
// Editing/moving an idea uses the same real storage action after a rebuild.
$('room-list').children[0].onclick();$('idea-list').children[0].onclick();$('idea-room').value='art';$('idea-text').value='Moved with its note';await submit();assert.equal(lastHouse.ideas[0].roomId,'art');assert.equal(lastHouse.ideas[0].text,'Moved with its note');
// Do not remove a room holding ideas. A staged overlap also leaves the plan intact.
$('plan-tab').onclick();$('room-list').children[1].onclick();$('remove-room').onclick();assert.match($('plan-message').textContent,/Move this room/);$('plan-x').value=5;$('room-form').onsubmit({preventDefault(){}});assert.match($('plan-message').textContent,/overlap/);$('cancel-plan').onclick();assert.equal(lastHouse.rooms.length,7);
// New learning controls use the same real revision-aware storage.
$('learn-room').onclick();assert.equal($('socrates-panel').hidden,false);assert.equal($('room-panel').hidden,true);
$('socrates-next').onclick();assert.equal($('socrates-room').textContent,lastHouse.rooms.find(r=>r.id===selected).name);
$('reflection-answer').value='I should test the assumption with a small example.';
failSave=true;
await $('reflection-form').onsubmit({preventDefault(){}});
assert.equal($('reflection-answer').value,'I should test the assumption with a small example.');
assert.match($('learning-message').textContent,/unavailable/);
failSave=false;
await $('reflection-form').onsubmit({preventDefault(){}});
assert.equal(lastHouse.learning.enabled,true);assert.equal(lastHouse.learning.days.at(-1).reflections.at(-1).answer,'I should test the assumption with a small example.');
const ideaCount=lastHouse.ideas.length;await $('review-now').onclick();assert.equal(lastHouse.ideas.length,ideaCount);assert.equal(lastHouse.learning.days.at(-1).review.status,'pending');assert.equal($('pending-review-button').hidden,true);
$('house-tab').onclick();assert.equal($('socrates-panel').hidden,true);
// A retained architecture draft must not replace newer reflections or review decisions.
$('plan-tab').onclick();$('house-tab').onclick();$('learn-room').onclick();
$('reflection-answer').value='This discovery was saved after the layout draft was started.';
await $('reflection-form').onsubmit({preventDefault(){}});
const latestLearning=model.clone(lastHouse.learning);
$('plan-tab').onclick();await $('apply-plan').onclick();
assert.deepEqual(lastHouse.learning,latestLearning);
assert.equal(lastHouse.learning.days.at(-1).review.status,'pending');
// The embodied resident owns the Socrates tab and saves conversation through the real revision gate.
$('socrates-tab').onclick();assert.equal($('resident-conversation').hidden,false);
$('resident-input').value='What assumption should I test?';
failSave=true;await $('resident-form').onsubmit({preventDefault(){}});
assert.equal($('resident-input').value,'What assumption should I test?');
assert.match($('resident-message').textContent,/unavailable/);
failSave=false;await $('resident-form').onsubmit({preventDefault(){}});
assert.equal($('resident-input').value,'');assert.equal(lastHouse.resident.messages.at(-2).role,'user');assert.equal(lastHouse.resident.messages.at(-1).role,'resident');
await $('resident-critic').onclick();
assert.equal(lastHouse.resident.roomFeatures.length,0);assert.equal(lastHouse.resident.proposals.at(-1).status,'pending');
const actions=$('resident-proposals').children[0].children.at(-1);
await actions.children[1].onclick();assert.equal(lastHouse.resident.roomFeatures.length,1);assert.equal(lastHouse.resident.proposals.at(-1).status,'applied');
// A saved resident conversation after beginning a layout draft must survive building that draft.
$('plan-tab').onclick();$('house-tab').onclick();$('socrates-tab').onclick();
$('resident-input').value='How could I improve this room with an experiment table?';await $('resident-form').onsubmit({preventDefault(){}});
const latestResident=model.clone(lastHouse.resident);
$('plan-tab').onclick();await $('apply-plan').onclick();assert.deepEqual(lastHouse.resident,latestResident);
// Designer metadata saved through real storage after a layout draft starts
// must survive building that draft. Asset-byte validation has its own suite.
$('plan-tab').onclick();
$('room-list').children[lastHouse.rooms.findIndex(room=>room.id==='work')].onclick();
$('plan-name').value='Kitchen with an experiment corner';$('room-form').onsubmit({preventDefault(){}});
const designed=model.clone(lastHouse);
designed.designObjects=[{id:'design-draft-preservation',assetId:'a'.repeat(64),title:'A practical table',placement:'room',kind:'object',roomId:'work',action:'reflect',note:'Observe how the table helps you work.',scale:.5,rotation:0,position:[0,0,0]}];
await context.saveHouse(designed);
const revisedDesign=model.clone(lastHouse);
revisedDesign.designObjects[0].action='experiment';revisedDesign.designObjects[0].note='Predict whether a smaller work surface helps you focus, then record the result.';
await context.saveHouse(revisedDesign);
const latestDesignObjects=model.clone(lastHouse.designObjects);
assert.equal($('plan-workspace').hidden,false);
await $('apply-plan').onclick();
assert.deepEqual(lastHouse.designObjects,latestDesignObjects);
assert.equal(lastHouse.rooms.find(room=>room.id==='work').name,'Kitchen with an experiment corner');
// A room containing a designer model cannot be removed from the layout.
$('plan-tab').onclick();
$('room-list').children[lastHouse.rooms.findIndex(room=>room.id==='work')].onclick();
const roomsWithDesign=$('room-list').children.length;
$('remove-room').onclick();
assert.match($('plan-message').textContent,/designer|design objects|imported/i);
assert.equal($('room-list').children.length,roomsWithDesign);
$('cancel-plan').onclick();
assert.deepEqual(lastHouse.designObjects,latestDesignObjects);
// Real scene visit event payloads create observations and bounded autonomous critiques.
residentVisit({roomId:'connections',position:{x:5,z:0}});await residentTimers.get(15000)();
assert.ok(lastHouse.resident.observations.some(observation=>observation.roomId==='connections'));
assert.ok(lastHouse.resident.proposals.some(proposal=>proposal.roomId==='connections'&&proposal.status==='pending'));
// Physical books have distinct titles/pages and answers are real saved reflections.
pick({homeAction:'read',bookId:'definitions',roomId:'math',label:'Read What do we mean?'});
assert.equal($('home-activity').hidden,false);assert.equal($('activity-title').textContent,'What do we mean?');
const firstPage=$('activity-text').textContent;$('activity-next').onclick();assert.notEqual($('activity-text').textContent,firstPage);
$('activity-book-select').value='practice';$('activity-book-select').onchange();assert.equal($('activity-title').textContent,'Learning by trying');
$('activity-answer').value='My prediction is that a smaller test will reveal the missing assumption.';await $('activity-save').onclick();
assert.equal(lastHouse.learning.days.at(-1).reflections.at(-1).answer,'My prediction is that a smaller test will reveal the missing assumption.');
pick({ideaId:lastHouse.ideas[0].id,roomId:lastHouse.ideas[0].roomId});assert.equal($('activity-title').textContent,lastHouse.ideas[0].title);assert.ok($('activity-text').textContent.includes(lastHouse.ideas[0].text));
$('activity-edit').onclick();assert.equal($('idea-dialog').open,true);$('idea-action').value='experiment';await submit();assert.equal(lastHouse.ideas[0].action,'experiment');
// Assistant edits preserve a custom function when omitted and can explicitly choose another.
const object=model.clone(lastHouse.ideas[0]);delete object.action;object.text='Updated through the assistant tool';await tools.get('save_idea').execute(object);assert.equal(lastHouse.ideas[0].action,'experiment');assert.equal(lastHouse.ideas[0].text,object.text);
await tools.get('save_idea').execute({...object,action:'question'});assert.equal(lastHouse.ideas[0].action,'question');assert.deepEqual(tools.get('save_idea').inputSchema.properties.action.enum,model.IDEA_ACTIONS);
const journalBefore=document.body.classList.contains('journal-open');$('journal-toggle').onclick();assert.equal(document.body.classList.contains('journal-open'),!journalBefore);$('journal-toggle').onclick();assert.equal(document.body.classList.contains('journal-open'),journalBefore);
// Run the actual app startup and ChatGPT panel together in local mode. Their
// parallel requests must share one config response and its session CSRF token.
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
const localConfig={mode:'local',csrfToken:'one-startup-session',gpt:{ready:false},chatgpt:{connected:false,pending:false,ready:false,account:null,accounts:[],model:null}};
function localStartup(configResponses){
 const requests=[];let configs=0;
 document.body.dataset={mode:'local'};
 const panel=()=>({...optionalPanel(),renderNeighborhood(){},notify(){}});
 const localContext=vm.createContext({...model,...neighborhood,pragueDate,recordReflection,document,console,crypto,AbortController,window:{document,addEventListener(){},setInterval(){},clearInterval(){}},setInterval(){},initLearning:panel,initResidentUI:panel,initHomeUI:panel,ARTISTS:[],initArtCityUI:panel,initDesignerUI:panel,initChatGPTUI,createScene(){return {load(){},setAssetResolver(){}};},async fetch(path,options={}){
  requests.push({path,options});
  if(path==='/api/config'){const response=configResponses[configs++];assert.ok(response,'Unexpected duplicate startup config request');return await response;}
  assert.equal(options.headers['X-Local-CSRF'],localConfig.csrfToken);
  if(path==='/api/chatgpt/status')return Response.json(localConfig.chatgpt);
  if(path==='/api/house')return Response.json({house:model.starter(),revision:1});
  throw Error('Unexpected startup request '+path);
 }});
 vm.runInContext(source,localContext);
 return {context:localContext,requests,configCount:()=>configs};
}
const firstConfig=deferred(),startup=localStartup([firstConfig.promise]);
assert.equal(startup.configCount(),1);
const parallelConfigA=startup.context.getLocalConfig(),parallelConfigB=startup.context.getLocalConfig();
assert.equal(startup.configCount(),1);
firstConfig.resolve(Response.json(localConfig));
assert.deepEqual(await parallelConfigA,await parallelConfigB);
for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(startup.configCount(),1);
assert.equal(startup.requests.filter(request=>request.path==='/api/house').length,1);
assert.equal(startup.requests.filter(request=>request.path==='/api/chatgpt/status').length,1);
await startup.context.getLocalConfig();assert.equal(startup.configCount(),1);
const failedConfig=deferred(),recovering=localStartup([failedConfig.promise,Response.json(localConfig)]);
const failedRead=assert.rejects(recovering.context.getLocalConfig(),/Test config unavailable/);
assert.equal(recovering.configCount(),1);
failedConfig.resolve(Response.json({error:'Test config unavailable'},{status:503}));
await failedRead;
for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));
assert.equal($('retry').hidden,false);
assert.equal(recovering.requests.filter(request=>request.path!=='/api/config').length,0);
await Promise.all([$('retry').onclick(),vm.runInContext('chatgptUI.onLoad()',recovering.context)]);
assert.equal(recovering.configCount(),2,'A failed config promise permits a fresh shared retry.');
assert.equal(recovering.requests.filter(request=>request.path==='/api/house').length,1);
assert.equal(recovering.requests.filter(request=>request.path==='/api/chatgpt/status').length,1);
assert.equal($('retry').hidden,true);
console.log('Verified real revision-aware UI actions: edits, failed-save drafts, staged layouts preserving journals, conversations and latest designer functions/notes, guarded designer-room removal, daily approval, and single-session local startup/config retry. Browser/GPU checks are separate.');
