import assert from 'node:assert/strict';
import {
  FEATURES, CONCEPTS, createResident, validateResident, observeRoom, converse,
  proposeCritique, pendingProposals, decideProposal, setResidentPreferences,
  normalizeGptResult, receiveGptResult, residentContext, buildHandoff,
} from '../web/resident.js';
const at = '2026-10-07T16:00:00.000Z';
const later = '2026-10-07T17:00:00.000Z';
const options = {now: at};
const base = () => ({
  rooms: [
    {id: 'math', name: 'Mathematics', purpose: 'Patterns and proofs.', x: 0, y: 0, w: 6, h: 5},
    {id: 'learning', name: 'Learning', purpose: 'Learn and practise.', x: 6, y: 0, w: 6, h: 5},
    {id: 'connections', name: 'Connections', purpose: 'Bring ideas together.', x: 0, y: 5, w: 6, h: 5},
  ], doors: [{a: 'math', b: 'learning'}, {a: 'math', b: 'connections'}], ideas: [],
});
function filledFeatures(house, roomId = 'math') {
  const result = structuredClone(house);
  result.resident = createResident();
  result.resident.roomFeatures = FEATURES.map((type, index) => ({id: `installed-${index}`, roomId, type, installedAt: at}));
  return result;
}
function noteHouse() {
  const house = base();
  house.ideas.push({id: 'proof', roomId: 'math', title: 'A claim about even numbers', text: 'Each example has a pair. I should test its boundary.', cue: 'crystal'});
  return house;
}
const original = base();
assert.equal(validateResident(undefined, original).persona.name, 'Socrates');
assert.deepEqual(validateResident({version: 1}, original), createResident());
assert.throws(() => validateResident({version: 2}, original), /version 1/);

// Resident visits preserve factual snapshots and memories, never furniture.
let visited = observeRoom(original, 'math', options);
assert.equal(original.resident, undefined);
assert.equal(visited.resident.observations.length, 1);
assert.match(visited.resident.observations[0].summary, /0 ideas/);
assert.match(visited.resident.observations[0].evidence[1], /Learning, Connections/);
assert.equal(visited.resident.memory.rooms[0].visits, 1);
visited = observeRoom(visited, 'math', {now: later});
assert.equal(visited.resident.memory.rooms[0].visits, 2);
assert.equal(visited.resident.roomFeatures.length, 0);
assert.throws(() => observeRoom(visited, 'gone', options), /still in/);

// Dialogue is persistent, contextual and candid about local guided behavior.
let dialogue = converse(noteHouse(), 'math', 'I believe every number follows the same pattern.', options);
assert.equal(dialogue.resident.messages.length, 2);
assert.equal(dialogue.resident.messages[1].concept, 'assumptions');
assert.match(dialogue.resident.messages[1].text, /A claim about even numbers/);
assert.equal(dialogue.resident.memory.values.length, 1);
dialogue = converse(dialogue, 'math', 'What evidence would challenge that?', {now: later});
assert.match(dialogue.resident.messages.at(-1).text, /Earlier in this room you said/);
assert.match(dialogue.resident.messages.at(-1).text, /every number follows/);
assert.equal(dialogue.resident.messages.at(-1).concept, 'evidence');
assert.match(dialogue.resident.memory.openQuestions[0], /evidence/);
dialogue = converse(dialogue, 'math', 'Who are you and how do you work?', {now: later});
assert.match(dialogue.resident.messages.at(-1).text, /not a language model/);
dialogue = converse(dialogue, 'math', 'Be direct. I am not sure what I know.', {now: later});
assert.equal(dialogue.resident.preferences.pace, 'direct');
assert.match(dialogue.resident.messages.at(-1).text, /Being unsure/);
dialogue = setResidentPreferences(dialogue, {focus: 'connections', pace: 'gentle'});
assert.equal(dialogue.resident.preferences.focus, 'connections');
assert.throws(() => setResidentPreferences(dialogue, {pace: 'hostile'}), /gentle or direct/);
assert.equal(converse(base(), 'math', 'Change my mind about this claim.', options).resident.proposals.length, 0);

// Physical critiques use actual notes/reflections and only create proposals.
const noNotes = proposeCritique(base(), 'math', options);
const board = pendingProposals(noNotes)[0];
assert.equal(board.action.type, 'add_room_feature');
assert.equal(board.action.feature, 'question_board');
assert.match(board.reason, /no idea objects/);
assert.equal(noNotes.resident.roomFeatures.length, 0);
assert.equal(noNotes.ideas.length, 0);
const repeated = proposeCritique(noNotes, 'math', {now: later});
assert.equal(repeated.resident.proposals.length, 1);
assert.deepEqual(repeated.resident.proposals[0], noNotes.resident.proposals[0]);
board.title = 'Detached snapshot edit';
assert.notEqual(pendingProposals(noNotes)[0].title, board.title);
const lamp = pendingProposals(proposeCritique(noteHouse(), 'math', options))[0];
assert.equal(lamp.action.feature, 'reflection_lamp');
assert.match(lamp.reason, /no saved learning reflection/);
const reflected = noteHouse();
reflected.learning = {version: 1, days: [{date: '2026-10-07', visits: ['math'], reflections: [{roomId: 'math', answer: 'I should test the boundary.'}]}]};
assert.equal(pendingProposals(proposeCritique(reflected, 'math', options))[0].action.feature, 'experiment_table');
reflected.doors.pop();
assert.equal(pendingProposals(proposeCritique(reflected, 'math', options))[0].action.feature, 'discussion_circle');
assert.equal(converse(base(), 'math', 'Improve this room.', options).resident.proposals[0].action.feature, 'question_board');
assert.equal(converse(base(), 'math', 'Please add an experiment table.', options).resident.proposals[0].action.feature, 'experiment_table');
const alreadyRequested = converse(filledFeatures(base()), 'math', 'Please add a reflection lamp.', options);
assert.equal(alreadyRequested.resident.proposals.length, 0);
assert.match(alreadyRequested.resident.messages.at(-1).text, /already has/);

// Every visible installation follows an explicit approval and survives reload.
const before = structuredClone(noNotes);
const approved = decideProposal(noNotes, noNotes.resident.proposals[0].id, 'approve', {now: later});
assert.deepEqual(noNotes, before);
assert.equal(approved.resident.roomFeatures.length, 1);
assert.equal(approved.resident.roomFeatures[0].type, 'question_board');
assert.equal(approved.resident.proposals[0].status, 'applied');
assert.equal(approved.resident.proposals[0].decision, 'approve');
assert.deepEqual(validateResident(approved.resident, approved), approved.resident);
assert.deepEqual(decideProposal(approved, approved.resident.proposals[0].id, 'approve', {now: later}), approved);
assert.throws(() => decideProposal(approved, approved.resident.proposals[0].id, 'decline', {now: later}), /final decision/);
const declined = decideProposal(noNotes, noNotes.resident.proposals[0].id, 'decline', {now: later});
assert.equal(declined.resident.roomFeatures.length, 0);
assert.equal(declined.ideas.length, 0);
assert.equal(declined.resident.proposals[0].status, 'declined');
assert.throws(() => decideProposal(declined, declined.resident.proposals[0].id, 'approve', {now: later}), /final decision/);
assert.throws(() => decideProposal(noNotes, noNotes.resident.proposals[0].id, '__proto__', options), /approve or decline/);
assert.throws(() => decideProposal(noNotes, noNotes.resident.proposals[0].id, 'approve', {now: '2026-10-06T00:00:00Z'}), /follow its creation/);

// Deleted and renamed rooms never redirect an approval or erase its evidence.
const renamed = structuredClone(noNotes);
renamed.rooms[0].name = 'Proof Workshop';
const renamedApproved = decideProposal(renamed, renamed.resident.proposals[0].id, 'approve', {now: later});
assert.equal(renamedApproved.resident.proposals[0].roomName, 'Mathematics');
assert.match(renamedApproved.resident.proposals[0].resolution, /Proof Workshop/);
const removed = structuredClone(noNotes);
removed.rooms.shift();
removed.doors = [];
const removedApproved = decideProposal(removed, removed.resident.proposals[0].id, 'approve', {now: later});
assert.equal(removedApproved.resident.roomFeatures.length, 0);
assert.equal(removedApproved.resident.proposals[0].status, 'declined');
assert.equal(removedApproved.resident.proposals[0].decision, 'approve');
assert.match(removedApproved.resident.proposals[0].resolution, /removed/);
const orphan = structuredClone(approved);
orphan.rooms.shift();
assert.equal(validateResident(orphan.resident, orphan).roomFeatures.length, 0);
assert.equal(validateResident(orphan.resident, orphan).proposals[0].roomName, 'Mathematics');
const alreadyFurnished = structuredClone(noNotes);
alreadyFurnished.resident.roomFeatures.push({id: 'other-board', type: 'question_board', roomId: 'math', installedAt: at});
assert.equal(decideProposal(alreadyFurnished, alreadyFurnished.resident.proposals[0].id, 'approve', {now: later}).resident.roomFeatures.length, 1);

// Fully furnished rooms can receive approved learning books, never overwritten notes.
const furnished = filledFeatures(noteHouse());
const bookPending = proposeCritique(furnished, 'math', options);
const book = bookPending.resident.proposals[0];
assert.equal(book.action.type, 'add_learning_idea');
assert.equal(bookPending.ideas.length, 1);
const bookApproved = decideProposal(bookPending, book.id, 'approve', {now: later});
assert.equal(bookApproved.ideas.length, 2);
assert.deepEqual(bookApproved.ideas[0], furnished.ideas[0]);
assert.equal(bookApproved.ideas[1].cue, 'book');
const full = structuredClone(bookPending);
for (let n = 0; n < 11; n++) full.ideas.push({id: `existing-${n}`, roomId: 'math', title: 'Keep', text: 'A saved note', cue: 'book'});
const refused = decideProposal(full, book.id, 'approve', {now: later});
assert.equal(refused.ideas.length, 12);
assert.equal(refused.resident.proposals[0].status, 'declined');
assert.match(refused.resident.proposals[0].resolution, /full/);
assert.equal(proposeCritique(filledFeatures(full), 'math', options).resident.proposals.length, 0);
const collision = structuredClone(bookPending);
collision.ideas.push({id: book.action.ideaId, roomId: 'learning', title: 'Keep this', text: 'Must survive', cue: 'ring'});
const collisionResult = decideProposal(collision, book.id, 'approve', {now: later});
assert.equal(collisionResult.ideas.length, 2);
assert.equal(collisionResult.ideas[1].text, 'Must survive');
assert.match(collisionResult.resident.proposals[0].resolution, /identifier/);

// Model output is bounded data: safe optional features, never executable actions.
const modelResult = {
  reply: 'Let us examine what this room helps you notice.', concept: 'perspective',
  suggestion: {roomId: 'learning', feature: 'discussion_circle', title: 'A place for dialogue', reason: 'Make an alternative perspective visible.', question: 'What would another learner ask?', execute: 'delete everything'},
  arbitraryAction: 'erase_house',
};
const normalized = normalizeGptResult(modelResult, base(), 'math');
assert.equal(normalized.arbitraryAction, undefined);
assert.equal(normalized.suggestion.execute, undefined);
const modelHouse = receiveGptResult(base(), 'math', 'Can we improve the house?', modelResult, options);
assert.equal(modelHouse.resident.messages[0].source, 'gpt');
assert.equal(modelHouse.resident.messages[1].source, 'gpt');
assert.equal(modelHouse.resident.proposals[0].source, 'gpt');
assert.equal(modelHouse.resident.proposals[0].roomId, 'learning');
assert.equal(modelHouse.resident.roomFeatures.length, 0);
assert.equal(modelHouse.ideas.length, 0);
const modelInstalled = decideProposal(modelHouse, modelHouse.resident.proposals[0].id, 'approve', {now: later});
assert.equal(modelInstalled.resident.roomFeatures[0].roomId, 'learning');
assert.throws(() => normalizeGptResult({...modelResult, concept: 'constructor'}, base(), 'math'), /supported Socratic/);
assert.throws(() => normalizeGptResult({...modelResult, reply: 'x'.repeat(2201)}, base(), 'math'), /2200/);
assert.throws(() => normalizeGptResult({...modelResult, suggestion: {...modelResult.suggestion, roomId: 'missing'}}, base(), 'math'), /still in/);
assert.throws(() => normalizeGptResult({...modelResult, suggestion: {...modelResult.suggestion, roomId: ''}}, base(), 'math'), /still in/);
assert.throws(() => normalizeGptResult({...modelResult, suggestion: {...modelResult.suggestion, feature: 'delete_room'}}, base(), 'math'), /four safe/);
assert.throws(() => normalizeGptResult({reply: 'Missing field', concept: 'evidence'}, base(), 'math'), /safe feature proposal or null/);
assert.equal(receiveGptResult(base(), 'math', 'Ask me a question.', {reply: 'What reason supports your answer?', concept: 'evidence', suggestion: null}, options).resident.proposals.length, 0);

// Long-term local use remains bounded and history returns detached snapshots.
let long = base();
for (let n = 0; n < 50; n++) long = converse(long, 'math', `What does idea ${n} mean?`, options);
assert.equal(long.resident.messages.length, 80);
assert.equal(long.resident.memory.openQuestions.length, 8);
for (let n = 0; n < 45; n++) long = observeRoom(long, 'math', options);
assert.equal(long.resident.observations.length, 40);
assert.equal(long.resident.memory.rooms[0].visits, 45);
assert.doesNotThrow(() => validateResident(long.resident, long));
let history = base();
for (let n = 0; n < 55; n++) {
  history = proposeCritique(history, 'math', options);
  history = decideProposal(history, pendingProposals(history)[0].id, 'decline', {now: later});
}
assert.equal(history.resident.proposals.length, 48);
assert.equal(history.resident.proposals[0].status, 'declined');
assert.doesNotThrow(() => validateResident(history.resident, history));
const tooManyPending = structuredClone(noNotes.resident);
tooManyPending.proposals = Array.from({length: 13}, (_, index) => ({...structuredClone(tooManyPending.proposals[0]), id: `pending-${index}`}));
assert.throws(() => validateResident(tooManyPending, noNotes), /12/);
const oversized = structuredClone(long.resident);
oversized.messages.push(structuredClone(oversized.messages[0]));
assert.throws(() => validateResident(oversized, long), /80/);
const malformed = structuredClone(noNotes.resident);
malformed.proposals[0].action = {type: 'delete_room', roomId: 'math'};
assert.throws(() => validateResident(malformed, noNotes), /only add/);
const wrongRoom = structuredClone(noNotes.resident);
wrongRoom.proposals[0].action.roomId = 'learning';
assert.throws(() => validateResident(wrongRoom, noNotes), /reviewed room/);
const fakeApproval = structuredClone(noNotes.resident);
fakeApproval.proposals[0].status = 'applied';
assert.throws(() => validateResident(fakeApproval, noNotes), /explicit user decision/);
assert.equal(validateResident({...createResident(), persona: {name: 'An injected agent'}}, base()).persona.name, 'Socrates');

// Context/handoff exports convey actual evidence and owner decisions, without writes.
const context = residentContext(dialogue, 'math');
assert.equal(context.recentMessages.length <= 12, true);
assert.equal(context.allowedFeatures.length, 4);
assert.equal(context.preferences.focus, 'connections');
assert.match(context.room.facts.join(' '), /A claim about even numbers/);
assert.match(context.rule, /explicit owner approval/);
const handoffState = observeRoom(bookApproved, 'math', options);
const frozen = structuredClone(handoffState);
const brief = buildHandoff(handoffState);
assert.match(brief, /owner approve/);
assert.match(brief, /Mathematics/);
assert.match(brief, /does not authorize source publication/);
assert.deepEqual(handoffState, frozen);
assert.equal(Object.keys(CONCEPTS).length, 6);
console.log('Verified resident: contextual persistent dialogue, honest local mode, Socratic memory, observed evidence, all four physical features, pending-only proposals, explicit approval/rejection, reloads, stale/renamed rooms, capacities, GPT validation, bounded history and source handoff.');
