import assert from 'node:assert/strict';
import {initChatGPTUI} from '../web/chatgpt-ui.js';
import {initResidentUI} from '../web/resident-ui.js';
import {starter} from '../web/model.js';

class Element {
 constructor(tag='div'){this.tagName=tag;this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.children=[];this.attributes={};this.href='';}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 removeAttribute(key){delete this.attributes[key];if(key==='href')this.href='';}
 showModal(){this.open=true;}close(){this.open=false;}
}
const elements=new Map();
const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const document={createElement:tag=>new Element(tag)};
const timers=new Map(),events=new Map();let serial=0,opened=0;
const window={document,addEventListener(name,fn){events.set(name,fn);},setInterval(fn){const id=++serial;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);},open(){++opened;}};
let config={connected:false,pending:false,ready:false,account:null,accounts:[{id:'oaiapp_one',label:'Test account'}],sessionOnly:true,model:null};
const requests=[],changes=[];let statusWait=null,badLink=false;
async function request(path,options={}){
 requests.push({path,options});
 if(path==='/api/chatgpt/status')return statusWait?statusWait.promise:structuredClone(config);
 const input=options.body?JSON.parse(options.body):null;
 if(path==='/api/chatgpt/start'){
  assert.equal(options.method,'POST');assert.equal(options.headers['Content-Type'],'application/json');
  config={...config,pending:true,model:null};
  return {authorizationUrl:badLink?'https://example.com/steal':'https://auth.openai.com/api/accounts/authorize?state=opaque',expiresAt:Date.now()+600000,chatgpt:structuredClone(config)};
 }
 if(path==='/api/chatgpt/cancel'){config={...config,pending:false};return structuredClone(config);}
 if(path==='/api/chatgpt/disconnect'){config={...config,connected:false,pending:false,ready:false,account:null,model:null};return {...config,revocationWarning:'Signed out locally. Remote revocation was not confirmed.'};}
 if(path==='/api/chatgpt/models'){
  assert.equal(config.connected,true);
  config={...config,model:'account-model-b'};
  return {models:[{slug:'account-model-b',displayName:'Model B'},{slug:'account-model-a',displayName:'Model A'}],chatgpt:structuredClone(config)};
 }
 if(path==='/api/chatgpt/model'){config={...config,model:input.model};return structuredClone(config);}
 throw Error('Unexpected local request.');
}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
const ui=initChatGPTUI({$,window,local:true,request,onConfig:value=>changes.push(value)});
await ui.onLoad();
assert.deepEqual(requests.map(value=>value.path),['/api/chatgpt/status']);
assert.equal($('chatgpt-settings').hidden,false);
assert.equal($('chatgpt-model').disabled,true);
assert.equal(timers.size,0);
assert.equal(opened,0);
await $('chatgpt-connect').onclick();
assert.equal(JSON.parse(requests.find(value=>value.path==='/api/chatgpt/start').options.body).accountId,undefined);
assert.equal($('chatgpt-authorize').hidden,false);
assert.equal(new URL($('chatgpt-authorize').href).hostname,'auth.openai.com');
assert.equal(opened,0,'Authorization is never opened automatically.');
assert.equal(timers.size,1);
assert.equal(requests.some(value=>value.path==='/api/chatgpt/models'),false);
config={...config,connected:true,pending:false,ready:true,account:{id:'oaiapp_one',label:'Test account'}};
await [...timers.values()][0]();
assert.equal(timers.size,0);
assert.equal($('chatgpt-authorize').hidden,true);
assert.equal($('chatgpt-authorize').href,'');
assert.equal($('chatgpt-model').children[0].textContent,'Model B');
assert.equal($('chatgpt-model').disabled,false);
assert.equal(changes.at(-1).model,'account-model-b');
$('chatgpt-model').value='account-model-a';await $('chatgpt-model').onchange();
assert.equal(changes.at(-1).model,'account-model-a');
assert.match($('chatgpt-status').textContent,/selected/);

// A reload checks only local status; it does not fetch account models externally.
const modelRequestsBefore=requests.filter(value=>value.path==='/api/chatgpt/models').length;
const reloaded=initChatGPTUI({$,window,local:true,request,onConfig:value=>changes.push(value)});
await reloaded.onLoad();
assert.equal(requests.filter(value=>value.path==='/api/chatgpt/models').length,modelRequestsBefore);
await $('chatgpt-model').onfocus();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(requests.filter(value=>value.path==='/api/chatgpt/models').length,modelRequestsBefore+1);

// Choosing "add another" remains distinct from reauthorizing the active account.
$('chatgpt-account').value='';$('chatgpt-account').onchange();
await $('chatgpt-connect').onclick();
assert.deepEqual(JSON.parse(requests.filter(value=>value.path==='/api/chatgpt/start').at(-1).options.body),{});
await $('chatgpt-cancel').onclick();
assert.equal(timers.size,0);
assert.equal($('chatgpt-authorize').hidden,true);
$('chatgpt-account').value='oaiapp_one';$('chatgpt-account').onchange();
await $('chatgpt-connect').onclick();
assert.deepEqual(JSON.parse(requests.filter(value=>value.path==='/api/chatgpt/start').at(-1).options.body),{accountId:'oaiapp_one'});

// A late status response from an abandoned attempt cannot reconnect the UI.
statusWait=deferred();const pendingStatus=[...timers.values()][0]();
await $('chatgpt-cancel').onclick();
const latest=changes.at(-1);
statusWait.resolve({...config,pending:false,connected:true,ready:true});await pendingStatus;
assert.equal(changes.at(-1),latest);
assert.equal(timers.size,0);statusWait=null;
await $('chatgpt-disconnect').onclick();
assert.equal(changes.at(-1).connected,false);
assert.match($('chatgpt-status').textContent,/revocation was not confirmed/);
assert.equal($('chatgpt-model').disabled,true);
assert.equal($('chatgpt-authorize').href,'');
badLink=true;await $('chatgpt-connect').onclick();
assert.match($('chatgpt-status').textContent,/invalid ChatGPT sign-in link/);
assert.equal($('chatgpt-authorize').hidden,true);
assert.equal(timers.size,0);badLink=false;
await $('chatgpt-connect').onclick();
assert.equal(timers.size,1);
const normalNow=Date.now;
try{Date.now=()=>normalNow()+700000;await [...timers.values()][0]();}
finally{Date.now=normalNow;}
assert.equal(timers.size,0);
assert.match($('chatgpt-status').textContent,/expired/);
events.get('pagehide')();
const count=requests.length;await reloaded.onLoad();assert.equal(requests.length,count);
const previewUI=initChatGPTUI({$,window,local:false,request(){throw Error('Preview must not start OAuth.');}});
await previewUI.onLoad();assert.equal($('chatgpt-settings').hidden,true);
config={...config,connected:false,pending:false,ready:false,error:'ChatGPT registration could not be read. Your existing registration file is preserved; the offline house remains available.'};
const unavailable=initChatGPTUI({$,window,local:true,request});
await unavailable.onLoad();
assert.equal($('chatgpt-connect').disabled,true);
assert.equal($('chatgpt-status').textContent,config.error);
const unavailableCount=requests.length;await $('chatgpt-connect').onclick();assert.equal(requests.length,unavailableCount);

// Resident dialogue routes online modes explicitly and preserves unsent drafts.
let house=starter(),sent=[],fail=false,selectedRoom='math',residentState={roomId:'math',near:true};
const resident=initResidentUI({$,document,window,scene:{residentState:()=>residentState,setResidentTalking(){}},getHouse:()=>house,getSelected:()=>selectedRoom,isLoaded:()=>true,isSaving:()=>false,async saveHouse(value){house=value;return house;},local:true,gptConfig:async()=>({gpt:{ready:true},chatgpt:{ready:false}}),gptConnect:async()=>({gpt:{ready:true}}),gptDisconnect:async()=>({gpt:{ready:false}}),async gptChat(message,roomId,mode){if(fail)throw Error('Test online connection unavailable');sent.push({message,roomId,mode});},schedule(){return 1;},cancel(){}});
await resident.onLoad();
$('conversation-mode').value='chatgpt';$('conversation-mode').onchange();
assert.equal($('gpt-dialog').open,true);
assert.equal($('conversation-mode').value,'offline');
resident.refreshConfig({chatgpt:{ready:true,account:{label:'My ChatGPT account'}}});
$('conversation-mode').value='chatgpt';$('conversation-mode').onchange();
assert.match($('conversation-privacy').textContent,/saved memories, reflections and decisions/);
$('resident-input').value='Could this room help me listen better?';
fail=true;await $('resident-form').onsubmit({preventDefault(){}});
assert.equal($('resident-input').value,'Could this room help me listen better?');
assert.match($('resident-message').textContent,/unavailable/);
fail=false;await $('resident-form').onsubmit({preventDefault(){}});
assert.deepEqual(sent.at(-1),{message:'Could this room help me listen better?',roomId:'math',mode:'chatgpt'});
assert.equal($('resident-input').value,'');
$('conversation-mode').value='gpt';$('conversation-mode').onchange();
$('resident-input').value='What assumption should I examine?';await $('resident-form').onsubmit({preventDefault(){}});
assert.equal(sent.at(-1).mode,'gpt');
resident.refreshConfig({chatgpt:{ready:false}});
assert.equal($('conversation-mode').value,'gpt','Disconnecting a ChatGPT plan preserves the separately configured API-key mode.');
resident.refreshConfig({gpt:{ready:false}});assert.equal($('conversation-mode').value,'offline');
await $('resident-critic').onclick();
const card=$('resident-proposals').children[0];
assert.ok(card.children.some(node=>node.textContent.startsWith('Try it: ')));
assert.ok(card.children.some(node=>node.textContent.startsWith('Next visit: ')));
selectedRoom='work';residentState={roomId:'math',near:false};resident.render();
assert.equal($('conversation-location').textContent,'Socrates is in '+house.rooms.find(room=>room.id==='math').name);
await $('resident-critic').onclick();
assert.equal(house.resident.proposals.at(-1).roomId,'work','A distant resident critiques the user-selected room.');
selectedRoom='art';residentState={roomId:'math',near:true,summoning:true};resident.render();
assert.equal($('conversation-location').textContent,'Socrates is coming to meet you');
assert.equal($('resident-send').disabled,true);
await $('resident-critic').onclick();
assert.equal(house.resident.proposals.at(-1).roomId,'art','A resident still travelling does not substitute the room he is crossing.');
console.log('Verified explicit ChatGPT sign-in UI, local-only startup, pending-only bounded polling, model/account choices, cancellation, online dialogue routing, privacy and philosophical proposal practices.');
