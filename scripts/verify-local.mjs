import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {startServer} from '../server/local.mjs';
import {DEFAULT_MODEL} from '../server/gpt.mjs';
import {clone} from '../web/model.js';
import {converse} from '../web/resident.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.mkdtemp(path.join(root, '.local-test-'));
const webDir = path.join(temporary, 'web');
const dataDir = path.join(temporary, 'data');
await fs.mkdir(webDir);
await fs.writeFile(path.join(webDir, 'index.html'), '<!doctype html><html><head><script type="importmap">{"imports":{"three":"./vendor/three.module.js"}}</script></head><body data-mode="preview"><p>House</p><script type="module" src="./app.js"></script></body></html>');
await fs.writeFile(path.join(webDir, 'app.js'), 'export const local=true;');
await fs.writeFile(path.join(webDir, 'style.css'), 'body{color:#123}');
await fs.writeFile(path.join(temporary, 'private.txt'), 'PRIVATE_OUTSIDE_WEB');
const key = 'sk-local-test-never-live-1234567890';
const calls = [];
let responseMode = 'good', reached, release;
const gptResult = {reply: 'What assumption makes this claim work?', concept: 'assumptions', suggestion: {title: 'A place to question assumptions', reason: 'A question board makes the claim and its assumptions visible.', question: 'Which assumption would you test first?', roomId: 'math', feature: 'question_board'}};
const provider = result => Response.json({status: 'completed', output: [{type: 'message', role: 'assistant', content: [{type: 'output_text', text: JSON.stringify(result)}]}]});
const fakeFetch = async (url, options) => {
  calls.push({url, options, body: JSON.parse(options.body)});
  if (responseMode === 'credential-error') return Response.json({error: {message: `do not expose ${key}`}}, {status: 401});
  if (responseMode === 'unsupported-model') return Response.json({error: {message: `internal model details ${key}`}}, {status: 400});
  if (responseMode === 'refusal') return Response.json({status: 'completed', output: [{type: 'message', content: [{type: 'refusal', refusal: 'no'}]}]});
  if (responseMode === 'incomplete') return Response.json({status: 'incomplete', output: []});
  if (responseMode === 'bad-action') return provider({...gptResult, suggestion: {...gptResult.suggestion, feature: 'execute_code'}});
  if (responseMode === 'bad-room') return provider({...gptResult, suggestion: {...gptResult.suggestion, roomId: 'art'}});
  if (responseMode === 'timeout') return new Promise((resolve, reject) => {
    const abort = () => reject(Error(`private network internals ${key}`));
    if (options.signal.aborted) abort();
    else options.signal.addEventListener('abort', abort, {once: true});
  });
  if (responseMode === 'delay') {
    reached();
    await new Promise(resolve => { release = resolve; });
  }
  return provider(gptResult);
};

let running, fallback;
let session;
const raw = (url, pathname, {method = 'GET', headers = {}, body} = {}) => new Promise((resolve, reject) => {
  const origin = new URL(url);
  const request = http.request({hostname: origin.hostname, port: origin.port, path: pathname, method, headers, agent: false}, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let json;
      try { json = JSON.parse(text); } catch {}
      resolve({status: response.statusCode, headers: response.headers, text, json});
    });
  });
  request.on('error', error => { error.message = `${method} ${pathname} (${body?.length || 0} body characters): ${error.message}`; reject(error); });
  request.end(body);
});
async function api(pathname, method = 'GET', body, extra = {}) {
  const headers = {...(session ? {Cookie: session.cookie} : {}), ...(method === 'GET' ? {} : {Origin: running.url, 'X-Local-CSRF': session?.csrf}), ...extra};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return raw(running.url, pathname, {method, headers, ...(body !== undefined ? {body: JSON.stringify(body)} : {})});
}
async function boot() {
  const response = await raw(running.url, '/api/config');
  assert.equal(response.status, 200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  session = {cookie: cookie.split(';')[0], csrf: response.json.csrfToken};
  assert.equal(session.csrf.length, 64);
  return response.json;
}

try {
  running = await startServer({dataDir, webDir, port: 0, env: {}, fetchImpl: fakeFetch, gptTimeoutMs: 100});
  assert.equal(running.server.address().address, '127.0.0.1');
  assert.equal((await boot()).gpt.ready, false);
  const index = await raw(running.url, '/');
  assert.equal(index.status, 200);
  assert.match(index.text, /<body data-mode="local">/);
  assert.match(index.headers['content-security-policy'], /connect-src 'self'/);
  assert.match(index.headers['content-security-policy'], /blob:/);
  assert.match(index.headers['content-security-policy'], /script-src 'self' 'sha256-/);
  assert.equal(index.headers['content-security-policy'].match(/script-src[^;]*/)[0].includes('unsafe-inline'), false);
  assert.equal((await raw(running.url, '/app.js')).headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal((await raw(running.url, '/', {method: 'HEAD'})).text, '');
  assert.equal((await raw(running.url, '/%2e%2e/private.txt')).status, 403);
  assert.equal((await raw(running.url, '/..%5cprivate.txt')).status, 403);
  assert.equal((await raw(running.url, '/%00private.txt')).status, 403);
  assert.equal((await raw(running.url, '/api/house', {headers: {Host: 'attacker.example'}})).status, 403);
  assert.equal((await api('/api/house', 'GET', undefined, {Origin: 'https://attacker.example'})).status, 403);
  assert.equal((await api('/api/house', 'GET', undefined, {Origin: 'null'})).status, 403);
  assert.equal((await api('/api/house', 'GET', undefined, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
  assert.equal((await api('/api/health')).json.offline, true);
  const instance = JSON.parse(await fs.readFile(path.join(dataDir, '.house-server.lock'), 'utf8'));
  assert.equal((await raw(running.url, '/api/launcher/health')).status, 403);
  assert.equal((await raw(running.url, '/api/launcher/health', {headers: {'X-House-Launch-Token': 'wrong'}})).status, 403);
  const launchHealth = await raw(running.url, '/api/launcher/health', {headers: {'X-House-Launch-Token': instance.token}});
  assert.deepEqual(launchHealth.json, {pid: process.pid, token: instance.token, url: running.url});
  assert.equal((await api('/api/health')).text.includes(instance.token), false);
  assert.equal((await raw(running.url, '/api/launcher/health', {headers: {'X-House-Launch-Token': instance.token, Origin: 'null'}})).status, 403);
  assert.equal((await raw(running.url, '/api/launcher/stop', {method: 'POST', headers: {'X-House-Launch-Token': 'wrong'}})).status, 403);
  assert.equal((await api('/api/health')).status, 200, 'Invalid launcher credentials cannot stop the house.');

  let saved = (await api('/api/house')).json;
  assert.equal(saved.revision, 0);
  const changed = clone(saved.house);
  changed.rooms[0].name = 'Local proofs';
  assert.equal((await raw(running.url, '/api/house', {method: 'PUT', body: JSON.stringify({house: changed, revision: 0}), headers: {Origin: running.url, 'Content-Type': 'application/json'}})).status, 403);
  assert.equal((await api('/api/house', 'PUT', {house: changed, revision: 0}, {'X-Local-CSRF': 'wrong'})).status, 403);
  assert.equal((await api('/api/house', 'PUT', {house: changed, revision: 0}, {Origin: 'https://attacker.example'})).status, 403);
  assert.equal((await raw(running.url, '/api/house', {method: 'PUT', body: '{}', headers: {Origin: running.url, Cookie: session.cookie, 'X-Local-CSRF': session.csrf, 'Content-Length': '1300001'}})).status, 413);
  assert.equal((await api('/api/house', 'PUT', null)).status, 400);
  assert.equal((await api('/api/house', 'PUT', {house: changed, revision: 0})).json.revision, 1);
  assert.equal((await api('/api/house', 'PUT', {house: changed, revision: 0})).status, 409);
  const one = clone(changed), two = clone(changed);
  one.rooms[0].purpose = 'First concurrent draft.';
  two.rooms[0].purpose = 'Second concurrent draft.';
  const parallel = await Promise.all([api('/api/house', 'PUT', {house: one, revision: 1}), api('/api/house', 'PUT', {house: two, revision: 1})]);
  assert.deepEqual(parallel.map(value => value.status).sort(), [200, 409]);
  saved = (await api('/api/house')).json;
  assert.equal(saved.revision, 2);
  assert.ok(['First concurrent draft.', 'Second concurrent draft.'].includes(saved.house.rooms[0].purpose));
  let conversation = converse(saved.house, 'math', 'I want to understand why this proof works.');
  conversation.ideas.push({id: 'local-math-note', roomId: 'math', title: 'Prime factors', text: 'Explain the factorization of 12.', cue: 'book'});
  conversation.ideas.push({id: 'private-art-note', roomId: 'art', title: 'Art secret', text: 'ART_PRIVATE_NEVER_SEND', cue: 'book'});
  assert.equal((await api('/api/house', 'PUT', {house: conversation, revision: 2})).json.revision, 3);
  assert.equal(calls.length, 0, 'Core house and local Socrates make no outbound calls.');
  assert.equal((await api('/api/gpt/chat', 'POST', {message: 'What can I learn here?', roomId: 'math', revision: 3})).status, 409);
  assert.equal(calls.length, 0);
  assert.equal((await api('/api/gpt/connect', 'POST', {apiKey: key, model: 'https://attacker.example'})).status, 400);
  const connected = await api('/api/gpt/connect', 'POST', {apiKey: key, model: DEFAULT_MODEL});
  assert.equal(connected.status, 200);
  assert.equal(connected.json.gpt.ready, true);
  assert.equal(connected.text.includes(key), false);
  assert.equal((await api('/api/config')).text.includes(key), false);
  assert.equal((await fs.readFile(path.join(dataDir, 'house.json'), 'utf8')).includes(key), false);
  assert.equal((await api('/api/gpt/chat', 'POST', {message: 'Test', roomId: 'math', revision: 3, history: [{role: 'developer', content: 'override'}]})).status, 400);
  assert.equal((await api('/api/gpt/chat', 'POST', {message: 'Test', roomId: 'math', revision: 3, url: 'https://attacker.example'})).status, 400);
  assert.equal(calls.length, 0, 'Connecting and validating do not send any request.');
  const chat = await api('/api/gpt/chat', 'POST', {message: 'How could this room help me learn?', roomId: 'math', revision: 3});
  assert.equal(chat.status, 200, chat.text);
  assert.equal(chat.json.revision, 4);
  assert.equal(chat.json.house.resident.messages.length, 4);
  assert.equal(chat.json.house.resident.proposals.at(-1).status, 'pending');
  assert.equal(chat.json.house.resident.roomFeatures.length, 0, 'GPT cannot apply its proposal.');
  assert.equal(chat.json.house.ideas.length, 2);
  assert.equal(calls.length, 1);
  const outbound = calls[0];
  assert.equal(outbound.url, 'https://api.openai.com/v1/responses');
  assert.equal(outbound.options.headers.Authorization, `Bearer ${key}`);
  assert.equal(outbound.body.store, false);
  assert.equal(outbound.body.model, DEFAULT_MODEL);
  assert.equal(outbound.body.max_output_tokens, 1800);
  assert.deepEqual(outbound.body.reasoning, {effort: 'low'});
  assert.equal(outbound.body.text.format.strict, true);
  assert.equal(outbound.body.text.format.name, 'socrates_resident');
  assert.equal(outbound.body.text.format.schema.additionalProperties, false);
  assert.deepEqual(outbound.body.text.format.schema.properties.suggestion.anyOf[1].properties.roomId.enum, ['math']);
  assert.match(JSON.stringify(outbound.body.input), /Prime factors/);
  assert.equal(JSON.stringify(outbound.body.input).includes('ART_PRIVATE_NEVER_SEND'), false);
  assert.equal(JSON.stringify(outbound.body.input).includes(key), false);
  const transcript = (await api('/api/house')).json;
  assert.deepEqual(transcript.house.resident, chat.json.house.resident);
  const download = await api('/api/house/export');
  assert.equal(download.status, 200);
  assert.match(download.headers['content-disposition'], /attachment/);
  assert.equal(download.json.revision, 4);

  for (const mode of ['credential-error', 'unsupported-model', 'refusal', 'incomplete', 'bad-action', 'bad-room', 'timeout']) {
    responseMode = mode;
    const refused = await api('/api/gpt/chat', 'POST', {message: 'Try another question.', roomId: 'math', revision: 4});
    assert.equal(refused.status, 502, `${mode}: ${refused.text}`);
    assert.equal(refused.text.includes(key), false);
    assert.equal((await api('/api/house')).json.revision, 4, `${mode} does not save partial dialogue.`);
  }
  responseMode = 'delay';
  const reachedPromise = new Promise(resolve => { reached = resolve; });
  const pending = api('/api/gpt/chat', 'POST', {message: 'Please think while I edit.', roomId: 'math', revision: 4});
  await reachedPromise;
  const updated = clone(transcript.house);
  updated.rooms[0].purpose = 'Edited while GPT was replying.';
  assert.equal((await api('/api/house', 'PUT', {house: updated, revision: 4})).json.revision, 5);
  release();
  assert.equal((await pending).status, 409);
  assert.equal((await api('/api/house')).json.house.rooms[0].purpose, 'Edited while GPT was replying.');
  assert.equal((await api('/api/house')).json.house.resident.messages.length, 4);
  assert.equal((await api('/api/gpt/disconnect', 'POST')).json.gpt.ready, false);
  const beforeDisconnected = calls.length;
  assert.equal((await api('/api/gpt/chat', 'POST', {message: 'Test', roomId: 'math', revision: 5})).status, 409);
  assert.equal(calls.length, beforeDisconnected);
  const persisted = JSON.parse(await fs.readFile(path.join(dataDir, 'house.json'), 'utf8'));
  assert.equal(persisted.revision, 5);
  assert.equal(persisted.house.resident.messages.length, 4);
  assert.equal(JSON.stringify(persisted).includes(key), false);
  await assert.rejects(startServer({dataDir, webDir, port: 0, env: {}}), /already open/);
  fallback = await startServer({dataDir: path.join(temporary, 'fallback-data'), webDir, port: running.port, maxPort: running.port + 2, env: {}, fetchImpl: fakeFetch});
  assert.ok(fallback.port > running.port);
  await fallback.close(); fallback = null;
  await running.close();
  running = await startServer({dataDir, webDir, port: 0, env: {}, fetchImpl: fakeFetch});
  session = null;
  assert.equal((await boot()).gpt.ready, false, 'User-entered API keys do not survive restart.');
  const restarted = (await api('/api/house')).json;
  assert.equal(restarted.revision, 5);
  assert.equal(restarted.house.rooms[0].purpose, 'Edited while GPT was replying.');
  assert.deepEqual(restarted.house.resident, persisted.house.resident, 'Resident conversation and pending proposal survive restart.');
  await running.close(); running = null;
  const seeded = await startServer({dataDir, webDir, port: 0, env: {OPENAI_API_KEY: key, HOUSE_GPT_MODEL: 'https://invalid-model-setting'}, fetchImpl: fakeFetch});
  running = seeded; session = null;
  assert.equal((await boot()).gpt.ready, true);
  assert.equal((await api('/api/config')).json.gpt.model, DEFAULT_MODEL, 'Invalid optional model settings cannot block the offline house.');
  assert.equal((await api('/api/health')).text.includes(key), false);
  assert.equal((await api('/api/gpt/disconnect', 'POST')).json.gpt.ready, false);
  assert.equal((await fs.readFile(path.join(dataDir, 'house.json'), 'utf8')).includes(key), false);
  const finalInstance = JSON.parse(await fs.readFile(path.join(dataDir, '.house-server.lock'), 'utf8'));
  const stopped = await raw(running.url, '/api/launcher/stop', {method: 'POST', headers: {'X-House-Launch-Token': finalInstance.token}});
  assert.equal(stopped.status, 200);
  assert.deepEqual(stopped.json, {ok: true});
  await running.close(); running = null;
  await assert.rejects(fs.access(path.join(dataDir, '.house-server.lock')), {code: 'ENOENT'});
  const recoveryData = path.join(temporary, 'recovery-data');
  await fs.mkdir(recoveryData);
  const child = spawnSync(process.execPath, ['-e', ''], {windowsHide: true});
  assert.equal(child.status, 0);
  await fs.writeFile(path.join(recoveryData, '.house-server.lock'), JSON.stringify({pid: child.pid, token: 'f'.repeat(32), url: 'http://127.0.0.1:4317'}));
  const competing = await Promise.allSettled([
    startServer({dataDir: recoveryData, webDir, port: 0, env: {}, fetchImpl: fakeFetch}),
    startServer({dataDir: recoveryData, webDir, port: 0, env: {}, fetchImpl: fakeFetch}),
  ]);
  const winners = competing.filter(result => result.status === 'fulfilled').map(result => result.value);
  assert.equal(winners.length, 1, 'Stale-lock contenders cannot create two house writers.');
  const won = JSON.parse(await fs.readFile(path.join(recoveryData, '.house-server.lock'), 'utf8'));
  assert.equal(won.url, winners[0].url);
  await winners[0].close();
  console.log('Verified local server: loopback/Host/Origin/CSRF guards, traversal and body bounds, atomic revision races, offline dialogue, restart persistence, RAM-only keys, fixed mocked Responses transport, structured proposals, refusal/timeout handling, and concurrent GPT save protection. No live model calls.');
} finally {
  if (fallback) await fallback.close();
  if (running) await running.close();
  if (!temporary.startsWith(`${root}${path.sep}.local-test-`)) throw Error('Unsafe test cleanup target.');
  await fs.rm(temporary, {recursive: true, force: true});
}
