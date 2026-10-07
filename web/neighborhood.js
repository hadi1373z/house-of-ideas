import {clone,legacyStarter,starter,validateHouse,defaultIdeaAction} from './model.js';

// Every edition owns a whole independent document. Never discard a home to
// make space: the owner can export the neighborhood before continuing.
export const MAX_HOMES=128;
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
function at(options){
 const date=new Date(options?.now??new Date());
 if(!Number.isFinite(date.valueOf()))throw Error('Use a valid home creation date.');
 return date.toISOString();
}
function snapshot(house){validateHouse(house);return clone(house);}
function title(value,fallback){
 if(value===undefined&&fallback!==undefined)return fallback;
 if(typeof value!=='string'||!value.trim()||value.length>100)throw Error('A home title needs 1–100 characters.');
 return value.trim();
}
export function validateNeighborhood(input){
 if(!input||input.version!==1||!Array.isArray(input.homes)||!input.homes.length||input.homes.length>MAX_HOMES)throw Error(`A neighborhood needs 1–${MAX_HOMES} preserved homes.`);
 const ids=new Set();
 const homes=input.homes.map(home=>{
  if(!home||!validId(home.id)||ids.has(home.id))throw Error('Each home needs a unique identifier.');
  ids.add(home.id);
  if(!['legacy','inhabited'].includes(home.edition))throw Error('Choose a supported house edition.');
  if(typeof home.createdAt!=='string'||home.createdAt.length>40||!Number.isFinite(new Date(home.createdAt).valueOf()))throw Error('Every home needs a valid creation date.');
  return {id:home.id,title:title(home.title),createdAt:new Date(home.createdAt).toISOString(),edition:home.edition,house:snapshot(home.house)};
 });
 if(!ids.has(input.activeId))throw Error('Choose a home in this neighborhood.');
 if(homes.at(-1).edition!=='inhabited')throw Error('The newest home must be an inhabited edition.');
 return {version:1,activeId:input.activeId,homes};
}
export function initialNeighborhood(oldHouse,options={}){
 const old=snapshot(oldHouse??legacyStarter());
 const next=oldHouse===undefined?starter():clone(old);
 if(oldHouse!==undefined){
  const original=legacyStarter(),domestic=starter();
  // Rename exact default metadata in the separate new home. Personal names,
  // layout, notes and complete resident/journal records stay in both copies.
  next.rooms=next.rooms.map(room=>{
   const before=original.rooms.find(item=>item.id===room.id),after=domestic.rooms.find(item=>item.id===room.id);
   return before&&after&&room.name===before.name&&room.purpose===before.purpose?{...room,name:after.name,purpose:after.purpose}:room;
  });
 }
 const createdAt=at(options);
 return validateNeighborhood({version:1,activeId:'home-2',homes:[
  {id:'home-1',title:'Original house',createdAt,edition:'legacy',house:old},
  {id:'home-2',title:'Inhabited home',createdAt,edition:'inhabited',house:next},
 ]});
}
export function selectEdition(input,homeId){
 const result=validateNeighborhood(input);
 if(!result.homes.some(home=>home.id===homeId))throw Error('Choose a home in this neighborhood.');
 result.activeId=homeId;
 return result;
}
export function createEdition(input,house,options={}){
 const result=validateNeighborhood(input);
 if(result.homes.length>=MAX_HOMES)throw Error(`The neighborhood holds ${MAX_HOMES} preserved homes. Export it before creating another edition; no old home was removed.`);
 const source=house??result.homes.find(home=>home.id===result.activeId).house;
 const ids=new Set(result.homes.map(home=>home.id));
 let sequence=result.homes.length+1;
 while(ids.has(`home-${sequence}`))sequence++;
 const id=`home-${sequence}`;
 result.homes.push({id,title:title(options.title,`Home edition ${result.homes.length+1}`),createdAt:at(options),edition:'inhabited',house:snapshot(source)});
 result.activeId=id;
 return result;
}
function appearance(house){
 const rooms=house.rooms.map(({id,name,color,x,y,w,h})=>({id,name,color,x,y,w,h})).sort((a,b)=>a.id.localeCompare(b.id));
 const doors=house.doors.map(({a,b})=>[a,b].sort().join('|')).sort();
 const features=(house.resident?.roomFeatures||[]).map(({id,roomId,type})=>({id,roomId,type})).sort((a,b)=>a.id.localeCompare(b.id));
 const ideas=house.ideas.map(({id,roomId,cue,action})=>({id,roomId,cue,action:action??defaultIdeaAction(cue)})).sort((a,b)=>a.id.localeCompare(b.id));
 return JSON.stringify({rooms,doors,features,ideas});
}
export function saveEdition(input,house,options={}){
 const result=validateNeighborhood(input),latest=result.homes.at(-1);
 if(result.activeId!==latest.id)throw Error('This older home is preserved. Build a new edition next door before changing it.');
 const next=snapshot(house);
 if(appearance(latest.house)!==appearance(next))return createEdition(result,next,options);
 latest.house=next;
 return result;
}
