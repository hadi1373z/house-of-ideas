// The room is the interface. The journal is opened deliberately, never a permanent dashboard.
import {BOOKS,bookById} from './books.js';
export function initHomeUI({$,window,document,scene,getHouse,getSelected,selectRoom,openIdea,reflect,saveReflection,visitHome,getNeighborhood,forkHome,isReadOnly}) {
 let action=null,page=0,activityVersion=0;
 const focus=()=>document.querySelector('#scene canvas')?.focus?.();
 function journal(open){const roomId=scene?.playerState?.().roomId;if(open&&roomId&&roomId!==getSelected())selectRoom(roomId,false);document.body.classList.toggle('journal-open',open);document.body.classList.toggle('rooms-open',open);$('journal-toggle').setAttribute('aria-expanded',String(open));$('journal-toggle').textContent=open?'Close journal · J':'Journal · J';if(!open)focus();}
 $('journal-toggle').onclick=()=>journal(!document.body.classList.contains('journal-open'));
 function closeAction(){action=null;$('home-activity').hidden=true;scene?.stand?.();focus();}
 $('activity-close').onclick=closeAction;
 $('activity-edit').onclick=()=>{if(action?.ideaId&&!isReadOnly())openIdea(action.ideaId);};
 $('activity-save').onclick=async()=>{if(!action||isReadOnly())return;const version=activityVersion,answer=$('activity-answer').value,roomId=action.roomId;try{await saveReflection(roomId,answer);if(version===activityVersion&&answer===$('activity-answer').value){$('activity-feedback').textContent='Your answer is kept in this home’s journal.';$('activity-answer').value='';}}catch(error){if(version===activityVersion)$('activity-feedback').textContent=error.message;}};
 function readBook(){const book=bookById($('activity-book-select').value);$('activity-title').textContent=book.title;$('activity-text').textContent=book.pages[page]+'\n\n'+book.question;$('activity-page').textContent=`Page ${page+1} of ${book.pages.length}`;}
 $('activity-book-select').replaceChildren(...BOOKS.map(book=>{const option=document.createElement('option');option.value=book.id;option.textContent=book.title;return option;}));
 $('activity-book-select').onchange=()=>{activityVersion++;page=0;readBook();};$('activity-next').onclick=()=>{page=(page+1)%bookById($('activity-book-select').value).pages.length;readBook();};
 $('activity-reflect').onclick=()=>{if(action?.roomId)selectRoom(action.roomId,false);closeAction();journal(true);reflect();};
 function interact(data){
  if(!data?.homeAction)return;
  if(data.roomId)selectRoom(data.roomId,false);
  if(data.homeAction==='journal'){journal(true);if(!isReadOnly())openIdea();return;}
  action=data;activityVersion++;page=0;const room=getHouse().rooms.find(r=>r.id===data.roomId);$('activity-answer').value='';$('activity-feedback').textContent='';$('activity-edit').hidden=!data.ideaId||isReadOnly();$('activity-book-picker').hidden=!data.bookId;$('activity-answer-label').hidden=isReadOnly();$('activity-save').hidden=isReadOnly();
  const content={sit:['A moment at home','Sit, look around, and let a thought settle. What would make this room more comfortable to think in?'],read:['An examined life','Socrates begins with a question: what do you mean? Choose one belief, give a concrete example, and look for a case where it might fail.'],tea:['Tea in the kitchen','Take a quiet pause. Which part of your day deserves more attention? You can keep your answer in the journal.'],rest:['A place to rest','Let the house be a place to return to. Look around from the bed; there is no task to finish here.']};
  const [title,text]=content[data.homeAction]||content.sit;
  $('activity-title').textContent=title;$('activity-room').textContent=room?.name||'Home';$('activity-close').textContent=['sit','tea','rest'].includes(data.homeAction)?'Stand up':data.homeAction==='read'?'Close book':'Put object down';$('activity-text').textContent=text;$('activity-reflect').hidden=isReadOnly();$('home-activity').hidden=false;
  if(data.bookId){$('activity-book-select').value=data.bookId;readBook();}
  if(data.anchor&&['sit','tea','rest'].includes(data.homeAction))scene?.seatAt?.({...data,height:data.homeAction==='rest'?.9:1.15});
  focus();
 }
 function inspectIdea(id){const idea=getHouse().ideas.find(i=>i.id===id);if(!idea)return;const kind=idea.action||({book:'read',ring:'question',sphere:'experiment',crystal:'reflect'}[idea.cue]);interact({homeAction:kind,ideaId:id,roomId:idea.roomId});$('activity-title').textContent=idea.title;const instructions={read:'Read your note, then return to it with a new question.',question:'What exactly do you mean? Give a concrete example, then look for a counterexample.',experiment:'Turn this idea into a small test. Write a prediction, an observable result, and what would change your mind.',reflect:'Why does this idea matter to you? What changed since you last considered it?'};$('activity-text').textContent=(idea.text||'This object is waiting for your notes.')+'\n\n'+instructions[kind];}
 function renderNeighborhood(){
  const n=getNeighborhood();if(!n){$('neighborhood-card').hidden=true;return;}
  $('neighborhood-card').hidden=false;$('home-edition').textContent=n.homes.find(h=>h.id===n.activeId)?.title||'Home';
  $('home-history').replaceChildren(...n.homes.map((h,index)=>{const b=document.createElement('button');b.className='home-history-entry';b.textContent=`${index+1}. ${h.title}${h.id===n.activeId?' · you are here':''}`;b.onclick=()=>visitHome(h.id);return b;}));
  $('home-readonly').hidden=!isReadOnly();$('new-home').disabled=!n;
 }
 $('neighborhood-toggle').onclick=()=>{journal(false);closeAction();scene?.showNeighborhood?.();};
 $('new-home').onclick=()=>forkHome();
 window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||document.querySelector('dialog[open]'))return;if(e.key.toLowerCase()==='j'){e.preventDefault();journal(!document.body.classList.contains('journal-open'));}else if(e.key==='Escape'){closeAction();journal(false);}});
 const update=()=>{const state=scene?.playerState?.(),target=scene?.focusedTarget?.();if(state){$('enter-house').hidden=Boolean(state.designTour)||Boolean(state.cityId&&state.cityId!=='home')||Boolean(state.artistCity)||!state.outside||state.entering||state.neighborhood;$('scene-room').textContent=state.cityId==='makers'?(state.cityLocation||state.cityName):state.artistCity?(state.artistName?state.artistName+'’s house'+(state.artistEditionNumber>1?' · Edition '+state.artistEditionNumber:''):'Artists’ City'):state.designTour?'Design tour':state.neighborhood?'Neighbourhood':state.outside?'House of Ideas':getHouse().rooms.find(r=>r.id===state.roomId)?.name||'Home';}let prompt=target?.label?`E · ${target.label}`:scene?.residentState?.().near?'E · Talk with Socrates':'WASD to walk · drag to look · J for journal';$('art-city-return').hidden=!(state?.artistCity||state?.cityId&&state.cityId!=='home');if(state?.cityId==='makers'&&!target?.label)prompt='Makers’ City · enter a hall · E to read, question or experiment';if(state?.artistCity&&!target?.label)prompt='Artists’ City · enter a house · E to meet its artist or inspect art';if(state?.designTour)prompt='Design tour · WASD to walk · Return home when finished';if(state?.entering)prompt=state.cityId&&state.cityId!=='home'?'Walking to the city landmark… · WASD to take control':'Walking home… · WASD to take control';if(state?.seated)prompt='WASD · Stand up';if(state?.neighborhood&&!target?.label)prompt='Walk along the street · E at a door to visit';$('world-prompt').textContent=prompt;};
 const timer=window.setInterval?.(update,200);window.addEventListener('pagehide',()=>window.clearInterval?.(timer),{once:true});update();
 return {journal,interact,inspectIdea,renderNeighborhood,closeAction,notify(text,error=false){$('world-toast').textContent=text;$('world-toast').hidden=!error;},focus};
}
