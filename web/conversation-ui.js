// Private online dialogue becomes reviewable development work only by owner decision.
import {ARTISTS} from './art-city-data.js';
import {initConversationImport} from './conversation-import.js';
export function initConversationUI({document,window,request,hosted,getHouse,getNeighborhood,getRevision,notify}) {
 const $=id=>document.getElementById(id),pageSize=30;
 let messages=[],briefs=[],selected=new Set(),page=0,busy=false,loaded=false,sequence=0,olderCursor=null,readingEarlier=false;
 const messageCache=new Map(),artistFor=message=>ARTISTS.find(artist=>artist.id===(message.actor||message.artistId));
 const titleFor=id=>getNeighborhood?.()?.homes?.find(home=>home.id===id)?.title||'House edition';
 const placeFor=message=>message.sourceHomeTitle||message.homeTitle||(artistFor(message)?'Artists’ City':titleFor(message.homeId));
 const roomFor=message=>{
  if(message.sourceRoomName||message.roomName)return message.sourceRoomName||message.roomName;
  const artist=artistFor(message);if(artist)return `${artist.name}’s gallery`;
  const home=getNeighborhood?.()?.homes?.find(home=>home.id===message.homeId);
  return (home?.house||getHouse?.())?.rooms?.find(room=>room.id===message.roomId)?.name||'House';
 };
 const when=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Saved conversation':date.toLocaleString('en-GB',{timeZone:'Europe/Prague',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
 const mode=value=>({chatgpt:'ChatGPT plan',gpt:'GPT',api:'GPT',offline:'House guide',local:'House guide',artist:'Artist conversation'}[value]||'Saved conversation');
 const speaker=message=>message.role==='user'?'You':artistFor(message)?.name||(!(message.actor||message.artistId)||message.actor==='socrates'?'Socrates':'House resident');
 function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
 function note(text,error=false){$('conversations-status').textContent=text;$('conversations-status').classList.toggle('error',error);}
 function evidence(){return messages.filter(message=>selected.has(message.id));}
 function renderEvidence(){
  $('conversation-selection-count').textContent=`${selected.size} of 20 messages selected`;
  $('conversation-evidence-text').value=evidence().map(message=>`${speaker(message)} · ${placeFor(message)} · ${when(message.at)}\n${message.text}`).join('\n\n');
  $('conversation-draft').disabled=!hosted||busy||!selected.size;
  $('conversation-save-brief').disabled=!hosted||busy||!selected.size;
 }
 function renderMessages(){
  const lastPage=Math.max(0,Math.ceil(messages.length/pageSize)-1);page=Math.min(Math.max(page,0),lastPage);
  const current=messages.slice(page*pageSize,(page+1)*pageSize);
  $('conversations-count').textContent=messages.length?`${messages.length} private messages loaded · page ${page+1} of ${lastPage+1}`:'No saved conversations yet. Speak to Socrates in this online house to begin.';
  $('conversation-previous').disabled=busy||page===0;$('conversation-next').disabled=busy||page===lastPage;
  $('conversation-load-earlier').hidden=olderCursor===null;$('conversation-load-earlier').disabled=busy||readingEarlier;
  $('conversation-load-earlier').textContent=readingEarlier?'Loading earlier conversations…':'Load earlier conversations';
  $('conversation-messages').replaceChildren(...current.map(message=>{
   const card=element('article',undefined,'conversation-archive-turn');
   const label=element('label',undefined,'conversation-select-label'),checkbox=element('input');checkbox.type='checkbox';checkbox.checked=selected.has(message.id);checkbox.disabled=busy;checkbox.setAttribute('aria-label',`Select ${speaker(message)} message from ${when(message.at)}`);
   checkbox.onchange=()=>{if(busy)return;if(checkbox.checked&&selected.size>=20){checkbox.checked=false;note('Choose at most 20 messages for one development brief.',true);return;}if(checkbox.checked)selected.add(message.id);else selected.delete(message.id);renderEvidence();};
   label.append(checkbox,element('span',`${speaker(message)} · ${roomFor(message)}`));
   card.append(label,element('small',`${placeFor(message)} · ${when(message.at)} · ${mode(message.mode)}`),element('p',message.text));return card;
  }));
 }
 function renderBriefs(){
  $('conversation-briefs').replaceChildren(...briefs.map(brief=>{
   const card=element('article',undefined,'conversation-development-brief');
   card.append(element('small',`${brief.status==='approved'?'APPROVED':'DRAFT'} · ${when(brief.createdAt)}`),element('h3',brief.problem),element('h4','Proposed change'),element('p',brief.proposal),element('h4','How to check it'),element('p',brief.criteria),element('small',`${brief.evidenceIds?.length||0} conversation references`));
   if(brief.status==='approved'){
    const download=element('a','Download approved development brief','conversation-file-link');download.href=`/api/improvements/${encodeURIComponent(brief.id)}/file`;download.download=`house-of-ideas-approved-development-${String(brief.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)}.json`;card.append(download);
   }else{
    const approve=element('button','Approve this development brief','primary');approve.type='button';approve.disabled=busy;approve.onclick=()=>approveBrief(brief.id);card.append(approve);
   }return card;
  }));
  $('conversation-briefs-empty').hidden=briefs.length>0;
 }
 function render(){renderMessages();renderEvidence();renderBriefs();$('conversation-file').hidden=!hosted||!loaded;}
 function acceptArchive(data,{earlier=false}={}){
  if(!data||!Array.isArray(data.messages)||!Array.isArray(data.briefs))throw Error('The conversation archive could not be opened. Try again.');
  const cursor=data.nextCursor??null;
  if(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1))throw Error('The conversation page could not be read. Refresh conversations to try again.');
  const overlap=data.messages.some(message=>messageCache.has(message.id)),wasEmpty=messageCache.size===0;
  for(const message of data.messages)messageCache.set(message.id,message);
  messages=[...messageCache.values()].sort((left,right)=>Number.isSafeInteger(left.sequence)&&Number.isSafeInteger(right.sequence)?left.sequence-right.sequence:0);
  // Keep the earlier boundary when a refreshed recent page overlaps the loaded
  // history. A non-overlapping page starts a new chain to fill any history gap.
  if(earlier||cursor===null||wasEmpty||!overlap)olderCursor=cursor;
  briefs=data.briefs;loaded=true;
 }
 async function refresh(){
  if(!hosted)return false;
  const ticket=++sequence;
  try{
   const data=await request('/api/conversations');
   if(ticket!==sequence)return false;
   const wasAtEnd=page>=Math.max(0,Math.ceil(messages.length/pageSize)-1);
   acceptArchive(data);
   if(wasAtEnd)page=Math.max(0,Math.ceil(messages.length/pageSize)-1);
   render();
   $('conversation-prompt-note').textContent='Socrates considers your room, remembered goals, reflections, and decisions. He questions assumptions and proposes changes for you to decide.';
   note('Choose messages to turn a conversation into a development draft.');return true;
  }catch(error){if(ticket===sequence)note(error.message,true);return false;}
 }
 async function loadEarlier(){
  if(!hosted||busy||readingEarlier||olderCursor===null)return false;
  const cursor=olderCursor,ticket=++sequence;readingEarlier=true;render();
  try{
   const data=await request(`/api/conversations?before=${encodeURIComponent(cursor)}&limit=200`);
   if(ticket!==sequence)return false;
   if(data.nextCursor!==null&&data.nextCursor!==undefined&&data.nextCursor>=cursor)throw Error('This conversation page did not advance. Refresh conversations to try again.');
   acceptArchive(data,{earlier:true});page=0;render();note('Earlier conversations are ready. Your selected evidence and draft are kept.');return true;
  }catch(error){if(ticket===sequence)note(error.message,true);return false;}finally{readingEarlier=false;render();}
 }
 async function approveBrief(id){
  if(!hosted||busy||!briefs.some(brief=>brief.id===id&&brief.status==='draft'))return;
  busy=true;render();note('Recording your approval…');
  try{await request(`/api/improvements/${encodeURIComponent(id)}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const opened=await refresh();note(opened?'Your approval is recorded. Download the development brief when you want to use it for website work.':'Your approval is recorded, but the archive could not refresh. Refresh conversations to see the approved file.',!opened);notify?.('Development brief approved');}
  catch(error){note(error.message,true);}finally{busy=false;render();}
 }
 $('conversation-draft').onclick=()=>{
  if(!hosted||busy||!selected.size)return;
  // Keep private excerpts in the evidence preview. Development files contain
  // the owner's deliberate design summary, never an automatic transcript copy.
  $('conversation-problem').focus?.();note('Read the private excerpts, write your own summary of the change, and add a concrete way to check it.');
 };
 $('conversation-brief-form').onsubmit=async event=>{
  event.preventDefault();if(!hosted||busy)return;
  const payload={problem:$('conversation-problem').value.trim(),proposal:$('conversation-proposal').value.trim(),criteria:$('conversation-criteria').value.trim(),evidenceIds:[...selected]};
  if(!payload.evidenceIds.length||payload.evidenceIds.length>20||!payload.problem||payload.problem.length>1000||!payload.proposal||payload.proposal.length>2000||!payload.criteria||payload.criteria.length>1500){note('Choose 1–20 messages and complete the problem, proposed change, and check.',true);return;}
  const signature=JSON.stringify({problem:$('conversation-problem').value,proposal:$('conversation-proposal').value,criteria:$('conversation-criteria').value,evidenceIds:[...selected]});
  busy=true;render();note('Saving your development draft…');
  try{
   await request('/api/improvements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const current=JSON.stringify({problem:$('conversation-problem').value,proposal:$('conversation-proposal').value,criteria:$('conversation-criteria').value,evidenceIds:[...selected]});
   if(current===signature){$('conversation-problem').value='';$('conversation-proposal').value='';$('conversation-criteria').value='';selected.clear();}
   const opened=await refresh();note(opened?'Draft saved. Read it below before choosing whether to approve it.':'Your draft was saved, but the archive could not refresh. Refresh conversations to see it.',!opened);
  }catch(error){note(error.message,true);}finally{busy=false;render();}
 };
 function close(){ $('conversations-dialog').close(); }
 async function show(){
  $('conversations-dialog').showModal();
  if(hosted){note('Opening your private conversations…');await refresh();}
  else note('This private online archive belongs to the hosted house. In the offline house, Socrates’ conversations stay in your saved house file; use Export conversation in his conversation panel. The browser preview keeps temporary memories.');
 }
 $('conversations-tab').onclick=show;$('conversations-open').onclick=show;$('conversations-close').onclick=close;
 $('conversation-refresh').onclick=()=>{note('Refreshing your private conversations…');return refresh();};
 $('conversation-load-earlier').onclick=loadEarlier;
 $('conversation-previous').onclick=()=>{if(page>0&&!busy){page--;renderMessages();}};$('conversation-next').onclick=()=>{if((page+1)*pageSize<messages.length&&!busy){page++;renderMessages();}};
 $('conversation-clear-selection').onclick=()=>{if(busy)return;selected.clear();renderMessages();renderEvidence();};
 $('conversation-online-content').hidden=!hosted;$('conversation-mode-guidance').hidden=hosted;
 initConversationImport({document,parent:$('conversation-online-content'),request,hosted,onImported:refresh,notify});
 if(!hosted){const link=element('a','Open your private online house','conversation-file-link');link.href='https://house-of-ideas-online.nutmeg-ibex-4408.chatgpt.site';link.target='_blank';link.rel='noopener noreferrer';$('conversation-mode-guidance').append(link);}
 render();
 return {show,close,refresh,onLoad:refresh};
}
