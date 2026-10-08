import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {startServer} from '../server/local.mjs';
import {createChatGPTPlanController} from '../server/chatgpt-plan.mjs';
import {requestArtistReply} from '../server/artist-gpt.mjs';
import {legacyStarter,clone} from '../web/model.js';
import {initialNeighborhood} from '../web/neighborhood.js';
import {initialCityNetwork,saveCityNote,validateCityNetwork} from '../web/city-network.js';
import {appendArtistReply,artistConversation} from '../web/artist-dialogue.js';
import {proposeArtistHome,decideArtistHome,artistImprovementBrief} from '../web/artist-homes.js';
import {ARTISTS} from '../web/art-city-data.js';

// All online requests, API credentials and ChatGPT accounts in this suite are
// mocked. Only the actual loopback HTTP server and temporary storage are used.
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'house-artist-ai-http-'));
assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
assert.ok(path.basename(temporary).startsWith('house-artist-ai-http-'));
const webDir=path.join(temporary,'web'),dataDir=path.join(temporary,'data'),file=path.join(dataDir,'house.json');
await fs.mkdir(webDir);await fs.mkdir(dataDir);
await fs.writeFile(path.join(webDir,'index.html'),'<!doctype html><body data-mode="preview">Artist AI test</body>');
const key='sk-artist-test-never-live-1234567890',date='2026-10-08T10:00:00.000Z';
const monet=ARTISTS.find(a=>a.id==='monet'),rodin=ARTISTS.find(a=>a.id==='rodin');
const suggestion={title:'Light beside a quiet window',reason:'Compare your two studies from the same view before interpreting their light.',exercise:'Paint the same small view at two times and name one visible colour difference.',feature:'observation-alcove',atmosphere:'garden'};
const artistResult={reply:'Let us keep one viewpoint and compare the light in your two studies. Which edge changes first?',suggestion};
const socratesResult={reply:'Which assumption would you test here?',concept:'assumptions',suggestion:null};
let network=appendArtistReply(initialCityNetwork(),{artistId:'monet',text:'MONET_PREVIOUS_OWNER_OBSERVATION',reply:'MONET_PREVIOUS_RESIDENT_REPLY',workId:monet.works[0].id,date});
network=appendArtistReply(network,{artistId:'rodin',text:'RODIN_PRIVATE_PREVIOUS_OBSERVATION',reply:'RODIN_PRIVATE_PREVIOUS_REPLY',workId:rodin.works[0].id,date});
network=proposeArtistHome(network,'monet',{...suggestion,title:'MONET_EXISTING_APPROVED_EDITION'});
network=decideArtistHome(network,network.artistHomes.proposals.at(-1).id,'approved');
network=proposeArtistHome(network,'rodin',{...suggestion,title:'RODIN_PRIVATE_DECLINED_DESIGN',feature:'material-table',atmosphere:'quiet'});
network=decideArtistHome(network,network.artistHomes.proposals.at(-1).id,'declined');
const personal=legacyStarter();
personal.ideas.push({id:'private-owner-note',roomId:'math',title:'PRIVATE_PERSONAL_HOUSE_IDEA',text:'PRIVATE_PERSONAL_NOTE_NEVER_SEND',cue:'book'});
personal.personalMetadata={complete:'PRIVATE_PERSONAL_METADATA_NEVER_SEND'};
const neighborhood=initialNeighborhood(personal,{now:date});
neighborhood.activeId='home-1';neighborhood.cityNetwork=network;
const originalBytes=JSON.stringify({version:2,revision:11,neighborhood},null,4)+'\n\n';
await fs.writeFile(file,originalBytes);
const calls=[];
let responseMode='good',responseGate;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const provider=result=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
async function mockedProvider(url,options){
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);calls.push({url,body});
  if(body.text.format.name==='artist_resident')assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,`Bearer ${key}`);
  assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
  if(responseMode==='delay'){
    const gate=responseGate;gate.started.resolve();
    await new Promise((resolve,reject)=>{
      const abort=()=>reject(Error('A cancelled mock request'));
      if(options.signal.aborted){abort();return;}
      options.signal.addEventListener('abort',abort,{once:true});
      gate.release.promise.then(()=>{options.signal.removeEventListener('abort',abort);resolve();});
    });
  }
  if(responseMode==='credential-error')return Response.json({error:{message:`Never expose ${key}`}},{status:401});
  if(responseMode==='bad-action')return provider({...artistResult,suggestion:{...suggestion,feature:'execute_code'}});
  return provider(body.text.format.name==='artist_resident'?artistResult:socratesResult);
}
let running,session;
const launch=()=>startServer({webDir,dataDir,port:0,maxPort:0,env:{OPENAI_API_KEY:key},fetchImpl:mockedProvider,gptTimeoutMs:3000});
const raw=(url,route,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
  const address=new URL(url),request=http.request({hostname:address.hostname,port:address.port,path:route,method,headers,agent:false},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');let data;try{data=JSON.parse(text);}catch{}resolve({status:response.statusCode,headers:response.headers,text,data});});
  });request.on('error',reject);request.end(body);
});
async function boot(){const response=await raw(running.url,'/api/config');assert.equal(response.status,200);session={cookie:response.headers['set-cookie'][0].split(';')[0],csrf:response.data.csrfToken};return response.data;}
async function request(route,input,{method='POST',csrf=session.csrf,origin=running.url,cookie=session.cookie}={}){
  const headers={'Content-Type':'application/json'};
  if(origin!==null)headers.Origin=origin;if(cookie!==null)headers.Cookie=cookie;if(csrf!==null)headers['X-Local-CSRF']=csrf;
  return raw(running.url,route,{method,headers,body:JSON.stringify(input)});
}
async function get(route){const response=await raw(running.url,route);assert.equal(response.status,200,response.text);return response.data;}
const homesBytes=state=>Buffer.from(JSON.stringify(state.neighborhood.homes));
const payload=(revision,extra={})=>({artistId:'monet',workId:monet.works[1].id,message:'  How could your house reflect the changing light?\nKeep one clear viewpoint.  ',provider:'api',revision,...extra});
const deferResponse=()=>{responseMode='delay';responseGate={started:deferred(),release:deferred()};return responseGate;};
const socInput=revision=>({roomId:'math',message:'What assumption should I test?',revision});
try{
  running=await launch();assert.equal((await boot()).gpt.ready,true);
  let state=await get('/api/house');const originalHomes=homesBytes(state),originalArchive=clone(network.artistHomes),originalRodin=clone(artistConversation(network,'rodin'));
  await get('/api/cities');await get('/api/chatgpt/status');
  assert.equal(calls.length,0,'Opening an API-configured house sends no conversation or authentication request.');
  assert.equal(await fs.readFile(file,'utf8'),originalBytes);
  for(const options of [{csrf:null},{csrf:'wrong'},{origin:null},{origin:'https://outside.example'},{cookie:null}]){
    const rejected=await request('/api/artists/chat',payload(state.revision),options);assert.equal(rejected.status,403,rejected.text);
  }
  for(const invalid of [payload(10),payload(12)])assert.equal((await request('/api/artists/chat',invalid)).status,409);
  for(const invalid of [payload(11,{provider:'offline'}),payload(11,{provider:undefined}),payload(11,{artistId:'unknown'}),payload(11,{workId:rodin.works[0].id}),payload(11,{history:[]}),payload(11,{commands:['replace the house']}),payload(11,{message:'x'.repeat(2001)}),payload(11,{revision:-1})]){
    const rejected=await request('/api/artists/chat',invalid);assert.equal(rejected.status,400,rejected.text);
  }
  assert.equal((await request('/api/artists/chat',payload(11),{method:'PUT'})).status,404);
  assert.equal((await request('/api/artists/chat',payload(11,{provider:'chatgpt'}))).status,409,'ChatGPT requires an explicit signed-in session; it cannot fall back to the API key.');
  assert.equal(calls.length,0,'Protection, revision, ownership and input checks all finish before contacting a provider.');
  assert.equal(await fs.readFile(file,'utf8'),originalBytes);

  const result=await request('/api/artists/chat',payload(11));assert.equal(result.status,200,result.text);
  assert.deepEqual(result.data,{...artistResult,revision:11});
  assert.equal(await fs.readFile(file,'utf8'),originalBytes,'Requesting an artist reply writes no conversation, proposal, house or revision.');
  assert.deepEqual(await get('/api/house'),state);
  const outbound=calls.at(-1).body,context=outbound.input.find(message=>message.content.startsWith('Gallery identity'));
  const identity=JSON.parse(context.content.slice(context.content.indexOf('{')));
  assert.equal(identity.artistId,'monet');assert.equal(identity.persona.name,'Claude Monet');
  assert.equal(identity.selectedWorkId,monet.works[1].id);
  assert.deepEqual(identity.works.map(work=>work.id),monet.works.map(work=>work.id));
  assert.deepEqual(outbound.input.slice(-3,-1),[{role:'user',content:'MONET_PREVIOUS_OWNER_OBSERVATION'},{role:'assistant',content:'MONET_PREVIOUS_RESIDENT_REPLY'}]);
  assert.equal(outbound.input.at(-1).content,payload(11).message,'The exact current draft reaches its chosen artist.');
  assert.match(JSON.stringify(outbound.input),/MONET_EXISTING_APPROVED_EDITION/);
  for(const secret of ['RODIN_PRIVATE','PRIVATE_PERSONAL','MONET_EXISTING_APPROVED_EDITION_REPLACEMENT'])assert.equal(JSON.stringify(outbound.input).includes(secret),false);
  assert.equal(outbound.text.format.name,'artist_resident');assert.equal(Object.hasOwn(outbound,'stream'),false);

  // The same append/propose operations used by the UI persist together under
  // the existing city compare-and-swap, independently of archived home choice.
  network=appendArtistReply(network,{artistId:'monet',text:payload(11).message,reply:result.data.reply,workId:monet.works[1].id,date});
  network=proposeArtistHome(network,'monet',result.data.suggestion);
  assert.equal(network.artistHomes.proposals.at(-1).decision,'pending');
  assert.deepEqual(network.artistHomes.editions,originalArchive.editions,'An AI proposal does not build an edition before the owner decides.');
  let saved=await request('/api/cities',{cityNetwork:network,revision:11},{method:'PUT'});assert.equal(saved.status,200,saved.text);state=saved.data;
  assert.equal(state.revision,12);assert.equal(state.neighborhood.activeId,'home-1');
  assert.deepEqual(homesBytes(state),originalHomes);assert.deepEqual(artistConversation(state.cityNetwork,'rodin'),originalRodin);
  assert.deepEqual(state.cityNetwork.artistHomes.proposals.slice(0,2),originalArchive.proposals);
  const pendingBytes=await fs.readFile(file);
  assert.equal((await request('/api/cities',{cityNetwork:initialCityNetwork(),revision:11},{method:'PUT'})).status,409);
  assert.deepEqual(await fs.readFile(file),pendingBytes,'A stale browser cannot erase retained conversations or gallery history.');
  network=decideArtistHome(state.cityNetwork,state.cityNetwork.artistHomes.proposals.at(-1).id,'approved');
  saved=await request('/api/cities',{cityNetwork:network,revision:12},{method:'PUT'});assert.equal(saved.status,200,saved.text);state=saved.data;
  assert.equal(state.cityNetwork.artistHomes.editions.at(-1).number,3);
  assert.deepEqual(state.cityNetwork.artistHomes.editions.slice(0,1),originalArchive.editions);assert.deepEqual(homesBytes(state),originalHomes);
  const brief=artistImprovementBrief(state.cityNetwork,'monet');assert.equal(brief.approvedEditions.length,2);assert.equal(JSON.stringify(brief).includes('MONET_PREVIOUS_OWNER_OBSERVATION'),false);
  const persisted=clone(await get('/api/house'));
  await running.close();running=null;running=await launch();await boot();assert.deepEqual(await get('/api/house'),persisted,'Both whole homes, independent chats, decisions and every old gallery edition survive restart.');
  state=await get('/api/house');network=state.neighborhood.cityNetwork;

  // Schema-valid saves at the correct revision must still preserve history.
  // Removing source references keeps the erased-conversation fixture valid;
  // the HTTP retention guard must reject its actual loss of saved records.
  const erasedConversations=clone(network);delete erasedConversations.artistConversations;
  for(const proposal of erasedConversations.artistHomes.proposals)delete proposal.sourceMessageId;
  const erasedArchive=clone(network);delete erasedArchive.artistHomes;
  const rewrittenApproval=clone(network),rewrittenEdition=rewrittenApproval.artistHomes.editions[0];
  rewrittenEdition.title='A rewritten earlier house';
  rewrittenApproval.artistHomes.proposals.find(proposal=>proposal.id===rewrittenEdition.proposalId).title=rewrittenEdition.title;
  const rewrittenRefusal=clone(network);rewrittenRefusal.artistHomes.proposals.find(proposal=>proposal.decision==='declined').reason='A rewritten earlier refusal';
  const retainedBytes=await fs.readFile(file),retainedCalls=calls.length;
  for(const destructive of [erasedConversations,erasedArchive,rewrittenApproval,rewrittenRefusal]){
    assert.doesNotThrow(()=>validateCityNetwork(destructive),'These requests are valid documents, rather than malformed-schema rejections.');
    const rejected=await request('/api/cities',{cityNetwork:destructive,revision:state.revision},{method:'PUT'});
    assert.equal(rejected.status,409,rejected.text);assert.match(rejected.data.error,/Preserve the artist conversations, decisions and earlier gallery houses/);
    assert.deepEqual(await fs.readFile(file),retainedBytes,'A current-revision replacement cannot erase or rewrite retained artist records.');
    assert.deepEqual(await get('/api/house'),state);
  }
  assert.equal(calls.length,retainedCalls);

  // Reject a result if another tab saves during inference. Keep that tab's
  // complete city update and make no implicit retry or late conversation save.
  let gate=deferResponse();const raced=request('/api/artists/chat',payload(state.revision));await gate.started.promise;
  const racedNetwork=saveCityNote(network,'artists','A concurrent owner note.',{now:date});
  saved=await request('/api/cities',{cityNetwork:racedNetwork,revision:state.revision},{method:'PUT'});assert.equal(saved.status,200);state=saved.data;
  const concurrentBytes=await fs.readFile(file);gate.release.resolve();
  const racedResult=await raced;assert.equal(racedResult.status,409,racedResult.text);assert.match(racedResult.data.error,/while the artist was answering/);
  assert.deepEqual(await fs.readFile(file),concurrentBytes);assert.deepEqual(homesBytes(await get('/api/house')),originalHomes);network=state.cityNetwork;
  responseMode='good';
  for(const mode of ['credential-error','bad-action']){
    responseMode=mode;const before=await fs.readFile(file),failed=await request('/api/artists/chat',payload(state.revision));
    assert.equal(failed.status,502,failed.text);assert.equal(failed.text.includes(key),false);assert.deepEqual(await fs.readFile(file),before);
  }
  responseMode='good';

  // Artist and Socrates requests share the API controller's single active
  // operation, and disconnect cancels each without saving a late response.
  saved=await request('/api/neighborhood/select',{homeId:'home-2',revision:state.revision});assert.equal(saved.status,200);state=saved.data;
  let before=await fs.readFile(file);gate=deferResponse();const heldArtist=request('/api/artists/chat',payload(state.revision));await gate.started.promise;
  let count=calls.length;assert.equal((await request('/api/gpt/chat',socInput(state.revision))).status,409);assert.equal(calls.length,count);
  const disconnected=await request('/api/gpt/disconnect',{});assert.equal(disconnected.status,200);assert.equal(disconnected.data.gpt.ready,false);
  const cancelledArtist=await heldArtist;assert.equal(cancelledArtist.status,502,cancelledArtist.text);gate.release.resolve();assert.deepEqual(await fs.readFile(file),before);
  responseMode='good';count=calls.length;assert.equal((await request('/api/artists/chat',payload(state.revision))).status,409);assert.equal(calls.length,count);
  assert.equal((await request('/api/gpt/connect',{apiKey:key})).status,200);
  gate=deferResponse();const heldSocrates=request('/api/gpt/chat',socInput(state.revision));await gate.started.promise;
  count=calls.length;assert.equal((await request('/api/artists/chat',payload(state.revision))).status,409);assert.equal(calls.length,count);
  assert.equal((await request('/api/gpt/disconnect',{})).status,200);
  const cancelledSocrates=await heldSocrates;assert.equal(cancelledSocrates.status,502,cancelledSocrates.text);gate.release.resolve();assert.deepEqual(await fs.readFile(file),before);
  assert.deepEqual(homesBytes(await get('/api/house')),originalHomes);
  responseMode='good';

  // Mock the account interface, while exercising the real ChatGPT controller,
  // catalog choice and artist SSE transport without OAuth or a paid request.
  let connected=true,modelCalls=0,tokenCalls=0,planMode='good',planGate;
  const planCalls=[],account='oaiapp_mock_artist';
  const auth={status:()=>({connected,account:connected?{id:account,label:'Mock artist account'}:null}),
    async models(){++modelCalls;return [{slug:'plan-model-b',displayName:'Model B'},{slug:'plan-model-a',displayName:'Model A'}];},
    async accessToken(){++tokenCalls;return 'mock-plan-token';},async disconnect(){connected=false;return this.status();},close(){connected=false;}};
  function streamedResult(result){
    const text=JSON.stringify(result),event=(type,data)=>`event: ${type}\r\ndata: ${JSON.stringify({type,...data})}\r\n\r\n`;
    return new Response(event('response.output_text.delta',{delta:text})+event('response.completed',{response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]}}),{headers:{'Content-Type':'text/event-stream'}});
  }
  const plan=createChatGPTPlanController({auth,timeoutMs:3000,fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer mock-plan-token');
    const body=JSON.parse(options.body);planCalls.push(body);assert.equal(body.store,false);assert.equal(body.stream,true);
    for(const field of ['max_output_tokens','reasoning','temperature','tools','previous_response_id'])assert.equal(Object.hasOwn(body,field),false);
    if(planMode==='delay'){const held=planGate;held.started.resolve();await held.release.promise;}
    return streamedResult(body.text.format.name==='artist_resident'?artistResult:socratesResult);
  }});
  assert.equal(modelCalls,0);assert.equal(tokenCalls,0);assert.equal(planCalls.length,0);
  const input={artistId:'monet',workId:monet.works[1].id,message:'How do these studies belong in this house?'};
  assert.deepEqual(await plan.artistChat(input,network,requestArtistReply),artistResult);
  assert.equal(planCalls.at(-1).model,'plan-model-b','ChatGPT uses the first available account catalog model, rather than an API default.');
  assert.equal(modelCalls,1);assert.equal(tokenCalls,1);
  let planCount=planCalls.length;await assert.rejects(plan.selectModel('hidden-model'),/account catalog/);assert.equal(planCalls.length,planCount);
  await plan.selectModel('plan-model-a');await plan.artistChat(input,network,requestArtistReply);assert.equal(planCalls.at(-1).model,'plan-model-a');
  assert.equal(JSON.stringify(planCalls.at(-1).input).includes('RODIN_PRIVATE'),false);
  assert.equal(JSON.stringify(planCalls.at(-1).input).includes('PRIVATE_PERSONAL'),false);
  planMode='delay';planGate={started:deferred(),release:deferred()};let late=plan.artistChat(input,network,requestArtistReply);await planGate.started.promise;
  planCount=planCalls.length;await assert.rejects(plan.chat({roomId:'math',message:'A competing question'},state.house),/current ChatGPT reply/);assert.equal(planCalls.length,planCount);
  plan.reset();await assert.rejects(late,/cancelled|timed out|account changed/);planGate.release.resolve();
  planGate={started:deferred(),release:deferred()};late=plan.chat({roomId:'math',message:'A held Socrates question'},state.house);await planGate.started.promise;
  planCount=planCalls.length;await assert.rejects(plan.artistChat(input,network,requestArtistReply),/current ChatGPT reply/);assert.equal(planCalls.length,planCount);
  plan.reset();planGate.release.resolve();await assert.rejects(late,/cancelled|timed out/);
  await plan.disconnect();plan.close();
  assert.deepEqual(await get('/api/house'),state,'Mock account-controller conversations never touch the HTTP store.');
  validateCityNetwork(network);
  console.log('Artist AI HTTP: explicit protected providers, own persona/history context, read-only replies, shared revisions, atomic reviewed house editions, complete durable archives, API/ChatGPT cancellation and shared resident serialization passed (mock providers only).');
}finally{
  responseGate?.release.resolve();
  await running?.close();assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));await fs.rm(temporary,{recursive:true,force:true});
}
