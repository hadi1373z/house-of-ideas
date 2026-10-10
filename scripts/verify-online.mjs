import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openOnlineSqlite} from './online-sqlite-adapter.mjs';
import worker, {createOnlineWorker} from '../worker/online.js';
import {clone} from '../web/model.js';
import {converse, receiveGptResult} from '../web/resident.js';
import {appendArtistReply} from '../web/artist-dialogue.js';
import {initialCityNetwork} from '../web/city-network.js';
import {conversationRecords, loadOnlineHouse, commitOnlineHouse, importConversationRecords} from '../worker/online-store.js';
import {SOCRATES_PROMPT_VERSION, DEFAULT_MODEL} from '../server/gpt.mjs';

// Real SQLite runs every generated schema migration. Provider requests and Sites
// identity are fixtures; this suite never sends a paid request or owner data.
const {sql, DB} = await openOnlineSqlite();
const env = {DB, ASSETS: {fetch: () => new Response('fixture asset')}};
const user = 'owner-one', other = 'owner-two', date = '2026-10-10T13:00:00.000Z';
const request = (path, method = 'GET', body, {identity = user, headers = {}} = {}) => new Request(`https://online-house.test${path}`, {
  method,
  headers: {...(identity ? {'oai-authenticated-user-id': identity} : {}), ...(method === 'GET' ? {} : {'Origin': 'https://online-house.test', 'X-House-Request': '1', 'Content-Type': 'application/json'}), ...headers},
  ...(body === undefined ? {} : {body: JSON.stringify(body)}),
});
const call = async (path, method, body, options, target = worker, bindings = env) => target.fetch(request(path, method, body, options), bindings);
const count = identity => sql.prepare('SELECT COUNT(*) AS count FROM online_conversation_messages WHERE user_id = ?').get(identity).count;
const load = async identity => (await call('/api/house', 'GET', undefined, {identity})).json();
const save = async (house, revision) => call('/api/house', 'PUT', {house, revision});

assert.equal((await call('/api/house', 'GET', undefined, {identity: null})).status, 401);
assert.equal((await call('/api/config', 'GET', undefined, {identity: null})).status, 401);
assert.equal((await call('/')).status, 200);
let config = await (await call('/api/config')).json();
assert.equal(config.storage, 'private-cloud'); assert.equal(config.gpt.ready, false); assert.equal(config.gpt.model, DEFAULT_MODEL);
assert.equal(config.chatgpt.ready, false); assert.equal(config.promptVersion, SOCRATES_PROMPT_VERSION);
assert.ok(!JSON.stringify(config).includes('API_KEY'));
assert.equal((await call('/api/gpt/chat', 'POST', {message: 'Hello', roomId: 'math', revision: 0})).status, 409);
let state = await load(user);
assert.equal(state.revision, 0); assert.equal(state.neighborhood.homes.length, 3); assert.equal(state.neighborhood.homes.at(-1).edition, 'residence');
assert.deepEqual(await load(user), state, 'Repeated initial reads return one durable set of starter creation dates.');
assert.equal((await save(state.house, 7)).status, 409);
assert.equal((await call('/api/house', 'PUT', {house: state.house, revision: 0}, {headers: {Origin: 'https://evil.test'}})).status, 403);
assert.equal((await call('/api/house', 'PUT', {house: state.house, revision: 0}, {headers: {'X-House-Request': '0'}})).status, 403);
assert.equal((await call('/api/house', 'PUT', {house: state.house, revision: 0}, {headers: {'Content-Type': 'text/plain'}})).status, 415);
assert.equal((await call('/api/house', 'PUT', {house: state.house, revision: 0, userId: other})).status, 400);
assert.equal((await call('/api/house', 'PUT', {house: state.house, revision: 0}, {headers: {'Content-Length': '1300001'}})).status, 413);
assert.equal(count(user), 0);

const first = converse(state.house, 'math', 'My private goal is to learn proof from this house.', {now: date});
first.customOwnerMetadata = {retain: ['private custom record']};
let response = await save(first, state.revision); assert.equal(response.status, 200);
state = await response.json(); assert.equal(state.revision, 1); assert.equal(count(user), 2);
assert.deepEqual(state.house.customOwnerMetadata, first.customOwnerMetadata);
assert.equal((await save(first, 0)).status, 409); assert.equal(count(user), 2, 'A failed CAS never adds archived messages.');
assert.equal((await load(other)).revision, 0); assert.equal(count(other), 0);
let archive = await (await call('/api/conversations')).json();
assert.equal(archive.messages.length, 2); assert.equal(archive.messages[0].actor, 'socrates'); assert.equal(archive.messages[0].mode, 'offline');
assert.equal((await (await call('/api/conversations', 'GET', undefined, {identity: other})).json()).messages.length, 0);

const snapshot = JSON.stringify(state.neighborhood.homes);
state = await (await call('/api/neighborhood/create', 'POST', {revision: state.revision})).json();
assert.equal(state.neighborhood.homes.length, 4); assert.equal(JSON.stringify(state.neighborhood.homes.slice(0, 3)), snapshot);
assert.equal(count(user), 2, 'Copied resident messages deduplicate across neighbouring editions.');
let next = clone(state.house); next.rooms[0].brightness = (next.rooms[0].brightness ?? 70) + 1;
state = await (await save(next, state.revision)).json();
assert.equal(state.neighborhood.homes.length, 5, 'A physical change becomes an independent edition.');
assert.equal(count(user), 2);
const newest = state.neighborhood.activeId;
state = await (await call('/api/neighborhood/select', 'POST', {homeId: 'home-1', revision: state.revision})).json();
assert.equal((await save(state.house, state.revision)).status, 400, 'An older house cannot be edited in place.');
state = await (await call('/api/neighborhood/select', 'POST', {homeId: newest, revision: state.revision})).json();

// Forty-five exchanges overflow the renderer's rolling eighty-message memory.
// The private archive retains all ninety committed messages independently.
for (let index = 0; index < 45; index++) {
  const house = receiveGptResult(state.house, 'math', `Private exchange ${index}`, {reply: `Reason about example ${index}.`, concept: 'evidence', suggestion: null}, {now: date});
  response = await save(house, state.revision); assert.equal(response.status, 200); state = await response.json();
}
assert.equal(state.house.resident.messages.length, 80); assert.equal(count(user), 92);
archive = await (await call('/api/conversations?limit=20')).json(); assert.equal(archive.messages.length, 20); assert.ok(archive.nextCursor);
const page = await (await call(`/api/conversations?limit=20&before=${archive.nextCursor}`)).json();
assert.equal(page.messages.length, 20); assert.ok(page.messages.at(-1).sequence < archive.messages[0].sequence);
assert.equal((await call('/api/conversations?limit=501')).status, 400);
response = await call('/api/conversations/file'); assert.match(response.headers.get('content-disposition'), /attachment/);
const file = await response.json(); assert.equal(file.messages.length, 92); assert.ok(file.messages.some(message => message.text.includes('private goal')));
assert.ok(!JSON.stringify(file).includes('sk-test'));

// Reused IDs in a branch with distinct text remain distinct archive records.
const branch = clone(state.neighborhood);
branch.homes.at(-1).house.resident.messages[0].text = 'A distinct branch message with the same source ID';
const records = await conversationRecords(branch);
const modified = records.find(message => message.text === 'A distinct branch message with the same source ID');
assert.ok(modified); assert.ok(!file.messages.some(message => message.id === modified.id));

const evidenceId = file.messages[0].id;
response = await call('/api/improvements', 'POST', {problem: 'I cannot find the learning painting.', proposal: 'Add a visible painting route to the room guide.', criteria: 'Find the painting without assistance in thirty seconds.', evidenceIds: [evidenceId]});
assert.equal(response.status, 201); let brief = (await response.json()).brief; assert.equal(brief.status, 'draft');
assert.equal((await call(`/api/improvements/${brief.id}/file`)).status, 409);
assert.equal((await call(`/api/improvements/${brief.id}/approve`, 'POST', {}, {identity: other})).status, 404);
assert.equal((await call('/api/improvements', 'POST', {problem: 'x', proposal: 'y', criteria: 'z', evidenceIds: [evidenceId]}, {identity: other})).status, 400);
assert.equal((await call(`/api/improvements/${brief.id}/approve`, 'POST', {publish: true})).status, 400);
brief = (await (await call(`/api/improvements/${brief.id}/approve`, 'POST', {})).json()).brief;
assert.equal(brief.status, 'approved'); assert.ok(brief.approvedAt);
const approvedFile = await (await call(`/api/improvements/${brief.id}/file`)).json();
assert.equal(approvedFile.proposal, brief.proposal); assert.deepEqual(approvedFile.evidenceIds, [evidenceId]);
assert.deepEqual(approvedFile.sourceContext.homeIds, [file.messages[0].homeId]);
assert.equal(approvedFile.sourceContext.promptVersion, SOCRATES_PROMPT_VERSION);
assert.equal(approvedFile.sourceContext.houseRevision, state.revision);
assert.ok(!Object.hasOwn(approvedFile, 'messages')); assert.ok(!JSON.stringify(approvedFile).includes('My private goal'));
assert.equal((await (await call(`/api/improvements/${brief.id}/approve`, 'POST', {})).json()).brief.approvedAt, brief.approvedAt, 'Approval is idempotent.');
assert.equal((await call('/api/source/update', 'POST', {})).status, 404, 'The cloud API cannot edit or publish source.');

// The owner chose ChatGPT-plan conversations in the local house. No hosted
// endpoint may read an API key or call a provider, even if one is configured.
let providerCalls = 0, keyReads = 0;
const noProvider = createOnlineWorker({fetchImpl: async () => { providerCalls++; throw Error('Hosted inference is forbidden'); }});
const bindingsWithKey = {...env};
Object.defineProperty(bindingsWithKey, 'OPENAI_API_KEY', {get() { keyReads++; return 'sk-test-unused-key'; }});
config = await (await call('/api/config', 'GET', undefined, {}, noProvider, bindingsWithKey)).json();
assert.equal(config.gpt.ready, false); assert.equal(config.capabilities.artistGpt, false);
const blocked = await Promise.all(['/api/gpt/chat','/api/artists/chat','/api/chatgpt/chat'].map(route => call(route, 'POST', {message: 'Kept draft', roomId: 'math', revision: state.revision}, {}, noProvider, bindingsWithKey)));
for (const result of blocked) { assert.equal(result.status, 409); assert.match((await result.json()).error, /Continue with ChatGPT/); }
assert.equal(providerCalls, 0); assert.equal(keyReads, 0);
const beforeCityCount = count(user);
let cityNetwork = appendArtistReply(state.neighborhood.cityNetwork ?? initialCityNetwork(), {artistId: 'monet', text: 'My private blue observation', reply: 'Compare its reflected edge.', date});
response = await call('/api/cities', 'PUT', {cityNetwork, revision: state.revision}); assert.equal(response.status, 200); state = await response.json();
const cityCount = beforeCityCount + 2; assert.equal(count(user), cityCount);
archive = await (await call('/api/conversations')).json(); assert.equal(archive.messages.at(-1).actor, 'monet');
const destructive = clone(cityNetwork); destructive.artistConversations.monet = [];
assert.equal((await call('/api/cities', 'PUT', {cityNetwork: destructive, revision: state.revision})).status, 409); assert.equal(count(user), cityCount);

// A portable local conversation file becomes private cloud evidence. Foreign
// home identifiers must never link to, change or replace a cloud starter home.
const foreignFile = {...file, messages: file.messages.map(message => ({...message, homeTitle: 'Local proof home', roomName: 'Mathematics'}))};
const otherHome = await load(other), mainHouse = await load(user);
response = await call('/api/conversations/import', 'POST', {file: foreignFile}, {identity: other});
assert.equal(response.status, 200); let imported = await response.json(); assert.equal(imported.imported, file.messages.length); assert.equal(imported.existing, 0);
assert.deepEqual(await load(other), otherHome); assert.deepEqual(await load(user), mainHouse);
const importedArchive = await (await call('/api/conversations', 'GET', undefined, {identity: other})).json();
assert.equal(importedArchive.messages[0].homeId, null); assert.equal(importedArchive.messages[0].sourceHomeTitle, 'Local proof home');
assert.equal(importedArchive.messages[0].sourceRoomName, 'Mathematics'); assert.equal(importedArchive.messages[0].imported, true);
response = await call('/api/conversations/import', 'POST', {file: foreignFile}, {identity: other});
imported = await response.json(); assert.equal(imported.imported, 0); assert.equal(imported.existing, file.messages.length);
assert.equal(count(other), file.messages.length, 'Import retries deduplicate every stable message identity.');
response = await call('/api/conversations/import', 'POST', {file: {...foreignFile, briefs: [approvedFile]}}, {identity: other});
assert.equal(response.status, 200);
assert.equal((await (await call('/api/conversations', 'GET', undefined, {identity: other})).json()).briefs.length, 0, 'A portable file cannot import another context\'s approval authority.');
assert.equal((await call('/api/conversations/import', 'POST', {file: foreignFile}, {identity: null})).status, 401);
assert.equal((await call('/api/conversations/import', 'POST', {file: foreignFile}, {headers: {Origin: 'https://evil.test'}})).status, 403);
for (const invalid of [
  {...foreignFile, userId: user},
  {...foreignFile, messages: [{...foreignFile.messages[0], id: '0'.repeat(64)}]},
  {...foreignFile, messages: [{...foreignFile.messages[0], text: 'x'.repeat(2201)}]},
  {...foreignFile, messages: [{...foreignFile.messages[0], role: 'system'}]},
  {...foreignFile, messages: [{...foreignFile.messages[0], at: 'not-a-date'}]},
  {...foreignFile, messages: Array.from({length: 1001}, () => foreignFile.messages[0])},
]) assert.equal((await call('/api/conversations/import', 'POST', {file: invalid}, {identity: other})).status, 400);
assert.equal(count(other), file.messages.length, 'An invalid file cannot partially import or erase messages.');
const importedEvidence = importedArchive.messages[0].id;
response = await call('/api/improvements', 'POST', {problem: 'The local proof house hides its painting.', proposal: 'Show a room guide.', criteria: 'Find the painting promptly.', evidenceIds: [importedEvidence]}, {identity: other});
assert.equal(response.status, 201);
const importedBrief = (await response.json()).brief;
assert.deepEqual(importedBrief.sourceContext.homeIds, []);
assert.deepEqual(importedBrief.sourceContext.sourcePlaces, [{homeTitle: 'Local proof home', roomName: 'Mathematics'}]);
assert.equal(count(user), cityCount);

// The brief budget is checked by the insert itself. Two owner tabs at 999
// drafts produce exactly one final draft, preserving export compatibility.
const briefQuotaUser = 'brief-quota-fixture';
assert.equal((await call('/api/conversations/import', 'POST', {file: {...foreignFile, messages: foreignFile.messages.slice(0, 2)}}, {identity: briefQuotaUser})).status, 200);
sql.prepare("WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 999) INSERT INTO online_improvement_briefs (user_id,id,document,status,created_at) SELECT ?,printf('fixture-%d',n),?,'draft',? FROM fixture")
  .run(briefQuotaUser, JSON.stringify({problem: 'Fixture problem', proposal: 'Fixture design', criteria: 'Fixture check', evidenceIds: [foreignFile.messages[0].id]}), date);
const briefQuotaPayload = {problem: 'Find the painting.', proposal: 'Add a clear room guide.', criteria: 'Find it in thirty seconds.', evidenceIds: [foreignFile.messages[0].id]};
const briefQuotaResults = await Promise.all([0, 1].map(() => call('/api/improvements', 'POST', briefQuotaPayload, {identity: briefQuotaUser})));
assert.deepEqual(briefQuotaResults.map(result => result.status).sort(), [201, 409]);
assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM online_improvement_briefs WHERE user_id = ?').get(briefQuotaUser).count, 1000);
assert.equal((await call('/api/improvements', 'POST', briefQuotaPayload, {identity: briefQuotaUser})).status, 409);
assert.equal((await (await call('/api/conversations/file', 'GET', undefined, {identity: briefQuotaUser})).json()).briefs.length, 1000);

// Explicit revision-token guard remains effective even if another writer uses
// precisely the expected next number. A losing transaction cannot backfill.
const before = await loadOnlineHouse(DB, user), candidate = clone(before.neighborhood);
candidate.homes.at(-1).house = receiveGptResult(before.house, 'math', 'Atomic losing draft', {reply: 'Atomic losing reply', concept: 'evidence', suggestion: null}, {now: date});
const racedDB = {...DB, async batch(statements) {
  sql.prepare('UPDATE online_neighborhoods SET revision = revision + 1, revision_token = ? WHERE user_id = ?').run('other-writer-token', user);
  return DB.batch(statements);
}};
await assert.rejects(commitOnlineHouse(racedDB, user, before, candidate), error => error.status === 409);
assert.equal(count(user), cityCount);
assert.ok(!(await (await call('/api/conversations/file')).text()).includes('Atomic losing'));

// A failed archive insertion rolls the house update back too. Neither a reply
// nor its revision may be partially committed by a database error.
state = await load(user);
const rollbackCount = count(user), rollbackRevision = state.revision;
sql.exec("CREATE TEMP TRIGGER fail_archive_fixture BEFORE INSERT ON online_conversation_messages WHEN NEW.user_id = 'owner-one' BEGIN SELECT RAISE(ABORT, 'fixture archive failure'); END");
const rollbackHouse = receiveGptResult(state.house, 'math', 'Rollback draft', {reply: 'Rollback reply', concept: 'evidence', suggestion: null}, {now: date});
assert.equal((await save(rollbackHouse, state.revision)).status, 503);
assert.equal((await load(user)).revision, rollbackRevision); assert.equal(count(user), rollbackCount);
sql.exec('DROP TRIGGER fail_archive_fixture');

const fullUser = 'archive-capacity-fixture', full = await loadOnlineHouse(DB, fullUser);
sql.prepare("WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 10000) INSERT INTO online_conversation_messages (user_id,id,actor,document,created_at) SELECT ?,printf('%064x',n),'socrates','{}',? FROM fixture").run(fullUser, date);
const fullCandidate = clone(full.neighborhood);
fullCandidate.homes.at(-1).house = receiveGptResult(full.house, 'math', 'Capacity draft', {reply: 'Capacity reply', concept: 'evidence', suggestion: null}, {now: date});
await assert.rejects(commitOnlineHouse(DB, fullUser, full, fullCandidate), error => error.status === 409 && error.message.includes('10,000'));
assert.equal((await loadOnlineHouse(DB, fullUser)).revision, 0); assert.equal(count(fullUser), 10000, 'Capacity failures never prune the private archive.');
assert.equal((await call('/api/conversations/import', 'POST', {file: {...foreignFile, messages: foreignFile.messages.slice(0, 2)}}, {identity: fullUser})).status, 409);
assert.equal(count(fullUser), 10000);
const oversized = clone(full.neighborhood); oversized.homes.at(-1).house.ownerMetadata = 'x'.repeat(1300000);
await assert.rejects(commitOnlineHouse(DB, fullUser, full, oversized), error => error.status === 409 && error.message.includes('storage size budget'));
assert.equal((await loadOnlineHouse(DB, fullUser)).revision, 0);

const quotaUser = 'simultaneous-file-fixture', quotaHome = await loadOnlineHouse(DB, quotaUser);
const seedQuota = identity => sql.prepare("WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 9998) INSERT INTO online_conversation_messages (user_id,id,actor,document,created_at) SELECT ?,printf('%064x',n),'socrates','{}',? FROM fixture").run(identity, date);
seedQuota(quotaUser);
const pairFiles = [0, 2].map(offset => ({...foreignFile, messages: foreignFile.messages.slice(offset, offset + 2)}));
const parallelImports = await Promise.all(pairFiles.map(file => call('/api/conversations/import', 'POST', {file}, {identity: quotaUser})));
assert.deepEqual(parallelImports.map(result => result.status).sort(), [200, 409]); assert.equal(count(quotaUser), 10000);
assert.deepEqual(await loadOnlineHouse(DB, quotaUser), quotaHome, 'Parallel file imports never replace the house document.');
const winner = parallelImports.findIndex(result => result.status === 200);
response = await call('/api/conversations/import', 'POST', {file: pairFiles[winner]}, {identity: quotaUser});
assert.equal(response.status, 200); assert.equal((await response.json()).imported, 0, 'Idempotent retries succeed even at the capacity limit.');

const importRaceUser = 'house-import-race', importRaceBefore = await loadOnlineHouse(DB, importRaceUser);
seedQuota(importRaceUser);
const importRaceCandidate = clone(importRaceBefore.neighborhood);
importRaceCandidate.homes.at(-1).house = receiveGptResult(importRaceBefore.house, 'math', 'A house-save draft at the archive limit', {reply: 'A house-save reply at the archive limit', concept: 'evidence', suggestion: null}, {now: date});
const importRaceDB = {...DB, async batch(statements) {
  await importConversationRecords(DB, importRaceUser, pairFiles[0].messages);
  return DB.batch(statements);
}};
await assert.rejects(commitOnlineHouse(importRaceDB, importRaceUser, importRaceBefore, importRaceCandidate), error => error.status === 409);
assert.equal(count(importRaceUser), 10000); assert.equal((await loadOnlineHouse(DB, importRaceUser)).revision, 0, 'A concurrent file import cannot leave a saved exchange missing from its archive.');

// The loopback preview uses a file-backed database. Reopening applies no old
// migration twice and returns the same saved house and independent transcript.
const tempRoot = path.resolve(os.tmpdir()), tempDir = await fs.mkdtemp(path.join(tempRoot, 'house-online-qa-'));
try {
  const file = path.join(tempDir, 'fixture.sqlite');
  let disk = await openOnlineSqlite({file}), diskState = await loadOnlineHouse(disk.DB, 'restart-fixture');
  const diskNeighborhood = clone(diskState.neighborhood);
  diskNeighborhood.homes.at(-1).house = receiveGptResult(diskState.house, 'math', 'Remember after restart', {reply: 'This reply is saved.', concept: 'evidence', suggestion: null}, {now: date});
  diskState = await commitOnlineHouse(disk.DB, 'restart-fixture', diskState, diskNeighborhood); disk.close();
  disk = await openOnlineSqlite({file});
  assert.deepEqual(await loadOnlineHouse(disk.DB, 'restart-fixture'), diskState);
  assert.equal((await disk.DB.prepare('SELECT COUNT(*) AS count FROM online_conversation_messages WHERE user_id = ?').bind('restart-fixture').first()).count, 2);
  disk.close();
} finally {
  const relative = path.relative(tempRoot, path.resolve(tempDir));
  if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('house-online-qa-')) throw Error('Invalid temporary cleanup path.');
  await fs.rm(tempDir, {recursive: true, force: true});
}
sql.close();
console.log('Private online identity, neighborhood CAS, full conversation archive, GPT safety and owner-approved development briefs passed.');
