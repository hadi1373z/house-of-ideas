// Optional, explicit ChatGPT plan sign-in. This public OAuth client never reads
// another app's credentials. Only host/account registrations survive restart;
// access, refresh and ID tokens remain in this local server's memory.
import {randomBytes, randomUUID, createHash, timingSafeEqual, createPublicKey, verify} from 'node:crypto';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';

const ISSUER = 'https://auth.openai.com';
const AUTHORIZE = `${ISSUER}/api/accounts/authorize`;
const TOKEN = `${ISSUER}/api/accounts/oauth/token`;
const JWKS = `${ISSUER}/.well-known/jwks.json`;
const DISCOVERY = `${ISSUER}/.well-known/openid-configuration`;
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const ATTEMPT_MS = 10 * 60 * 1000;

export class ChatGPTAuthError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function validClient(id) { return typeof id === 'string' && /^oaiapp_[A-Za-z0-9_-]{1,160}$/.test(id); }
function safeLabel(value, fallback) {
  return typeof value === 'string' && value.trim() && value.length <= 120 && !/[\u0000-\u001f]/.test(value) ? value.trim() : fallback;
}
function credential(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 32768 && !/[\s\u0000-\u001f]/.test(value);
}
function callbackOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new ChatGPTAuthError('Open ChatGPT sign-in from the local house.', 400); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new ChatGPTAuthError('ChatGPT needs the local 127.0.0.1 callback.', 400);
  return url.origin;
}

async function boundedJson(response, maxBytes = 128000) {
  const reader = response.body?.getReader();
  if (!reader) throw new ChatGPTAuthError('ChatGPT returned an empty connection response.');
  const chunks = []; let length = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new ChatGPTAuthError('ChatGPT returned a connection response that was too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks, length).toString('utf8')); }
  catch { throw new ChatGPTAuthError('ChatGPT returned an unreadable connection response.'); }
}

export async function createChatGPTAuth({dataDir, fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 15000} = {}) {
  if (typeof dataDir !== 'string' || !dataDir) throw new ChatGPTAuthError('Choose local storage for the ChatGPT registration.', 500);
  await mkdir(dataDir, {recursive: true});
  const path = join(dataDir, 'chatgpt-registration.json');
  let registration;
  try { registration = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new ChatGPTAuthError('The ChatGPT registration could not be read. The offline house remains available.', 500); }
  if (registration && (registration.version !== 1 || !/^urn:uuid:[0-9a-f-]{36}$/i.test(registration.hostId) || !Array.isArray(registration.accounts) || registration.accounts.length > 32 || registration.accounts.some(account => !validClient(account.id) || typeof account.subject !== 'string' || !account.subject || account.subject.length > 256 || typeof account.label !== 'string' || account.label.length > 120) || new Set(registration.accounts.map(account => account.id)).size !== registration.accounts.length)) throw new ChatGPTAuthError('The ChatGPT registration is invalid. The offline house remains available.', 500);
  registration ||= {version: 1, hostId: `urn:uuid:${randomUUID()}`, accounts: []};
  // Rebuild known fields so an unrelated credential accidentally put in this
  // registration file is never propagated by a later write.
  registration = {version: 1, hostId: registration.hostId, accounts: registration.accounts.map(({id, subject, label}) => ({id, subject, label}))};
  let writeQueue = Promise.resolve();
  function saveRegistration() {
    const contents = JSON.stringify(registration, null, 2) + '\n';
    const operation = writeQueue.catch(() => {}).then(async () => {
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, contents, {mode: 0o600});
      await rename(temporary, path);
    });
    writeQueue = operation; return operation;
  }
  await saveRegistration();
  let generation = 0, pending = null, session = null, refreshPromise = null;
  let jwksCache = null, jwksAt = 0;
  const operations = new Set();
  function assertGeneration(version) {
    if (version !== generation) throw new ChatGPTAuthError('This ChatGPT connection attempt was cancelled. Start again when you are ready.', 409);
  }
  function stopOperations() { for (const controller of operations) controller.abort(); }
  async function request(url, options = {}) {
    const controller = new AbortController(); operations.add(controller);
    try { return await fetchImpl(url, {...options, redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)])}); }
    catch { throw new ChatGPTAuthError('Could not reach ChatGPT. The offline house remains available.'); }
    finally { operations.delete(controller); }
  }
  async function jsonRequest(url, options = {}) {
    const response = await request(url, options);
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if ([400, 401, 403].includes(response.status)) throw new ChatGPTAuthError('ChatGPT did not accept this sign-in. Continue with ChatGPT again.', 401);
      if (response.status === 429) throw new ChatGPTAuthError('ChatGPT is busy. Try again later.');
      throw new ChatGPTAuthError('ChatGPT could not complete the connection. The offline house remains available.');
    }
    return boundedJson(response);
  }
  async function keys(force = false) {
    if (!force && jwksCache && now() - jwksAt < 3600000) return jwksCache;
    const document = await jsonRequest(JWKS);
    if (!Array.isArray(document.keys) || document.keys.length > 100) throw new ChatGPTAuthError('ChatGPT signing keys could not be verified.');
    jwksCache = document.keys; jwksAt = now(); return jwksCache;
  }
  async function validateIdentity(token, attempt, {refresh = false} = {}) {
    if (!credential(token) || token.length > 20000) throw new ChatGPTAuthError('ChatGPT did not return a valid account identity.', 401);
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new ChatGPTAuthError('ChatGPT did not return a valid account identity.', 401);
    let header, claims;
    try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); claims = JSON.parse(Buffer.from(parts[1], 'base64url')); }
    catch { throw new ChatGPTAuthError('ChatGPT did not return a readable account identity.', 401); }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || header.crit !== undefined) throw new ChatGPTAuthError('ChatGPT account signing could not be verified.', 401);
    let key = (await keys()).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
    if (!key) key = (await keys(true)).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
    let signed = false;
    try { signed = !!key && verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({key, format: 'jwk'}), Buffer.from(parts[2], 'base64url')); }
    catch { /* Invalid or unsupported key. */ }
    const audience = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    const seconds = now() / 1000;
    if (!signed || claims.iss !== ISSUER || !Array.isArray(audience) || !audience.includes(attempt.clientId) || (audience.length > 1 && claims.azp !== attempt.clientId) || (claims.azp !== undefined && claims.azp !== attempt.clientId) || !Number.isFinite(claims.exp) || claims.exp <= seconds || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds + 30)) || (claims.iat !== undefined && (!Number.isFinite(claims.iat) || claims.iat > seconds + 30)) || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256 || (!refresh && !equal(claims.nonce, attempt.nonce))) throw new ChatGPTAuthError('ChatGPT account identity could not be verified. Start sign-in again.', 401);
    if (refresh && claims.nonce !== undefined && !equal(claims.nonce, attempt.nonce)) throw new ChatGPTAuthError('ChatGPT session identity could not be verified. Start sign-in again.', 401);
    if (attempt.subject && claims.sub !== attempt.subject) throw new ChatGPTAuthError('That ChatGPT account does not match the selected registration. Add it as another account.', 401);
    const displayName = safeLabel(claims.name, 'ChatGPT');
    return {subject: claims.sub, label: attempt.label || `${displayName.slice(0, 90)} · account ${registration.accounts.length + 1}`};
  }
  function tokenSet(payload, identity, clientId, prior = null) {
    if (!payload || typeof payload !== 'object' || payload.token_type?.toLowerCase() !== 'bearer' || !credential(payload.access_token) || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0 || payload.expires_in > 31 * 86400 || (payload.refresh_token !== undefined && !credential(payload.refresh_token))) throw new ChatGPTAuthError('ChatGPT did not return usable session credentials.', 401);
    const scopes = payload.scope === undefined && prior ? prior.scopes : typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [];
    if (!scopes.includes('chatgpt.tokens.use.direct') || !scopes.includes('resource.invoke')) throw new ChatGPTAuthError('ChatGPT plan use was not authorized. Continue with ChatGPT and allow plan use, or use local Socrates.', 403);
    return {clientId, ...identity, nonce: prior?.nonce || null, accessToken: payload.access_token, refreshToken: payload.refresh_token || prior?.refreshToken || null, idToken: payload.id_token || prior?.idToken || null, expiresAt: now() + payload.expires_in * 1000, scopes};
  }
  function status() {
    const activeAttempt = pending && pending.expiresAt > now();
    return {connected: !!session, pending: !!activeAttempt, planEnabled: !!session, account: session ? {id: session.clientId, label: session.label} : null, accounts: registration.accounts.map(({id, label}) => ({id, label})), sessionOnly: true};
  }
  const api = {
    status,
    async begin(origin, {accountId} = {}) {
      const localOrigin = callbackOrigin(origin);
      const saved = accountId === undefined ? null : registration.accounts.find(account => account.id === accountId);
      if (accountId !== undefined && !saved) throw new ChatGPTAuthError('Choose a saved ChatGPT account or add a new one.', 400);
      ++generation; refreshPromise = null; stopOperations();
      const verifier = randomBytes(48).toString('base64url');
      pending = {generation, state: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url'), verifier, redirectUri: `${localOrigin}/auth/callback`, expiresAt: now() + ATTEMPT_MS, clientId: saved?.id || 'dynamic_agent_client', subject: saved?.subject, label: saved?.label};
      const url = new URL(AUTHORIZE);
      const params = {client_id: pending.clientId, ext_agent_host_id: registration.hostId, response_type: 'code', redirect_uri: pending.redirectUri, scope: SCOPES, resource: RESOURCE, state: pending.state, nonce: pending.nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url')};
      if (!saved) params.agent_name_hint = 'House of Ideas';
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return {authorizationUrl: url.href, expiresAt: pending.expiresAt};
    },
    async complete(query) {
      if (!(query instanceof URLSearchParams)) throw new ChatGPTAuthError('Use the ChatGPT callback query.', 400);
      const attempt = pending;
      if (!attempt || attempt.expiresAt <= now()) { pending = null; throw new ChatGPTAuthError('This ChatGPT sign-in expired. Continue with ChatGPT again.', 400); }
      for (const field of ['state', 'code', 'client_id', 'error']) if (query.getAll(field).length > 1) throw new ChatGPTAuthError('This ChatGPT callback is invalid.', 400);
      if (!equal(query.get('state'), attempt.state)) throw new ChatGPTAuthError('This ChatGPT callback does not match your sign-in.', 400);
      // Consume the attempt before network calls, so the code cannot be replayed.
      pending = null;
      if (query.has('error')) throw new ChatGPTAuthError('ChatGPT sign-in was not approved. You can continue using local Socrates.', 400);
      const clientId = query.get('client_id') || (attempt.clientId !== 'dynamic_agent_client' ? attempt.clientId : null);
      if (!validClient(clientId) || (attempt.clientId !== 'dynamic_agent_client' && clientId !== attempt.clientId)) throw new ChatGPTAuthError('ChatGPT registration did not return the expected client ID. Start again.', 400);
      const code = query.get('code');
      if (!credential(code) || code.length > 4000) throw new ChatGPTAuthError('ChatGPT did not return a usable authorization code.', 400);
      attempt.clientId = clientId;
      const existing = registration.accounts.find(account => account.id === clientId);
      // An account selector can return a client already registered locally.
      // Keep that registration's identity and stable label in that case too.
      attempt.subject ||= existing?.subject;
      attempt.label ||= existing?.label;
      const payload = await jsonRequest(TOKEN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'authorization_code', client_id: clientId, code, code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource: RESOURCE}).toString()});
      assertGeneration(attempt.generation);
      const identity = await validateIdentity(payload.id_token, attempt);
      assertGeneration(attempt.generation);
      const credentials = tokenSet(payload, identity, clientId);
      credentials.nonce = attempt.nonce;
      if (existing && existing.subject !== identity.subject) throw new ChatGPTAuthError('ChatGPT returned a different identity for this registration.', 401);
      if (!existing && registration.accounts.length >= 32) throw new ChatGPTAuthError('This installation already has 32 ChatGPT registrations.', 409);
      const next = {id: clientId, ...identity};
      if (existing) Object.assign(existing, next); else registration.accounts.push(next);
      await saveRegistration();
      assertGeneration(attempt.generation);
      session = credentials;
      return status();
    },
    cancel() { ++generation; pending = null; refreshPromise = null; stopOperations(); return status(); },
    close() { ++generation; pending = null; session = null; refreshPromise = null; stopOperations(); },
    async disconnect() {
      const previous = session;
      api.close();
      if (!previous?.refreshToken) return status();
      try {
        const discovery = await jsonRequest(DISCOVERY);
        const endpoint = new URL(discovery.revocation_endpoint);
        if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'auth.openai.com' || endpoint.port || endpoint.username || endpoint.password) throw Error('Invalid revocation endpoint.');
        const response = await request(endpoint.href, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({token: previous.refreshToken, token_type_hint: 'refresh_token', client_id: previous.clientId}).toString()});
        await response.body?.cancel().catch(() => {});
        if (response.status !== 200) throw Error('Revocation not confirmed.');
        return status();
      } catch { return {...status(), revocationWarning: 'Signed out locally. Remote revocation was not confirmed; you can disconnect House of Ideas in ChatGPT Settings.'}; }
    },
    async accessToken() {
      if (!session) throw new ChatGPTAuthError('Continue with ChatGPT in local settings, or use local Socrates.', 409);
      if (session.expiresAt > now() + 60000) return session.accessToken;
      if (refreshPromise) return refreshPromise;
      const previous = session, version = generation;
      if (!previous.refreshToken) { session = null; throw new ChatGPTAuthError('This ChatGPT session expired. Continue with ChatGPT again.', 401); }
      const operation = (async () => {
        const payload = await jsonRequest(TOKEN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'refresh_token', client_id: previous.clientId, refresh_token: previous.refreshToken, resource: RESOURCE}).toString()});
        assertGeneration(version);
        const identity = payload.id_token ? await validateIdentity(payload.id_token, {clientId: previous.clientId, subject: previous.subject, label: previous.label, nonce: previous.nonce}, {refresh: true}) : {subject: previous.subject, label: previous.label};
        assertGeneration(version);
        const credentials = tokenSet(payload, identity, previous.clientId, previous);
        if (session !== previous) throw new ChatGPTAuthError('The ChatGPT session changed during renewal.', 409);
        session = credentials; return credentials.accessToken;
      })();
      refreshPromise = operation;
      try { return await operation; }
      catch (error) { if (error.status === 401 || error.status === 403) { if (session === previous) session = null; } throw error; }
      finally { if (refreshPromise === operation) refreshPromise = null; }
    },
    async models() {
      const version = generation;
      const accessToken = await api.accessToken();
      const payload = await jsonRequest(`${RESOURCE}/models`, {headers: {Authorization: `Bearer ${accessToken}`}});
      assertGeneration(version);
      if (!Array.isArray(payload.models) || payload.models.length > 500) throw new ChatGPTAuthError('ChatGPT returned an unreadable model catalog.');
      const catalog = payload.models.filter(model => model?.visibility === 'list' && typeof model.slug === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(model.slug) && typeof model.display_name === 'string' && model.display_name.length > 0 && model.display_name.length <= 120).map(model => ({slug: model.slug, displayName: model.display_name}));
      return [...new Map(catalog.map(model => [model.slug, model])).values()];
    },
  };
  return api;
}
