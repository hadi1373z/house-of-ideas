import {validateHouse,starter} from '../web/model.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function readBounded(request){if(Number(request.headers.get('content-length')||0)>1300000)throw Error('too-large');const reader=request.body?.getReader();if(!reader)throw Error('Empty request.');let n=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>1300000){await reader.cancel();throw Error('too-large');}chunks.push(value);}const bytes=new Uint8Array(n);let at=0;for(const b of chunks){bytes.set(b,at);at+=b.length;}return JSON.parse(new TextDecoder().decode(bytes));}
async function load(db,user){return db.prepare('SELECT document, revision FROM houses WHERE user_id = ?').bind(user).first();}
async function save(db,user,house,revision){return db.prepare('INSERT INTO houses (user_id, document, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET document = excluded.document, revision = houses.revision + 1, updated_at = excluded.updated_at WHERE houses.revision = ? RETURNING revision').bind(user,JSON.stringify(house),new Date().toISOString(),revision).first();}
export default {async fetch(request,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Sign in to open your house.'},401);
 if(!env.DB)return json({error:'Your house storage is unavailable. Please try again.'},503);
 if(url.pathname!=='/api/house')return json({error:'Not found.'},404);
 try{
  if(request.method==='GET'){const row=await load(env.DB,user);return json({house:row?JSON.parse(row.document):starter(),revision:row?.revision||0});}
  if(request.method==='PUT'){
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Save from this house.'},403);
   let data,house;try{data=await readBounded(request);if(!Number.isInteger(data.revision)||data.revision<0)throw Error('Invalid revision.');house=validateHouse(data.house);}catch(e){return json({error:e.message==='too-large'?'Your house data is too large.':e.message},e.message==='too-large'?413:400);}
   const row=await save(env.DB,user,house,data.revision);if(!row)return json({error:'This house changed in another tab. Your draft is still here. Reload before making further changes.'},409);
   return json({revision:row.revision});
  }return json({error:'Method not allowed.'},405);
 }catch(e){console.error('House storage error',e);return json({error:'Could not load or save the house. Your draft is still here; please try again.'},503);}
}};
