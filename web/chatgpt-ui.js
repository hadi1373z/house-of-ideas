// The browser sees connection status and an explicit OAuth authorization link,
// never access or refresh tokens. The offline house remains usable throughout.
export function initChatGPTUI({$, window, local = false, request, onConfig = () => {}}) {
 const section=$('chatgpt-settings'),account=$('chatgpt-account'),connect=$('chatgpt-connect'),authorize=$('chatgpt-authorize'),cancel=$('chatgpt-cancel'),disconnect=$('chatgpt-disconnect'),model=$('chatgpt-model'),note=$('chatgpt-status');
 const document=window.document;
 let config={connected:false,pending:false,accounts:[],account:null,model:null},catalog=[],busy=false,alive=true,version=0,timer=null,polling=false,deadline=0,message='',accountChoice=null;
 function stopPoll(){if(timer!==null)window.clearInterval(timer);timer=null;polling=false;}
 function option(value,label){const node=document.createElement('option');node.value=value;node.textContent=label;return node;}
 function render(){
  section.hidden=!local;
  if(!local)return;
  const chosen=accountChoice??config.account?.id??'';
  account.replaceChildren(option('','Add another ChatGPT account'),...(config.accounts||[]).map(value=>option(value.id,value.label)));
  account.value=(config.accounts||[]).some(value=>value.id===chosen)?chosen:'';
  model.replaceChildren(...(catalog.length?catalog.map(value=>option(value.slug,value.displayName)):config.model?[option(config.model,config.model)]:[option('',config.connected?'Choose a ChatGPT model':'Sign in to see available models')]));
  model.value=config.model||catalog[0]?.slug||'';
  connect.disabled=busy||Boolean(config.error);account.disabled=busy||config.pending||Boolean(config.error);
  cancel.disabled=busy||!config.pending;cancel.hidden=!config.pending;
  disconnect.disabled=busy||!config.connected;disconnect.hidden=!config.connected;
  model.disabled=busy||!config.connected||Boolean(config.error);
  if(!config.pending){authorize.hidden=true;authorize.removeAttribute('href');}
  note.textContent=message||config.error||(config.pending?'Sign-in is waiting for your approval in ChatGPT.':config.connected?`${config.account?.label||'ChatGPT account'} connected · online. Sign-in lasts until the house server stops.`:'Optional online connection. The house and local Socrates work offline.');
 }
 function accept(data){
  const next=data?.chatgpt||data;
  if(!next||typeof next.connected!=='boolean')throw Error('The local house returned an unreadable ChatGPT status.');
  config=next;
  if(!config.connected)catalog=[];
  onConfig({...config});render();return config;
 }
 const post=(path,body={})=>request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 async function loadModels(){
  if(!local||!config.connected||!alive)return;
  const current=version,selectedAccount=config.account?.id;
  try{
   const data=await request('/api/chatgpt/models');
   if(!alive||current!==version||selectedAccount!==config.account?.id)return;
   if(!Array.isArray(data.models))throw Error('The local house returned an unreadable ChatGPT model list.');
   catalog=data.models.filter(value=>typeof value.slug==='string'&&typeof value.displayName==='string');
   if(data.chatgpt)accept(data);else{config={...config,model:catalog.some(value=>value.slug===config.model)?config.model:catalog[0]?.slug||null};onConfig({...config});}
   message=catalog.length?'ChatGPT is connected. Choose ChatGPT plan in the conversation menu when you want an online answer.':'No eligible ChatGPT models are available for this account. Local Socrates remains available.';render();
  }catch(error){if(alive&&current===version){message=error.message+' Focus the model menu to try again.';render();}}
 }
 async function poll(){
  if(polling||!alive||!config.pending)return;
  if(Date.now()>=deadline){stopPoll();authorize.hidden=true;authorize.removeAttribute('href');config={...config,pending:false};message='This sign-in has expired. Continue with ChatGPT again when you are ready.';render();return;}
  const current=version;polling=true;
  try{
   const data=await request('/api/chatgpt/status');
   if(!alive||current!==version)return;
   message='';accept(data);
   if(!config.pending){stopPoll();if(config.connected)await loadModels();}
  }catch(error){if(alive&&current===version){message=error.message;render();}}
  finally{if(current===version)polling=false;}
 }
 function startPoll(until){stopPoll();deadline=Math.min(Number.isFinite(until)?until:Date.now()+600000,Date.now()+600000);timer=window.setInterval(poll,2000);}
 account.onchange=()=>{accountChoice=account.value;};
 connect.onclick=async()=>{
  if(!local||busy||config.error)return;
  const current=++version;stopPoll();busy=true;message='Preparing your ChatGPT sign-in…';authorize.hidden=true;render();
  try{
   const selected=account.value;
   const data=await post('/api/chatgpt/start',selected?{accountId:selected}:{});
   if(!alive||current!==version)return;
   const url=new URL(data.authorizationUrl);
   if(url.protocol!=='https:'||url.hostname!=='auth.openai.com'||url.port||url.username||url.password||url.pathname!=='/api/accounts/authorize')throw Error('The local house returned an invalid ChatGPT sign-in link.');
   catalog=[];message='Open the sign-in link below and approve House of Ideas in ChatGPT. GPT conversations use the internet; your house stays on this computer.';
   accept(data);authorize.href=url.href;authorize.hidden=false;authorize.textContent='Continue to ChatGPT';startPoll(data.expiresAt);
  }catch(error){if(alive&&current===version){message=error.message;render();}}
  finally{if(alive&&current===version){busy=false;render();}}
 };
 cancel.onclick=async()=>{
  if(!local||busy)return;
  const current=++version;stopPoll();busy=true;authorize.hidden=true;message='Cancelling sign-in…';render();
  try{const data=await post('/api/chatgpt/cancel');if(alive&&current===version){message='Sign-in cancelled. Local Socrates is available.';accept(data);}}
  catch(error){if(alive&&current===version){message=error.message;render();}}
  finally{if(alive&&current===version){busy=false;render();}}
 };
 disconnect.onclick=async()=>{
  if(!local||busy)return;
  const current=++version;stopPoll();busy=true;authorize.hidden=true;message='Signing out of ChatGPT…';render();
  try{const data=await post('/api/chatgpt/disconnect');if(alive&&current===version){catalog=[];message=data.revocationWarning||data.chatgpt?.revocationWarning||'Signed out. Your house and local Socrates remain available.';accept(data);}}
  catch(error){if(alive&&current===version){message=error.message;render();}}
  finally{if(alive&&current===version){busy=false;render();}}
 };
 model.onfocus=()=>{if(local&&config.connected&&!catalog.length&&!busy)loadModels();};
 model.onchange=async()=>{
  if(!local||busy||!config.connected)return;
  const current=version,selected=model.value;busy=true;message='';render();
  try{const data=await post('/api/chatgpt/model',{model:selected});if(alive&&current===version){message='ChatGPT model selected for online conversations.';accept(data);}}
  catch(error){if(alive&&current===version){message=error.message;render();}}
  finally{if(alive&&current===version){busy=false;render();}}
 };
 window.addEventListener('pagehide',()=>{alive=false;++version;stopPoll();});
 render();
 return {
  async onLoad(){
   if(!local||!alive)return;
   const current=version;
   try{const data=await request('/api/chatgpt/status');if(!alive||current!==version)return;message='';accept(data);if(config.pending)startPoll();}
   catch(error){if(alive&&current===version){message=error.message;render();}}
  },
  refreshConfig(value){if(!alive)return;message='';accept(value);},
 };
}
