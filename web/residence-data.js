import {ARTISTS} from './art-city-data.js';
import {starter, validateHouse} from './model.js';

// These are the same attributed, locally packaged works as Artists' City.
// A painting assignment stores only its catalog identifier, never a URL or code.
export const PAINTINGS=Object.freeze(ARTISTS.flatMap(artist=>artist.works.map(work=>Object.freeze({...work,artistId:artist.id,artistName:artist.name}))));
const WORKS=new Map(PAINTINGS.map(work=>[work.id,work]));
const copy=value=>JSON.parse(JSON.stringify(value));
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
export const floorOf=room=>room?.floor??0;
export const roomBrightness=room=>room?.brightness??75;
export const floorLabel=level=>['Ground floor','First floor','Second floor'][level]??'Unknown floor';
export const paintingWork=id=>WORKS.get(id)??null;

export function validateRoomResidence(room){
 const result={};
 if(room.floor!==undefined){if(!Number.isInteger(room.floor)||room.floor<0||room.floor>2)throw Error('Choose a room floor between 0 and 2.');result.floor=room.floor;}
 if(room.brightness!==undefined){if(typeof room.brightness!=='number'||!Number.isFinite(room.brightness)||room.brightness<0||room.brightness>100)throw Error('Room brightness must be between 0 and 100.');result.brightness=room.brightness;}
 if(room.entryText!==undefined){if(typeof room.entryText!=='string'||room.entryText.length>1000)throw Error('Writing on arrival supports up to 1,000 characters.');result.entryText=room.entryText;}
 if(room.paintings!==undefined){
  if(!Array.isArray(room.paintings)||room.paintings.length>3||room.paintings.some(id=>!WORKS.has(id))||new Set(room.paintings).size!==room.paintings.length)throw Error('Choose up to three different paintings from the local collection.');
  result.paintings=[...room.paintings];
 }
 return result;
}

export function stairLanding(a,b){
 if(!a||!b||Math.abs(floorOf(a)-floorOf(b))!==1)return null;
 const minX=Math.max(a.x,b.x),maxX=Math.min(a.x+a.w,b.x+b.w),minY=Math.max(a.y,b.y),maxY=Math.min(a.y+a.h,b.y+b.h);
 if(maxX-minX<2||maxY-minY<2)return null;
 return {x:(minX+maxX)/2,y:(minY+maxY)/2,minX,maxX,minY,maxY};
}

export function validateResidence(input,rooms,doors){
 const result={};
 if(input.residence!==undefined){
  const config=input.residence;
  if(!config||config.version!==1||!Number.isInteger(config.floors)||config.floors<1||config.floors>3)throw Error('A residence supports one to three floors.');
  if(rooms.some(room=>floorOf(room)>=config.floors))throw Error('Move rooms off the upper floor before reducing the floor count.');
  for(let floor=0;floor<config.floors;floor++)if(!rooms.some(room=>floorOf(room)===floor))throw Error('Every floor needs a room and a reachable landing.');
  result.residence={version:1,floors:config.floors};
 }else if(rooms.some(room=>floorOf(room)>0)||input.stairs?.length)throw Error('Configure the residence floor count before adding upstairs rooms.');
 if(input.stairs!==undefined){
  if(!Array.isArray(input.stairs)||input.stairs.length>8)throw Error('A residence supports up to eight stair connections.');
  const ids=new Set(),pairs=new Set();
  result.stairs=input.stairs.map(stair=>{
   if(!stair||!identifier(stair.id)||ids.has(stair.id))throw Error('Each staircase needs a unique identifier.');ids.add(stair.id);
   const a=rooms.find(room=>room.id===stair.a),b=rooms.find(room=>room.id===stair.b);
   if(!a||!b||!stairLanding(a,b))throw Error('Stairs need rooms on adjacent floors sharing at least a 2 × 2 cell landing.');
   const pair=[stair.a,stair.b].sort().join('|');if(pairs.has(pair))throw Error('Those rooms already have a staircase.');pairs.add(pair);
   return {id:stair.id,a:stair.a,b:stair.b};
  });
 }
 if(result.residence){
  const seen=new Set([rooms[0].id]);let changed=true;
  while(changed){changed=false;for(const link of [...doors,...(result.stairs||[])]){if(seen.has(link.a)&&!seen.has(link.b)){seen.add(link.b);changed=true;}if(seen.has(link.b)&&!seen.has(link.a)){seen.add(link.a);changed=true;}}}
  if(seen.size!==rooms.length)throw Error('Connect every room with a door or staircase so it can be visited.');
 }
 return result;
}

export const hasResidenceConfiguration=house=>house.residence!==undefined||house.stairs!==undefined||house.rooms.some(room=>['floor','brightness','entryText','paintings'].some(key=>room[key]!==undefined));

function unusedId(base,items){const ids=new Set(items.map(item=>item.id));let id=base,count=2;while(ids.has(id))id=`${base}-${count++}`;return id;}
function checked(house){validateHouse(house);return house;}

export function setResidenceFloors(source,count){
 if(!Number.isInteger(count)||count<1||count>3)throw Error('Choose one, two or three floors.');
 const next=copy(source);validateHouse(next);
 if(next.rooms.some(room=>floorOf(room)>=count))throw Error('Move rooms off the upper floor before reducing the floor count; their content was kept.');
 next.residence={version:1,floors:count};next.stairs=next.stairs||[];
 for(let level=1;level<count;level++){
  if(next.rooms.some(room=>floorOf(room)===level))continue;
  if(next.rooms.length>=16)throw Error('This home has 16 rooms. Make space before adding another floor; no room was removed.');
  const previous=next.rooms.find(room=>floorOf(room)===level-1&&room.id==='learning')||next.rooms.find(room=>floorOf(room)===level-1);
  if(!previous)throw Error('The floor below needs a room before adding its staircase.');
  const id=unusedId(`residence-floor-${level}`,next.rooms);
  next.rooms.push({id,name:level===1?'Upper gallery':'Quiet writing room',purpose:level===1?'Look closely at paintings, read an idea and discuss what you notice with Socrates.':'A quiet upstairs place to write, reconsider a claim and keep a reflection.',color:level===1?'#a87958':'#627b9a',x:previous.x,y:previous.y,w:previous.w,h:previous.h,floor:level,brightness:level===1?85:65,entryText:level===1?'Welcome upstairs. Choose a painting and describe what you can actually see.':'Pause here. What would make you reconsider your first explanation?',paintings:level===1?['water-lilies']:[]});
  next.stairs.push({id:unusedId(`stairs-${level}`,next.stairs),a:previous.id,b:id});
 }
 return checked(next);
}

export function createResidence(source=starter(),options={}){
 const next=copy(source);validateHouse(next);
 next.rooms=next.rooms.map(room=>({...room,floor:floorOf(room),brightness:roomBrightness(room),entryText:room.entryText??(room.id==='learning'?'Welcome home. Socrates is in the living room; the house guide shows every room and its objects.':''),paintings:room.paintings??[]}));
 const choices=[['questions','water-lilies'],['math','composition-eight'],['art','starry-night']];
 // Catalog IDs are checked, and a custom collection is never replaced.
 for(const [roomId,workId] of choices){const room=next.rooms.find(item=>item.id===roomId);if(room&&!room.paintings.length&&WORKS.has(workId))room.paintings=[workId];}
 const fallback=next.rooms.find(room=>floorOf(room)===0&&!room.paintings.length);
 if(!next.rooms.some(room=>room.paintings.length)&&fallback)fallback.paintings=['water-lilies'];
 return setResidenceFloors(next,options.floors??next.residence?.floors??2);
}

export function configureRoom(source,roomId,changes={}){
 const next=copy(source),room=next.rooms.find(item=>item.id===roomId);
 if(!room)throw Error('Choose a room in this home.');
 const allowed=['name','purpose','color','floor','brightness','entryText','paintings'];
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(key=>!allowed.includes(key)))throw Error('Choose room names, purposes, floors, brightness, writing or paintings.');
 Object.assign(room,copy(changes));return checked(next);
}

export function assignIdeasToRoom(source,roomId,ideaIds){
 const next=copy(source);
 if(!next.rooms.some(room=>room.id===roomId))throw Error('Choose a room in this home.');
 if(!Array.isArray(ideaIds)||new Set(ideaIds).size!==ideaIds.length||ideaIds.some(id=>!next.ideas.some(idea=>idea.id===id)))throw Error('Select existing ideas to assign to this room.');
 const selected=new Set(ideaIds);next.ideas=next.ideas.map(idea=>selected.has(idea.id)?{...idea,roomId}:idea);return checked(next);
}

// A read-only renderer/navigation view. It is never saved in place of the full
// multi-floor document; all conversations, journals and upstairs rooms remain
// in the original source supplied by the coordinator.
export function floorHouse(source,level=0){
 const next=copy(source),rooms=next.rooms.filter(room=>floorOf(room)===level),ids=new Set(rooms.map(room=>room.id));
 next.rooms=rooms;next.doors=next.doors.filter(door=>ids.has(door.a)&&ids.has(door.b));next.ideas=next.ideas.filter(idea=>ids.has(idea.roomId));
 if(next.resident)next.resident.roomFeatures=(next.resident.roomFeatures||[]).filter(feature=>ids.has(feature.roomId));
 if(next.designObjects)next.designObjects=next.designObjects.filter(item=>item.placement==='garden'?level===0:ids.has(item.roomId));
 delete next.residence;delete next.stairs;return next;
}
