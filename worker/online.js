import {validateHouse} from '../web/model.js';
import {saveEdition, selectEdition, createEdition} from '../web/neighborhood.js';
import {initialCityNetwork, validateCityNetwork} from '../web/city-network.js';
import {DEFAULT_MODEL, SOCRATES_PROMPT_VERSION} from '../server/gpt.mjs';
import {validateConversationFile} from '../web/conversation-data.js';
import {OnlineError, loadOnlineHouse, commitOnlineHouse, retainArtistArchive, readConversationArchive, importConversationRecords, briefFromRow} from './online-store.js';

const BODY_LIMIT = 1300000;
const json = (body, status = 200, extra = {}) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra}});
const download = (body, name) => json(body, 200, {'Content-Disposition': `attachment; filename="${name}"`});
const revision = value => { if (!Number.isInteger(value) || value < 0) throw new OnlineError('Use the current house revision.'); };
function plain(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new OnlineError(`Use a complete ${label} with supported fields.`);
}
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new OnlineError(`${label} needs 1–${max} characters.`);
  return value.trim();
}
function mutation(request, url) {
  if (request.headers.get('origin') !== url.origin || request.headers.get('x-house-request') !== '1') throw new OnlineError('Save from your signed-in online house page.', 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new OnlineError('Send house data as JSON.', 415);
}
async function readJson(request, limit = BODY_LIMIT) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new OnlineError('This request is too large. Your saved data is kept.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OnlineError('Send the requested JSON data.');
  const chunks = []; let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new OnlineError('This request is too large. Your saved data is kept.', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); } catch { throw new OnlineError('Send valid JSON data.'); }
  } finally { reader.releaseLock(); }
}
function current(input, before) {
  revision(input.revision);
  if (input.revision !== before.revision) throw new OnlineError('This house changed in another tab. Your draft is kept. Reload saved state before trying again.', 409);
}
function checked(operation) {
  try { return operation(); } catch (error) { if (error instanceof OnlineError) throw error; throw new OnlineError(error.message); }
}
function noNewAssets(before, house) {
  const known = new Set(before.neighborhood.homes.flatMap(home => (home.house.designObjects ?? []).map(object => object.assetId)));
  if ((house.designObjects ?? []).some(object => !known.has(object.assetId))) throw new OnlineError('GLB file imports are available in the offline installation. This online house has not uploaded that design.');
}
async function createImprovement(db, user, input, sourceVersion) {
  plain(input, ['problem', 'proposal', 'criteria', 'evidenceIds'], 'development proposal');
  const proposal = {problem: text(input.problem, 1000, 'Observed problem'), proposal: text(input.proposal, 2000, 'Proposed development'), criteria: text(input.criteria, 1500, 'Acceptance criteria')};
  if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length < 1 || input.evidenceIds.length > 20 || input.evidenceIds.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) || new Set(input.evidenceIds).size !== input.evidenceIds.length) throw new OnlineError('Choose 1–20 distinct messages from your private archive.');
  const sourceHomes = new Set(), sourceResidents = new Set(), sourcePlaces = new Map();
  for (const id of input.evidenceIds) {
    const evidence = await db.prepare('SELECT id, home_id, actor, document FROM online_conversation_messages WHERE user_id = ? AND id = ?').bind(user, id).first();
    if (!evidence) throw new OnlineError('Every evidence message must belong to your own saved conversations.');
    if (evidence.home_id) sourceHomes.add(evidence.home_id);
    sourceResidents.add(evidence.actor);
    const record = JSON.parse(evidence.document), homeTitle = record.sourceHomeTitle || record.homeTitle, roomName = record.sourceRoomName || record.roomName;
    if (homeTitle || roomName) {
      const place = {...(homeTitle ? {homeTitle} : {}), ...(roomName ? {roomName} : {})};
      sourcePlaces.set(JSON.stringify(place), place);
    }
  }
  proposal.evidenceIds = [...input.evidenceIds];
  const house = await loadOnlineHouse(db, user);
  proposal.sourceContext = {homeIds: [...sourceHomes], residentIds: [...sourceResidents], sourcePlaces: [...sourcePlaces.values()], activeHomeId: house.neighborhood.activeId, houseRevision: house.revision,
    sourceVersion: typeof sourceVersion === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(sourceVersion) ? sourceVersion : 'unversioned-online-build', promptVersion: SOCRATES_PROMPT_VERSION};
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  // Capacity and insertion share one SQLite write statement. Two tabs at 999
  // drafts cannot both pass a separate read check and exceed the archive limit.
  const row = await db.prepare('INSERT INTO online_improvement_briefs (user_id, id, document, status, created_at) SELECT ?, ?, ?, \'draft\', ? WHERE (SELECT COUNT(*) FROM online_improvement_briefs WHERE user_id = ?) < 1000 RETURNING id, document, status, created_at, approved_at').bind(user, id, JSON.stringify(proposal), createdAt, user).first();
  if (!row) throw new OnlineError('Your proposal archive is full. Existing drafts and approvals are preserved.', 409);
  return briefFromRow(row);
}

export function createOnlineWorker() {
  return {async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const user = request.headers.get('oai-authenticated-user-id');
    if (!user || user.length > 256 || /[\u0000-\u001f]/.test(user)) return json({error: 'Sign in to open your private online house.'}, 401);
    if (!env.DB) return json({error: 'Private house storage is unavailable. Please try again.'}, 503);
    try {
      if (!['GET', 'POST', 'PUT'].includes(request.method)) throw new OnlineError('Method not allowed.', 405);
      if (request.method !== 'GET') mutation(request, url);
      if (['/api/config', '/api/gpt/config'].includes(url.pathname) && request.method === 'GET') {
        return json({mode: 'online', storage: 'private-cloud', gpt: {ready: false, model: DEFAULT_MODEL}, chatgpt: {ready: false, connected: false, planEnabled: false}, capabilities: {artistGpt: false, conversationArchive: true, conversationImport: true, glbImport: false}, promptVersion: SOCRATES_PROMPT_VERSION});
      }
      if (['/api/house', '/api/neighborhood'].includes(url.pathname) && request.method === 'GET') return json(await loadOnlineHouse(env.DB, user));
      if (url.pathname === '/api/house/export' && request.method === 'GET') return download({...await loadOnlineHouse(env.DB, user), exportedAt: new Date().toISOString()}, 'house-of-ideas-online.json');
      if (url.pathname === '/api/house' && request.method === 'PUT') {
        const input = await readJson(request); plain(input, ['house', 'revision'], 'house save');
        const before = await loadOnlineHouse(env.DB, user); current(input, before);
        const house = checked(() => validateHouse(input.house)); noNewAssets(before, house);
        const candidate = checked(() => saveEdition(before.neighborhood, house));
        const saved = await commitOnlineHouse(env.DB, user, before, candidate);
        return json(saved);
      }
      if (['/api/neighborhood/select', '/api/neighborhood/create', '/api/neighborhood/import'].includes(url.pathname) && request.method === 'POST') {
        const input = await readJson(request); plain(input, url.pathname.endsWith('/select') ? ['homeId', 'revision'] : url.pathname.endsWith('/import') ? ['house', 'revision'] : ['revision'], 'neighbourhood action');
        const before = await loadOnlineHouse(env.DB, user); current(input, before);
        let candidate;
        if (url.pathname.endsWith('/select')) candidate = checked(() => selectEdition(before.neighborhood, input.homeId));
        else if (url.pathname.endsWith('/import')) {
          const house = checked(() => validateHouse(input.house)); noNewAssets(before, house);
          candidate = checked(() => createEdition(before.neighborhood, house, {edition: 'atelier', title: 'Imported designer home'}));
        } else candidate = checked(() => createEdition(before.neighborhood));
        return json(await commitOnlineHouse(env.DB, user, before, candidate));
      }
      if (url.pathname === '/api/cities') {
        const before = await loadOnlineHouse(env.DB, user);
        if (request.method === 'GET') return json({cityNetwork: before.neighborhood.cityNetwork ?? initialCityNetwork(), revision: before.revision});
        if (request.method !== 'PUT') throw new OnlineError('Method not allowed.', 405);
        const input = await readJson(request); plain(input, ['cityNetwork', 'revision'], 'city save'); current(input, before);
        const cityNetwork = checked(() => validateCityNetwork(input.cityNetwork));
        retainArtistArchive(before.neighborhood.cityNetwork, cityNetwork);
        const saved = await commitOnlineHouse(env.DB, user, before, {...before.neighborhood, cityNetwork});
        return json({...saved, cityNetwork: saved.neighborhood.cityNetwork});
      }
      if (['/api/gpt/chat', '/api/artists/chat', '/api/chatgpt/chat'].includes(url.pathname) && request.method === 'POST') throw new OnlineError('ChatGPT-plan conversations run in your local house. Use Continue with ChatGPT there and import the conversation file here. Your draft is kept.', 409);
      if (url.pathname === '/api/conversations/import' && request.method === 'POST') {
        const input = await readJson(request); plain(input, ['file'], 'conversation import');
        let file;
        try { file = await validateConversationFile(input.file, {maxMessages: 1000, maxBytes: BODY_LIMIT}); } catch (error) { throw new OnlineError(error.message); }
        return json(await importConversationRecords(env.DB, user, Array.isArray(file) ? file : file.messages));
      }
      if (['/api/conversations', '/api/conversations/file'].includes(url.pathname) && request.method === 'GET') {
        const all = url.pathname.endsWith('/file');
        let before, limit = 200;
        if (!all) {
          if ([...url.searchParams.keys()].some(key => !['before', 'limit'].includes(key))) throw new OnlineError('Use a conversation page cursor and limit.');
          if (url.searchParams.has('before')) { before = Number(url.searchParams.get('before')); if (!Number.isSafeInteger(before) || before < 1) throw new OnlineError('Use a valid conversation cursor.'); }
          if (url.searchParams.has('limit')) { limit = Number(url.searchParams.get('limit')); if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new OnlineError('Read 1–500 messages per page.'); }
        }
        const archive = {...await readConversationArchive(env.DB, user, {all, before, limit}), promptVersion: SOCRATES_PROMPT_VERSION};
        return all ? download({format: 'house-of-ideas-private-conversations', version: 1, exportedAt: new Date().toISOString(), ...archive}, 'house-of-ideas-private-conversations.json') : json(archive);
      }
      if (url.pathname === '/api/improvements' && request.method === 'POST') return json({brief: await createImprovement(env.DB, user, await readJson(request, 12000), env.HOUSE_SOURCE_VERSION)}, 201);
      const improvement = url.pathname.match(/^\/api\/improvements\/([a-f0-9-]{36})\/(approve|file)$/);
      if (improvement) {
        const [, id, action] = improvement;
        if (request.method !== (action === 'approve' ? 'POST' : 'GET')) throw new OnlineError('Method not allowed.', 405);
        const row = await env.DB.prepare('SELECT id, document, status, created_at, approved_at FROM online_improvement_briefs WHERE user_id = ? AND id = ?').bind(user, id).first();
        if (!row) throw new OnlineError('This development proposal was not found.', 404);
        if (action === 'approve') {
          const input = await readJson(request, 4096); plain(input, [], 'approval');
          if (row.status === 'approved') return json({brief: briefFromRow(row)});
          const approved = await env.DB.prepare('UPDATE online_improvement_briefs SET status = \'approved\', approved_at = ? WHERE user_id = ? AND id = ? AND status = \'draft\' RETURNING id, document, status, created_at, approved_at').bind(new Date().toISOString(), user, id).first();
          if (!approved) throw new OnlineError('The proposal changed. Reload it before approving.', 409);
          return json({brief: briefFromRow(approved)});
        }
        if (row.status !== 'approved') throw new OnlineError('Review and approve this development proposal before exporting it.', 409);
        return download({format: 'house-of-ideas-approved-development-brief', version: 1, ...briefFromRow(row), promptVersion: SOCRATES_PROMPT_VERSION,
          workflow: 'Implement the approved proposal, preserve every house edition and private record, verify the acceptance criteria, compare the result and show the owner. This file does not publish source or authorize automatic deployment.'}, `house-development-brief-${id}.json`);
      }
      throw new OnlineError('Not found.', 404);
    } catch (error) {
      if (error instanceof OnlineError) return json({error: error.message}, error.status);
      // Never echo database errors, provider responses, headers or credentials.
      return json({error: 'The online house could not complete this request. Saved conversations and your draft are preserved.'}, 503);
    }
  }};
}
export default createOnlineWorker();
