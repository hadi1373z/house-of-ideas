import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server/local.mjs';
import {clone, legacyStarter} from '../web/model.js';
import {initialNeighborhood} from '../web/neighborhood.js';
import {initialCityNetwork} from '../web/city-network.js';
import {converse} from '../web/resident.js';
import {appendArtistReply} from '../web/artist-dialogue.js';
import {conversationCore, conversationId, conversationRecords, validateConversationFile, CONVERSATION_ARCHIVE_LIMIT} from '../web/conversation-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'house-local-archive-'));
const webDir = path.join(temporary, 'web'), dataDir = path.join(temporary, 'data'), file = path.join(dataDir, 'house.json');
await fs.mkdir(webDir); await fs.mkdir(dataDir);
await fs.writeFile(path.join(webDir, 'index.html'), '<!doctype html><body data-mode="preview">Archive fixture</body>');
const instant = '2026-10-06T10:00:00.000Z';
const sha = core => createHash('sha256').update(JSON.stringify(core)).digest('hex');
let running, session, externalCalls = 0;
async function launch() {
  running = await startServer({webDir, dataDir, port: 0, maxPort: 0, env: {}, now: () => new Date(instant),
    fetchImpl: async () => { externalCalls++; throw Error('Archive tests never contact a provider.'); }});
  const config = await fetch(running.url + '/api/config');
  session = {cookie: config.headers.get('set-cookie').split(';')[0], csrf: (await config.json()).csrfToken};
}
async function api(route, method = 'GET', body, headers = {}) {
  const response = await fetch(running.url + route, {method,
    headers: {Cookie: session.cookie, ...(method === 'GET' ? {} : {Origin: running.url, 'X-Local-CSRF': session.csrf, 'Content-Type': 'application/json'}), ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  return {status: response.status, headers: response.headers, json: await response.json()};
}
async function archive() {
  const response = await api('/api/conversations/file');
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.match(response.headers.get('content-disposition'), /house-of-ideas-private-conversations\.json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.json;
}

try {
  // A pre-archive v2 envelope is backfilled only in memory on a download. Its
  // exact bytes and revision stay untouched until a successful mutation.
  const neighborhood = initialNeighborhood();
  neighborhood.homes.at(-1).house = converse(neighborhood.homes.at(-1).house, 'math', 'A question kept before the archive existed.', {now: instant});
  const seed = {version: 2, revision: 7, neighborhood, ownerExtension: {note: 'Keep unknown envelope metadata.'}};
  const originalBytes = JSON.stringify(seed, null, 3) + '\n';
  await fs.writeFile(file, originalBytes);
  await launch();
  assert.equal((await fetch(running.url + '/api/conversations/file')).status, 403, 'A private archive requires a local browser session.');
  assert.equal((await api('/api/conversations/file', 'GET', undefined, {Origin: 'https://attacker.example'})).status, 403);
  assert.equal((await api('/api/conversations/file', 'GET', undefined, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
  let exported = await archive();
  assert.equal(exported.messages.length, 2); assert.equal(exported.revision, 7);
  assert.equal(exported.source, 'local-house');
  assert.equal(await fs.readFile(file, 'utf8'), originalBytes, 'Export is read-only even when the archive field is absent.');
  assert.equal((await api('/api/house')).json.revision, 7);
  const firstId = exported.messages[0].id;
  const expectedCore = {actor: 'socrates', originalId: neighborhood.homes.at(-1).house.resident.messages[0].id,
    role: 'user', text: 'A question kept before the archive existed.', at: instant, mode: 'offline', roomId: 'math'};
  assert.equal(firstId, sha(expectedCore), 'Local IDs use the same immutable field order as the cloud archive.');
  assert.equal(exported.messages[0].homeTitle, neighborhood.homes.at(-1).title);
  assert.equal(exported.messages[0].roomName, neighborhood.homes.at(-1).house.rooms.find(room => room.id === 'math').name);
  assert.deepEqual((await validateConversationFile(exported)).messages, exported.messages);

  let saved = (await api('/api/house')).json;
  for (let i = 0; i < 45; i++) {
    const house = converse(saved.house, 'math', `Saved question number ${i}.`, {now: new Date(Date.parse(instant) + i * 1000)});
    const result = await api('/api/house', 'PUT', {house, revision: saved.revision});
    assert.equal(result.status, 200, JSON.stringify(result.json));
    saved = (await api('/api/house')).json;
  }
  assert.equal(saved.house.resident.messages.length, 80, 'The resident working window remains bounded.');
  exported = await archive();
  assert.equal(exported.messages.length, 92, 'The durable archive retains dialogue outside the working window.');
  assert.ok(exported.messages.some(message => message.id === firstId));
  const stored = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(stored.conversationArchive.version, 1); assert.equal(stored.conversationArchive.messages.length, 92);
  assert.deepEqual(stored.ownerExtension, seed.ownerExtension);
  assert.equal(Object.hasOwn(saved, 'conversationArchive'), false, 'Ordinary house responses do not copy the growing private archive.');

  const duplicateHome = await api('/api/neighborhood/create', 'POST', {revision: saved.revision});
  assert.equal(duplicateHome.status, 200); saved = duplicateHome.json;
  assert.equal((await archive()).messages.length, 92, 'Copied-home conversations retain one stable archive entry.');
  const beforeFailure = await fs.readFile(file);
  const unsaved = converse(saved.house, 'math', 'This stale draft must never be archived.', {now: instant});
  assert.equal((await api('/api/house', 'PUT', {house: unsaved, revision: saved.revision - 1})).status, 409);
  const invalid = clone(unsaved); invalid.resident.messages.at(-1).concept = 'execute_code';
  assert.equal((await api('/api/house', 'PUT', {house: invalid, revision: saved.revision})).status, 400);
  assert.deepEqual(await fs.readFile(file), beforeFailure, 'Stale and invalid saves preserve both house and archive bytes.');
  assert.equal((await archive()).messages.length, 92);

  const cityNetwork = appendArtistReply(saved.neighborhood.cityNetwork ?? initialCityNetwork(), {artistId: 'monet', workId: 'water-lilies',
    text: 'How does the reflection shape the painting?', reply: 'Look at the marks that cross the reflection. What changes there?', date: instant});
  const citySave = await api('/api/cities', 'PUT', {cityNetwork, revision: saved.revision});
  assert.equal(citySave.status, 200); saved = citySave.json;
  exported = await archive();
  const artistMessages = exported.messages.filter(message => message.actor === 'monet');
  assert.equal(artistMessages.length, 2); assert.deepEqual(artistMessages.map(message => message.role), ['user', 'artist']);
  assert.equal(artistMessages[1].workId, 'water-lilies'); assert.equal(artistMessages[1].roomName, 'Claude Monet gallery');
  assert.equal(artistMessages[1].homeId, null); assert.equal(exported.messages.length, 94);
  assert.equal((await api('/api/conversations')).json.count, 94);
  const expectedArchive = exported.messages;
  await running.close(); running = null;
  await launch();
  assert.deepEqual((await archive()).messages, expectedArchive, 'Complete Socrates and artist archive survives restart.');
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).ownerExtension, seed.ownerExtension);

  // Equal copied conversations deduplicate; reused original IDs with changed
  // immutable text form separate records. Display labels do not affect IDs.
  const original = expectedArchive[0], branch = {...original, text: 'A different claim in a branched house.'};
  assert.notEqual(await conversationId(branch), original.id);
  assert.equal(await conversationId({...original, homeId: 'foreign-home', homeTitle: 'Another label'}), original.id);
  assert.deepEqual(conversationCore(original), expectedCore);
  const legacyDates = clone(saved.neighborhood);
  legacyDates.homes.at(-1).house.resident.messages[0].at = '2026-10-06';
  const priorDateBytes = JSON.stringify(legacyDates);
  const recoveredDates = await conversationRecords(legacyDates);
  assert.ok(recoveredDates.some(message => message.at === '2026-10-06T00:00:00.000Z'));
  assert.equal(JSON.stringify(legacyDates), priorDateBytes, 'Legacy date normalization is confined to transfer metadata, preserving the source snapshot.');
  await assert.rejects(validateConversationFile({...exported, apiKey: 'never-import-credentials'}), /unsupported field/);
  await assert.rejects(validateConversationFile({...exported, messages: [{...original, id: '0'.repeat(64)}]}), /identity/);
  await assert.rejects(validateConversationFile({...exported, messages: [{...original, at: '2026-02-30T10:00:00.000Z'}]}), /date/);
  const noApprovals = await validateConversationFile({...exported, briefs: [{status: 'approved', proposal: 'A foreign approval is never authority here.'}]});
  assert.equal(Object.hasOwn(noApprovals, 'briefs'), false);
  assert.deepEqual(await conversationRecords(saved.neighborhood), expectedArchive.filter(message =>
    saved.neighborhood.homes.some(home => (home.house.resident?.messages ?? []).some(m => m.id === message.originalId && m.text === message.text)) || message.actor === 'monet'));

  // Saturating storage refuses the entire next save without pruning old data.
  await running.close(); running = null;
  const capacityMessages = Array.from({length: CONVERSATION_ARCHIVE_LIMIT}, (_, i) => {
    const core = {actor: 'socrates', originalId: 'capacity-' + i, role: 'user', text: 'Preserve archived claim ' + i,
      at: instant, mode: 'offline', roomId: 'math'};
    return {id: sha(core), ...core, homeId: 'home-2', homeTitle: 'Capacity fixture', roomName: 'Study'};
  });
  const fullEnvelope = {version: 2, revision: 100, neighborhood: initialNeighborhood(), ownerExtension: seed.ownerExtension,
    conversationArchive: {version: 1, messages: capacityMessages, ownerArchiveNote: 'Keep archive extensions too.'}};
  await fs.writeFile(file, JSON.stringify(fullEnvelope));
  await launch();
  const fullBytes = await fs.readFile(file), capacitySaved = (await api('/api/house')).json;
  const capacityDraft = converse(capacitySaved.house, 'math', 'The next exchange remains in my draft.', {now: instant});
  const overflow = await api('/api/house', 'PUT', {house: capacityDraft, revision: 100});
  assert.equal(overflow.status, 409); assert.match(overflow.json.error, /10,000 messages/);
  assert.deepEqual(await fs.readFile(file), fullBytes); assert.equal((await api('/api/house')).json.revision, 100);
  assert.equal((await archive()).messages.length, CONVERSATION_ARCHIVE_LIMIT);
  const noNewDialogue = await api('/api/neighborhood/select', 'POST', {homeId: 'home-1', revision: 100});
  assert.equal(noNewDialogue.status, 200, 'An existing home can still be visited at archive capacity.');
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).conversationArchive.ownerArchiveNote, 'Keep archive extensions too.');

  // The already-required v1 conversion preserves exact original bytes and
  // unknown envelope metadata while capturing retained dialogue atomically.
  await running.close(); running = null;
  const oldHouse = converse(legacyStarter(), 'math', 'An original legacy conversation.', {now: instant});
  const legacyEnvelope = {version: 1, revision: 3, house: oldHouse, ownerExtension: seed.ownerExtension};
  const legacyBytes = JSON.stringify(legacyEnvelope, null, 3) + '\n';
  await fs.writeFile(file, legacyBytes);
  await launch();
  const migrated = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(migrated.version, 2); assert.equal(migrated.revision, 4);
  assert.deepEqual(migrated.ownerExtension, seed.ownerExtension); assert.equal(migrated.conversationArchive.messages.length, 2);
  assert.equal(await fs.readFile(path.join(dataDir, 'house-before-neighborhood.json'), 'utf8'), legacyBytes);
  assert.equal(externalCalls, 0, 'Archive capture and export make no model or external requests.');
  console.log('Local archive: read-only backfill, immutable SHA identities, rollover retention, copied-home deduplication, artist labels, atomic refusals, unknown metadata, restart, capacity and exact legacy backup passed.');
} finally {
  await running?.close();
  if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('house-local-archive-')) throw Error('Refusing unexpected archive test cleanup path.');
  await fs.rm(temporary, {recursive: true, force: true});
}
