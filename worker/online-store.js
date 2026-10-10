import {clone} from '../web/model.js';
import {initialNeighborhood, createEdition, validateNeighborhood} from '../web/neighborhood.js';
import {createResidence} from '../web/residence-data.js';
import {conversationRecords, CONVERSATION_ARCHIVE_LIMIT} from '../web/conversation-data.js';
export {conversationRecords} from '../web/conversation-data.js';

export const ARCHIVE_LIMIT = CONVERSATION_ARCHIVE_LIMIT;
export class OnlineError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const conflict = () => new OnlineError('This house changed in another tab. Your draft is kept. Reload saved state before trying again.', 409);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function initialOnlineNeighborhood() {
  const initial = initialNeighborhood();
  return createEdition(initial, createResidence(initial.homes.at(-1).house), {edition: 'residence', title: 'Socrates’ residence'});
}
export function envelope(neighborhood, revision) {
  const value = clone(neighborhood);
  return {house: clone(value.homes.find(home => home.id === value.activeId).house), neighborhood: value, revision};
}
export async function loadOnlineHouse(db, user) {
  let row = await db.prepare('SELECT document, revision FROM online_neighborhoods WHERE user_id = ?').bind(user).first();
  if (!row) {
    // Persist the starter once, even before the first edit. Otherwise two tabs
    // would see different creation dates for the same revision-zero houses.
    await db.prepare('INSERT INTO online_neighborhoods (user_id, document, revision, revision_token, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(user_id) DO NOTHING')
      .bind(user, JSON.stringify(initialOnlineNeighborhood()), crypto.randomUUID(), new Date().toISOString()).run();
    row = await db.prepare('SELECT document, revision FROM online_neighborhoods WHERE user_id = ?').bind(user).first();
  }
  if (!row) throw new OnlineError('The initial online house could not be saved. Please try again.', 503);
  return envelope(validateNeighborhood(JSON.parse(row.document)), row.revision);
}

// This guard matches the local city's append-only artist records. A saved final
// decision and earlier gallery edition cannot be rewritten by a stale client.
export function retainArtistArchive(previous, next) {
  const fail = () => { throw new OnlineError('Preserve the artist conversations, decisions and earlier gallery houses before saving. Nothing was removed.', 409); };
  for (const [artist, messages] of Object.entries(previous?.artistConversations ?? {})) {
    if (!same(messages, next.artistConversations?.[artist]?.slice(0, messages.length))) fail();
  }
  const archive = previous?.artistHomes;
  if (!archive) return;
  if (!same(archive.editions, next.artistHomes?.editions?.slice(0, archive.editions.length))) fail();
  for (let index = 0; index < archive.proposals.length; index++) {
    const before = archive.proposals[index], after = next.artistHomes?.proposals?.[index];
    if (!after || ['id', 'artistId', 'date', 'sourceMessageId'].some(key => before[key] !== after[key]) || (before.decision !== 'pending' && !same(before, after))) fail();
  }
}

export async function commitOnlineHouse(db, user, before, candidate) {
  const neighborhood = validateNeighborhood(candidate);
  const document = JSON.stringify(neighborhood);
  if (new TextEncoder().encode(document).byteLength > 1300000) throw new OnlineError('This online neighbourhood has reached its storage size budget. Download the complete backup before arranging more storage. Nothing was removed.', 409);
  const priorHomes = new Map(before.revision ? before.neighborhood.homes.map(home => [home.id, home.house]) : []);
  const changed = {...neighborhood, homes: neighborhood.homes.filter(home => !same(priorHomes.get(home.id), home.house))};
  if (before.revision && same(before.neighborhood.cityNetwork?.artistConversations, neighborhood.cityNetwork?.artistConversations)) delete changed.cityNetwork;
  const records = await conversationRecords(changed);
  const existing = await db.prepare('SELECT id FROM online_conversation_messages WHERE user_id = ?').bind(user).all();
  const known = new Set((existing.results ?? []).map(row => row.id));
  const additions = records.filter(record => !known.has(record.id));
  if (known.size + additions.length > ARCHIVE_LIMIT) {
    throw new OnlineError(`The private archive holds ${ARCHIVE_LIMIT.toLocaleString('en-US')} messages. Download it before arranging more storage. Your draft is kept; no messages were removed.`, 409);
  }
  const token = crypto.randomUUID(), createdAt = new Date().toISOString(), revision = before.revision + 1;
  const additionsJson = JSON.stringify(additions);
  // Recheck capacity inside the write transaction too: a simultaneous imported
  // file can grow the archive without changing this house's revision.
  const write = db.prepare('UPDATE online_neighborhoods SET document = ?, revision = revision + 1, revision_token = ?, updated_at = ? WHERE user_id = ? AND revision = ? AND (SELECT COUNT(*) FROM online_conversation_messages WHERE user_id = ?) + (SELECT COUNT(*) FROM json_each(?) incoming WHERE NOT EXISTS (SELECT 1 FROM online_conversation_messages WHERE user_id = ? AND id = json_extract(incoming.value, \'$.id\'))) <= ? RETURNING revision')
    .bind(document, token, createdAt, user, before.revision, user, additionsJson, user, ARCHIVE_LIMIT);
  // One bounded JSON input backfills many messages without exceeding a D1 batch
  // or bind-parameter limit. The cloud database already uses SQLite JSON1.
  const archive = db.prepare('INSERT INTO online_conversation_messages (user_id, id, home_id, actor, document, created_at) SELECT ?, json_extract(value, \'$.id\'), json_extract(value, \'$.homeId\'), json_extract(value, \'$.actor\'), value, ? FROM json_each(?) WHERE EXISTS (SELECT 1 FROM online_neighborhoods WHERE user_id = ? AND revision = ? AND revision_token = ?) ON CONFLICT(user_id, id) DO NOTHING')
    .bind(user, createdAt, additionsJson, user, revision, token);
  const statements = additions.length ? [write, archive] : [write];
  // D1 batch is transactional. Archive inserts also require this write's random
  // token, so a lost revision race cannot archive an exchange that never saved.
  const result = await db.batch(statements);
  if (!result?.[0]?.results?.some(row => row.revision === revision)) {
    const capacity = await db.prepare('SELECT (SELECT COUNT(*) FROM online_conversation_messages WHERE user_id = ?) + (SELECT COUNT(*) FROM json_each(?) incoming WHERE NOT EXISTS (SELECT 1 FROM online_conversation_messages WHERE user_id = ? AND id = json_extract(incoming.value, \'$.id\'))) AS needed').bind(user, additionsJson, user).first();
    if (capacity.needed > ARCHIVE_LIMIT) throw new OnlineError('The private archive grew while saving and reached its message budget. Download it before arranging more storage. Your draft and previous conversations are preserved.', 409);
    throw conflict();
  }
  return envelope(neighborhood, revision);
}

export async function importConversationRecords(db, user, records) {
  const messages = records.map(record => ({...record, homeId: null,
    ...(record.sourceHomeTitle || record.homeTitle ? {sourceHomeTitle: record.sourceHomeTitle || record.homeTitle} : {}),
    ...(record.sourceRoomName || record.roomName ? {sourceRoomName: record.sourceRoomName || record.roomName} : {}),
    imported: true}));
  const payload = JSON.stringify(messages), now = new Date().toISOString();
  // Each import is one atomic statement. SQLite checks the live per-user count
  // and distinct incoming identities while holding its write transaction.
  const inserted = await db.prepare('INSERT INTO online_conversation_messages (user_id, id, home_id, actor, document, created_at) SELECT ?, json_extract(value, \'$.id\'), NULL, json_extract(value, \'$.actor\'), value, ? FROM json_each(?) WHERE (SELECT COUNT(*) FROM online_conversation_messages WHERE user_id = ?) + (SELECT COUNT(*) FROM json_each(?) incoming WHERE NOT EXISTS (SELECT 1 FROM online_conversation_messages WHERE user_id = ? AND id = json_extract(incoming.value, \'$.id\'))) <= ? ON CONFLICT(user_id, id) DO NOTHING RETURNING id')
    .bind(user, now, payload, user, payload, user, ARCHIVE_LIMIT).all();
  const remaining = await db.prepare('SELECT COUNT(*) AS count FROM json_each(?) incoming WHERE NOT EXISTS (SELECT 1 FROM online_conversation_messages WHERE user_id = ? AND id = json_extract(incoming.value, \'$.id\'))').bind(payload, user).first();
  if (remaining.count) throw new OnlineError(`The private archive holds ${ARCHIVE_LIMIT.toLocaleString('en-US')} messages. This file was not imported. Your existing conversations are preserved.`, 409);
  return {imported: (inserted.results ?? []).length, existing: messages.length - (inserted.results ?? []).length, total: (await db.prepare('SELECT COUNT(*) AS count FROM online_conversation_messages WHERE user_id = ?').bind(user).first()).count};
}

export async function readConversationArchive(db, user, {before, limit = 200, all = false} = {}) {
  const query = all
    ? db.prepare('SELECT sequence, document FROM online_conversation_messages WHERE user_id = ? ORDER BY sequence').bind(user)
    : before === undefined
      ? db.prepare('SELECT sequence, document FROM online_conversation_messages WHERE user_id = ? ORDER BY sequence DESC LIMIT ?').bind(user, limit)
      : db.prepare('SELECT sequence, document FROM online_conversation_messages WHERE user_id = ? AND sequence < ? ORDER BY sequence DESC LIMIT ?').bind(user, before, limit);
  const result = await query.all(), rows = result.results ?? [];
  const nextCursor = !all && rows.length === limit ? rows.at(-1).sequence : null;
  const messages = (all ? rows : [...rows].reverse()).map(row => ({...JSON.parse(row.document), sequence: row.sequence}));
  const briefsResult = await db.prepare('SELECT id, document, status, created_at, approved_at FROM online_improvement_briefs WHERE user_id = ? ORDER BY created_at, id').bind(user).all();
  return {messages, nextCursor, briefs: (briefsResult.results ?? []).map(briefFromRow)};
}
export function briefFromRow(row) {
  return row ? {id: row.id, ...JSON.parse(row.document), status: row.status, createdAt: row.created_at, approvedAt: row.approved_at} : null;
}
