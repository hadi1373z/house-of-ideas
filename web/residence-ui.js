import {clone, validateHouse, defaultIdeaAction, sharedEdge} from './model.js';
import {PAINTINGS, paintingWork, floorOf, floorLabel, roomBrightness, createResidence, setResidenceFloors, configureRoom} from './residence-data.js';

const functions = {read:'Read the saved note',question:'Examine its claim and a counterexample',experiment:'Plan a prediction and an observable test',reflect:'Reflect on what changed'};
const featureFunctions = {discussion_circle:'Take two perspectives in turn',question_board:'Clarify a claim and an open question',reflection_lamp:'Pause and record what changed your mind',experiment_table:'Test a prediction and compare the result'};

// Saved text is always textContent/value. Browsing a preserved home never saves it.
export function initResidenceUI({$, document, window, scene, getHouse, getNeighborhood, getSelected, selectRoom, saveHouse, buildResidence, visitHome, reload, isReadOnly = () => false, isLoaded = () => true, isSaving = () => false, meetSocrates, openIdea, inspectObject, interact}) {
 const drafts = new Map(), mapDrafts = new Map();
 let editingRoom = null, boundDraft = null, busy = false, entryKey = null, dismissedEntry = null, reloadNeeded = false, mapReloadNeeded=false, mode='home', mapLevel=0, mapRoomId=null, mapBoundKey=null;
 const node = (tag, text, id) => {const element=document.createElement(tag);if(text!==undefined&&text!==null)element.textContent=text;if(id)element.id=id;return element;};
 const button = (text,id,action) => {const element=node('button',text,id);element.type='button';if(action)element.onclick=action;return element;};
 const label = (text,input) => {const wrap=node('label',text);wrap.append(input);return wrap;};
 const option = (text,value) => {const item=node('option',text);item.value=String(value);return item;};
 const homeKey = () => getNeighborhood()?.activeId || 'current';
 const draftKey = roomId => homeKey()+'|'+roomId;
 const canEdit = () => isLoaded()&&!isReadOnly()&&!busy&&!isSaving();
 const focus = () => document.querySelector?.('#scene canvas')?.focus?.();
 const status = node('p',null,'residence-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const dialog=node('dialog',null,'residence-dialog');dialog.className='residence-dialog';dialog.setAttribute('aria-label','Your home and room guide');
 const heading=node('h2'),head=node('div');head.className='dialog-head';head.append(heading,button('Close','residence-close',close));dialog.append(head);
 const guideIntro=node('p','Socrates lives in your own home. The artists live in their gallery houses in Artists’ City. Use this guide to enter a home, find a room and see what its objects do.','residence-guide-intro');dialog.append(guideIntro);
 const actions=node('div',null,'residence-guide-actions');actions.className='residence-actions';
 const meet=button('Meet Socrates','residence-meet',async()=>{close();try{await meetSocrates?.();}catch(error){status.textContent=error.message;open();}});
 const build=button('Build a home with paintings and upper floors','residence-build',()=>saveNewResidence());build.className='primary';actions.append(meet,build);dialog.append(actions,status);
 const tabs=node('nav');tabs.className='residence-tabs';tabs.setAttribute('aria-label','Home guide');const homeTab=button('Your homes','residence-home-tab',()=>{rememberMap();mode='home';render();}),mapTab=button('Map & ideas','residence-map-tab',()=>openMap());tabs.append(homeTab,mapTab);dialog.append(tabs);
 const directory=node('section',null,'residence-directory');
 const homesLabel=node('h3','Your neighbouring homes'),homes=node('div',null,'residence-home-list');homes.className='residence-home-list';directory.append(homesLabel,homes);
 const roomsLabel=node('h3','Find a room'),floors=node('div',null,'residence-floor-list');floors.className='residence-floor-list';directory.append(roomsLabel,floors);
 const roomList=node('div',null,'residence-room-list');roomList.className='residence-room-list';directory.append(roomList);dialog.append(directory);
 const mapSection=node('section',null,'residence-map-section');mapSection.className='residence-map-section';mapSection.hidden=true;mapSection.append(node('p','Choose a floor and a room to see its purpose, ideas and objects. Move an idea by choosing another room in the list; build the assignments in a new house when you are ready.'));
 const mapFloor=node('select',null,'residence-map-floor');mapSection.append(label('Floor on the map',mapFloor));const mapLayout=node('div');mapLayout.className='residence-map-layout';
 const mapPaper=node('div');mapPaper.className='residence-map-paper';const mapSvg=document.createElementNS?.('http://www.w3.org/2000/svg','svg')||node('svg');mapSvg.id='residence-map';mapSvg.setAttribute('viewBox','-0.5 -0.5 21 17');mapSvg.setAttribute('role','group');mapSvg.setAttribute('aria-label','Rooms, idea objects, paintings and stairs in your home');mapPaper.append(mapSvg,node('p','● Idea object  ◇ Furnishing or design  ▣ Painting  ↟ Stairs · Select a symbol for its description.'));
 const mapDetail=node('section',null,'residence-map-room');mapLayout.append(mapPaper,mapDetail);mapSection.append(mapLayout,node('h3','Ideas and their places'));
 const mapIdeas=node('div',null,'residence-map-ideas');mapIdeas.className='residence-map-ideas';mapSection.append(mapIdeas);
 const mapStatus=node('p',null,'residence-map-status');mapStatus.setAttribute('role','status');mapStatus.setAttribute('aria-live','polite');
 const mapBuild=button('Build assignments in a new house','residence-map-build',saveMapAssignments);mapBuild.className='primary';const mapReload=button('Reload saved house','residence-map-reload',async()=>{if(busy||isSaving()||typeof reload!=='function')return;rememberMap();const destinations=mapDrafts.get(homeKey())||{};busy=true;render();try{if(await reload()===false)throw Error('The saved house could not be reloaded.');mapBoundKey=null;mapDrafts.set(homeKey(),destinations);mapReloadNeeded=false;mapStatus.textContent='Saved house reloaded. Your idea destinations are kept; review them before building.';}catch(error){mapReloadNeeded=true;mapStatus.textContent=error.message+' Your idea destinations are kept.';}finally{busy=false;render();}});mapReload.hidden=true;const mapActions=node('div');mapActions.className='residence-actions';mapActions.append(mapReload,mapBuild);mapSection.append(mapStatus,mapActions);dialog.append(mapSection);document.body.append(dialog);
 const mapAssignmentInputs=new Map();

 const editor=node('dialog',null,'residence-room-dialog');editor.className='residence-dialog residence-room-dialog';editor.setAttribute('aria-label','Assign a room and its objects');
 const editorHeading=node('h2'),editorHead=node('div');editorHead.className='dialog-head';editorHead.append(editorHeading,button('Close','residence-room-close',closeEditor));editor.append(editorHead,node('p','Build these changes in a new house next door. Earlier rooms, ideas and journal records stay available in their previous home.'));
 const form=node('form',null,'residence-room-form'),fields={};
 const name=node('input',null,'residence-room-name');name.maxLength=60;name.required=true;fields.name=name;form.append(label('Room name',name));
 const purpose=node('textarea',null,'residence-room-purpose');purpose.maxLength=400;purpose.rows=3;fields.purpose=purpose;form.append(label('Room purpose or idea',purpose));
 const grid=node('div');grid.className='residence-field-grid';
 const count=node('select',null,'residence-house-floors');for(let n=1;n<=3;n++)count.append(option(n+' '+(n===1?'floor':'floors'),n));fields.floors=count;grid.append(label('Floors in this home',count));
 const floor=node('select',null,'residence-room-floor');fields.floor=floor;grid.append(label('Room floor',floor));
 const color=node('input',null,'residence-room-color');color.type='color';fields.color=color;grid.append(label('Room color',color));
 const brightness=node('input',null,'residence-room-brightness');brightness.type='range';brightness.min='0';brightness.max='100';brightness.step='1';fields.brightness=brightness;
 const brightnessOutput=node('output',null,'residence-room-brightness-value');brightnessOutput.setAttribute('for','residence-room-brightness');const brightnessLabel=label('Room brightness',brightness);brightnessLabel.append(brightnessOutput);grid.append(brightnessLabel);form.append(grid);
 const entryText=node('textarea',null,'residence-room-entry');entryText.maxLength=1000;entryText.rows=3;fields.entryText=entryText;form.append(label('Writing shown when you enter this room',entryText));
 const paintingSet=node('fieldset'),paintingLegend=node('legend','Paintings on the walls · choose up to three');paintingSet.append(paintingLegend);
 const paintingList=node('div',null,'residence-painting-options');paintingList.className='residence-painting-options';const paintingInputs=new Map();
 for(const work of PAINTINGS){const choice=node('label'),input=node('input',null,'residence-painting-'+work.id);input.type='checkbox';input.value=work.id;paintingInputs.set(work.id,input);const image=node('img');image.src=work.imageUrl;image.alt=work.alt||work.title;image.loading='lazy';const caption=node('span',work.title+' · '+work.artistName);choice.append(input,image,caption);paintingList.append(choice);input.onchange=()=>{remember();};}
 paintingSet.append(node('p','These attributed images are included locally for offline viewing.'),paintingList);form.append(paintingSet);
 const assignments=node('details'),assignmentSummary=node('summary','Assign ideas to rooms'),assignmentList=node('div',null,'residence-idea-assignments');assignmentList.className='residence-idea-assignments';assignments.append(assignmentSummary,node('p','Choose a destination for each idea. Every note stays attached to its object. Each room can hold twelve ideas.'),assignmentList);form.append(assignments);
 const assignmentInputs=new Map();
 const editorStatus=node('p',null,'residence-room-status');editorStatus.setAttribute('role','status');editorStatus.setAttribute('aria-live','polite');form.append(editorStatus);
 const save=button('Build this room in a new home','residence-room-save');save.type='submit';save.className='primary';
 const reloadButton=button('Reload saved house','residence-room-reload',async()=>{
  if(busy||isSaving()||typeof reload!=='function')return;remember();const retained=draft(),roomId=editingRoom;busy=true;render();
  try{if(await reload()===false)throw Error('The saved house could not be reloaded.');if(roomId===editingRoom){boundDraft=draftKey(roomId);drafts.set(boundDraft,retained);const room=getHouse().rooms.find(item=>item.id===roomId);if(room)showDraft(room);reloadNeeded=false;editorStatus.textContent='Saved house reloaded. Your exact room draft is kept; review it before building.';}}
  catch(error){reloadNeeded=true;editorStatus.textContent=error.message+' Your room draft is kept.';}
  finally{busy=false;render();}
 });reloadButton.hidden=true;const editorActions=node('div');editorActions.className='residence-actions';editorActions.append(reloadButton,save);form.append(editorActions);editor.append(form);document.body.append(editor);

 const paintingDialog=node('dialog',null,'residence-painting-dialog');paintingDialog.className='residence-dialog residence-painting-dialog';paintingDialog.setAttribute('aria-label','Painting in your home');
 const paintingHeading=node('h2'),paintingHead=node('div');paintingHead.className='dialog-head';paintingHead.append(paintingHeading,button('Close','residence-painting-close',closePainting));paintingDialog.append(paintingHead);
 const paintingImage=node('img',null,'residence-painting-image'),paintingCaption=node('p',null,'residence-painting-caption'),paintingDescription=node('p',null,'residence-painting-description'),paintingPractice=node('blockquote',null,'residence-painting-practice'),paintingCredit=node('p',null,'residence-painting-credit');
 const paintingSource=node('a','Artwork source ↗','residence-painting-source'),paintingRights=node('a','Image record and reuse details ↗','residence-painting-rights');for(const link of [paintingSource,paintingRights]){link.target='_blank';link.rel='noopener noreferrer';}
 paintingDialog.append(paintingImage,paintingCaption,paintingDescription,paintingPractice,paintingCredit,paintingSource,paintingRights);document.body.append(paintingDialog);
 const entry=node('section',null,'residence-entry-writing');entry.className='residence-entry-writing';entry.hidden=true;entry.setAttribute('aria-label','Writing at this place');
 const entryTitle=node('strong',null,'residence-entry-title'),entryBody=node('p',null,'residence-entry-text'),entryClose=button('Dismiss','residence-entry-dismiss',dismissEntry);entry.append(entryTitle,entryBody,entryClose);document.body.append(entry);
 const openButton=$?.('residence-open');if(openButton)openButton.onclick=open;const mapOpenButton=$?.('residence-map-open');if(mapOpenButton)mapOpenButton.onclick=openMap;
 document.body.classList?.add?.('residence-navigation');

 function close(){rememberMap();dialog.close();focus();}dialog.addEventListener?.('cancel',rememberMap);dialog.addEventListener?.('close',rememberMap);
 function closePainting(){paintingDialog.close();focus();}
 function dismissEntry(){dismissedEntry=entryKey;entry.hidden=true;focus();}
 function rememberMap(){if(mapBoundKey)mapDrafts.set(mapBoundKey,Object.fromEntries([...mapAssignmentInputs].map(([id,input])=>[id,input.value])));}
 mapFloor.onchange=()=>{rememberMap();mapLevel=Number(mapFloor.value);mapRoomId=getHouse().rooms.find(room=>floorOf(room)===mapLevel)?.id||null;renderMap();};
 function chooseMapRoom(id){rememberMap();mapRoomId=id;mapLevel=floorOf(getHouse().rooms.find(room=>room.id===id));renderMap();}
 function svg(tag,attributes={}){const element=document.createElementNS?.('http://www.w3.org/2000/svg',tag)||node(tag);for(const[key,value]of Object.entries(attributes))element.setAttribute(key,String(value));return element;}
 function mapAction(element,callback){element.onclick=callback;element.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();callback();}};element.setAttribute('tabindex','0');element.setAttribute('role','button');return element;}
 function renderMap(){
  const house=getHouse(),key=homeKey(),levels=house.residence?.floors||1;if(mapBoundKey!==key){rememberMap();mapBoundKey=key;mapAssignmentInputs.clear();mapRoomId=house.rooms.find(room=>room.id===getSelected?.())?.id||house.rooms[0].id;mapLevel=floorOf(house.rooms.find(room=>room.id===mapRoomId));}
  mapLevel=Math.min(Math.max(0,mapLevel),levels-1);if(!house.rooms.some(room=>room.id===mapRoomId&&floorOf(room)===mapLevel))mapRoomId=house.rooms.find(room=>floorOf(room)===mapLevel)?.id||null;
  mapFloor.replaceChildren(...Array.from({length:levels},(_,level)=>option(floorLabel(level),level)));mapFloor.value=String(mapLevel);mapSvg.replaceChildren();
  const grid=svg('g',{stroke:'#cfcabb','stroke-width':'.025'});for(let x=0;x<=20;x++)grid.append(svg('line',{x1:x,x2:x,y1:0,y2:16}));for(let y=0;y<=16;y++)grid.append(svg('line',{x1:0,x2:20,y1:y,y2:y}));mapSvg.append(grid);
  for(const room of house.rooms.filter(room=>floorOf(room)===mapLevel)){
   const group=svg('g',{'aria-label':room.name+' · '+floorLabel(mapLevel)});mapAction(group,()=>chooseMapRoom(room.id));const rect=svg('rect',{x:room.x+.07,y:room.y+.07,width:room.w-.14,height:room.h-.14,fill:room.color,'fill-opacity':room.id===mapRoomId?'.32':'.14',stroke:room.id===mapRoomId?'#243f35':room.color,'stroke-width':'.1',rx:'.08'});
   const text=svg('text',{x:room.x+room.w/2,y:room.y+.75,'text-anchor':'middle','font-size':'.43',fill:'#293e35'});text.textContent=room.name;group.append(rect,text);mapSvg.append(group);
   const roomIdeas=house.ideas.filter(idea=>idea.roomId===room.id);let index=0;for(const idea of roomIdeas){const x=room.x+.4+(index%4)*(room.w-.8)/4,y=room.y+1.3+Math.floor(index++/4)*Math.max(.2,(room.h-1.9)/Math.max(1,Math.ceil(roomIdeas.length/4)));const mark=svg('g',{'aria-label':idea.title+' · '+functions[idea.action||defaultIdeaAction(idea.cue)]});mark.append(svg('circle',{cx:x,cy:y,r:'.16',fill:'#415f76'}));if(room.w>=5){const caption=svg('text',{x:x+.25,y:y+.12,'font-size':'.25',fill:'#334a43'});caption.textContent=idea.title.length>13?idea.title.slice(0,12)+'…':idea.title;mark.append(caption);}mapAction(mark,()=>{chooseMapRoom(room.id);mapStatus.textContent=idea.title+'\n'+idea.text+'\n'+functions[idea.action||defaultIdeaAction(idea.cue)];});mapSvg.append(mark);}
   for(const [index,id]of (room.paintings||[]).entries()){const work=paintingWork(id);if(!work)continue;const mark=svg('text',{x:room.x+.55+index*.6,y:room.y+room.h-.5,'font-size':'.45',fill:'#86583d','aria-label':work.title+' by '+work.artistName});mark.textContent='▣';mapAction(mark,()=>inspectPainting(id,room.id));mapSvg.append(mark);}
   const objects=[...(house.resident?.roomFeatures||[]).filter(item=>item.roomId===room.id).map(item=>({label:item.type.replaceAll('_',' '),description:featureFunctions[item.type]})),...(house.designObjects||[]).filter(item=>item.placement==='room'&&item.roomId===room.id).map(item=>({label:item.title,description:item.note+'\n'+functions[item.action]})),...(scene?.roomInventory?.(room.id)||[]).filter(item=>item?.homeAction&&!item.ideaId&&!item.workId&&!item.featureId&&!item.designId&&item.homeAction!=='painting').map(item=>({label:item.label,description:item.function||({read:'Read a selectable book',journal:'Write an idea or reflection',light:'Toggle the room lamp',sit:'Sit and look around',tea:'Pause for tea',rest:'Rest and reconsider'}[item.homeAction]||'Explore this room object')}))];
   for(const[index,object]of objects.entries()){const mark=svg('text',{x:room.x+.5+index*Math.max(.2,(room.w-1)/Math.max(1,objects.length)),y:room.y+room.h-1.05,'font-size':'.38',fill:'#426854','aria-label':object.label+' · '+object.description});mark.textContent='◇';mapAction(mark,()=>{chooseMapRoom(room.id);mapStatus.textContent=object.label+'\n'+object.description;});mapSvg.append(mark);}
  }
  for(const door of house.doors){const a=house.rooms.find(room=>room.id===door.a),b=house.rooms.find(room=>room.id===door.b);if(floorOf(a)!==mapLevel)continue;const edge=sharedEdge(a,b);if(!edge)continue;const center=(edge.lo+edge.hi)/2;mapSvg.append(svg('line',{x1:edge.axis==='x'?center-.55:edge.fixed,x2:edge.axis==='x'?center+.55:edge.fixed,y1:edge.axis==='z'?center-.55:edge.fixed,y2:edge.axis==='z'?center+.55:edge.fixed,stroke:'#f8f2e6','stroke-width':'.28'}));}
  for(const stair of house.stairs||[]){const a=house.rooms.find(room=>room.id===stair.a),b=house.rooms.find(room=>room.id===stair.b),room=floorOf(a)===mapLevel?a:floorOf(b)===mapLevel?b:null,other=room===a?b:a;if(!room)continue;const text=svg('text',{x:room.x+room.w-.55,y:room.y+room.h-.5,'font-size':'.6',fill:'#534276','aria-label':'Stairs to '+floorLabel(floorOf(other))});text.textContent='↟';mapAction(text,()=>{mapLevel=floorOf(other);chooseMapRoom(other.id);});mapSvg.append(text);}
  const room=house.rooms.find(room=>room.id===mapRoomId);mapDetail.replaceChildren();if(room){const title=node('h3',room.name),description=node('p',room.purpose||'This room is waiting for a purpose.'),tools=node('div');tools.className='residence-actions';const edit=button('Assign room & objects','residence-map-edit-room',()=>openRoomEditor(room.id));edit.disabled=!canEdit();tools.append(button('Go to this room','residence-map-go-room',()=>goRoom(room.id)),edit);const list=node('ul');list.className='residence-inventory';for(const object of inventory(room)){if(object.tagName?.toLowerCase()==='li')list.append(object);else{const item=node('li');item.append(object);list.append(item);}}mapDetail.append(title,node('small',floorLabel(floorOf(room))),description,tools,node('h4','Objects and activities'),list);if(room.entryText)mapDetail.append(node('p','Entry writing: '+room.entryText));}
  const values=mapDrafts.get(key)||{};mapAssignmentInputs.clear();mapIdeas.replaceChildren(...house.ideas.map(idea=>{const item=node('article'),title=node('h4',idea.title),description=node('p',idea.text||'This object is waiting for a description.'),select=node('select',null,'residence-map-assign-'+idea.id);select.append(...house.rooms.map(room=>option(room.name+' · '+floorLabel(floorOf(room)),room.id)));select.value=values[idea.id]||idea.roomId;select.onchange=rememberMap;select.disabled=!canEdit();mapAssignmentInputs.set(idea.id,select);item.append(title,node('small',idea.cue+' · '+functions[idea.action||defaultIdeaAction(idea.cue)]),description,label('Room for this idea',select),button('Show its current place',null,()=>chooseMapRoom(idea.roomId)));return item;}));if(!house.ideas.length)mapIdeas.append(node('p','No saved ideas yet. Go to a room and add a thought or question to give it a physical object.'));mapBuild.disabled=!canEdit()||!house.ideas.length;mapFloor.disabled=busy||isSaving();mapReload.hidden=!mapReloadNeeded||typeof reload!=='function';mapReload.disabled=busy||isSaving();
 }
 async function saveMapAssignments(){if(!canEdit())return;rememberMap();const key=homeKey(),destinations=mapDrafts.get(key)||{};busy=true;mapStatus.textContent='Building these idea assignments in a new house…';render();try{let next=getHouse().residence?clone(getHouse()):createResidence(getHouse(),{floors:1});next.ideas=next.ideas.map(idea=>({...idea,roomId:destinations[idea.id]||idea.roomId}));next=validateHouse(next);await buildResidence(next);mapDrafts.delete(key);mapBoundKey=null;mapReloadNeeded=false;mapStatus.textContent='Your ideas have their assigned rooms in a new house. Every earlier home and note remains available.';}catch(error){mapReloadNeeded=true;mapStatus.textContent=error.message+' Your idea destinations are kept for retry.';}finally{busy=false;render();}}
 function draft(){return {...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value])),paintings:[...paintingInputs].filter(([,input])=>input.checked).map(([id])=>id),assignments:Object.fromEntries([...assignmentInputs].map(([id,input])=>[id,input.value]))};}
 function remember(){if(boundDraft)drafts.set(boundDraft,draft());}
 function closeEditor(){remember();editor.close();focus();}
 editor.addEventListener?.('close',remember);editor.addEventListener?.('cancel',remember);
 function fillFloors(){const current=Number(fields.floor.value)||0;floor.replaceChildren(...Array.from({length:Number(fields.floors.value)||1},(_,n)=>option(floorLabel(n),n)));floor.value=String(Math.min(current,Number(fields.floors.value)-1));}
 for(const [key,input] of Object.entries(fields)){input.oninput=()=>{if(key==='brightness')brightnessOutput.textContent=input.value+'%';remember();};input.onchange=()=>{if(key==='floors')fillFloors();if(key==='brightness')brightnessOutput.textContent=input.value+'%';remember();};}
 function showDraft(room){
  boundDraft=draftKey(room.id);const values=drafts.get(boundDraft)||{name:room.name,purpose:room.purpose,color:room.color,floors:getHouse().residence?.floors||1,floor:floorOf(room),brightness:roomBrightness(room),entryText:room.entryText||'',paintings:room.paintings||[],assignments:Object.fromEntries(getHouse().ideas.map(idea=>[idea.id,idea.roomId]))};
  for(const [key,input] of Object.entries(fields))input.value=String(values[key]);fillFloors();fields.floor.value=String(values.floor);brightnessOutput.textContent=fields.brightness.value+'%';
  for(const [id,input] of paintingInputs)input.checked=values.paintings.includes(id);
  assignmentInputs.clear();assignmentList.replaceChildren(...getHouse().ideas.map(idea=>{const select=node('select',null,'residence-assign-'+idea.id);select.append(...getHouse().rooms.map(room=>option(room.name+' · '+floorLabel(floorOf(room)),room.id)));select.value=values.assignments[idea.id]||idea.roomId;select.onchange=remember;assignmentInputs.set(idea.id,select);const wrap=label(idea.title,select);wrap.append(node('small',idea.cue+' · '+functions[idea.action||defaultIdeaAction(idea.cue)]));return wrap;}));
 }
 function openRoomEditor(id=getSelected?.()){
  if(!canEdit())return;const room=getHouse().rooms.find(item=>item.id===id);if(!room)return;
  remember();editingRoom=id;editorHeading.textContent='Make '+room.name+' your own';editorStatus.textContent='';showDraft(room);close();if(!editor.open)editor.showModal();render();
 }
 async function saveNewResidence(){
  if(!isLoaded()||busy||isSaving())return;busy=true;status.textContent='Building a new neighbouring home…';render();
  try{const next=createResidence(getHouse(),{floors:Math.max(2,getHouse().residence?.floors||1)});if(typeof buildResidence!=='function')throw Error('New-home building is unavailable.');await buildResidence(next);status.textContent='Your new home is ready. Choose a room below to enter; paintings and upper floors are included.';}
  catch(error){status.textContent=error.message;}finally{busy=false;render();}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(!canEdit()||!editingRoom)return;remember();const values=draft(),roomId=editingRoom,key=boundDraft,sourceKey=homeKey();busy=true;editorStatus.textContent='Building your changed room in a new neighbouring home…';render();
  try{
   let next=clone(getHouse());next.ideas=next.ideas.map(idea=>({...idea,roomId:values.assignments[idea.id]||idea.roomId}));next=setResidenceFloors(next,Number(values.floors));
   next=configureRoom(next,roomId,{name:values.name,purpose:values.purpose,color:values.color,floor:Number(values.floor),brightness:Number(values.brightness),entryText:values.entryText,paintings:values.paintings});next=validateHouse(next);
   if(!getHouse().residence){if(typeof buildResidence!=='function')throw Error('New-home building is unavailable.');await buildResidence(next);}else await saveHouse(next);
   if(boundDraft===key&&(sourceKey===homeKey()||getHouse().rooms.some(room=>room.id===roomId))){drafts.delete(key);editingRoom=null;boundDraft=null;reloadNeeded=false;editor.close();status.textContent='A new house edition keeps your room changes. The previous house stays in the neighbourhood.';open();}
  }catch(error){reloadNeeded=true;if(boundDraft===key)editorStatus.textContent=error.message+' Your room settings, writing, paintings and idea destinations are kept for retry.';}
  finally{busy=false;render();}
 };
 function goRoom(id){close();scene?.focusRoom?.(id);selectRoom?.(id,!scene?.focusRoom);focus();updateEntry();}
 function inventory(room){
  const entries=[];
  for(const idea of getHouse().ideas.filter(item=>item.roomId===room.id))entries.push(button(idea.title+' · '+idea.cue+' · '+functions[idea.action||defaultIdeaAction(idea.cue)],null,()=>{close();goRoom(room.id);openIdea?.(idea.id);}));
  for(const id of room.paintings||[]){const work=paintingWork(id);if(work)entries.push(button(work.title+' · '+work.artistName+' · Look, compare and question',null,()=>inspectPainting(id,room.id)));}
  for(const feature of getHouse().resident?.roomFeatures?.filter(item=>item.roomId===room.id)||[])entries.push(node('li',feature.type.replaceAll('_',' ')+' · '+featureFunctions[feature.type]));
  for(const object of getHouse().designObjects?.filter(item=>item.placement==='room'&&item.roomId===room.id)||[])entries.push(button(object.title+' · '+functions[object.action],null,()=>{close();goRoom(room.id);inspectObject?.(object.id);}));
  for(const item of scene?.roomInventory?.(room.id)||[]){
   if(item?.ideaId||item?.workId||item?.featureId||item?.designId||item?.homeAction==='painting')continue;
   const text=typeof item==='string'?item:(item.label||item.kind||'Room object')+(item.function?' · '+item.function:'');
   if(item?.homeAction&&interact)entries.push(button(text,null,()=>{goRoom(room.id);interact(item);}));else entries.push(node('li',text));
  }
  return entries;
 }
 function render(){
  const house=getHouse(),n=getNeighborhood(),active=n?.homes.find(home=>home.id===n.activeId);heading.textContent='Your home · Socrates'+(active?' · '+active.title:'');
  build.disabled=!isLoaded()||busy||isSaving();build.hidden=false;build.textContent=house.residence?'Build a new home from this edition':'Build a home with paintings and upper floors';meet.disabled=!isLoaded()||busy||isSaving();
  homes.replaceChildren(...(n?.homes||[]).map((home,index)=>{const item=node('article'),title=node('strong',String(index+1)+'. '+home.title),text=node('small',home.id===n.activeId?'You are here':home.id===n.homes.at(-1).id?'Latest home':'Preserved earlier home'),visit=button(home.id===n.activeId?'Enter this home':'Visit this home',null,async()=>{close();await visitHome?.(home.id);const first=getHouse().rooms.find(room=>floorOf(room)===0)||getHouse().rooms[0];goRoom(first.id);});item.append(title,text,visit);return item;}));homesLabel.hidden=!n;
  const floorCount=house.residence?.floors||1;
  floors.replaceChildren(...Array.from({length:floorCount},(_,level)=>button(floorLabel(level),'residence-go-floor-'+level,()=>{close();scene?.setFloor?.(level);const state=scene?.playerState?.();if(state?.roomId)selectRoom?.(state.roomId,false);updateEntry();})));
  roomList.replaceChildren(...house.rooms.map(room=>{
   const item=node('article'),title=node('h4',room.name),position=node('small',floorLabel(floorOf(room))+' · '+(house.residence?roomBrightness(room)+'% brightness':'original lighting')),purpose=node('p',room.purpose||'Choose a purpose for this room.'),controls=node('div');controls.className='residence-actions';
   controls.append(button('Go there','residence-go-'+room.id,()=>goRoom(room.id)));const edit=button('Assign room & objects','residence-edit-'+room.id,()=>openRoomEditor(room.id));edit.disabled=!canEdit();controls.append(edit);
   const objects=inventory(room),details=node('details'),summary=node('summary',objects.length+' objects and activities'),list=node('ul');list.className='residence-inventory';list.append(...objects.map(object=>{if(object.tagName?.toLowerCase()==='li')return object;const item=node('li');item.append(object);return item;}));details.append(summary,list);if(!objects.length)list.append(node('li','No saved objects yet. Give an idea, painting or learning exercise a place.'));
   item.append(title,position,purpose,controls,details);if(room.entryText)item.append(node('p','Entry writing: '+room.entryText));roomList.append(item);return item;
  }));
  for(const input of [...Object.values(fields),...paintingInputs.values(),...assignmentInputs.values()])input.disabled=!canEdit();save.disabled=!canEdit();reloadButton.hidden=!reloadNeeded||typeof reload!=='function';reloadButton.disabled=busy||isSaving();
  directory.hidden=mode!=='home';guideIntro.hidden=actions.hidden=status.hidden=mode!=='home';mapSection.hidden=mode!=='map';homeTab.setAttribute('aria-current',String(mode==='home'));mapTab.setAttribute('aria-current',String(mode==='map'));if(mode==='map')renderMap();
  if(openButton)openButton.disabled=!isLoaded();if(mapOpenButton)mapOpenButton.disabled=!isLoaded();
 }
 function open(){rememberMap();mode='home';render();if(!dialog.open)dialog.showModal();}
 function openMap(){rememberMap();mode='map';render();if(!dialog.open)dialog.showModal();}
 function inspectPainting(id,roomId){const work=paintingWork(id);if(!work)return;close();if(roomId)selectRoom?.(roomId,false);paintingHeading.textContent=work.title;paintingImage.src=work.imageUrl;paintingImage.alt=work.alt||work.title;paintingCaption.textContent=work.artistName+(work.date?' · '+work.date:'')+(work.medium?' · '+work.medium:'');paintingDescription.textContent=work.description;paintingPractice.textContent='Look for three details before deciding what this painting means. What does each detail support? Find one that challenges your first interpretation, then discuss it with Socrates.';paintingCredit.textContent=(work.citation||'')+'\n'+(work.rights||'');paintingSource.href=work.sourceUrl;paintingRights.href=work.rightsUrl||work.sourceUrl;if(!paintingDialog.open)paintingDialog.showModal();}
 function updateEntry(){const state=scene?.playerState?.(),home=getHouse();if(!state||state.outside||state.neighborhood||state.designTour||state.artistCity||state.cityId&&state.cityId!=='home'){entryKey=null;dismissedEntry=null;entry.hidden=true;return;}const room=home.rooms.find(item=>item.id===state.roomId);if(!room){entryKey=null;entry.hidden=true;return;}const next=homeKey()+'|'+room.id+'|'+floorOf(room);if(entryKey!==next){entryKey=next;dismissedEntry=null;entryTitle.textContent=room.name+' · '+floorLabel(floorOf(room));entryBody.textContent=room.entryText||'';}entry.hidden=!room.entryText||dismissedEntry===entryKey;}
 const timer=window.setInterval?.(updateEntry,200);window.addEventListener?.('pagehide',()=>window.clearInterval?.(timer),{once:true});
 render();updateEntry();return {open,openMap,render,openRoomEditor,inspectPainting,updateEntry,close,closeEditor,closePainting,dismissEntry,goRoom};
}
