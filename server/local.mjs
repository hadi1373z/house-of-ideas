import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {starter, validateHouse, clone} from '../web/model.js';
import {initialNeighborhood,validateNeighborhood,saveEdition,selectEdition,createEdition} from '../web/neighborhood.js';
import {receiveGptResult} from '../web/resident.js';
import {createGptController, validateChatInput} from './gpt.mjs';
import {createDesignAssetStore} from './design-assets.mjs';
import {createChatGPTAuth} from './chatgpt-auth.mjs';
import {createChatGPTPlanController} from './chatgpt-plan.mjs';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BODY_LIMIT = 1300000;
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
class LocalError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

function htmlPolicy(html) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/i.test(match[1]) && match[2].length)
    .map(match => `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  return hashes.length ? CSP.replace("script-src 'self'", `script-src 'self' ${hashes.join(' ')}`) : CSP;
}

function send(response, body, status = 200, headers = {}) {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP, ...headers});
  response.end(JSON.stringify(body));
}

async function readJson(request, limit = BODY_LIMIT) {
  if (Number(request.headers['content-length'] || 0) > limit) throw new LocalError('This request is too large.', 413);
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new LocalError('This request is too large.', 413);
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new LocalError('Send a valid JSON request.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LocalError('Send a JSON object.');
  return value;
}
async function readBinary(request,limit){if(Number(request.headers['content-length']||0)>limit)throw new LocalError('Use a GLB file under 12 MiB.',413);const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>limit)throw new LocalError('Use a GLB file under 12 MiB.',413);chunks.push(chunk);}return Buffer.concat(chunks);}

async function atomicJson(file, value) {
  const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  let written = false;
  try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync(); written = true; }
  finally { await handle.close(); if (!written) await fs.unlink(temporary).catch(() => {}); }
  try { await fs.rename(temporary, file); }
  catch (error) { await fs.unlink(temporary).catch(() => {}); throw error; }
}

async function acquireDataLock(dataDir) {
  await fs.mkdir(dataDir, {recursive: true});
  const file = path.join(dataDir, '.house-server.lock');
  let handle;
  try { handle = await fs.open(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let previous;
    try { previous = JSON.parse(await fs.readFile(file, 'utf8')); } catch { throw Error('The local house lock could not be read. Preserve it before repairing the data folder.'); }
    if (!Number.isInteger(previous.pid) || previous.pid <= 0) throw Error('The local house lock is invalid. Preserve it before repairing the data folder.');
    let active = true;
    try { process.kill(previous.pid, 0); } catch (failure) { if (failure.code === 'ESRCH') active = false; }
    if (active) throw Error('This local house is already open. Use its existing browser tab.');
    // Only one process can recover a stale instance. Recheck identity under the
    // recovery guard, so no contender can unlink a newly acquired live lock.
    const recovery = path.join(dataDir, '.house-server-recovery');
    try { await fs.mkdir(recovery); } catch (failure) { if (failure.code === 'EEXIST') throw Error('This house is recovering its previous local session. Try the launcher again.'); throw failure; }
    try {
      const current = JSON.parse(await fs.readFile(file, 'utf8'));
      if (current.pid !== previous.pid || current.token !== previous.token) throw Error('This local house changed while starting. Try the launcher again.');
      try { process.kill(current.pid, 0); throw Error('This local house is already open. Use its existing browser tab.'); }
      catch (failure) { if (failure.code !== 'ESRCH') throw failure; }
      await fs.unlink(file);
      handle = await fs.open(file, 'wx', 0o600);
    } finally { await fs.rmdir(recovery); }
  }
  const token = randomBytes(16).toString('hex');
  await handle.writeFile(JSON.stringify({pid: process.pid, token, url: null}));
  await handle.close();
  return {
    token,
    async setURL(url) { await fs.writeFile(file, JSON.stringify({pid: process.pid, token, url}), {mode: 0o600}); },
    async release() {
      const current = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '{}'));
      if (current.token === token) await fs.unlink(file);
    },
  };
}

async function openStore(dataDir) {
  await fs.mkdir(dataDir, {recursive: true});
  const file = path.join(dataDir, 'house.json');
  let current;
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    if (![1,2].includes(data.version) || !Number.isInteger(data.revision) || data.revision < 0) throw Error('Invalid local storage envelope.');
    if(data.version===1){
      validateHouse(data.house);const oldHouse=data.house;
      // Preserve the exact prior envelope as well as the visible old house before the upgrade.
      await fs.copyFile(file,path.join(dataDir,'house-before-neighborhood.json'),fs.constants.COPYFILE_EXCL).catch(error=>{if(error.code!=='EEXIST')throw error;});
      current={version:2,revision:data.revision+1,neighborhood:initialNeighborhood(oldHouse)};
      await atomicJson(file,current);
    }else current={version:2,revision:data.revision,neighborhood:validateNeighborhood(data.neighborhood)};
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('The saved local neighbourhood could not be read. Preserve data/house.json before repairing it.');
    current={version:2,revision:0,neighborhood:initialNeighborhood()};
    await atomicJson(file,current);
  }
  let tail = Promise.resolve();
  const read=()=>{const n=clone(current.neighborhood);return {house:clone(n.homes.find(h=>h.id===n.activeId).house),neighborhood:n,revision:current.revision};};
  const mutate=(revision,change)=>{
    const operation=tail.then(async()=>{
      if(revision!==current.revision)throw new LocalError('This house changed in another tab. Your draft is still here. Reload before making further changes.',409);
      let neighborhood;try{neighborhood=validateNeighborhood(change(clone(current.neighborhood)));}catch(error){throw new LocalError(error.message);}
      const next={version:2,revision:current.revision+1,neighborhood};await atomicJson(file,next);current=next;return read();
    });tail=operation.catch(()=>{});return operation;
  };
  return {read,save(house,revision){return mutate(revision,n=>saveEdition(n,validateHouse(house)));},select(homeId,revision){return mutate(revision,n=>selectEdition(n,homeId));},create(revision){return mutate(revision,n=>createEdition(n));},import(neighborhood,revision){return mutate(revision,()=>neighborhood);},async idle(){await tail;}};
}

function cookieSession(request) {
  const match = (request.headers.cookie || '').match(/(?:^|;\s*)house_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1];
}

function equalToken(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function ensureRevision(value) {
  if (!Number.isInteger(value) || value < 0) throw new LocalError('Use the current house revision.');
}

export async function startServer({dataDir = process.env.HOUSE_DATA_DIR || path.join(APP_ROOT, 'data'), webDir = path.join(APP_ROOT, 'web'), port = 4317, maxPort = 4327, env = process.env, fetchImpl = globalThis.fetch, gptTimeoutMs = 30000} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(maxPort) || maxPort < port || maxPort > 65535) throw Error('Use valid local port numbers.');
  dataDir = path.resolve(dataDir);
  const lock = await acquireDataLock(dataDir);
  let store, gpt, assets, chatgptAuth, chatgptPlan;
  try {
    webDir = await fs.realpath(path.resolve(webDir));
    store = await openStore(dataDir);
    gpt = createGptController({env, fetchImpl, timeoutMs: gptTimeoutMs});
    assets=await createDesignAssetStore(dataDir);
    try{chatgptAuth=await createChatGPTAuth({dataDir,fetchImpl});}catch{const message='ChatGPT registration could not be read. Your existing registration file is preserved; the offline house remains available.';const unavailable=()=>{throw new LocalError(message,409);};chatgptAuth={status:()=>({connected:false,pending:false,planEnabled:false,account:null,accounts:[],sessionOnly:true,error:message}),begin:unavailable,complete:unavailable,models:unavailable,accessToken:unavailable,cancel(){},disconnect:async()=>{},close(){}};}
    chatgptPlan=createChatGPTPlanController({auth:chatgptAuth,fetchImpl,timeoutMs:gptTimeoutMs});
  } catch (error) { await lock.release(); throw error; }
  const sessions = new Map();
  let origin = '';
  let closeServer;
  const headersForSession = request => {
    const now = Date.now();
    for (const [id, session] of sessions) if (now - session.seen > 12 * 60 * 60 * 1000) sessions.delete(id);
    let id = cookieSession(request), session = sessions.get(id);
    if (!session) {
      if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
      id = randomBytes(32).toString('hex'); session = {csrf: randomBytes(32).toString('hex'), seen: now}; sessions.set(id, session);
    }
    session.seen = now;
    return {session, headers: {'Set-Cookie': `house_session=${id}; HttpOnly; SameSite=Strict; Path=/`}};
  };
  const requireMutation = request => {
    if (request.headers.origin !== origin) throw new LocalError('Save from your local house page.', 403);
    const session = sessions.get(cookieSession(request));
    if (!session || Date.now() - session.seen > 12 * 60 * 60 * 1000 || !equalToken(request.headers['x-local-csrf'], session.csrf)) throw new LocalError('Reopen local settings to refresh this browser session.', 403);
    session.seen = Date.now();
  };
  const handler = async (request, response) => {
    try {
      if (request.headers.host !== new URL(origin).host) throw new LocalError('Use the local house address.', 403);
      const callbackRequest=request.method==='GET'&&request.url?.split('?')[0]==='/auth/callback';
      if (!callbackRequest&&request.headers.origin !== undefined && request.headers.origin !== origin) throw new LocalError('Open the local house directly.', 403);
      if (!callbackRequest&&request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site'])) throw new LocalError('Open the local house directly.', 403);
      if (!request.url || !request.url.startsWith('/') || request.url.startsWith('//')) throw new LocalError('Invalid local path.');
      const rawPath = request.url.split('?')[0];
      let decoded;
      try { decoded = decodeURIComponent(rawPath); } catch { throw new LocalError('Invalid local path.'); }
      if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(part => part === '..' || part === '.')) throw new LocalError('Invalid local path.', 403);
      const url = new URL(request.url, origin);
      if(url.pathname==='/auth/callback'&&request.method==='GET'){await chatgptAuth.complete(url.searchParams);chatgptPlan.reset();response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':CSP});response.end('<!doctype html><title>House of Ideas connected</title><h1>ChatGPT connection complete</h1><p>Return to House of Ideas and choose a model. Conversations use your plan only when you explicitly select ChatGPT and send a message.</p><a href="/">Return to your house</a>');return;}
      if (url.pathname === '/api/launcher/health' && request.method === 'GET') {
        if (!equalToken(request.headers['x-house-launch-token'], lock.token)) throw new LocalError('Use the local house launcher.', 403);
        return send(response, {pid: process.pid, token: lock.token, url: origin});
      }
      if (url.pathname === '/api/launcher/stop' && request.method === 'POST') {
        if (!equalToken(request.headers['x-house-launch-token'], lock.token)) throw new LocalError('Use the local house launcher.', 403);
        send(response, {ok: true});
        setImmediate(() => { closeServer().catch(() => {}); });
        return;
      }
      if (url.pathname === '/api/health' && request.method === 'GET') return send(response, {ok: true, mode: 'local', offline: true, gpt: gpt.config()});
      if (['/api/config', '/api/gpt/config'].includes(url.pathname) && request.method === 'GET') {
        const {session, headers} = headersForSession(request);
        return send(response, {mode: 'local', csrfToken: session.csrf, gpt: gpt.config(),chatgpt:chatgptPlan.config()}, 200, headers);
      }
      if (url.pathname === '/api/house') {
        if (request.method === 'GET') return send(response, store.read());
        if (request.method === 'PUT') {
          requireMutation(request);
          const input = await readJson(request);
          ensureRevision(input.revision);
          const known=new Set((store.read().house.designObjects||[]).map(o=>o.assetId));for(const object of validateHouse(input.house).designObjects||[])if(!known.has(object.assetId)&&!await assets.has(object.assetId))throw new LocalError('Import this design’s GLB file before placing it in the house.');
          const saved = await store.save(input.house, input.revision);
          return send(response, {revision:saved.revision,neighborhood:saved.neighborhood});
        }
        throw new LocalError('Method not allowed.', 405);
      }
      if (['/api/neighborhood/select','/api/neighborhood/create'].includes(url.pathname) && request.method==='POST') {
        requireMutation(request);const input=await readJson(request,4096);ensureRevision(input.revision);
        const saved=url.pathname.endsWith('/select')?await store.select(input.homeId,input.revision):await store.create(input.revision);
        return send(response,saved);
      }
      if(url.pathname==='/api/neighborhood/import'&&request.method==='POST'){requireMutation(request);const input=await readJson(request);ensureRevision(input.revision);const next=validateHouse(input.house);for(const object of next.designObjects||[])if(!await assets.has(object.assetId))throw new LocalError('Import the template’s GLB files before building it.');const current=store.read();if(input.revision!==current.revision)throw new LocalError('This house changed. Reload before importing a design.',409);const neighborhood=createEdition(current.neighborhood,next,{edition:'atelier',title:'Imported designer home'});const saved=await store.import(neighborhood,input.revision);return send(response,saved);}
      if(url.pathname==='/api/design-assets'&&request.method==='POST'){requireMutation(request);if(request.headers['content-type']!=='application/octet-stream')throw new LocalError('Send a GLB file.');const bytes=await readBinary(request,12*1024*1024);try{return send(response,await assets.import(bytes));}catch(error){if(error.status)throw error;throw new LocalError(error.message);}}
      if(/^\/assets\/[a-f0-9]{64}\.glb$/.test(url.pathname)&&['GET','HEAD'].includes(request.method)){const bytes=await assets.read(url.pathname.slice(8,-4));response.writeHead(200,{'Content-Type':'model/gltf-binary','Content-Length':bytes.length,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':CSP});response.end(request.method==='HEAD'?undefined:bytes);return;}
      if(url.pathname==='/api/chatgpt/status'&&request.method==='GET')return send(response,chatgptPlan.config());
      if(url.pathname==='/api/chatgpt/models'&&request.method==='GET'){const session=sessions.get(cookieSession(request));if(!session||!equalToken(request.headers['x-local-csrf'],session.csrf))throw new LocalError('Open your local house before requesting models.',403);return send(response,{models:await chatgptPlan.models(),chatgpt:chatgptPlan.config()});}
      if(url.pathname.startsWith('/api/chatgpt/')&&request.method==='POST'&&!url.pathname.endsWith('/chat')){requireMutation(request);const input=await readJson(request,4096);if(url.pathname.endsWith('/start')){chatgptPlan.reset();const result=await chatgptAuth.begin(origin,{accountId:input.accountId});return send(response,{...result,chatgpt:chatgptPlan.config()});}if(url.pathname.endsWith('/cancel')){chatgptAuth.cancel();return send(response,chatgptPlan.config());}if(url.pathname.endsWith('/disconnect'))return send(response,await chatgptPlan.disconnect());if(url.pathname.endsWith('/model')){await chatgptPlan.selectModel(input.model);return send(response,chatgptPlan.config());}throw new LocalError('Not found.',404);}
      if (url.pathname === '/api/house/export' && request.method === 'GET') {
        const session = sessions.get(cookieSession(request));
        if (!session || Date.now() - session.seen > 12 * 60 * 60 * 1000) throw new LocalError('Open your local house before exporting it.', 403);
        return send(response, {...store.read(), exportedAt: new Date().toISOString()}, 200, {'Content-Disposition': 'attachment; filename="house-of-ideas.json"'});
      }
      if (url.pathname === '/api/gpt/connect' && request.method === 'POST') {
        requireMutation(request);
        const input = await readJson(request, 4096);
        return send(response, {gpt: gpt.connect(input)});
      }
      if (url.pathname === '/api/gpt/disconnect' && request.method === 'POST') {
        requireMutation(request);
        return send(response, {gpt: gpt.disconnect()});
      }
      if (['/api/gpt/chat','/api/chatgpt/chat'].includes(url.pathname) && request.method === 'POST') {
        requireMutation(request);
        const input = await readJson(request, 40000);
        ensureRevision(input.revision);
        const before = store.read();
        if(before.neighborhood.activeId!==before.neighborhood.homes.at(-1).id)throw new LocalError('This older home is preserved. Build a new edition next door before starting a new conversation.',409);
        if (input.revision !== before.revision) throw new LocalError('This house changed. Reload before asking GPT.', 409);
        const checked = validateChatInput(input, before.house);
        const result = await (url.pathname==='/api/chatgpt/chat'?chatgptPlan:gpt).chat(checked, before.house);
        const next = receiveGptResult(before.house, checked.roomId, checked.message, result);
        const saved = await store.save(next, before.revision);
        return send(response, {result, ...saved});
      }
      if (url.pathname.startsWith('/api/')) throw new LocalError('Not found.', 404);
      if (!['GET', 'HEAD'].includes(request.method)) throw new LocalError('Method not allowed.', 405);
      const relative = decoded === '/' ? 'index.html' : decoded.slice(1);
      const candidate = path.resolve(webDir, relative);
      if (!candidate.startsWith(`${webDir}${path.sep}`)) throw new LocalError('Invalid local path.', 403);
      let file;
      try { file = await fs.realpath(candidate); } catch (error) { if (error.code === 'ENOENT') throw new LocalError('Not found.', 404); throw error; }
      if (!file.startsWith(`${webDir}${path.sep}`)) throw new LocalError('Invalid local path.', 403);
      const stat = await fs.stat(file);
      if (!stat.isFile()) throw new LocalError('Not found.', 404);
      const extension = path.extname(file).toLowerCase();
      if (!MIME[extension]) throw new LocalError('Not found.', 404);
      let bytes = await fs.readFile(file);
      if (file === path.join(webDir, 'index.html')) bytes = Buffer.from(bytes.toString('utf8').replace(/<body(?:\s[^>]*)?>/i, '<body data-mode="local">'));
      response.writeHead(200, {'Content-Type': MIME[extension], 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': extension === '.html' ? htmlPolicy(bytes.toString('utf8')) : CSP});
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      if (Number.isInteger(error.status)) return send(response, {error: error.message}, error.status, error.status === 413 ? {Connection: 'close'} : {});
      // Filesystem/API internals and credentials stay out of browser errors.
      send(response, {error: 'The local house could not complete this request. Your saved file is preserved.'}, 503);
    }
  };
  const server = http.createServer((request, response) => { handler(request, response); });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 3000;
  let selected = port;
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        const failed = error => { server.off('listening', listening); reject(error); };
        const listening = () => { server.off('error', failed); resolve(); };
        server.once('error', failed); server.once('listening', listening); server.listen(selected, '127.0.0.1');
      });
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || port === 0 || selected >= maxPort) { gpt.disconnect(); chatgptPlan.close(); await lock.release(); throw Error('Could not open a local house port. Close the previous launcher and try again.'); }
      selected++;
    }
  }
  selected = server.address().port;
  origin = `http://127.0.0.1:${selected}`;
  try { await lock.setURL(origin); }
  catch (error) { await new Promise(resolve => server.close(resolve)); gpt.disconnect(); chatgptPlan.close(); await lock.release(); throw error; }
  let closing;
  closeServer = () => {
    if (!closing) closing = (async () => {
      gpt.disconnect();
      chatgptPlan.close();
      try {
        await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
        await store.idle();
      } finally { await lock.release(); }
    })();
    return closing;
  };
  return {server, url: origin, port: selected, dataDir, close: closeServer};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const running = await startServer();
    process.stdout.write(`${JSON.stringify({url: running.url, mode: 'local'})}\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await running.close(); process.exit(0); });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
