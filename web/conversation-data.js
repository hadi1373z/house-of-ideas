// Shared data-only format for explicit private conversation transfers.
// A file carries dialogue, never credentials, houses or approval authority.
import {ARTISTS} from './art-city-data.js';

export const CONVERSATION_ARCHIVE_LIMIT = 10000;
export const CONVERSATION_FILE_FORMAT = 'house-of-ideas-private-conversations';
const concepts = new Set(['clarify', 'assumptions', 'evidence', 'counterexample', 'perspective', 'examined_life']);
const artists = new Map(ARTISTS.map(artist => [artist.id, artist]));
const recordKeys = ['id', 'actor', 'originalId', 'role', 'text', 'at', 'mode', 'roomId', 'concept', 'workId', 'homeId', 'homeTitle', 'roomName', 'sourceHomeTitle', 'sourceRoomName', 'sequence', 'promptVersion', 'imported'];
const fileKeys = ['format', 'version', 'messages', 'source', 'revision', 'exportedAt', 'nextCursor', 'briefs', 'promptVersion'];

function plain(input, allowed, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw Error(`Use a plain ${label} record.`);
  if (Object.keys(input).some(key => !allowed.includes(key))) throw Error(`The ${label} contains an unsupported field.`);
}
function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(value)) throw Error(`${label} needs a valid identifier.`);
  return value;
}
function text(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw Error(`${label} needs 1–${maximum} characters.`);
  // Immutable original text is part of the identity; do not trim or rewrite it.
  return value;
}
function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(new Date(value).valueOf())) throw Error('Use a valid ISO conversation date.');
  const day = new Date(value.slice(0, 10) + 'T00:00:00.000Z');
  if (day.toISOString().slice(0, 10) !== value.slice(0, 10)) throw Error('Use a valid ISO conversation date.');
  return value;
}

export function conversationCore(message) {
  const artist = artists.get(message?.actor);
  if (message?.actor !== 'socrates' && !artist) throw Error('Choose a known house resident for the conversation.');
  const originalId = identifier(message.originalId, 'The original message');
  if (!(artist ? ['user', 'artist'] : ['user', 'resident']).includes(message.role)) throw Error('Use the correct conversation speaker.');
  if (artist ? message.mode !== 'artist' : !['offline', 'gpt'].includes(message.mode)) throw Error('Use a supported conversation mode.');
  const roomId = artist ? null : identifier(message.roomId, 'The conversation room');
  if (artist && message.roomId !== null) throw Error('Artist conversations use their own gallery, without a house room identifier.');
  const core = {actor: message.actor, originalId, role: message.role,
    text: text(message.text, artist ? 2000 : message.role === 'user' ? 1200 : 2200, 'A conversation message'),
    at: timestamp(message.at), mode: message.mode, roomId};
  if (message.concept !== undefined) {
    if (artist || message.role !== 'resident' || !concepts.has(message.concept)) throw Error('Use a supported Socratic reply concept.');
    core.concept = message.concept;
  }
  if (!artist && message.role === 'resident' && !core.concept) throw Error('A Socratic reply needs its recorded concept.');
  if (message.workId !== undefined) {
    if (!artist?.works.some(work => work.id === message.workId)) throw Error('Choose a work from this artist’s gallery.');
    core.workId = message.workId;
  }
  return core;
}

export async function conversationId(message) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(conversationCore(message))));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateConversationRecord(input, {verifyId = true} = {}) {
  plain(input, recordKeys, 'conversation message');
  const core = conversationCore(input), id = await conversationId(core);
  if (verifyId && (typeof input.id !== 'string' || !/^[a-f0-9]{64}$/.test(input.id) || input.id !== id)) throw Error('The conversation message identity does not match its recorded content.');
  const result = {id, ...core};
  if (Object.hasOwn(input, 'homeId')) result.homeId = input.homeId === null ? null : identifier(input.homeId, 'The source home');
  for (const key of ['homeTitle', 'roomName', 'sourceHomeTitle', 'sourceRoomName']) if (Object.hasOwn(input, key)) result[key] = text(input[key], key.endsWith('RoomName') || key === 'roomName' ? 60 : 100, 'The conversation place');
  if (Object.hasOwn(input, 'sequence')) {
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) throw Error('Use a positive conversation sequence.');
    result.sequence = input.sequence;
  }
  if (Object.hasOwn(input, 'promptVersion')) result.promptVersion = text(input.promptVersion, 100, 'The prompt version');
  if (Object.hasOwn(input, 'imported')) {
    if (typeof input.imported !== 'boolean') throw Error('Use a valid conversation import label.');
    result.imported = input.imported;
  }
  return result;
}

export async function conversationRecords(neighborhood) {
  const records = new Map();
  const capturedAt = value => {
    try { return timestamp(value); } catch {
      // Older resident validation accepted parseable dates and retained their
      // original house snapshot. Export the same instant in the strict file
      // format without rewriting that saved home. New messages already use
      // ISO dates, so their established archive identities stay identical.
      const instant = new Date(value);
      if (!Number.isFinite(instant.valueOf())) throw Error('Use a valid conversation date.');
      return instant.toISOString();
    }
  };
  const add = async message => {
    const record = await validateConversationRecord(message, {verifyId: false});
    if (!records.has(record.id)) records.set(record.id, record);
  };
  for (const home of neighborhood.homes ?? []) {
    for (const message of home.house.resident?.messages ?? []) {
      const room = home.house.rooms.find(room => room.id === message.roomId);
      await add({actor: 'socrates', originalId: message.id, role: message.role, text: message.text, at: capturedAt(message.at),
        mode: message.source === 'gpt' ? 'gpt' : 'offline', roomId: message.roomId,
        ...(message.role === 'resident' && message.concept ? {concept: message.concept} : {}), homeId: home.id, homeTitle: home.title,
        ...(room ? {roomName: room.name} : {})});
    }
  }
  for (const [actor, messages] of Object.entries(neighborhood.cityNetwork?.artistConversations ?? {})) {
    for (const message of messages) await add({actor, originalId: message.id, role: message.role, text: message.text,
      at: message.date, mode: 'artist', roomId: null, ...(message.workId ? {workId: message.workId} : {}),
      homeId: null, homeTitle: 'Artists’ City', roomName: artists.get(actor)?.name + ' gallery'});
  }
  return [...records.values()];
}

function ignoredBriefs(value) {
  if (!Array.isArray(value) || value.length > 1000) throw Error('The conversation file holds at most 1,000 review records.');
  const check = (node, depth = 0) => {
    if (depth > 8) throw Error('The conversation review records are too deeply nested.');
    if (node === null || typeof node === 'boolean') return;
    if (typeof node === 'string' && node.length <= 10000) return;
    if (typeof node === 'number' && Number.isFinite(node)) return;
    if (Array.isArray(node) && node.length <= 1000) { for (const item of node) check(item, depth + 1); return; }
    if (node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)) && Object.keys(node).length <= 30) { for (const item of Object.values(node)) check(item, depth + 1); return; }
    throw Error('Use bounded plain conversation review records.');
  };
  for (const brief of value) {
    if (!brief || Array.isArray(brief) || typeof brief !== 'object') throw Error('Use plain conversation review records.');
    check(brief);
    if (brief.status !== undefined && !['draft', 'approved'].includes(brief.status)) throw Error('Use a valid conversation review status.');
  }
}

export async function validateConversationFile(input, {maxMessages = 1000, maxBytes = 1300000} = {}) {
  if (!Number.isSafeInteger(maxMessages) || maxMessages < 1 || maxMessages > CONVERSATION_ARCHIVE_LIMIT || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw Error('Use valid conversation file limits.');
  plain(input, fileKeys, 'conversation file');
  let serialized;
  try { serialized = JSON.stringify(input); } catch { throw Error('Use a JSON conversation file.'); }
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) throw Error('This conversation file is too large. Import a smaller part of the archive.');
  if (input.format !== CONVERSATION_FILE_FORMAT || input.version !== 1) throw Error('Use a House of Ideas private conversation file, version 1.');
  if (!Array.isArray(input.messages) || input.messages.length > maxMessages) throw Error(`Import at most ${maxMessages.toLocaleString('en-US')} conversation messages at a time.`);
  if (Object.hasOwn(input, 'source')) text(input.source, 100, 'The conversation file source');
  if (Object.hasOwn(input, 'revision') && (!Number.isSafeInteger(input.revision) || input.revision < 0)) throw Error('Use a valid house revision.');
  if (Object.hasOwn(input, 'exportedAt')) timestamp(input.exportedAt);
  if (Object.hasOwn(input, 'nextCursor') && input.nextCursor !== null && (!Number.isSafeInteger(input.nextCursor) || input.nextCursor < 1)) throw Error('Use a valid conversation cursor.');
  if (Object.hasOwn(input, 'promptVersion')) text(input.promptVersion, 100, 'The prompt version');
  if (Object.hasOwn(input, 'briefs')) ignoredBriefs(input.briefs);
  const records = new Map();
  for (const message of input.messages) {
    const record = await validateConversationRecord(message);
    if (!records.has(record.id)) records.set(record.id, record);
  }
  // Even a downloaded file with approved briefs imports only dialogue. The
  // destination owner must make a separate approval decision there.
  return {format: CONVERSATION_FILE_FORMAT, version: 1, messages: [...records.values()]};
}
