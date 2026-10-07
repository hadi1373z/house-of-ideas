import {pragueDate,visitRoom,reflect,reviewDay,pendingReview,decideReview,applyApproved,lesson,critique,validateLearning} from './socrates.js';

export function initLearning({$,document,window,getHouse,getSelected,isLoaded,isSaving,saveHouse,selectRoom,openHouse,scene,preview=false}) {
 let critic=false,tourIndex=0,visitDate=pragueDate(),visits=new Set(),timer=null;
 let reflectionDrafts=new Map(),homeKey='initial';const draftsByHome=new Map();
 const today=()=>pragueDate();
 function includeVisits(candidate) {
  if(visitDate!==today()){visitDate=today();visits=new Set();}
  let next=candidate;
  for(const id of visits)if(next.rooms.some(r=>r.id===id))next=visitRoom(next,today(),id);
  if(next.learning&&!preview)next.learning.enabled=true;
  return next;
 }
 function noteVisit(id) {
  if(!isLoaded())return;
  if(visitDate!==today()){visitDate=today();visits=new Set();}
  visits.add(id);
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>flushVisits().catch(()=>{}),900);
  timer.unref?.();
 }
 async function flushVisits() {
  if(!isLoaded()||isSaving())return;
  const before=getHouse(),next=includeVisits(before);
  if(JSON.stringify(next)!==JSON.stringify(before))await saveHouse(next);
 }
 function hideCritic() {
  critic=false;$('socrates-panel').hidden=true;$('socrates-tab').classList.remove('selected');
  $('room-panel').hidden=false;scene?.setSocrates?.(false);
 }
 function render() {
  const house=getHouse(),room=house.rooms.find(r=>r.id===getSelected())||house.rooms[0];
  const task=lesson(room),guide=critique(room,house);
  $('lesson-title').textContent=task.title;$('lesson-concept').textContent=task.concept;$('lesson-task').textContent=task.exercise;
  $('socrates-room').textContent=room.name;$('socrates-observation').textContent=guide.observation;
  $('socrates-question').textContent=guide.question;$('socrates-exercise').textContent=guide.exercise;
  const day=house.learning?.days?.find(d=>d.date===today());
  $('learning-progress').textContent=(day?.visits.length||0)+' rooms explored · '+(day?.reflections.length||0)+' reflections today';
  const prior=day?.reflections.find(r=>r.roomId===room.id);
  if(document.activeElement!==$('reflection-answer'))$('reflection-answer').value=reflectionDrafts.get(room.id)??prior?.answer??'';
  const pending=pendingReview(house,today());
  $('pending-review-button').hidden=!pending;
  const current=day?.review;
  $('daily-review-state').textContent=current?'Tonight’s suggestion is ready for '+current.forDate+'.': 'Socrates reviews your learning at 9 pm Prague time.';
  if(preview)$('daily-review-state').textContent='Preview only. Enter your saved house for a journal and nightly reviews.';
  if(critic){$('room-panel').hidden=true;$('socrates-panel').hidden=false;}
 }
 function showPending() {
  const review=pendingReview(getHouse(),today());if(!review)return;
  $('review-title').textContent=review.title;$('review-room').textContent=review.roomName+' · For '+review.forDate;
  $('review-reason').textContent=review.reason;$('review-question').textContent=review.question;
  $('review-exercise').textContent=review.exercise;$('review-message').textContent='';
  $('daily-dialog').showModal();
 }
 async function decide(decision) {
  const review=pendingReview(getHouse(),today());if(!review)return;
  $('review-approve').disabled=true;$('review-decline').disabled=true;
  try {
   let next=decideReview(includeVisits(getHouse()),review.id,decision,today());
   if(decision==='approve')next=applyApproved(next,today());
   await saveHouse(next);$('daily-dialog').close();
   const saved=next.learning.days.find(d=>d.review?.id===review.id)?.review;
   $('learning-message').textContent=saved?.status==='applied'?'Approved. A new learning book is waiting in '+review.roomName+'.':saved?.resolution||'Suggestion declined. Your house is unchanged.';
   if(saved?.status==='applied')selectRoom(review.roomId);
   if(pendingReview(next,today()))showPending();
  }catch(error){$('review-message').textContent=error.message;}
  finally{$('review-approve').disabled=false;$('review-decline').disabled=false;}
 }
 async function reviewTonight() {
  if(!isLoaded()||isSaving())return;
  try {
   const next=reviewDay(includeVisits(getHouse()),today());
   if(JSON.stringify(next)!==JSON.stringify(getHouse()))await saveHouse(next);
   const review=next.learning.days.find(d=>d.date===today())?.review;
   $('learning-message').textContent=review?'Tomorrow’s suggestion: '+review.title+'. You can confirm it when you return.':'Explore a room first so Socrates has something to review.';
  }catch(error){$('learning-message').textContent=error.message;}
 }
 async function onLoad() {
  const house=getHouse();
  let next=includeVisits({...house,learning:{...validateLearning(house.learning,house),enabled:!preview}});
  for(const day of next.learning?.days||[])if(day.date<today()&&!day.review)next=reviewDay(next,day.date);
  next=applyApproved(next,today());
  if(JSON.stringify(next)!==JSON.stringify(getHouse()))await saveHouse(next);
  render();showPending();
 }
 function showReflection(){openHouse();critic=true;scene?.setSocrates?.(true);noteVisit(getSelected());$('house-tab').classList.remove('selected');render();}
 $('socrates-tab').onclick=showReflection;
 $('learn-room').onclick=()=>{showReflection();$('reflection-answer').focus?.();};
 $('socrates-next').onclick=()=>{const rooms=getHouse().rooms;tourIndex=(rooms.findIndex(r=>r.id===getSelected())+1)%rooms.length;selectRoom(rooms[tourIndex].id);render();};
 $('reflection-answer').oninput=()=>reflectionDrafts.set(getSelected(),$('reflection-answer').value);
 $('reflection-form').onsubmit=async event=>{event.preventDefault();$('learning-message').textContent='';const roomId=getSelected(),answer=$('reflection-answer').value;reflectionDrafts.set(roomId,answer);try{let next=reflect(includeVisits(getHouse()),today(),roomId,answer);if(!preview)next.learning.enabled=true;await saveHouse(next);reflectionDrafts.delete(roomId);render();$('learning-message').textContent=preview?'Reflection added to this preview.':'Reflection saved. Revisit this idea tomorrow.';}catch(error){$('learning-message').textContent=error.message;}};
 $('review-now').onclick=reviewTonight;$('pending-review-button').onclick=showPending;
 $('review-approve').onclick=()=>decide('approve');$('review-decline').onclick=()=>decide('decline');
 $('review-later').onclick=()=>{$('daily-dialog').close();};
 window.addEventListener('pagehide',()=>{if(timer)clearTimeout(timer);});
 const clock=setInterval(()=>{const hour=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Prague',hour:'numeric',hourCycle:'h23'}).format(new Date()));if(hour>=21)reviewTonight();else flushVisits().catch(()=>{});},60000);clock.unref?.();
 return {render,onLoad,noteVisit,includeVisits,hideCritic,reviewTonight,onHomeChange(id){draftsByHome.set(homeKey,reflectionDrafts);homeKey=id;reflectionDrafts=draftsByHome.get(id)||new Map();visits=new Set();if(timer)clearTimeout(timer);$('learning-message').textContent='';hideCritic();}};
}
