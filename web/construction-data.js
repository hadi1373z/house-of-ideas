import {clone,validateHouse,sharedEdge} from './model.js';
import {createResidence,stairLanding,paintingWork} from './residence-data.js';
import {createResident,FEATURES} from './resident.js';

export function constructionDraft(source){return createResidence(source,{floors:source.residence?.floors||1});}
export function connectConstructionRooms(source,aId,bId){
 const next=clone(source),a=next.rooms.find(r=>r.id===aId),b=next.rooms.find(r=>r.id===bId);
 if(!a||!b||a===b)throw Error('Choose two different rooms.');
 const same=link=>[link.a,link.b].includes(aId)&&[link.a,link.b].includes(bId);
 if(sharedEdge(a,b)){if(!next.doors.some(same))next.doors.push({a:aId,b:bId});}
 else if(stairLanding(a,b)){next.stairs??=[];if(!next.stairs.some(same))next.stairs.push({id:'stairs-'+crypto.randomUUID(),a:aId,b:bId});}
 else throw Error('Doors need a shared wall. Stairs need adjacent floors with a shared 2 × 2 landing.');
 return next;
}
export function addConstructionObject(source,roomId,type){
 const next=clone(source),room=next.rooms.find(r=>r.id===roomId);if(!room)throw Error('Choose a room.');
 if(type.startsWith('painting:')){const id=type.slice(9);if(!paintingWork(id))throw Error('Choose a catalogue painting.');room.paintings??=[];if(!room.paintings.includes(id)){if(room.paintings.length>=3)throw Error('A room supports three paintings.');room.paintings.push(id);}}
 else if(FEATURES.includes(type)){next.resident??=createResident();if(!next.resident.roomFeatures.some(f=>f.roomId===roomId&&f.type===type))next.resident.roomFeatures.push({id:'build-'+crypto.randomUUID(),roomId,type,installedAt:new Date().toISOString()});}
 else throw Error('Choose a painting or learning furnishing.');
 return next;
}
export function validateConstruction(source){return validateHouse(source);}
const designState=house=>JSON.stringify([house.rooms,house.doors,house.stairs,house.residence,house.ideas,house.designObjects,house.resident?.roomFeatures]);
export function prepareConstruction(draft,base,current){
 if(designState(base)!==designState(current))throw Error('The saved rooms or objects changed since this draft began. Your draft is kept. Start fresh from the current home before building.');
 const next=clone(current);for(const key of ['rooms','doors','stairs','residence','ideas','designObjects']){if(Object.hasOwn(draft,key))next[key]=clone(draft[key]);else delete next[key];}
 if(draft.resident)next.resident={...clone(current.resident||draft.resident),roomFeatures:clone(draft.resident.roomFeatures)};
 return validateConstruction(next);
}
