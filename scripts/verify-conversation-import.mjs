import assert from 'node:assert/strict';
import {importConversationFile,initConversationImport} from '../web/conversation-import.js';
const file=messages=>{const body=JSON.stringify({format:'house-of-ideas-private-conversations',version:1,messages});return {size:new TextEncoder().encode(body).byteLength,async text(){return body;}};};
const messages=Array.from({length:601},(_,i)=>({id:String(i),text:'漢'.repeat(2200)}));
let calls=[],saved=new Set(),failAt=null;
const request=async(path,options)=>{
 assert.equal(path,'/api/conversations/import');assert.equal(options.method,'POST');assert.ok(new TextEncoder().encode(options.body).byteLength<1300000);
 if(failAt===calls.length){failAt=null;throw Error('Connection interrupted.');}
 const data=JSON.parse(options.body);assert.ok(data.file.messages.length<=200);assert.deepEqual(Object.keys(data.file),['format','version','messages']);
 calls.push(data);let imported=0;for(const message of data.file.messages)if(!saved.has(message.id)){saved.add(message.id);imported++;}return {imported};
};
const progress=[];failAt=1;
await assert.rejects(importConversationFile({file:file(messages),request,onProgress:p=>progress.push(p)}),/messages were processed.*retrying will not duplicate/);
assert.ok(saved.size>0&&saved.size<messages.length);assert.equal(progress.length,1);
const result=await importConversationFile({file:file(messages),request});assert.equal(result.processed,601);assert.equal(saved.size,601);
const repeated=await importConversationFile({file:file(messages),request});assert.equal(repeated.imported,0);assert.equal(saved.size,601);
const before=calls.length;
await assert.rejects(importConversationFile({file:{size:10,text:async()=>'{'},request}),/not readable/);
await assert.rejects(importConversationFile({file:{size:1,text:async()=>JSON.stringify({format:'credentials',messages:[]})},request}),/private conversation file/);
await assert.rejects(importConversationFile({file:{size:193*1024*1024,text:async()=>{throw Error('Must not read.');}},request}),/under 192 MiB/);
await assert.rejects(importConversationFile({file:file([]),request}),/1–10,000/);assert.equal(calls.length,before);
class Element{constructor(){this.children=[];this.files=[];}append(...nodes){this.children.push(...nodes);}setAttribute(){}}
const document={createElement:()=>new Element()},parent=new Element();
assert.equal(initConversationImport({document,parent,request,hosted:false}),undefined);assert.equal(parent.children.length,0);
let uploaded=0;
const ui=initConversationImport({document,parent,hosted:true,request:async()=>{uploaded++;return {imported:1};},onImported:async()=>{}});
ui.input.files=[file([{id:'test',text:'hello'}])];ui.input.onchange();assert.equal(uploaded,0,'Selecting a file never uploads it.');assert.equal(ui.button.disabled,false);
await ui.button.onclick();assert.equal(uploaded,1);assert.match(ui.status.textContent,/Imported 1 new messages/);assert.equal(ui.input.disabled,false);
console.log('Explicit conversation-file upload, UTF-8 bounded chunks, recoverable partial imports, idempotent retries and no upload on selection passed.');
