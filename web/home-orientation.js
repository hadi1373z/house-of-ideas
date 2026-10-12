import {floorLabel,floorOf} from './residence-data.js';

export function homeOrientation(house,state,resident){
 const room=state?.cityId==='home'?house.rooms.find(r=>r.id===state.roomId):null;
 const links=room?[...(house.doors||[]).map(l=>({...l,kind:'Door'})),...(house.stairs||[]).map(l=>({...l,kind:'Stair landing'}))].filter(l=>l.a===room.id||l.b===room.id).map(l=>({kind:l.kind,room:house.rooms.find(r=>r.id===(l.a===room.id?l.b:l.a))})).filter(l=>l.room):[];
 const host=house.rooms.find(r=>r.id===resident?.roomId);
 return {room,links,location:room?room.name+' · '+floorLabel(floorOf(room)):state?.cityId==='home'?'Outside · your current home':state?.cityName||'Your home',host:host?host.name+' · '+floorLabel(floorOf(host)):'Location unavailable'};
}

export function initHomeOrientation({document,window,scene,getHouse,getTitle,visitRoom,returnEntrance,openObjects,meetResident}){
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;};
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const opener=button('You are here · Getting around',show);opener.id='home-orientation-open';document.body.append(opener);
 const dialog=document.createElement('dialog');dialog.id='home-orientation-dialog';dialog.setAttribute('aria-label','Getting around');document.body.append(dialog);
 const head=node('div','');head.className='dialog-head';head.append(node('h2','Make yourself at home'),button('Close',()=>dialog.close()));
 const content=node('section','');dialog.append(head,content);
 let signature='';
 function context(){return homeOrientation(getHouse(),scene?.playerState?.(),scene?.residentState?.());}
 function update(){const c=context(),label=c.location+' · Getting around';if(label!==signature){signature=label;opener.textContent=label;}}
 function show(){const c=context(),house=getHouse();content.replaceChildren(node('small',getTitle?.()||'Your current home'),node('h3',c.location));
  if(c.room){content.append(node('p',c.room.purpose||'Explore the objects in this room.'),node('p',(scene?.roomInventory?.(c.room.id)||[]).length+' usable objects and ideas in this room.'),button('Show this room’s objects',()=>{dialog.close();openObjects(c.room.id);}),node('h4','Connected places'),node('small','Choose a connection to move directly, or walk through its door or stair landing.'));
   for(const link of c.links)content.append(button(link.kind+' → '+link.room.name+' · '+floorLabel(floorOf(link.room)),()=>{dialog.close();visitRoom(link.room.id);}));
   if(!c.links.length)content.append(node('p','Use the world map to choose another room.'));
  }else content.append(node('p','Enter through the front door, or choose a room from World guide. The map lets you move directly to a place without walking.'));
  content.append(node('h4','Find Socrates'),node('p','In your personal home: '+c.host+'. His position can change as he explores.'),button('Meet Socrates in my home',()=>{dialog.close();meetResident();}),button('Return to my front door',()=>{dialog.close();returnEntrance();}),node('h4','Move at your own pace'),node('p','Walk with W A S D or the arrow keys. Drag the view to look around. Press E near an object or resident to interact. Press M for the world map and J for your journal. On touch screens, use the movement joystick and drag the view.'),node('p','For a quieter visit, use World guide → Visit this place to move directly between rooms. Stair landings transfer between floors with E. Close any panel with Escape; opening a panel pauses walking controls. There are no time limits.'),node('p','Your room purposes, brightness and entrance writing are available through World guide → Assign rooms & ideas. Spatial edits create a new neighbouring home.'));
  if(!dialog.open)dialog.showModal();
 }
 update();const timer=window.setInterval(update,700);window.addEventListener('pagehide',()=>window.clearInterval(timer),{once:true});return {show,update};
}
