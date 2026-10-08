import assert from 'node:assert/strict';
import {generateKeyPairSync, sign, createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createChatGPTAuth} from '../server/chatgpt-auth.mjs';
import {createChatGPTPlanController, requestChatGPTReply} from '../server/chatgpt-plan.mjs';
import {starter} from '../web/model.js';

// All OAuth, model-catalog and inference requests in this suite are mocks.
const root = await mkdtemp(join(tmpdir(), 'house-chatgpt-'));
const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'test-key', use: 'sig', alg: 'RS256'};
let clock = Date.UTC(2026, 9, 8, 12), authorization, issued = 'oaiapp_test_one', subject = 'account-one';
let expiresIn = 3600, granted = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
let mutateClaims = value => value, mutateToken = value => value, tokenWait = null, refreshWait = null, revokeFailed = false;
let tokenRequests = 0, refreshRequests = 0, revokeRequests = 0, lastExchange;
let catalogVariant = 'normal', catalogCancelled = 0, catalogBytesRead = 0, catalogStarted;
let tokenExtraBytes = 0;
const calls = [];
const access = 'mock-access-secret', refresh = 'mock-refresh-secret';
function jwt(claims) {
  const head = Buffer.from(JSON.stringify({alg: 'RS256', kid: 'test-key'})).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${head}.${body}.${sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`;
}
function tokenPayload() {
  return {token_type: 'Bearer', access_token: access, refresh_token: refresh, expires_in: expiresIn, scope: granted,
    id_token: mutateToken(jwt(mutateClaims({iss: 'https://auth.openai.com', aud: issued, sub: subject, name: 'Test resident', nonce: authorization.searchParams.get('nonce'), iat: clock / 1000, exp: clock / 1000 + 3600}))), ...(tokenExtraBytes ? {metadata: 'x'.repeat(tokenExtraBytes)} : {})};
}
function json(value, status = 200) { return new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}}); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; }
const modelCatalog = {models: [{slug: 'plan-model-b', display_name: 'Available model B', visibility: 'list'}, {slug: 'hidden-model', display_name: 'Hidden', visibility: 'hide'}, {slug: 'plan-model-a', display_name: 'Available model A', visibility: 'list'}]};
function catalogStream(text, {hold = false} = {}) {
  const bytes = new TextEncoder().encode(text); let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      catalogStarted?.resolve();
      if (offset >= bytes.length) { if (!hold) controller.close(); return; }
      const chunk = bytes.slice(offset, offset + 32768);
      offset += chunk.length; catalogBytesRead += chunk.length; controller.enqueue(chunk);
    },
    cancel() { ++catalogCancelled; },
  }), {headers: {'Content-Type': 'application/json'}});
}
async function fetchAuth(url, options = {}) {
  calls.push({url, method: options.method || 'GET'});
  assert.equal(options.redirect, 'error');
  if (url === 'https://auth.openai.com/.well-known/jwks.json') return json({keys: [jwk]});
  if (url === 'https://auth.openai.com/api/accounts/oauth/token') {
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('resource'), 'https://api.openai.com/v1');
    assert.equal(form.has('client_secret'), false);
    assert.equal(form.has('scope'), false);
    if (form.get('grant_type') === 'refresh_token') {
      ++refreshRequests;
      assert.equal(form.get('client_id'), 'oaiapp_test_one');
      assert.equal(form.get('refresh_token'), refresh);
      if (refreshWait) await refreshWait.promise;
      return json({token_type: 'Bearer', access_token: 'mock-renewed-secret', refresh_token: 'mock-rotated-secret', expires_in: 3600, scope: granted});
    }
    ++tokenRequests; lastExchange = form;
    assert.equal(form.get('client_id'), issued);
    assert.equal(form.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
    assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'), authorization.searchParams.get('code_challenge'));
    if (tokenWait) await tokenWait.promise;
    return json(tokenPayload());
  }
  if (url === 'https://api.openai.com/v1/models') {
    assert.match(options.headers.Authorization, /^Bearer mock-(?:access|renewed)-secret$/);
    if (catalogVariant === 'large') return json({...modelCatalog, metadata: 'x'.repeat(160000)});
    if (catalogVariant === 'too-big') return catalogStream(JSON.stringify({...modelCatalog, metadata: 'x'.repeat(3 * 1024 * 1024)}));
    if (catalogVariant === 'held') return catalogStream('{"models":[', {hold: true});
    if (catalogVariant === 'too-many') return json({models: Array.from({length: 501}, (_, index) => ({slug: `model-${index}`, display_name: 'Model', visibility: 'list'}))});
    if (catalogVariant === 'null') return json(null);
    return json(modelCatalog);
  }
  if (url === 'https://auth.openai.com/.well-known/openid-configuration') return json({revocation_endpoint: 'https://auth.openai.com/api/accounts/oauth/revoke'});
  if (url === 'https://auth.openai.com/api/accounts/oauth/revoke') {
    ++revokeRequests;
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('token_type_hint'), 'refresh_token');
    assert.ok([refresh, 'mock-rotated-secret'].includes(form.get('token')));
    assert.equal(form.get('client_id'), 'oaiapp_test_one');
    return new Response('', {status: revokeFailed ? 503 : 200});
  }
  throw Error(`Unexpected mocked request: ${url}`);
}
async function begin(auth, options) {
  const result = await auth.begin('http://127.0.0.1:4318', options);
  authorization = new URL(result.authorizationUrl);
  return result;
}
function callback({client = true, state = authorization.searchParams.get('state'), error} = {}) {
  const query = new URLSearchParams({state, code: 'mock-code'});
  if (client) query.set('client_id', issued);
  if (error) query.set('error', error);
  return query;
}
async function signIn(auth) { await begin(auth); return auth.complete(callback()); }

try {
  const auth = await createChatGPTAuth({dataDir: root, fetchImpl: fetchAuth, now: () => clock});
  assert.deepEqual(auth.status(), {connected: false, pending: false, planEnabled: false, account: null, accounts: [], sessionOnly: true});
  assert.equal(calls.length, 0, 'Opening the offline app makes no auth request.');
  await assert.rejects(auth.begin('http://localhost:4318'), /127\.0\.0\.1/);
  await assert.rejects(auth.begin('https://example.com'), /127\.0\.0\.1/);
  await assert.rejects(auth.begin('http://127.0.0.1:4318/path'), /127\.0\.0\.1/);
  await assert.rejects(auth.begin('http://127.0.0.1:4318', {accountId: 'unknown'}), /saved ChatGPT account/);
  await begin(auth);
  assert.equal(authorization.hostname, 'auth.openai.com');
  assert.equal(authorization.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(authorization.searchParams.get('agent_name_hint'), 'House of Ideas');
  assert.equal(authorization.searchParams.get('redirect_uri'), 'http://127.0.0.1:4318/auth/callback');
  const firstState = authorization.searchParams.get('state'), firstNonce = authorization.searchParams.get('nonce'), hostId = authorization.searchParams.get('ext_agent_host_id');
  await assert.rejects(auth.complete(callback({state: 'other'})), /does not match/);
  assert.equal(tokenRequests, 0);
  await assert.rejects(auth.complete(callback({error: 'access_denied'})), /not approved/);
  assert.equal(tokenRequests, 0);
  await begin(auth);
  assert.notEqual(authorization.searchParams.get('state'), firstState);
  assert.notEqual(authorization.searchParams.get('nonce'), firstNonce);
  assert.equal(authorization.searchParams.get('ext_agent_host_id'), hostId);
  const duplicateState = callback(); duplicateState.append('state', firstState);
  await assert.rejects(auth.complete(duplicateState), /callback is invalid/);
  assert.equal(tokenRequests, 0);
  await assert.rejects(auth.complete(callback({client: false})), /expected client ID/);
  assert.equal(tokenRequests, 0);
  await begin(auth); clock += 10 * 60 * 1000 + 1;
  await assert.rejects(auth.complete(callback()), /expired/);
  assert.equal(tokenRequests, 0);

  for (const change of [
    claims => ({...claims, iss: 'https://evil.example'}),
    claims => ({...claims, aud: 'other-client'}),
    claims => ({...claims, nonce: 'other-nonce'}),
    claims => ({...claims, exp: clock / 1000 - 1}),
    claims => ({...claims, sub: ''}),
    claims => ({...claims, aud: [issued, 'other-client']}),
    claims => ({...claims, nbf: clock / 1000 + 120}),
  ]) {
    mutateClaims = change;
    await begin(auth); await assert.rejects(auth.complete(callback()), /identity could not be verified/);
    assert.equal(auth.status().connected, false);
  }
  mutateClaims = value => value;
  mutateToken = value => {
    const parts = value.split('.');
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
    return parts.join('.');
  };
  await begin(auth); await assert.rejects(auth.complete(callback()), /identity could not be verified/);
  mutateToken = value => value;
  granted = 'openid profile';
  await begin(auth); await assert.rejects(auth.complete(callback()), /plan use was not authorized/);
  granted = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
  await signIn(auth);
  await assert.rejects(auth.complete(callback()), /expired/, 'A consumed authorization code cannot be replayed.');
  assert.equal(auth.status().connected, true);
  assert.equal(auth.status().account.id, issued);
  assert.equal(auth.status().accounts.length, 1);
  assert.equal(lastExchange.get('client_id'), issued);
  assert.deepEqual(await auth.models(), [{slug: 'plan-model-b', displayName: 'Available model B'}, {slug: 'plan-model-a', displayName: 'Available model A'}]);
  // Real catalogs carry metadata that the house does not retain. A valid larger
  // document must not fail the much smaller authentication-document bound.
  catalogVariant = 'large';
  assert.ok(Buffer.byteLength(JSON.stringify({...modelCatalog, metadata: 'x'.repeat(160000)})) > 128000);
  assert.deepEqual(await auth.models(), [{slug: 'plan-model-b', displayName: 'Available model B'}, {slug: 'plan-model-a', displayName: 'Available model A'}]);
  assert.equal(JSON.stringify(await auth.models()).includes('metadata'), false);
  catalogVariant = 'too-big'; catalogBytesRead = 0;
  await assert.rejects(auth.models(), /model catalog.*2 MiB/);
  assert.equal(catalogCancelled, 1, 'An oversized catalog cancels the response body.');
  assert.ok(catalogBytesRead <= 2 * 1024 * 1024 + 2 * 32768, 'The stream stops near the cap instead of buffering the whole response.');
  assert.equal(auth.status().connected, true, 'A failed catalog request retains the signed-in account.');
  for (const variant of ['too-many', 'null']) {
    catalogVariant = variant;
    await assert.rejects(auth.models(), /unreadable model catalog/);
  }
  // Abort after response headers have already arrived, while its body is held.
  catalogVariant = 'held'; catalogStarted = deferred();
  const heldCatalog = auth.models();
  await catalogStarted.promise;
  await new Promise(resolve => setTimeout(resolve, 0));
  auth.cancel();
  await assert.rejects(heldCatalog, error => error.status === 409 && /cancelled/.test(error.message));
  assert.equal(catalogCancelled, 2, 'Cancellation reaches an in-progress catalog reader.');
  assert.equal(auth.status().connected, true);
  catalogVariant = 'normal'; catalogStarted = null;
  // Authentication responses retain their original cap; this change is not an
  // unrestricted relaxation for signed credentials or identity documents.
  tokenExtraBytes = 160000;
  await begin(auth); await assert.rejects(auth.complete(callback()), /sign-in response.*128 KB/);
  assert.equal(auth.status().connected, true);
  tokenExtraBytes = 0;

  const timed = await createChatGPTAuth({dataDir: join(root, 'timeout-check'), fetchImpl: fetchAuth, now: () => clock, timeoutMs: 100});
  await signIn(timed);
  catalogVariant = 'held'; catalogStarted = deferred();
  const timedCatalog = timed.models();
  await catalogStarted.promise;
  // Keep this mock process awake; AbortSignal.timeout deliberately uses an
  // unreferenced timer and the mock stream has no real socket handle.
  const alive = setTimeout(() => {}, 1000);
  try { await assert.rejects(timedCatalog, error => error.status === 504 && /timed out/.test(error.message)); }
  finally { clearTimeout(alive); timed.close(); }
  assert.equal(catalogCancelled, 3, 'The connection timeout cancels a body that never finishes.');
  catalogVariant = 'normal'; catalogStarted = null;
  const stored = await readFile(join(root, 'chatgpt-registration.json'), 'utf8');
  assert.equal(stored.includes(access), false);
  assert.equal(stored.includes(refresh), false);
  assert.equal(stored.includes('id_token'), false);
  assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['accounts', 'hostId', 'version']);
  assert.deepEqual(Object.keys(JSON.parse(stored).accounts[0]).sort(), ['id', 'label', 'subject']);
  assert.equal(JSON.stringify(auth.status()).includes(access), false);
  assert.equal(JSON.stringify(auth.status()).includes(subject), false);
  const restarted = await createChatGPTAuth({dataDir: root, fetchImpl: fetchAuth, now: () => clock});
  assert.equal(restarted.status().connected, false, 'OAuth tokens do not survive restart.');
  await begin(restarted, {accountId: issued});
  assert.equal(authorization.searchParams.get('client_id'), issued);
  assert.equal(authorization.searchParams.has('agent_name_hint'), false);
  assert.equal(authorization.searchParams.get('ext_agent_host_id'), hostId);
  await restarted.complete(callback({client: false}));
  restarted.close();

  // A failed account replacement preserves the already validated active one.
  await begin(auth); granted = 'openid';
  await assert.rejects(auth.complete(callback()), /plan use was not authorized/);
  assert.equal(auth.status().connected, true);
  granted = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
  await begin(auth, {accountId: issued});
  const wrongClient = callback(); wrongClient.set('client_id', 'oaiapp_other');
  await assert.rejects(auth.complete(wrongClient), /expected client ID/);
  await begin(auth, {accountId: issued}); subject = 'wrong-account';
  await assert.rejects(auth.complete(callback()), /does not match/);
  subject = 'account-one';

  // Refresh is serialized and rotating credentials replace each other together.
  expiresIn = 1; await signIn(auth);
  refreshWait = deferred();
  const renewedA = auth.accessToken(), renewedB = auth.accessToken();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(refreshRequests, 1);
  refreshWait.resolve();
  assert.deepEqual(await Promise.all([renewedA, renewedB]), ['mock-renewed-secret', 'mock-renewed-secret']);
  refreshWait = null;
  assert.equal(JSON.stringify(auth.status()).includes('mock-renewed-secret'), false);
  assert.equal((await auth.disconnect()).connected, false);
  assert.equal(revokeRequests, 1);
  expiresIn = 3600;

  // A cancelled, consumed callback cannot install late credentials.
  await begin(auth); tokenWait = deferred();
  const lateCallback = auth.complete(callback());
  await new Promise(resolve => setTimeout(resolve, 0));
  auth.cancel(); tokenWait.resolve();
  await assert.rejects(lateCallback, /cancelled/);
  assert.equal(auth.status().connected, false);
  tokenWait = null;
  await assert.rejects(auth.complete(callback()), /expired/);
  expiresIn = 1; await signIn(auth); refreshWait = deferred();
  const lateRefresh = auth.accessToken();
  await new Promise(resolve => setTimeout(resolve, 0));
  auth.close(); refreshWait.resolve();
  await assert.rejects(lateRefresh, /cancelled/);
  assert.equal(auth.status().connected, false);
  refreshWait = null; expiresIn = 3600;
  await signIn(auth); revokeFailed = true;
  const signedOut = await auth.disconnect();
  assert.equal(signedOut.connected, false);
  assert.match(signedOut.revocationWarning, /not confirmed/);
  revokeFailed = false;

  issued = 'oaiapp_test_two'; subject = 'account-two';
  await signIn(auth);
  assert.equal(auth.status().accounts.length, 2);
  assert.equal(new Set(auth.status().accounts.map(account => account.label)).size, 2, 'Account labels remain distinct even if display names match.');
  auth.close(); issued = 'oaiapp_test_one'; subject = 'account-one';

  const house = starter(), input = {roomId: house.rooms[0].id, message: 'How can this room help me examine my assumptions?'};
  const result = {reply: 'Which assumption would you put to a practical test?', concept: 'assumptions', suggestion: {title: 'Make an assumption visible', reason: 'A visible question gives you something specific to test.', question: 'What would make you revise it?', roomId: input.roomId, feature: 'question_board'}};
  let planCalls = 0, observedBody, streamVariant = 'valid', replyWait = null;
  function event(type, payload) { return `event: ${type}\r\ndata: ${JSON.stringify({type, ...payload})}\r\n\r\n`; }
  function streamResponse(text) {
    const bytes = new TextEncoder().encode(text); let offset = 0;
    return new Response(new ReadableStream({pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset + 17)); offset += 17;
    }}), {headers: {'Content-Type': 'text/event-stream; charset=utf-8'}});
  }
  async function fetchPlan(url, options) {
    ++planCalls; assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, `Bearer ${access}`);
    observedBody = JSON.parse(options.body);
    assert.equal(observedBody.model, 'plan-model-b');
    assert.equal(observedBody.store, false); assert.equal(observedBody.stream, true);
    for (const field of ['max_output_tokens', 'previous_response_id', 'background', 'temperature', 'tools']) assert.equal(Object.hasOwn(observedBody, field), false);
    assert.equal(observedBody.input.some(message => message.role === 'system'), false);
    assert.equal(observedBody.text.format.strict, true);
    if (replyWait) await replyWait.promise;
    const responseText = JSON.stringify(streamVariant === 'extra' ? {...result, commands: ['delete files']} : streamVariant === 'wrong-room' ? {...result, suggestion: {...result.suggestion, roomId: 'other'}} : result);
    if (streamVariant === 'oversize') return streamResponse(event('response.output_text.delta', {delta: 'x'.repeat(12001)}));
    if (streamVariant === 'failure') return streamResponse(event('response.failed', {response: {status: 'failed'}}));
    if (streamVariant === 'incomplete') return streamResponse(event('response.output_text.delta', {delta: responseText}));
    if (streamVariant === 'refusal') return streamResponse(event('response.refusal.delta', {delta: 'no'}));
    return streamResponse((streamVariant === 'no-delta' ? '' : event('response.output_text.delta', {delta: responseText})) + event('response.completed', {response: {status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text: responseText}]}]}}));
  }
  await signIn(auth);
  const plan = createChatGPTPlanController({auth, fetchImpl: fetchPlan});
  assert.equal(plan.config().model, null);
  assert.deepEqual(await plan.models(), [{slug: 'plan-model-b', displayName: 'Available model B'}, {slug: 'plan-model-a', displayName: 'Available model A'}]);
  assert.equal(plan.config().model, 'plan-model-b', 'Default follows account catalog ordering.');
  await assert.rejects(plan.selectModel('hidden-model'), /account catalog/);
  await assert.rejects(plan.chat({...input, commands: []}, house), /only the message/);
  assert.equal(planCalls, 0);
  assert.deepEqual(await plan.chat(input, house), result);
  streamVariant = 'no-delta';
  assert.deepEqual(await plan.chat(input, house), result);
  assert.equal(observedBody.input.at(-1).content, input.message);
  for (const variant of ['extra', 'wrong-room', 'oversize', 'failure', 'incomplete', 'refusal']) {
    streamVariant = variant;
    await assert.rejects(plan.chat(input, house), /outside the allowed|too large|did not complete|ended before|could not answer/);
  }
  await assert.rejects(requestChatGPTReply({auth, input, house, fetchImpl: fetchPlan}), /Choose an available/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(requestChatGPTReply({auth, model: 'plan-model-b', input, house, signal: cancelled.signal, fetchImpl: fetchPlan}), /cancelled/);
  streamVariant = 'valid'; replyWait = deferred();
  const lateReply = plan.chat(input, house);
  await new Promise(resolve => setTimeout(resolve, 0));
  await assert.rejects(plan.chat(input, house), /current ChatGPT reply/);
  plan.reset(); replyWait.resolve();
  await assert.rejects(lateReply, /cancelled|timed out/);
  plan.close();
  assert.equal(plan.config().ready, false);
  assert.equal(plan.config().model, null);
  assert.equal(JSON.stringify(plan.config()).includes(access), false);
  console.log('Verified optional ChatGPT OAuth, PKCE/JWKS identity, RAM-only tokens, renewal, bounded larger model catalogs, body cancellation/timeouts and bounded SSE resident replies (mock requests only).');
} finally { await rm(root, {recursive: true, force: true}); }
