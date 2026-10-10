import {CONVERSATION_ARCHIVE_LIMIT, CONVERSATION_FILE_FORMAT, conversationRecords, validateConversationRecord} from '../web/conversation-data.js';

export class ConversationArchiveError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
function capacity() {
  throw new ConversationArchiveError(`The private archive holds ${CONVERSATION_ARCHIVE_LIMIT.toLocaleString('en-US')} messages. Download it before arranging more storage. Your draft is kept; no messages were removed.`);
}
export async function validateConversationArchive(input) {
  if (input === undefined) return {version: 1, messages: []};
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 || !Array.isArray(input.messages)) throw Error('Use a version 1 local conversation archive.');
  if (input.messages.length > CONVERSATION_ARCHIVE_LIMIT) capacity();
  const records = new Map();
  for (const message of input.messages) {
    const record = await validateConversationRecord(message);
    if (records.has(record.id)) throw Error('Local conversation archive identities must be unique.');
    records.set(record.id, record);
  }
  return {...input, version: 1, messages: [...records.values()]};
}
export async function mergeConversationArchive(archive, ...neighborhoods) {
  // Existing archive entries were verified at startup and created by this
  // module. Rechecking all old SHA hashes on every save would needlessly grow
  // the cost of each conversation; validate only newly captured records.
  const records = new Map((archive?.messages ?? []).map(message => [message.id, message]));
  for (const neighborhood of neighborhoods) {
    for (const message of await conversationRecords(neighborhood)) {
      if (!records.has(message.id)) records.set(message.id, message);
      if (records.size > CONVERSATION_ARCHIVE_LIMIT) capacity();
    }
  }
  return {...archive, version: 1, messages: [...records.values()]};
}
export function conversationFile(archive, revision, exportedAt = new Date().toISOString()) {
  return {format: CONVERSATION_FILE_FORMAT, version: 1, source: 'local-house', exportedAt, revision, messages: archive.messages};
}
