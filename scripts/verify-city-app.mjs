import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import * as model from '../web/model.js';
import * as neighborhood from '../web/neighborhood.js';
import {initialCityNetwork,validateCityNetwork,CITIES,saveCityNote} from '../web/city-network.js';
import {initCityTravelUI} from '../web/city-travel-ui.js';
import {initResidentUI} from '../web/resident-ui.js';
import {initArtistResidentUI} from '../web/artist-resident-ui.js';
import {initArtistHomesUI} from '../web/artist-homes-ui.js';
import {proposeArtistHome} from '../web/artist-homes.js';
import {ARTISTS} from '../web/art-city-data.js';
import {validateResident,formatCityDiscussion} from '../web/resident.js';
import {initHomeUI} from '../web/home-ui.js';
import * as residenceData from '../web/residence-data.js';
import {pragueDate,reflect as recordReflection} from '../web/socrates.js';
import {BOOKS} from '../web/books.js';
import {startServer} from '../server/local.mjs';

// Exercise the app's actual coordinator, travel panel, home panel and resident
// panel against the actual local HTTP store. The renderer and unrelated panels
// are isolated because their geometry/interaction suites test them separately.
const root=fileURLToPath(new URL('../',import.meta.url));
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-city-app-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
assert.ok(path.basename(temporary).startsWith('house-city-app-'));
const dataDir=path.join(temporary,'data');await fs.mkdir(dataDir);
const personal=model.starter();personal.ideas.push({id:'preserved-idea',roomId:'math',title:'An original question',
  text:'Which assumption could make this observation fail?',cue:'ring',action:'question'});
personal.resident=validateResident(undefined,personal);
await fs.writeFile(path.join(dataDir,'house.json'),JSON.stringify({version:2,revision:10,
  neighborhood:neighborhood.initialNeighborhood(personal,{now:'2026-10-08T08:00:00.000Z'})}));
let running,providerCalls=0;
const elements=new Map(),timers=new Map(),requests=[],physical=[];
class Element {
  constructor(tag='div'){
    this.tagName=tag;this.children=[];this.value='';this.textContent='';this.hidden=false;
    this.disabled=false;this.checked=false;this.open=false;this.style={setProperty(){}};this.dataset={};
    this.attributes={};this.listeners=new Map();this.files=[];
    const classes=new Set();this.classList={add(...items){items.forEach(item=>classes.add(item));},
      remove(...items){items.forEach(item=>classes.delete(item));},contains:item=>classes.has(item),
      toggle(item,enabled){const next=enabled===undefined?!classes.has(item):enabled;if(next)classes.add(item);else classes.delete(item);return next;}};
  }
  set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}
  setAttribute(key,value){this.attributes[key]=String(value);}removeAttribute(key){delete this.attributes[key];}
  addEventListener(name,callback){this.listeners.set(name,callback);}focus(){this.focused=true;}
  showModal(){this.open=true;}close(){this.open=false;this.listeners.get('close')?.();}
  click(){return this.onclick?.({preventDefault(){},submitter:this});}setPointerCapture(){}
  createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}};}
  getScreenCTM(){return {inverse(){return {};}};}
}
const html=await fs.readFile(path.join(root,'web/index.html'),'utf8');
for(const match of html.matchAll(/<([^\s>]+)[^>]*\bid="([^"]+)"([^>]*)>/g)){
  const element=new Element(match[1]);element.id=match[2];element.hidden=match[3].includes('hidden');
}
const $=id=>{assert.ok(elements.has(id),'The real app contains '+id);return elements.get(id);};
const radios=model.CUES.map(value=>{const radio=new Element('input');radio.value=value;radio.checked=value==='crystal';return radio;});
const saveArea=new Element(),body=new Element('body');body.dataset.mode='local';
const document={body,getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),
  querySelectorAll:()=>[],querySelector(selector){
    if(selector==='.save-area')return saveArea;if(selector==='#scene canvas')return $('scene');
    if(selector==='dialog[open]')return [...elements.values()].find(element=>element.open);
    if(selector.includes(':checked'))return radios.find(radio=>radio.checked);
    const value=selector.match(/value="([^"]+)"/)?.[1];return radios.find(radio=>radio.value===value)||null;
  }};
const optionalPanel=()=>({async onLoad(){},render(){},close(){},onHomeChange(){}});
const window={addEventListener(){},setInterval(callback,delay){timers.set('home:'+delay,callback);return delay;},
  clearInterval(){},setTimeout(){},URL,open(){throw Error('No remote window is opened.');}};
let city='home',artistId=null,pick,latestSceneHouse,physicalNetwork,cookie='',cityGate=null,houseGate=null,readGate=null,failCities=false,failReads=false;
const scene={load(house){latestSceneHouse=model.clone(house);},setEdition(){},setNeighborhood(){},
  setCityNetwork(network){physicalNetwork=model.clone(network);},cityState:()=>CITIES.find(item=>item.id===city),
  prepareCity(id){assert.ok(CITIES.some(item=>item.id===id),'Prepare receives the destination city');physical.push('prepare:'+id);},
  travelToCity(id){assert.ok(physicalNetwork.visits[id]>0,'A visit is saved before scene transition');city=id;
    physical.push('travel:'+id);pick({artAction:'city-state'});},
  leaveArtCity(){city='home';pick({artAction:'city-state'});},showNeighborhood(){city='home';pick({artAction:'city-state'});},
  playerState:()=>({cityId:city,cityName:CITIES.find(item=>item.id===city).name,cityLocation:city==='makers'?'Workshop hall':null,
    artistCity:city==='artists',artistId:city==='artists'?artistId:null,roomId:city==='home'?'math':null,outside:city!=='home',neighborhood:city==='home'}),
  artistResidentState:id=>({artistId:id,cityId:city,available:city==='artists',near:city==='artists'&&artistId===id,position:{x:0,z:0}}),
  greetArtistResident(){},setArtistTalking(){},enterArtistHouse(id){city='artists';artistId=id;pick({artAction:'city-state'});},
  residentState:()=>({available:city!=='artists',cityId:city,artistCity:city==='artists',roomId:city==='home'?'math':null,
    locationLabel:CITIES.find(item=>item.id===city).name,near:true,activity:'Exploring '+city}),
  seatAt(data){physical.push({seat:model.clone(data)});},stand(){},select(){},setWalk(){},setExterior(){},
  setResidentTalking(){},summonResident(){physical.push('summon:'+city);return true;},
  onResidentVisit(){},onResidentInteract(){},focusedTarget:()=>null,startOutside(){},arriveAtDoor(){},returnDesign(){}};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const read=expression=>vm.runInContext(expression,context);
const submit=id=>$(id).onsubmit({preventDefault(){},submitter:new Element('button')});
const choose=(id,value)=>{$(id).value=value;$(id).onchange?.();};
async function until(predicate,label){const deadline=Date.now()+5000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,2));}throw Error('Timed out: '+label);}
async function browserFetch(route,options={}){
  requests.push({route,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(route==='/api/house'&&(!options.method||options.method==='GET')){
    if(readGate)await readGate.promise;
    if(failReads)return Response.json({error:'Saved state read unavailable.'},{status:503});
  }
  if(route==='/api/cities'&&options.method==='PUT'){
    if(cityGate)await cityGate.promise;
    if(failCities)return Response.json({error:'City collection disk unavailable. Your draft is kept.'},{status:503});
  }
  if(route==='/api/house'&&options.method==='PUT'&&houseGate)await houseGate.promise;
  const headers={...options.headers};if(cookie)headers.Cookie=cookie;
  if(options.method&&options.method!=='GET')headers.Origin=running.url;
  const response=await fetch(running.url+route,{...options,headers});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  return response;
}
let context;
try{
  running=await startServer({dataDir,webDir:path.join(root,'web'),port:0,maxPort:0,env:{},
    fetchImpl:async()=>{providerCalls++;throw Error('No unrequested provider request is allowed.');}});
  context=vm.createContext({...model,...neighborhood,...residenceData,initialCityNetwork,validateCityNetwork,CITIES,
    initHomeUI,pragueDate,recordReflection,initCityTravelUI,formatCityDiscussion,
    initLearning:()=>({render(){},hideCritic(){},noteVisit(){},onHomeChange(){},async onLoad(){},includeVisits:house=>house}),
    initResidentUI:options=>initResidentUI({...options,schedule(callback,delay){timers.set('resident:'+delay,callback);return delay;},cancel(){}}),
    initArtCityUI:optionalPanel,initArtistResidentUI:options=>initArtistResidentUI({...options,schedule(callback,delay){timers.set('artist:'+delay,callback);return delay;},cancel(){}}),initArtistHomesUI,proposeArtistHome,initChatGPTUI:optionalPanel,initDesignerUI:optionalPanel,initResidenceUI:optionalPanel,ARTISTS,
    document,window,console,crypto,AbortController,Blob,URL,setInterval(){},setTimeout(){},
    createScene(_,callback){pick=callback;return scene;},fetch:browserFetch});
  const source=(await fs.readFile(path.join(root,'web/app.js'),'utf8')).replace(/^import .*$/gm,'');
  vm.runInContext(source,context);
  await until(()=>read('loaded&&!saving')&&$('save-state').textContent==='Saved on this computer','actual app load');
  assert.equal(requests.filter(request=>request.route==='/api/config').length,1,'Startup shares the local CSRF config');
  const state=async()=>{const response=await fetch(running.url+'/api/house');assert.equal(response.status,200);return response.json();};
  let saved=await state();assert.equal(saved.revision,10);assert.equal(saved.neighborhood.activeId,'home-2');
  $('city-travel-open').click();assert.equal($('city-travel-home').attributes['aria-current'],'location');
  assert.equal($('city-travel-artists').attributes['aria-current'],'false');
  assert.equal($('city-travel-reload').hidden,true);

  // Copying an idea while inhabiting an archive uses only the independent city
  // state and global revision; neither complete house snapshot is changed.
  await context.visitHome('home-1');saved=await state();const homesBefore=JSON.stringify(saved.neighborhood.homes);
  $('city-travel-open').click();choose('city-travel-source-home','home-1');
  await $('city-travel-pack-idea').click();saved=await state();
  assert.equal(saved.revision,12);assert.equal(saved.neighborhood.activeId,'home-1');
  assert.equal(JSON.stringify(saved.neighborhood.homes),homesBefore);
  assert.equal(saved.neighborhood.cityNetwork.cargo[0].sourceHomeTitle,'Original house');
  assert.equal(read('revision'),saved.revision);
  await assert.rejects(context.saveHouse(read('clone(house)')),/older home is preserved/);

  // An in-flight city write gates another mutation. A subsequent house save
  // uses the city's new revision and retains the collection in the server,
  // app neighborhood and renderer; there is no stale whole-neighborhood put.
  await context.visitHome('home-2');$('city-travel-open').click();choose('city-travel-book','practice');
  cityGate=deferred();const bookWrite=$('city-travel-pack-book').click();
  await until(()=>read('saving'),'city save pending');
  const draft=model.clone(latestSceneHouse);draft.ideas[0].text='An idea draft prepared during city storage.';
  await assert.rejects(context.saveHouse(draft),/current save/);
  const previousRevision=read('revision');cityGate.resolve();await bookWrite;cityGate=null;
  assert.equal(read('revision'),previousRevision+1);const savedNetwork=model.clone(physicalNetwork);
  await context.saveHouse(draft);saved=await state();
  assert.equal(saved.revision,previousRevision+2);assert.equal(saved.house.ideas[0].text,draft.ideas[0].text);
  assert.deepEqual(saved.neighborhood.cityNetwork,savedNetwork);
  assert.deepEqual(read('getCityNetwork()'),savedNetwork);assert.deepEqual(physicalNetwork,savedNetwork);
  const lastPut=requests.filter(request=>request.route==='/api/house'&&request.method==='PUT').at(-1);
  assert.equal(lastPut.body.revision,previousRevision+1);

  // Retained layout and conversation drafts survive transport. The scene
  // moves only after storage succeeds, and each destination updates its
  // active indicator, journal name and physical-world caption.
  $('plan-tab').click();$('plan-name').value='My unbuilt room';submit('room-form');
  const planBefore=read('JSON.stringify(plan)');$('resident-input').value='A question I have not submitted.';
  $('city-travel-open').click();$('city-travel-journal-answer').value='An unsaved note at home.';
  await $('city-travel-artists').click();assert.equal(city,'artists');
  assert.equal(body.classList.contains('plan-mode'),false);assert.equal(read('JSON.stringify(plan)'),planBefore);
  assert.equal($('resident-input').value,'A question I have not submitted.');
  $('city-travel-open').click();assert.equal($('city-travel-artists').attributes['aria-current'],'location');
  assert.equal($('city-travel-home').attributes['aria-current'],'false');
  assert.match($('city-travel-journal-title').textContent,/Artists’ City/);
  timers.get('home:200')();assert.equal($('scene-room').textContent,'Artists’ City');
  assert.equal($('art-city-return').hidden,false);
  $('city-travel-journal-answer').value='An unsaved note in Artists’ City.';
  pick({cityAction:'read',bookId:'practice'});$('city-travel-activity-answer').value='A reading draft from the artists’ library.';
  const beforeFailure=await state();failCities=true;await $('city-travel-makers').click();
  assert.equal(city,'artists','A failed city save does not transport the player');
  assert.equal(read('revision'),beforeFailure.revision);assert.equal($('city-travel-dialog').open,true);
  assert.equal($('city-travel-activity-answer').value,'A reading draft from the artists’ library.');
  assert.equal($('city-travel-journal-answer').value,'An unsaved note in Artists’ City.');
  assert.equal(read('JSON.stringify(plan)'),planBefore);assert.match($('city-travel-status').textContent,/unavailable/);
  failCities=false;await $('city-travel-makers').click();assert.equal(city,'makers');
  $('city-travel-open').click();assert.equal($('city-travel-makers').attributes['aria-current'],'location');
  assert.equal($('city-travel-artists').attributes['aria-current'],'false');
  assert.match($('city-travel-journal-title').textContent,/Makers’ City/);
  assert.deepEqual($('city-travel-anchor').children.map(option=>option.value),['library','workshop','plaza']);
  timers.get('home:200')();assert.equal($('scene-room').textContent,'Workshop hall');
  assert.equal(read('JSON.stringify(plan)'),planBefore);

  // Physical facilities dispatch to city activities and journals, not house
  // editing. Books retain pages, table seats receive their spatial anchor,
  // workshop observations remain in the city journal and cargo is inspectable.
  pick({cityAction:'read',bookId:'practice'});
  assert.equal($('city-travel-activity-title').textContent,BOOKS.find(book=>book.id==='practice').title);
  const firstPage=$('city-travel-activity-text').textContent;pick({xrCommand:'next'});
  assert.notEqual($('city-travel-activity-text').textContent,firstPage);
  pick({cityAction:'activity',activity:'tea',anchor:{x:1,z:2}});
  assert.match($('city-travel-activity-title').textContent,/Tea/);assert.deepEqual(physical.at(-1).seat.anchor,{x:1,z:2});
  pick({cityAction:'activity',activity:'experiment'});
  assert.match($('city-travel-activity-title').textContent,/experiment/);
  const beforeActivity=await state(),homeSnapshots=JSON.stringify(beforeActivity.neighborhood.homes);
  $('city-travel-activity-answer').value='Prediction: a smaller test will reveal a missing assumption.';
  await submit('city-travel-activity-form');saved=await state();
  assert.equal(saved.neighborhood.cityNetwork.notes.at(-1).cityId,'makers');
  assert.match(saved.neighborhood.cityNetwork.notes.at(-1).text,/Prediction:/);
  assert.equal(JSON.stringify(saved.neighborhood.homes),homeSnapshots);
  choose('city-travel-cargo',saved.neighborhood.cityNetwork.cargo[0].id);choose('city-travel-anchor','workshop');
  await submit('city-travel-placement-form');saved=await state();const display=saved.neighborhood.cityNetwork.placements.at(-1);
  pick({cargoId:display.id});assert.equal($('city-travel-activity-title').textContent,'An original question');
  assert.match($('city-travel-activity-text').textContent,/Which assumption/);
  const providerBoundary=requests.length;await $('city-travel-discuss').click();
  assert.equal($('resident-conversation').hidden,false);assert.match($('resident-input').value,/Makers’ City/);
  assert.match($('resident-input').value,/An original question/);
  assert.equal(requests.length,providerBoundary,'Preparing a Socratic discussion does not send the message');
  assert.equal(providerCalls,0);

  // Returning restores each city's unsent journal/activity and the staged
  // architecture; no travel or copying action implicitly connects a provider.
  $('city-travel-open').click();await $('city-travel-artists').click();$('city-travel-open').click();
  assert.equal($('city-travel-journal-answer').value,'An unsaved note in Artists’ City.');
  pick({cityAction:'read',bookId:'practice'});
  assert.equal($('city-travel-activity-answer').value,'A reading draft from the artists’ library.');
  await $('city-travel-home').click();$('city-travel-open').click();
  assert.equal($('city-travel-journal-answer').value,'An unsaved note at home.');
  assert.equal($('city-travel-home').attributes['aria-current'],'location');
  assert.equal($('city-travel-makers').attributes['aria-current'],'false');
  assert.equal(read('JSON.stringify(plan)'),planBefore);

  // Editing a note while its previous version is being saved must keep the
  // new unsent text, even when the app re-renders from the server response.
  $('city-travel-journal-answer').value='The city note being committed.';
  cityGate=deferred();const noteWrite=submit('city-travel-journal-form');
  await until(()=>read('saving'),'journal save pending');
  $('city-travel-journal-answer').value='A newer city note typed while saving.';
  cityGate.resolve();await noteWrite;cityGate=null;saved=await state();
  assert.equal(saved.neighborhood.cityNetwork.notes.at(-1).text,'The city note being committed.');
  assert.equal($('city-travel-journal-answer').value,'A newer city note typed while saving.');

  // A real other-tab city write causes global CAS rejection. The failed
  // travel neither overwrites that tab nor discards the local unsent plan
  // or journal. Reloading storage allows an explicit retry with its revision.
  const externallySaved=saveCityNote(saved.neighborhood.cityNetwork,'home','Saved by another tab.');
  const otherTab=await fetch(running.url+'/api/cities',{method:'PUT',headers:{'Content-Type':'application/json',
    Origin:running.url,Cookie:cookie,'X-Local-CSRF':read('localSettings.csrfToken')},
    body:JSON.stringify({cityNetwork:externallySaved,revision:saved.revision})});
  assert.equal(otherTab.status,200);const newer=await otherTab.json();
  await $('city-travel-makers').click();assert.equal(city,'home');
  assert.equal(read('revision'),saved.revision);assert.match($('city-travel-status').textContent,/another tab/);
  assert.equal(read('JSON.stringify(plan)'),planBefore);
  assert.equal($('city-travel-journal-answer').value,'A newer city note typed while saving.');
  assert.deepEqual((await state()).neighborhood.cityNetwork,externallySaved);
  assert.equal($('city-travel-reload').hidden,false,'CAS failure offers explicit in-guide recovery');
  const recoveryStart=requests.length;failReads=true;await $('city-travel-reload').click();
  assert.equal($('city-travel-dialog').open,true);assert.equal(city,'home');
  assert.equal(read('revision'),saved.revision);assert.equal($('city-travel-reload').hidden,false);
  assert.equal($('city-travel-reload').disabled,false,'A failed read leaves reload available even while loaded=false');
  assert.match($('city-travel-status').textContent,/read unavailable/);
  assert.equal($('city-travel-journal-answer').value,'A newer city note typed while saving.');
  failReads=false;readGate=deferred();const recovery=$('city-travel-reload').click();
  await until(()=>$('city-travel-reload').disabled,'saved-state read pending');
  $('city-travel-journal-answer').value='A newer draft typed during saved-state reload.';
  readGate.resolve();await recovery;readGate=null;
  assert.equal(read('revision'),newer.revision);assert.equal(city,'home','Reload does not automatically retry travel');
  assert.equal($('city-travel-dialog').open,true);assert.equal($('city-travel-reload').hidden,true);
  assert.equal($('city-travel-journal-answer').value,'A newer draft typed during saved-state reload.');
  assert.equal(read('JSON.stringify(plan)'),planBefore);
  assert.ok(requests.slice(recoveryStart).every(request=>request.method==='GET'),'Recovery only reads saved state');
  await $('city-travel-makers').click();assert.equal(city,'makers');
  assert.equal(read('getCityNetwork().notes.at(-1).text'),'Saved by another tab.');
  $('plan-tab').click();
  assert.equal($('plan-name').value,'My unbuilt room');$('cancel-plan').click();

  // The resident panel shares the same save gate. New text typed while the
  // submitted conversation is saving remains a draft for the next turn.
  $('resident-talk').click();$('resident-input').value='How can I test an assumption here?';
  houseGate=deferred();const conversation=submit('resident-form');
  await until(()=>read('saving'),'resident conversation pending');
  $('resident-input').value='A second question typed while the first is saving.';
  houseGate.resolve();await conversation;houseGate=null;
  assert.equal($('resident-input').value,'A second question typed while the first is saving.');
  assert.equal((await state()).house.resident.messages.at(-2).text,'How can I test an assumption here?');
  const oldHomes=JSON.stringify((await state()).neighborhood.homes);
  scene.enterArtistHouse('monet');$('socrates-tab').click();
  assert.equal($('artist-resident-dialog').open,true);
  assert.match($('artist-resident-title').textContent,/Monet/);
  assert.equal($('resident-conversation').hidden,true);
  assert.equal($('resident-hud').hidden,true);
  assert.equal($('socrates-tab').textContent,'Meet the artist');
  const beforeArtist=(await state()).revision;
  $('artist-resident-input').value='Give me a practice inspired by light.';
  await submit('artist-resident-form');saved=await state();
  assert.equal(saved.revision,beforeArtist+1);
  assert.equal(saved.neighborhood.cityNetwork.artistConversations.monet.at(-2).text,'Give me a practice inspired by light.');
  assert.match(saved.neighborhood.cityNetwork.artistConversations.monet.at(-1).text,/light|colour/i);
  assert.equal(JSON.stringify(saved.neighborhood.homes),oldHomes,'Artist chat leaves all personal homes and Socrates history unchanged');
  scene.enterArtistHouse('morris');pick({artistResidentId:'morris'});
  assert.match($('artist-resident-title').textContent,/Morris/);
  assert.doesNotMatch($('artist-resident-messages').children.map(item=>item.children.map(child=>child.textContent).join(' ')).join(' '),/Give me a practice inspired by light/);
  $('artist-resident-input').value='How can I make a repeating pattern?';
  await submit('artist-resident-form');saved=await state();
  assert.match(saved.neighborhood.cityNetwork.artistConversations.morris.at(-1).text,/motif|repeat|pattern/);
  scene.enterArtistHouse('monet');$('socrates-tab').click();
  assert.equal($('artist-resident-input').value,'');
  assert.match($('artist-resident-messages').children.at(-2).children.at(-1).textContent,/Give me a practice/);
  $('artist-resident-input').value='Unsent artist question';failCities=true;
  await submit('artist-resident-form');failCities=false;
  assert.equal($('artist-resident-input').value,'Unsent artist question');
  assert.equal($('artist-resident-reload').hidden,false);
  await $('artist-resident-reload').click();
  assert.equal($('artist-resident-input').value,'Unsent artist question');
  assert.equal((await state()).revision,saved.revision);
  scene.leaveArtCity();assert.equal($('artist-resident-dialog').open,false);
  assert.equal($('resident-hud').hidden,false);assert.equal($('socrates-tab').textContent,'Socrates');
  assert.equal(providerCalls,0);assert.ok(!requests.some(request=>/^\/api\/(?:gpt|chatgpt)\/.+/.test(request.route)));
  console.log('Actual app city transport, global revisions, archive copies, drafts, physical activities and explicit provider boundaries verified.');
}finally{
  await running?.close();
  assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('house-city-app-'));
  await fs.rm(temporary,{recursive:true,force:true});
}
