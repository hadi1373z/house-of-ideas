import {validateResident,observeRoom,converse,proposeCritique,pendingProposals,decideProposal,buildHandoff,setResidentPreferences} from './resident.js';

export function initResidentUI({$,document,window,scene,getHouse,getSelected,isLoaded,isSaving,saveHouse,openHouse,local=false,preview=false,gptConfig,gptConnect,gptDisconnect,gptChat,schedule=setInterval,cancel=clearInterval}) {
 let open=false,busy=false,gptReady=false,dialogueMode='offline';
 const visits=new Set();
 const note=$('resident-message');
 const location=()=>scene?.residentState?.()||{roomId:getSelected(),near:true,activity:'examining the house'};
 const roomId=()=>{const state=location();return getHouse().rooms.some(r=>r.id===state.roomId)?state.roomId:getSelected();};
 function renderSpatial() {
  const state=location(),room=getHouse().rooms.find(r=>r.id===state.roomId);
  $('resident-location').textContent=room?'Socrates · '+room.name:'Socrates · Front door';
  $('resident-activity').textContent=state.talking?'Listening to you':state.activity||'Exploring the house';
  $('conversation-location').textContent=room?'Together in '+room.name:state.near?'Together by the front door':'Meet Socrates inside the house';
  if(open&&state.near&&!state.talking&&!state.summoning)scene?.setResidentTalking?.(true);
  $('resident-send').disabled=busy||isSaving()||!isLoaded()||!state.near||Boolean(state.summoning);
  $('resident-critic').disabled=busy||isSaving()||!isLoaded();
  $('resident-presence').textContent=state.near?'Socrates is here. Talk to him.':'Walk inside or call him over to speak face to face.';
 }
 function render() {
  renderSpatial();
  const resident=validateResident(getHouse().resident,getHouse());
  const messages=$('resident-messages');
  messages.replaceChildren();
  if(!resident.messages.length){const intro=document.createElement('p');intro.className='conversation-intro';intro.textContent='I live in this house with you. We can examine an idea, question the purpose of a room, or test an assumption. What would you like to understand?';messages.append(intro);}
  for(const turn of resident.messages.slice(-24)){
   const article=document.createElement('article');article.className='conversation-turn '+(turn.role==='user'?'you':'socrates');
   const label=document.createElement('small');label.textContent=turn.role==='user'?'YOU':'SOCRATES · '+(turn.source==='gpt'?'GPT':'OFFLINE');
   const text=document.createElement('p');text.textContent=turn.text;article.append(label,text);messages.append(article);
  }
  messages.scrollTop=messages.scrollHeight;
  $('resident-proposals').replaceChildren();
  for(const proposal of pendingProposals(getHouse())){
   const card=document.createElement('article');card.className='resident-proposal';
   const concept=document.createElement('small');concept.textContent=(proposal.concept||'Socratic critique').replaceAll('_',' ')+' · '+proposal.roomName;
   const title=document.createElement('h3');title.textContent=proposal.title;
   const reason=document.createElement('p');reason.textContent=proposal.reason;
   const question=document.createElement('blockquote');question.textContent=proposal.question;
   const approve=document.createElement('button');approve.className='primary';approve.textContent='Build this change';approve.disabled=busy||isSaving();approve.onclick=()=>decision(proposal.id,'approve');
   const decline=document.createElement('button');decline.textContent='Decline';decline.disabled=busy||isSaving();decline.onclick=()=>decision(proposal.id,'decline');
   const actions=document.createElement('div');actions.className='proposal-actions';actions.append(decline,approve);card.append(concept,title,reason,question,actions);$('resident-proposals').append(card);
  }
  $('conversation-mode').value=dialogueMode;
  $('gpt-status').textContent=local?(gptReady?'GPT key configured · optional':'Offline · GPT not configured'):'Browser preview · offline dialogue';
  $('conversation-privacy').textContent=dialogueMode==='gpt'?'GPT sends this message, recent conversation and the current room to OpenAI.':'This conversation stays on your computer.';
  if(preview)$('conversation-privacy').textContent='Preview conversation lasts for this visit. Use the desktop edition to keep memories.';
  $('resident-pace').value=resident.preferences.pace;
 }
 function show(){
  openHouse?.();scene?.setWalk?.(true);
  open=true;$('resident-conversation').hidden=false;
  if(!location().near)scene?.summonResident?.();else if(!location().summoning)scene?.setResidentTalking?.(true);
  render();
 }
 function close(){open=false;$('resident-conversation').hidden=true;scene?.setResidentTalking?.(false);}
 async function change(mutator,success){
  if(busy||isSaving())return;busy=true;note.textContent='';render();
  try{const saved=await saveHouse(mutator(getHouse()));if(success)note.textContent=typeof success==='function'?success(saved):success;}
  catch(error){note.textContent=error.message;}
  finally{busy=false;render();}
 }
 async function decision(id,answer){await change(house=>decideProposal(house,id,answer),saved=>{const proposal=saved.resident.proposals.find(p=>p.id===id);if(answer==='decline')return 'Declined. The room is unchanged.';return proposal?.status==='applied'?'Your decision is saved. Look around the room to see the change.':proposal?.resolution||'The proposed change could not be installed.';});}
 async function onLoad(){
  const before=getHouse(),resident=validateResident(before.resident,before);
  if(!before.resident)await saveHouse({...before,resident});
  if(local){try{gptReady=(await gptConfig()).gpt.ready;}catch(error){note.textContent=error.message;}}
  render();
 }
 $('resident-talk').onclick=show;
 $('socrates-tab').onclick=show;
 $('resident-close').onclick=close;
 $('resident-call').onclick=()=>{const coming=scene?.summonResident?.();note.textContent=coming===false?'Socrates needs a connected doorway to reach you.':'Socrates is coming to meet you.';renderSpatial();};
 $('resident-critic').onclick=()=>change(house=>proposeCritique(house,roomId()),'A critique is ready. Read it, then decide whether to build the change.');
 $('resident-form').onsubmit=async event=>{
  event.preventDefault();if(busy||isSaving()||!isLoaded()||!location().near||location().summoning)return;
  const text=$('resident-input').value.trim();if(!text)return;
  busy=true;note.textContent=dialogueMode==='gpt'?'Socrates is thinking with GPT…':'Socrates is considering your question…';render();
  try{
   if(dialogueMode==='gpt'){if(!gptReady)throw Error('Configure GPT first, or choose Offline.');await gptChat(text,roomId());}
   else await saveHouse(converse(getHouse(),roomId(),text));
   $('resident-input').value='';note.textContent='';
  }catch(error){note.textContent=error.message;}
  finally{busy=false;render();}
 };
 $('conversation-mode').onchange=()=>{if($('conversation-mode').value==='gpt'&&!gptReady){$('conversation-mode').value='offline';$('gpt-settings').onclick();return;}dialogueMode=$('conversation-mode').value;render();};
 $('gpt-settings').onclick=()=>{if(!local){note.textContent='GPT is available in the offline desktop edition. Your browser preview has local guided dialogue.';return;}$('gpt-settings-message').textContent='';$('gpt-dialog').showModal();};
 $('gpt-form').onsubmit=async event=>{event.preventDefault();$('gpt-settings-message').textContent='';try{const result=await gptConnect($('gpt-key').value,$('gpt-model').value);gptReady=result.gpt.ready;$('gpt-key').value='';$('gpt-dialog').close();note.textContent='GPT key configured for this session. Choose GPT when you want to use it.';render();}catch(error){$('gpt-settings-message').textContent=error.message;}};
 $('gpt-disconnect').onclick=async()=>{try{await gptDisconnect();gptReady=false;dialogueMode='offline';$('gpt-key').value='';$('gpt-dialog').close();render();}catch(error){$('gpt-settings-message').textContent=error.message;}};
 $('resident-pace').onchange=()=>change(house=>setResidentPreferences(house,{pace:$('resident-pace').value}), 'Socrates will remember your preferred pace.');
 $('resident-export').onclick=()=>{
  const blob=new Blob([buildHandoff(getHouse())],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='house-of-ideas-game-brief.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);note.textContent='Game improvement brief exported. You can give it to GPT or Codex.';
 };
 scene?.onResidentVisit?.(visit=>{const id=typeof visit==='string'?visit:visit?.roomId;if(isLoaded()&&typeof id==='string')visits.add(id);});
 scene?.onResidentInteract?.(show);
 const presence=schedule(renderSpatial,750);presence?.unref?.();
 const observation=schedule(async()=>{if(!isLoaded()||isSaving()||busy||!visits.size)return;let next=getHouse();for(const id of visits)if(next.rooms.some(r=>r.id===id)){next=observeRoom(next,id);const pending=pendingProposals(next);if(pending.length<3&&!pending.some(p=>p.roomId===id))next=proposeCritique(next,id);}try{await saveHouse(next);visits.clear();}catch{}},15000);observation?.unref?.();
 window.addEventListener('pagehide',()=>{cancel(presence);cancel(observation);});
 return {render,onLoad,show,close};
}
