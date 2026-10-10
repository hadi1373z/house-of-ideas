const MAX_FILE_BYTES=192*1024*1024,MAX_MESSAGES=10000,CHUNK_BYTES=1100000;

// A deliberate file upload copies dialogue only. No credential or house upload
// happens while browsing, signing in, choosing a file or drafting a brief.
export async function importConversationFile({file,request,onProgress=()=>{}}){
 if(!file||file.size>MAX_FILE_BYTES)throw Error('Choose a conversation JSON file under 192 MiB. Your local archive is kept.');
 let parsed;
 try{parsed=JSON.parse(await file.text());}catch{throw Error('This file is not readable conversation JSON. Your local archive is kept.');}
 if(parsed?.format!=='house-of-ideas-private-conversations'||parsed.version!==1||!Array.isArray(parsed.messages)||!parsed.messages.length||parsed.messages.length>MAX_MESSAGES)throw Error('Choose a House of Ideas private conversation file with 1–10,000 messages.');
 const batches=[];let batch=[],bytes=100;
 for(const message of parsed.messages){
  const size=new TextEncoder().encode(JSON.stringify(message)).byteLength+1;
  if(size>CHUNK_BYTES-100)throw Error('A conversation record is too large. No upload was started.');
  if(batch.length>=200||bytes+size>CHUNK_BYTES){batches.push(batch);batch=[];bytes=100;}
  batch.push(message);bytes+=size;
 }
 if(batch.length)batches.push(batch);
 let processed=0,imported=0;
 try{
  for(const messages of batches){
   const result=await request('/api/conversations/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:{format:parsed.format,version:1,messages}})});
   imported+=Number.isInteger(result?.imported)?result.imported:0;processed+=messages.length;
   onProgress({processed,total:parsed.messages.length,imported});
  }
 }catch(error){throw Error(`${processed?`${processed} messages were processed before this upload stopped. `:''}${error.message} Your file is kept; retrying will not duplicate saved messages.`);}
 return {processed,imported,total:parsed.messages.length};
}

export function initConversationImport({document,parent,request,hosted,onImported,notify}){
 if(!hosted)return;
 const node=(tag,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
 const section=node('section');section.className='conversation-import';
 section.append(node('h3','Bring conversations from your local house'));
 const explanation=node('p','Use Continue with ChatGPT in the house on your computer. Download its private conversation file, then select it here. Import copies dialogue for review and keeps both houses intact.');
 const local=node('a','Open local ChatGPT connection');local.href='http://127.0.0.1:4317/#chatgpt';local.target='_blank';local.rel='noopener noreferrer';local.className='conversation-file-link';
 const label=node('label','Private conversation JSON file');const input=node('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Private conversation JSON file');label.append(input);
 const button=node('button','Import conversations');button.type='button';button.className='primary';button.disabled=true;
 const status=node('p');status.setAttribute('role','status');
 section.append(explanation,local,label,button,status);if(typeof parent.insertBefore==='function')parent.insertBefore(section,parent.firstElementChild);else parent.append(section);
 let busy=false;
 input.onchange=()=>{button.disabled=busy||!input.files?.length;status.textContent='The file is selected. Choose Import conversations to upload it to this private house.';};
 button.onclick=async()=>{
  if(busy||!input.files?.length)return;const file=input.files[0];busy=true;input.disabled=button.disabled=true;status.textContent='Reading your conversation file…';
  try{
   const result=await importConversationFile({file,request,onProgress:progress=>{status.textContent=`Processed ${progress.processed} of ${progress.total} messages…`;}});
   status.textContent=`Imported ${result.imported} new messages. ${result.processed-result.imported} already saved messages were kept without duplicates.`;
   await onImported?.();notify?.('Private conversations imported');
  }catch(error){status.textContent=error.message;}finally{busy=false;input.disabled=false;button.disabled=!input.files?.length;}
 };
 return {section,input,button,status};
}
