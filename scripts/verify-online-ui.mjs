import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as model from '../web/model.js';
import * as homes from '../web/neighborhood.js';
import * as residence from '../web/residence-data.js';
import {initialCityNetwork,validateCityNetwork,CITIES,saveCityNote} from '../web/city-network.js';
import {initResidentUI} from '../web/resident-ui.js';
import {initConversationUI} from '../web/conversation-ui.js';
import {initMathCityUI} from '../web/math-city-ui.js';
import {initCityTravelUI} from '../web/city-travel-ui.js';
import {initChatGPTUI} from '../web/chatgpt-ui.js';
import {validateResident,formatCityDiscussion} from '../web/resident.js';
import {pragueDate,reflect as recordReflection} from '../web/socrates.js';
import {ARTISTS} from '../web/art-city-data.js';
import {initArtistResidentUI} from '../web/artist-resident-ui.js';
import {proposeArtistHome} from '../web/artist-homes.js';

// Exercise the actual coordinator, resident, city, mathematics and private
// archive panels with a mock authenticated cloud. No provider/key is used.
const elements=new Map(),requests=[],timers=[],downloadLinks=[];
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this._children=[];this.value='';this.hidden=false;this.disabled=false;this.open=false;this.checked=false;this.attributes={};this.dataset={};this.listeners=new Map();this.style={setProperty(){}};const classes=new Set();this.classList={add(...values){values.forEach(value=>classes.add(value));},remove(...values){values.forEach(value=>classes.delete(value));},contains:value=>classes.has(value),toggle(value,on){const active=on??!classes.has(value);if(active)classes.add(value);else classes.delete(value);return active;}};}
 get children(){return Object.assign({length:this._children.length,[Symbol.iterator]:()=>this._children[Symbol.iterator]()},Object.fromEntries(this._children.map((item,index)=>[index,item])));}
 set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
 set textContent(value){this._text=String(value);}get textContent(){return this._text||'';}
 set innerHTML(value){throw Error('Private text must never become HTML: '+value);}
 append(...children){this._children.push(...children);}replaceChildren(...children){this._children=children;}
 setAttribute(name,value){this.attributes[name]=String(value);}removeAttribute(name){delete this.attributes[name];}
 addEventListener(name,fn){this.listeners.set(name,fn);}showModal(){this.open=true;}close(){if(this.open){this.open=false;this.listeners.get('close')?.();}}focus(){this.focused=true;}
 click(){if(this.tagName==='A'&&this.download)downloadLinks.push(this);return this.onclick?.({preventDefault(){},submitter:this});}createSVGPoint(){return{x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}};}getScreenCTM(){return{inverse(){return{};}};}setPointerCapture(){}
}
const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
for(const match of html.matchAll(/<([^\s>]+)[^>]*\bid="([^"]+)"([^>]*)>/g)){const item=new Element(match[1]);item.id=match[2];item.hidden=match[3].includes('hidden');}
const $=id=>{assert.ok(elements.has(id),'Actual hosted element exists: '+id);return elements.get(id);};
const body=new Element('body'),saveArea=new Element();body.dataset.mode='hosted';
const radios=model.CUES.map(value=>{const item=new Element('input');item.value=value;item.checked=value==='crystal';return item;});
const document={body,getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),querySelectorAll:()=>[],querySelector(selector){if(selector==='.save-area')return saveArea;if(selector==='#scene canvas')return $('scene');if(selector==='dialog[open]')return [...elements.values()].find(item=>item.open);if(selector.includes(':checked'))return radios.find(item=>item.checked);return radios.find(item=>item.value===selector.match(/value="([^"]+)"/)?.[1])||null;}};
const window={document,addEventListener(){},setInterval(fn,delay){timers.push({fn,delay});return timers.length;},clearInterval(){},setTimeout(){},URL};
const panel=()=>({render(){},close(){},show(){},onHomeChange(){},onEditionCreated(){},async onLoad(){},includeVisits:house=>house,hideCritic(){},noteVisit(){},journal(){},notify(){},renderNeighborhood(){},closeAction(){}});
let network=homes.initialNeighborhood(model.starter(),{now:'2026-10-10T08:00:00Z'}),revision=4,ready=false,failHouse=false,houseGate=null,city='home',mathLevel=0,pick,context;
for(const home of network.homes)home.house.resident=validateResident(home.house.resident,home.house);
network=homes.createEdition(network,residence.createResidence(network.homes.at(-1).house),{edition:'residence',title:'Private cloud residence',now:'2026-10-10T09:00:00Z'});
network.cityNetwork=saveCityNote(initialCityNetwork(),'artists','Keep the original art-city observation.');
const originalHomes=JSON.stringify(network.homes.slice(0,2)),archive=[];
const snapshot=()=>({house:model.clone(network.homes.find(home=>home.id===network.activeId).house),neighborhood:model.clone(network),revision});
function archiveMessages(){const current=network.homes.find(home=>home.id===network.activeId);for(const message of current.house.resident.messages){const id=current.id+':'+message.id;if(archive.some(item=>item.id===id))continue;archive.push({id,homeId:current.id,roomId:message.roomId,at:message.at,role:message.role,text:message.text,mode:message.source,actor:'socrates'});}for(const [artist,messages]of Object.entries(network.cityNetwork.artistConversations||{}))for(const message of messages){const id=artist+':'+message.id;if(!archive.some(item=>item.id===id))archive.push({...message,id,at:message.date,actor:artist,mode:'artist'});}}
async function mockFetch(route,options={}){
 assert.ok(route.startsWith('/api/'),'Only the same-origin mock house is contacted');assert.equal(options.credentials,'same-origin');
 const method=options.method||'GET',headers=options.headers||{};assert.equal(headers['X-Local-CSRF'],undefined);if(!['GET','HEAD'].includes(method))assert.equal(headers['X-House-Request'],'1');
 requests.push({route,method,headers,body:options.body?JSON.parse(options.body):null});
 if(route==='/api/config')return Response.json({storage:'private-cloud',gpt:{ready,model:'mock-structured-model'},chatgpt:{ready:false},capabilities:{artistGpt:false}});
 if(route==='/api/house'&&method==='GET')return Response.json(snapshot());
 if(route==='/api/conversations')return Response.json({messages:archive,briefs:[],promptVersion:'socrates-test'});
 const input=JSON.parse(options.body||'{}');if(input.revision!==revision)return Response.json({error:'This house changed in another tab. Your draft is kept.'},{status:409});
 if(route==='/api/house'&&method==='PUT'){if(failHouse)return Response.json({error:'Mock private save unavailable. Your house is unchanged.'},{status:503});if(houseGate)await houseGate.promise;network=homes.saveEdition(network,input.house);revision++;archiveMessages();return Response.json(snapshot());}
 if(route==='/api/cities'){network=homes.validateNeighborhood({...network,cityNetwork:validateCityNetwork(input.cityNetwork)});revision++;archiveMessages();return Response.json(snapshot());}
 if(route==='/api/neighborhood/select'){network=homes.selectEdition(network,input.homeId);revision++;return Response.json(snapshot());}
 if(route==='/api/neighborhood/create'){network=homes.createEdition(network);revision++;return Response.json(snapshot());}
 if(route==='/api/neighborhood/import'){network=homes.createEdition(network,input.house,{edition:input.house.residence?'residence':'atelier'});revision++;return Response.json(snapshot());}
 throw Error('Unexpected hosted route '+route);
}
const scene={load(){},setEdition(){},setNeighborhood(){},setCityNetwork(){},setArtCityCatalog(){},setAssetResolver(){},select(){},setWalk(){},setExterior(){},startOutside(){},arriveAtDoor(){},setResidentTalking(){},summonResident(){return true;},onResidentVisit(){},onResidentInteract(){},focusedTarget:()=>null,returnDesign(){},stand(){},
 cityState:()=>CITIES.find(item=>item.id===city),prepareCity(){},travelToCity(id){city=id;pick({artAction:'city-state'});},leaveArtCity(){city='home';},mathState:()=>city==='mathematics'?{floor:mathLevel}:null,enterMathCity(){city='mathematics';mathLevel=0;},visitMathFloor(level){mathLevel=level;},
 playerState:()=>({cityId:city,floor:mathLevel,roomId:'math',outside:false,...(city==='artists'?{artistId:'monet'}:{})}),artistResidentState:()=>({available:city==='artists',near:true,cityId:city}),setArtistTalking(){},residentState:()=>({available:city!=='artists',near:true,roomId:'math',cityId:city,locationLabel:CITIES.find(item=>item.id===city).name,activity:'Considering your ideas'})};
context=vm.createContext({...model,...homes,...residence,initialCityNetwork,validateCityNetwork,CITIES,saveCityNote,ARTISTS,formatCityDiscussion,pragueDate,recordReflection,initMathCityUI,initCityTravelUI,initConversationUI,initChatGPTUI,
 initResidentUI:options=>initResidentUI({...options,schedule(fn,delay){timers.push({fn,delay});return timers.length;},cancel(){}}),initArtistResidentUI:options=>initArtistResidentUI({...options,schedule(){return 0;},cancel(){}}),proposeArtistHome,initLearning:panel,initHomeUI:panel,initDesignerUI:panel,initArtCityUI:panel,initArtistHomesUI:panel,initResidenceUI:panel,
 document,window,console,crypto,AbortController,Blob,URL,setInterval(){},setTimeout(){},fetch:mockFetch,createScene(_,callback){pick=callback;return scene;}});
const source=(await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8')).replace(/^import .*$/gm,'');vm.runInContext(source,context);
const read=expression=>vm.runInContext(expression,context),submit=id=>$(id).onsubmit({preventDefault(){},submitter:new Element('button')});
async function until(predicate,label){for(let count=0;count<200;count++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('Timed out: '+label);}
await until(()=>read('loaded&&!saving')&&requests.some(item=>item.route==='/api/conversations'),'hosted house startup');
assert.match($('save-state').textContent,/private online/);assert.equal(read('persistent'),true);assert.equal(requests.filter(item=>item.route==='/api/config').length,1);assert.equal(requests.filter(item=>item.route==='/api/gpt/chat').length,0);
assert.equal($('gpt-form').hidden,true);assert.equal($('chatgpt-settings').hidden,true);assert.equal($('gpt-key').disabled,true);assert.deepEqual(Array.from($('conversation-mode').children).map(item=>item.value),['offline']);assert.match($('gpt-status').textContent,/ChatGPT-plan conversations run in the local house/);
await $('gpt-settings').click();assert.equal($('gpt-dialog').open,true);assert.match($('hosted-gpt-status').textContent,/No paid API connection/);assert.equal($('hosted-chatgpt-local').href,'http://127.0.0.1:4317/#chatgpt');assert.equal($('hosted-chatgpt-local').target,'_blank');assert.match($('hosted-chatgpt-local').rel,/noopener/);assert.equal(requests.filter(item=>item.route==='/api/gpt/chat').length,0);
await submit('gpt-form');assert.match($('gpt-settings-message').textContent,/no browser key/);assert.ok(!requests.some(item=>item.route.includes('/connect')||item.route.includes('/chatgpt/')));
ready=true;read('residentUI.refreshConfig({gpt:{ready:true},chatgpt:{ready:true}})');await $('gpt-settings').click();assert.match($('gpt-status').textContent,/rule|rules/);$('gpt-dialog').close();$('resident-talk').click();$('conversation-mode').value='gpt';$('conversation-mode').onchange();assert.equal($('conversation-mode').value,'offline','A stale ready API config cannot enable hosted inference');$('gpt-dialog').close();
assert.match($('conversation-privacy').textContent,/private online house/);await assert.rejects(context.gptChat('Blocked hosted paid send','math','gpt'),/local house/);await assert.rejects(context.gptChat('Blocked hosted ChatGPT send','math','chatgpt'),/local house/);
const privateQuestion='Which assumption is behind this room’s arrangement?';$('resident-input').value=privateQuestion;failHouse=true;await submit('resident-form');failHouse=false;assert.equal($('resident-input').value,privateQuestion);assert.equal(archive.length,0);assert.match($('resident-message').textContent,/Mock private save unavailable/);
let release;houseGate={promise:new Promise(resolve=>{release=resolve;})};const send=submit('resident-form');await until(()=>read('saving'),'explicit private guide save');$('resident-input').value='A newer unsent question.';release();await send;houseGate=null;
assert.equal($('resident-input').value,'A newer unsent question.');assert.equal(snapshot().house.resident.messages.at(-2).text,privateQuestion);assert.notEqual(snapshot().house.resident.messages.at(-1).source,'gpt');await until(()=>$('conversations-count').textContent.includes('2 private messages'),'archive refreshed after successful save');assert.equal(JSON.stringify(network.homes.slice(0,2)),originalHomes);
scene.travelToCity('artists');$('socrates-tab').click();assert.equal($('artist-resident-dialog').open,true);const artistModes=Array.from($('artist-resident-mode').children);assert.equal(artistModes.find(item=>item.value==='chatgpt').hidden,true);assert.equal(artistModes.find(item=>item.value==='api').hidden,true);assert.equal(artistModes.find(item=>item.value==='api').disabled,true);assert.equal($('artist-resident-connect').textContent,'ChatGPT plan · local house');assert.match($('artist-resident-ai-privacy').textContent,/internet is required/);
await assert.rejects(context.artistAIReply({artistId:'monet',provider:'api',message:'Unconfigured'}),/local house/);await assert.rejects(context.artistAIReply({artistId:'monet',provider:'chatgpt',message:'Plan handoff only'}),/local house/);
const artistQuestion='How should our house help me observe changing light?';$('artist-resident-input').value=artistQuestion;await submit('artist-resident-form');assert.equal($('artist-resident-input').value,'');assert.equal(network.cityNetwork.artistConversations.monet.at(-2).text,artistQuestion);await context.saveCityNetwork(proposeArtistHome(network.cityNetwork,'monet'));assert.equal(network.cityNetwork.artistHomes.proposals[0].decision,'pending');assert.equal(network.cityNetwork.artistHomes.editions.length,0,'The resident cannot approve or build its proposal');await until(()=>$('conversations-count').textContent.includes('4 private messages'),'artist save refreshes archive');assert.ok(Array.from($('conversation-messages').children).some(card=>Array.from(card.children[0].children).some(item=>item.textContent.includes('Claude Monet'))),'The archive identifies the artist instead of Socrates');
await $('math-city-open').click();assert.equal(city,'mathematics');$('math-city-guide-open').click();await $('math-city-floor-7').click();assert.equal(mathLevel,7);pick({mathAction:'concept',conceptId:'algorithms'});$('math-city-reflection').value='The remainder decreases, so this process terminates.';$('math-city-reflection').oninput();await $('math-city-save-reflection').click();assert.equal(network.cityNetwork.notes.at(-1).cityId,'mathematics');assert.equal(network.cityNetwork.notes[0].text,'Keep the original art-city observation.');
await context.visitHome('home-1');assert.equal(network.activeId,'home-1');await assert.rejects(context.saveHouse(read('clone(house)')),/older home is preserved/);await context.forkHome();assert.equal(network.homes.length,4);assert.equal(JSON.stringify(network.homes.slice(0,2)),originalHomes);
await read('buildResidence(createResidence(house))');assert.equal(network.homes.at(-1).edition,'residence');assert.equal(JSON.stringify(network.homes.slice(0,2)),originalHomes);
await assert.rejects(context.importAsset(new Uint8Array([1,2,3])),/offline house/);await assert.rejects(context.gptConnect('not-a-key','mock'),/No key is entered/);assert.ok(!requests.some(item=>item.route.includes('/design-assets')||item.route.includes('/gpt/connect')));
$('design-open').click();assert.match($('save-state').textContent,/GLB design imports use the offline edition/);
assert.ok(requests.filter(item=>item.method!=='GET').every(item=>item.headers['X-House-Request']==='1'));assert.ok(requests.every(item=>item.headers['X-Local-CSRF']===undefined));
assert.ok(!requests.some(item=>/^\/api\/(gpt|chatgpt|artists)\//.test(item.route)),'Hosted conversations never call a paid provider or ChatGPT-plan endpoint');

// The actual local coordinator must open the existing plan settings for the
// handoff hash without authorizing or sending anything. Its separate export
// reads the full private archive, including messages outside the 80-turn window.
elements.clear();for(const match of html.matchAll(/<([^\s>]+)[^>]*\bid="([^"]+)"([^>]*)>/g)){const item=new Element(match[1]);item.id=match[2];item.hidden=match[3].includes('hidden');}
body.dataset.mode='local';city='home';const localRequests=[],blobs=[],localEvents=new Map();let failArchive=true;
const archiveFile={format:'house-of-ideas-private-conversations',version:1,source:'local-house',exportedAt:'2026-10-10T12:00:00Z',revision,messages:Array.from({length:126},(_,index)=>({id:'durable-'+index,actor:index<90?'socrates':'monet',role:index%2?'socrates':'user',text:'Preserved private turn '+index,mode:'chatgpt',at:'2026-10-10T10:00:00Z'}))};
const localConfig={csrfToken:'test-local-session',gpt:{ready:false},chatgpt:{connected:false,pending:false,ready:false,accounts:[]}};
const localWindow={document,location:{hash:'#chatgpt'},addEventListener(name,fn){localEvents.set(name,fn);},setInterval(){return 0;},clearInterval(){}};
const downloadURL={createObjectURL(blob){blobs.push(blob);return 'blob:local-archive';},revokeObjectURL(){}};
const localContext=vm.createContext({...model,...homes,...residence,initialCityNetwork,validateCityNetwork,CITIES,saveCityNote,ARTISTS,formatCityDiscussion,pragueDate,recordReflection,initMathCityUI:panel,initCityTravelUI:panel,initConversationUI:panel,initChatGPTUI,
 initResidentUI:options=>initResidentUI({...options,schedule(){return 0;},cancel(){}}),initArtistResidentUI:panel,proposeArtistHome,initLearning:panel,initHomeUI:panel,initDesignerUI:panel,initArtCityUI:panel,initArtistHomesUI:panel,initResidenceUI:panel,
 document,window:localWindow,console,crypto,AbortController,Blob,URL:downloadURL,setInterval(){},setTimeout(){},createScene(){return scene;},async fetch(route,options={}){localRequests.push({route,options});if(route==='/api/config')return Response.json(localConfig);assert.equal(options.headers['X-Local-CSRF'],localConfig.csrfToken);if(route==='/api/chatgpt/status')return Response.json(localConfig.chatgpt);if(route==='/api/house')return Response.json(snapshot());if(route==='/api/conversations/file')return failArchive?Response.json({error:'Archive read unavailable. Your saved file is unchanged.'},{status:503}):Response.json(archiveFile);throw Error('The local handoff must not invoke '+route);}});
vm.runInContext(source,localContext);await until(()=>vm.runInContext('loaded&&!saving',localContext),'local handoff startup');assert.equal($('gpt-dialog').open,true);assert.equal($('chatgpt-settings').hidden,false);assert.equal($('chatgpt-connect').focused,true);assert.equal(localRequests.filter(item=>item.route==='/api/config').length,1);assert.equal(localRequests.filter(item=>item.route==='/api/chatgpt/status').length,1);assert.ok(!localRequests.some(item=>/\/(start|chat|connect)$/.test(item.route)),'The hash opens settings without OAuth or inference');
$('resident-input').value='An unsent local question.';const beforeExport=JSON.stringify(snapshot());await $('resident-archive-export').click();assert.match($('resident-message').textContent,/Archive read unavailable/);assert.equal(downloadLinks.length,0);assert.equal($('resident-input').value,'An unsent local question.');failArchive=false;const originalCreateObjectURL=URL.createObjectURL;URL.createObjectURL=blob=>{blobs.push(blob);return originalCreateObjectURL(blob);};try{await $('resident-archive-export').click();}finally{URL.createObjectURL=originalCreateObjectURL;}assert.equal(downloadLinks.at(-1).download,'house-of-ideas-private-conversations.json');assert.deepEqual(JSON.parse(await blobs.at(-1).text()),archiveFile);assert.equal(archiveFile.messages.length,126);assert.equal(JSON.stringify(snapshot()),beforeExport,'Archive download never changes the house/revision');assert.equal($('resident-input').value,'An unsent local question.');assert.match($('resident-export').textContent,/recent game improvement brief/);assert.equal(localRequests.filter(item=>item.options.method&&item.options.method!=='GET').length,0);
console.log('Online/local UI verified with mocks only: private cloud guide and artist archives, local ChatGPT-plan handoff without OAuth/inference, no hosted paid modes, full durable local archive export beyond 80 turns, failed-export and concurrent drafts, Mathematics journal/floors and preserved editions.');
