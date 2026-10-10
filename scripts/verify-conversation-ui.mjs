import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initConversationUI} from '../web/conversation-ui.js';

class Element {
 constructor(tag='DIV'){this.tagName=tag;this.children=[];this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.attributes={};const classes=new Set();this.classList={contains:name=>classes.has(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);}};}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(name,value){this.attributes[name]=value;}showModal(){this.open=true;}close(){this.open=false;}focus(){this.focused=true;}
}
const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
function harness(hosted){
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element()]));
 const $=id=>{assert.ok(elements.has(id),`Missing ${id}`);return elements.get(id);};
 const archive={messages:Array.from({length:24},(_,i)=>({id:`m${i}`,sequence:i+1,homeId:'home1',role:i%2?'resident':'user',text:i===0?'<img src=x onerror=alert(1)>':`Conversation ${i}`,at:'2026-10-10T10:00:00Z',mode:'gpt',roomId:'math'})),briefs:[],promptVersion:'socrates-v1'};
 let failed=false,deferred=false,release=null,failRead=false,approvalFailed=false;
 const requests=[],notices=[];
 async function request(path,options={}){
  requests.push({path,options});
  if(path.startsWith('/api/conversations')){
   if(failRead)throw Error('Archive unavailable');
   const url=new URL(path,'https://house.test'),limit=Number(url.searchParams.get('limit')||200),before=url.searchParams.has('before')?Number(url.searchParams.get('before')):Infinity;
   const all=archive.messages.filter(message=>message.sequence<before),page=all.slice(-limit);
   return structuredClone({...archive,messages:page,nextCursor:page.length===limit?page[0].sequence:null});
  }
  if(path==='/api/improvements'){
   if(failed)throw Error('Cloud save failed');
   if(deferred)await new Promise(resolve=>{release=resolve;});
   const payload=JSON.parse(options.body);assert.ok(payload.evidenceIds.every(id=>archive.messages.some(message=>message.id===id)));
   const brief={id:`brief${archive.briefs.length+1}`,status:'draft',createdAt:'2026-10-10T12:00:00Z',...payload};archive.briefs.push(brief);return {brief};
  }
  const match=path.match(/^\/api\/improvements\/(brief\d+)\/approve$/);assert.ok(match,`Unexpected request ${path}`);
  if(approvalFailed)throw Error('Approval could not be saved');
  archive.briefs.find(brief=>brief.id===match[1]).status='approved';return {};
 }
 const ui=initConversationUI({document:{getElementById:$,createElement:tag=>new Element(tag)},window:{},request,hosted,getHouse:()=>({rooms:[{id:'math',name:'Library'}]}),getNeighborhood:()=>({activeId:'home1',homes:[{id:'home1',title:'My residence'}]}),getRevision:()=>3,notify:message=>notices.push(message)});
 const choose=index=>{const checkbox=$('conversation-messages').children[index].children[0].children[0];checkbox.checked=true;checkbox.onchange();return checkbox;};
 return {$,ui,archive,requests,notices,choose,setFailed:value=>{failed=value;},setDeferred:value=>{deferred=value;},release:()=>release(),setFailRead:value=>{failRead=value;},setApprovalFailed:value=>{approvalFailed=value;}};
}
const h=harness(true);await h.ui.show();assert.equal(h.$('conversations-dialog').open,true);assert.equal(h.$('conversation-file').hidden,false);assert.equal(h.requests.length,1);
assert.equal(h.$('conversation-messages').children[0].children[2].textContent,'<img src=x onerror=alert(1)>','Transcript must remain text, without HTML insertion.');
for(let i=0;i<20;i++)h.choose(i);
assert.equal(h.choose(20).checked,false);assert.equal(h.$('conversation-selection-count').textContent,'20 of 20 messages selected');assert.match(h.$('conversations-status').textContent,/at most 20/);
h.$('conversation-clear-selection').onclick();h.choose(0);h.choose(1);
h.$('conversation-problem').value='My own description';h.$('conversation-draft').onclick();assert.equal(h.$('conversation-problem').value,'My own description');assert.equal(h.$('conversation-proposal').value,'','Private transcript must not become a development summary automatically.');assert.match(h.$('conversation-evidence-text').value,/My residence/);h.$('conversation-proposal').value='Owner-authored design summary';
h.$('conversation-criteria').value='Walk to the book and return to the same page.';
const submit=()=>h.$('conversation-brief-form').onsubmit({preventDefault(){}});
h.setFailed(true);await submit();assert.equal(h.$('conversation-problem').value,'My own description');assert.equal(h.$('conversation-selection-count').textContent,'2 of 20 messages selected');assert.match(h.$('conversations-status').textContent,/Cloud save failed/);assert.equal(h.archive.briefs.length,0);
h.setFailed(false);h.setDeferred(true);const pending=submit();assert.equal(h.$('conversation-save-brief').disabled,true);h.$('conversation-proposal').value='New wording while the earlier draft is saving';h.release();await pending;h.setDeferred(false);
assert.equal(h.archive.briefs[0].status,'draft');assert.equal(h.archive.briefs[0].proposal,'Owner-authored design summary');assert.equal(h.$('conversation-proposal').value,'New wording while the earlier draft is saving','Finishing an earlier request must preserve a newer draft.');
let card=h.$('conversation-briefs').children[0];assert.equal(card.children.at(-1).tagName,'button');assert.equal(h.requests.filter(call=>call.path.endsWith('/approve')).length,0,'Saving is separate from approval.');
h.setApprovalFailed(true);await card.children.at(-1).onclick();assert.equal(h.archive.briefs[0].status,'draft');assert.equal(h.$('conversation-proposal').value,'New wording while the earlier draft is saving');assert.equal(h.$('conversation-briefs').children[0].children.at(-1).tagName,'button');assert.match(h.$('conversations-status').textContent,/Approval could not be saved/);h.setApprovalFailed(false);
card=h.$('conversation-briefs').children[0];
await card.children.at(-1).onclick();card=h.$('conversation-briefs').children[0];assert.equal(h.archive.briefs[0].status,'approved');assert.equal(card.children.at(-1).tagName,'a');assert.equal(card.children.at(-1).href,'/api/improvements/brief1/file');assert.match(card.children.at(-1).download,/house-of-ideas-approved-development-brief1\.json/);assert.equal(h.notices.length,1);
await submit();assert.equal(h.$('conversation-problem').value,'');assert.equal(h.$('conversation-proposal').value,'');assert.equal(h.$('conversation-selection-count').textContent,'0 of 20 messages selected');
h.setFailRead(true);assert.equal(await h.ui.refresh(),false);assert.match(h.$('conversations-status').textContent,/Archive unavailable/);assert.equal(h.$('conversation-briefs').children.length,2,'A failed refresh keeps the previously loaded archive visible.');
h.setFailRead(false);await h.ui.refresh();assert.equal(h.$('conversations-status').classList.contains('error'),false);
// Latest messages appear first on opening, and older pages remain selectable.
h.archive.messages.push(...Array.from({length:9},(_,i)=>({...h.archive.messages[1],id:`later${i}`,sequence:25+i})));await h.ui.refresh();assert.match(h.$('conversations-count').textContent,/page 2 of 2/);h.$('conversation-previous').onclick();assert.match(h.$('conversations-count').textContent,/page 1 of 2/);h.choose(0);h.$('conversation-next').onclick();assert.equal(h.$('conversation-selection-count').textContent,'1 of 20 messages selected');
h.ui.close();assert.equal(h.$('conversations-dialog').open,false);
// Backend cursors expose history beyond the latest 200 records. Loaded older
// evidence remains available when a later refresh's recent page excludes it.
const large=harness(true);large.archive.messages=Array.from({length:250},(_,i)=>({...h.archive.messages[1],id:`long${i}`,sequence:i+1,text:`Older conversation ${i}`}));await large.ui.show();assert.match(large.$('conversations-count').textContent,/200 private messages loaded/);assert.equal(large.$('conversation-load-earlier').hidden,false);
await large.$('conversation-load-earlier').onclick();assert.match(large.$('conversations-count').textContent,/250 private messages loaded/);assert.equal(large.$('conversation-load-earlier').hidden,true);large.choose(0);large.$('conversation-problem').value='An older conversation matters';large.$('conversation-proposal').value='Keep my unfinished change';large.$('conversation-criteria').value='Use evidence from the first visit';
large.archive.messages.push(...Array.from({length:45},(_,i)=>({...large.archive.messages[1],id:`new${i}`,sequence:251+i,text:`Recent conversation ${i}`})));await large.ui.refresh();assert.equal(large.$('conversation-selection-count').textContent,'1 of 20 messages selected');assert.match(large.$('conversation-evidence-text').value,/Older conversation 0/);assert.equal(large.$('conversation-proposal').value,'Keep my unfinished change');
assert.ok(large.requests.some(call=>call.path==='/api/conversations?before=51&limit=200'));
// Artist messages are attributed to their own resident, never to Socrates.
const artists=harness(true);artists.archive.messages=[{...artists.archive.messages[1],id:'artist1',sequence:1,actor:'monet',role:'artist',homeId:null,roomId:null,mode:'artist',text:'Observe the reflected edge.'}];await artists.ui.show();const artistCard=artists.$('conversation-messages').children[0];assert.match(artistCard.children[0].children[1].textContent,/Claude Monet/);assert.ok(!artistCard.children[0].children[1].textContent.includes('Socrates'));assert.match(artistCard.children[1].textContent,/Artists’ City/);artists.choose(0);assert.match(artists.$('conversation-evidence-text').value,/Claude Monet/);
const offline=harness(false);await offline.ui.show();assert.equal(offline.requests.length,0);assert.equal(offline.$('conversation-online-content').hidden,true);assert.equal(offline.$('conversation-file').hidden,true);assert.match(offline.$('conversations-status').textContent,/offline house, Socrates.*conversations stay/i);await offline.$('conversation-brief-form').onsubmit({preventDefault(){}});assert.equal(offline.requests.length,0);
assert.match(html,/download="house-of-ideas-private-conversations\.json"/);
console.log('Verified private history, text-safe artist attribution, bounded evidence, failed approval and save retention, separate approval, approved-only files, older-page loading beyond 200 messages, refresh-preserved older evidence and honest offline guidance.');
