import {validateTrail} from './learning-trail.js';
import {CUES, IDEA_ACTIONS, defaultIdeaAction} from './model.js';
import {BOOKS} from './books.js';
import {ARTISTS} from './artist-catalog.js';
import {validateArtistHomes} from './artist-home-data.js';

export const CITY_LIMITS = Object.freeze({cargo:64, placements:128, placementsPerAnchor:8,
  notes:120, cargoText:6000, noteText:2000, visits:1000000, travelPackBytes:2*1024*1024,
  artistMessages:80, artistMessageText:2000, artistConversationBytes:512*1024});
export const CITY_ANCHORS = Object.freeze({home:Object.freeze(['library','table','plaza']),
  artists:Object.freeze(['library','table','plaza']), makers:Object.freeze(['library','workshop','plaza']), mathematics:Object.freeze(['library','table','plaza'])});
const labels={library:'Library',table:'Learning table',plaza:'Plaza',workshop:'Workshop'};
export const CITIES = Object.freeze([
  {id:'home',name:'Home neighbourhood',description:'Return to your preserved homes, read in the library and bring a thought to the learning table.'},
  {id:'artists',name:'Artists’ City',description:'Explore eleven artist houses, read, discuss their works and keep observations in the city journal.'},
  {id:'makers',name:'Makers’ City',description:'Visit workshops, try a small experiment and bring useful ideas back to another city.'},
  {id:'mathematics',name:'Mathematics City',description:'Enter an eight-floor mathematical house, explore ideas and open the offline Atlas of Ideas on its screens.'},
].map(city=>Object.freeze({...city,anchors:Object.freeze(CITY_ANCHORS[city.id].map(id=>Object.freeze({id,label:labels[id]})))})));

const cityIds=CITIES.map(city=>city.id), validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
const keys=(input,allowed,label)=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error(`Use a plain ${label} record.`);
  if(Object.keys(input).some(key=>!allowed.includes(key)))throw Error(`The ${label} contains an unsupported field.`);
};
const text=(value,max,label,{empty=false}={})=>{
  if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw Error(`${label} needs ${empty?'0':'1'}–${max} characters.`);
  return value;
};
const city=value=>{if(!cityIds.includes(value))throw Error('Choose a city in this local network.');return value;};
const timestamp=value=>{
  if(typeof value!=='string'||value.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('Use a valid ISO city journal date.');
  const parsed=new Date(value);if(!Number.isFinite(parsed.valueOf()))throw Error('Use a valid ISO city journal date.');
  // JavaScript otherwise rolls invalid calendar days into the following month.
  const day=new Date(value.slice(0,10)+'T00:00:00.000Z');if(day.toISOString().slice(0,10)!==value.slice(0,10))throw Error('Use a valid ISO city journal date.');
  return parsed.toISOString();
};
const now=options=>timestamp((options?.now instanceof Date?options.now.toISOString():options?.now)??new Date().toISOString());
const array=(value,max,label)=>{if(!Array.isArray(value)||value.length>max)throw Error(`The city network holds at most ${max} ${label}; export it before adding more. Nothing was removed.`);return value;};
const unique=(value,seen,label)=>{if(!validId(value)||seen.has(value))throw Error(`Each ${label} needs a unique valid identifier.`);seen.add(value);return value;};
const freshId=(prefix,records,reserved=new Set())=>{const ids=new Set(records.map(record=>record.id));let index=records.length+1;while(ids.has(`${prefix}-${index}`)||reserved.has(`${prefix}-${index}`))index++;return `${prefix}-${index}`;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const withoutId=record=>{const {id,...value}=record;return value;};

export function initialCityNetwork(){
  return {version:1,cargo:[],placements:[],notes:[],visits:{home:0,artists:0,makers:0,mathematics:0},lastVisits:{home:null,artists:null,makers:null,mathematics:null}};
}

export function validateCityNetwork(input){
  if(input===undefined)return initialCityNetwork();
  keys(input,['version','cargo','placements','notes','visits','lastVisits','artistConversations','artistHomes','learningTrail'],'city network');
  if(input.version!==1)throw Error('Choose a supported city network version.');
  const cargoIds=new Set(),placementIds=new Set(),noteIds=new Set();
  const cargo=array(input.cargo,CITY_LIMITS.cargo,'carried objects').map(item=>{
    keys(item,['id','type','title','text','cue','action','sourceHomeTitle','sourceRoomName','bookId','sourceIdeaId'],'carried object');
    unique(item.id,cargoIds,'carried object');
    if(!['book','idea','activity'].includes(item.type))throw Error('Carry a learning book, idea or activity.');
    if(!CUES.includes(item.cue)||!IDEA_ACTIONS.includes(item.action))throw Error('Choose a supported carried object cue and function.');
    if(item.type==='book'&&!BOOKS.some(book=>book.id===item.bookId))throw Error('Choose a known offline learning book.');
    if(item.type!=='book'&&item.bookId!==undefined)throw Error('Only a learning book can contain a book identifier.');
    if(item.sourceIdeaId!==undefined&&!validId(item.sourceIdeaId))throw Error('Use a valid source idea identifier.');
    return {id:item.id,type:item.type,title:text(item.title,100,'Object title'),text:text(item.text,CITY_LIMITS.cargoText,'Object note',{empty:true}),
      cue:item.cue,action:item.action,sourceHomeTitle:text(item.sourceHomeTitle??'',100,'Source home name',{empty:true}),
      sourceRoomName:text(item.sourceRoomName??'',60,'Source room name',{empty:true}),
      ...(item.bookId===undefined?{}:{bookId:item.bookId}),...(item.sourceIdeaId===undefined?{}:{sourceIdeaId:item.sourceIdeaId})};
  });
  const counts=new Map();
  const placements=array(input.placements,CITY_LIMITS.placements,'display copies').map(item=>{
    keys(item,['id','cargoId','cityId','anchorId'],'city placement');unique(item.id,placementIds,'display copy');
    if(!cargoIds.has(item.cargoId))throw Error('Every display copy needs an object in your travel bag.');
    city(item.cityId);if(!CITY_ANCHORS[item.cityId].includes(item.anchorId))throw Error('Place an object at a known city landmark.');
    const slot=item.cityId+':'+item.anchorId,count=(counts.get(slot)||0)+1;counts.set(slot,count);
    if(count>CITY_LIMITS.placementsPerAnchor)throw Error(`This landmark holds ${CITY_LIMITS.placementsPerAnchor} display copies. Choose another place; nothing was removed.`);
    return {id:item.id,cargoId:item.cargoId,cityId:item.cityId,anchorId:item.anchorId};
  });
  const notes=array(input.notes,CITY_LIMITS.notes,'city journal entries').map(item=>{
    keys(item,['id','cityId','date','text'],'city journal entry');unique(item.id,noteIds,'city journal entry');
    return {id:item.id,cityId:city(item.cityId),date:timestamp(item.date),text:text(item.text,CITY_LIMITS.noteText,'City journal entry')};
  });
  keys(input.visits,cityIds,'city visit counts');keys(input.lastVisits??{},cityIds,'city visit dates');
  const visits={},lastVisits={};
  for(const id of cityIds){
    // Older networks stay byte-equivalent in content until the owner actually
    // visits the new city. Do not manufacture a saved mathematics visit.
    if(id==='mathematics'&&!Object.hasOwn(input.visits,id)&&!Object.hasOwn(input.lastVisits??{},id))continue;
    const count=input.visits[id];if(!Number.isInteger(count)||count<0||count>CITY_LIMITS.visits)throw Error(`City visit counts must be between 0 and ${CITY_LIMITS.visits}.`);
    visits[id]=count;lastVisits[id]=input.lastVisits?.[id]==null?null:timestamp(input.lastVisits[id]);
  }
  const result={version:1,cargo,placements,notes,visits,lastVisits};
  // Artist conversations are independent of personal Socrates memory and city
  // journals. Reading an older network must not manufacture a new saved field.
  if(Object.hasOwn(input,'artistConversations')){
    keys(input.artistConversations,ARTISTS.map(artist=>artist.id),'artist conversations');
    const conversations={},messageIds=new Set();
    for(const [artistId,history] of Object.entries(input.artistConversations)){
      const artist=ARTISTS.find(item=>item.id===artistId);
      if(!Array.isArray(history)||history.length>CITY_LIMITS.artistMessages)throw Error(`Your conversation with ${artist.name} holds at most ${CITY_LIMITS.artistMessages} messages. Back it up before continuing; nothing was removed.`);
      if(history.length%2)throw Error('Store complete artist conversation exchanges.');
      conversations[artistId]=history.map((message,index)=>{
        keys(message,['id','role','date','text','workId'],'artist conversation message');
        unique(message.id,messageIds,'artist conversation message');
        if(message.role!==(index%2?'artist':'user'))throw Error('Artist conversation messages alternate between you and the artist.');
        if(message.workId!==undefined&&!artist.works.some(work=>work.id===message.workId))throw Error('Choose a work from this artist’s own gallery.');
        return {id:message.id,role:message.role,date:timestamp(message.date),text:text(message.text,CITY_LIMITS.artistMessageText,'Artist conversation message'),
          ...(message.workId===undefined?{}:{workId:message.workId})};
      });
    }
    if(new TextEncoder().encode(JSON.stringify(conversations)).byteLength>CITY_LIMITS.artistConversationBytes)throw Error('Artist conversations exceed the 512 KiB local history budget. Back them up before continuing; nothing was removed.');
    result.artistConversations=conversations;
  }
  if(Object.hasOwn(input,'artistHomes')){
    result.artistHomes=validateArtistHomes(input.artistHomes);
    for(const p of result.artistHomes.proposals)if(p.sourceMessageId&&!result.artistConversations?.[p.artistId]?.some(m=>m.id===p.sourceMessageId&&m.role==='artist'))throw Error('Artist house ideas must refer to their own retained conversation.');
  }
  if(Object.hasOwn(input,'learningTrail'))result.learningTrail=validateTrail(input.learningTrail);
  return result;
}

export function packIdea(network,idea){
  const result=validateCityNetwork(network);
  if(!idea||typeof idea!=='object')throw Error('Choose an idea to copy into your travel bag.');
  result.cargo.push({id:freshId('cargo',result.cargo),type:idea.type==='activity'?'activity':'idea',title:idea.title,text:idea.text??'',
    cue:idea.cue,action:idea.action??defaultIdeaAction(idea.cue),sourceHomeTitle:idea.sourceHomeTitle??'',sourceRoomName:idea.sourceRoomName??'',
    ...(idea.id===undefined?{}:{sourceIdeaId:idea.id})});
  return validateCityNetwork(result);
}

export function packBook(network,input){
  const result=validateCityNetwork(network),id=typeof input==='string'?input:input?.bookId??input?.id;
  const book=BOOKS.find(item=>item.id===id);if(!book)throw Error('Choose a known offline learning book.');
  result.cargo.push({id:freshId('cargo',result.cargo),type:'book',bookId:book.id,title:book.title,text:[...book.pages,book.question].join('\n\n'),
    cue:'book',action:'read',sourceHomeTitle:input?.sourceHomeTitle??'',sourceRoomName:input?.sourceRoomName??''});
  return validateCityNetwork(result);
}

export function placeCargo(network,cargoId,cityId,anchorId){
  const result=validateCityNetwork(network);result.placements.push({id:freshId('placement',result.placements),cargoId,cityId,anchorId});return validateCityNetwork(result);
}
export function removePlacement(network,id){
  const result=validateCityNetwork(network);if(!result.placements.some(item=>item.id===id))throw Error('Choose a displayed city object to remove.');
  result.placements=result.placements.filter(item=>item.id!==id);return result;
}
export function recordCityVisit(network,cityId,options={}){
  const result=validateCityNetwork(network),id=city(cityId);result.visits[id]=(result.visits[id]??0)+1;result.lastVisits[id]=now(options);return validateCityNetwork(result);
}
export function saveCityNote(network,cityId,value,options={}){
  const result=validateCityNetwork(network);result.notes.push({id:freshId('note',result.notes),cityId:city(cityId),date:now(options),text:value});return validateCityNetwork(result);
}

export function exportTravelPack(network){
  const validated=validateCityNetwork(network),{artistConversations,artistHomes,learningTrail,...collection}=validated;
  // A portable learning collection does not publish private conversations.
  const pack={format:'house-of-ideas-travel-pack',version:1,network:collection};
  if(new TextEncoder().encode(JSON.stringify(pack)).byteLength>CITY_LIMITS.travelPackBytes)throw Error('This collection exceeds the portable travel pack budget. Nothing was removed.');
  return pack;
}

export function importTravelPack(network,input){
  const result=validateCityNetwork(network);
  if(typeof input==='string'){
    if(input.length>CITY_LIMITS.travelPackBytes||new TextEncoder().encode(input).byteLength>CITY_LIMITS.travelPackBytes)throw Error('Use a travel collection under 2 MiB.');
    try{input=JSON.parse(input);}catch{throw Error('Import a valid travel collection JSON file.');}
  }
  keys(input,['format','version','network'],'travel collection');
  if(input.format!=='house-of-ideas-travel-pack'||input.version!==1)throw Error('Choose a supported House of Ideas travel collection.');
  const incoming=validateCityNetwork(input.network),cargoMap=new Map();
  if(Object.hasOwn(incoming,'artistConversations')||Object.hasOwn(incoming,'artistHomes')||Object.hasOwn(incoming,'learningTrail'))throw Error('A travel collection contains learning objects and city journals. Keep private artist conversations and house decisions in the complete local backup; nothing was imported or removed.');
  const originalCargo=new Map(result.cargo.map(item=>[item.id,item])),originalPlacements=new Map(result.placements.map(item=>[item.id,item])),originalNotes=new Map(result.notes.map(item=>[item.id,item]));
  const usedCargo=new Set(),usedPlacements=new Set(),usedNotes=new Set();
  const reservedCargo=new Set(incoming.cargo.map(item=>item.id)),reservedPlacements=new Set(incoming.placements.map(item=>item.id)),reservedNotes=new Set(incoming.notes.map(item=>item.id));
  function existingCopy(records,used,candidate){
    const existing=records.get(candidate.id);if(!existing)return null;
    if(!used.has(existing.id)&&same(existing,candidate))return existing;
    return [...records.values()].find(record=>!used.has(record.id)&&same(withoutId(record),withoutId(candidate)))||null;
  }
  // Independent homes can both call their first snapshot cargo-1. Remap a
  // conflicting imported identity, never overwrite the destination's object.
  for(const item of incoming.cargo){
    const existing=result.cargo.find(record=>record.id===item.id),identical=existingCopy(originalCargo,usedCargo,item);
    if(identical){usedCargo.add(identical.id);cargoMap.set(item.id,identical.id);continue;}
    const id=existing?freshId('cargo',result.cargo,reservedCargo):item.id;result.cargo.push({...item,id});cargoMap.set(item.id,id);
  }
  for(const item of incoming.placements){
    const candidate={...item,cargoId:cargoMap.get(item.cargoId)},existing=result.placements.find(record=>record.id===candidate.id),identical=existingCopy(originalPlacements,usedPlacements,candidate);
    if(identical){usedPlacements.add(identical.id);continue;}
    result.placements.push({...candidate,id:existing?freshId('placement',result.placements,reservedPlacements):candidate.id});
  }
  for(const item of incoming.notes){
    const existing=result.notes.find(record=>record.id===item.id),identical=existingCopy(originalNotes,usedNotes,item);
    if(identical){usedNotes.add(identical.id);continue;}
    result.notes.push({...item,id:existing?freshId('note',result.notes,reservedNotes):item.id});
  }
  for(const id of cityIds){
    if(!Object.hasOwn(result.visits,id)&&!Object.hasOwn(incoming.visits,id))continue;
    result.visits[id]=Math.max(result.visits[id]??0,incoming.visits[id]??0);
    const date=incoming.lastVisits[id];if(date&&(!result.lastVisits[id]||date>result.lastVisits[id]))result.lastVisits[id]=date;
  }
  return validateCityNetwork(result);
}
export const exportCollection=exportTravelPack;
export const importCollection=importTravelPack;
