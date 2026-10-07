import assert from 'node:assert/strict';
import {
  FEATURES, CONCEPTS, createResident, validateResident, observeRoom, converse,
  proposeCritique, pendingProposals, decideProposal, setResidentPreferences,
  normalizeGptResult, receiveGptResult, residentContext, buildHandoff,
} from '../web/resident.js';
import {buildGptPrompt, selectedContext, requestGptReply, DEFAULT_MODEL} from '../server/gpt.mjs';
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
assert.equal(board.concept, 'clarify');
assert.match(board.practice, /define its key word/);
assert.match(board.successTest, /next visit/);
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
assert.equal(converse(base(), 'math', 'As a philosopher, what ideas do you have to improve the houses?', options).resident.proposals[0].status, 'pending');
assert.equal(converse(base(), 'math', 'Please add an experiment table.', options).resident.proposals[0].action.feature, 'experiment_table');
const alreadyRequested = converse(filledFeatures(base()), 'math', 'Please add a reflection lamp.', options);
assert.equal(alreadyRequested.resident.proposals.length, 0);
assert.match(alreadyRequested.resident.messages.at(-1).text, /already has/);

// A resident critiques the declared use of a place, with a practical next-visit
// test. Counts and imported design labels never establish comfort or learning.
function domestic(name, purpose) {
  const house = base();
  house.rooms[0].name = name;
  house.rooms[0].purpose = purpose;
  return house;
}
const restCritique = proposeCritique(domestic('Bedroom', 'Rest, dreams and personal thoughts.'), 'math', options);
const restPlan = restCritique.resident.proposals[0];
assert.equal(restPlan.action.feature, 'reflection_lamp');
assert.equal(restPlan.concept, 'examined_life');
assert.match(restPlan.reason, /0 idea objects/);
assert.match(restPlan.reason, /without judging how rested you are/);
assert.match(restPlan.practice, /pause without a task/);
assert.match(restPlan.successTest, /alone is not evidence/);
assert.equal(proposeCritique(domestic('Living room', 'Talk through different viewpoints.'), 'math', options).resident.proposals[0].action.feature, 'discussion_circle');
assert.equal(proposeCritique(domestic('Kitchen', 'Recipes, practical projects and their results.'), 'math', options).resident.proposals[0].action.feature, 'experiment_table');
const unclear = proposeCritique(domestic('New room', ''), 'math', options);
assert.match(unclear.resident.proposals[0].reason, /no written purpose/);
assert.match(unclear.resident.observations[0].evidence.join(' '), /Declared purpose: not written yet/);
const afterRefusal = proposeCritique(decideProposal(noNotes, noNotes.resident.proposals[0].id, 'decline', {now: later}), 'math', {now: later});
assert.notEqual(afterRefusal.resident.proposals.at(-1).action.feature, 'question_board');
assert.match(afterRefusal.resident.proposals.at(-1).reason, /You declined my previous question board/);
let noAdditions = base();
for (let n = 0; n < FEATURES.length; n++) {
  noAdditions = proposeCritique(noAdditions, 'math', options);
  noAdditions = decideProposal(noAdditions, pendingProposals(noAdditions)[0].id, 'decline', {now: later});
}
assert.equal(new Set(noAdditions.resident.proposals.map(proposal => proposal.action.feature)).size, FEATURES.length);
noAdditions = proposeCritique(noAdditions, 'math', options);
assert.equal(pendingProposals(noAdditions).length, 0);
assert.match(noAdditions.resident.messages.at(-1).text, /stop proposing them unless you ask/);
assert.equal(noAdditions.resident.roomFeatures.length, 0);
const explicitlyReconsidered = converse(noAdditions, 'math', 'Please add a question board after all.', options);
assert.equal(pendingProposals(explicitlyReconsidered)[0].action.feature, 'question_board');
const rememberedCare = converse(converse(domestic('Bedroom', 'A place to rest.'), 'math', 'I want to learn without neglecting sleep.', options), 'math', 'I feel tired. What would a useful pause do?', {now: later});
assert.equal(rememberedCare.resident.messages.at(-1).concept, 'examined_life');
assert.match(rememberedCare.resident.messages.at(-1).text, /previously told me/);
assert.match(rememberedCare.resident.messages.at(-1).text, /without turning rest into another obligation/);
const twoIdeas = noteHouse();
twoIdeas.ideas.push({id: 'garden', roomId: 'math', title: 'Garden patterns', text: 'Compare repeating leaf shapes.', cue: 'book', action: 'experiment'});
assert.match(converse(twoIdeas, 'math', 'Why do garden patterns repeat?', options).resident.messages.at(-1).text, /Your idea “Garden patterns”/);
const imported = noteHouse();
imported.designObjects = [{id: 'desk', title: 'Handmade discussion desk', assetId: 'asset-secret-hash', roomId: 'math', placement: 'room', kind: 'object', action: 'question', note: 'Try discussing one claim at this desk.', position: {x: 1, y: 0, z: 1}, sourceUrl: 'https://must-not-be-sent.invalid', bytes: 'private asset bytes'}];
const designPlan = proposeCritique(imported, 'math', options).resident.proposals[0];
assert.match(designPlan.reason, /Handmade discussion desk/);
assert.match(designPlan.reason, /appearance alone cannot tell me/);
assert.match(designPlan.evidence.join(' '), /assigned to question/);
assert.equal(designPlan.action.type, 'add_room_feature');
assert.equal(imported.resident, undefined);

// Every visible installation follows an explicit approval and survives reload.
const before = structuredClone(noNotes);
const approved = decideProposal(noNotes, noNotes.resident.proposals[0].id, 'approve', {now: later});
assert.deepEqual(noNotes, before);
assert.equal(approved.resident.roomFeatures.length, 1);
assert.equal(approved.resident.roomFeatures[0].type, 'question_board');
assert.equal(approved.resident.proposals[0].status, 'applied');
assert.equal(approved.resident.proposals[0].decision, 'approve');
assert.deepEqual(validateResident(approved.resident, approved), approved.resident);
assert.equal(validateResident(approved.resident, approved).proposals[0].successTest, noNotes.resident.proposals[0].successTest);
const historicalProposal = structuredClone(noNotes.resident);
for (const field of ['concept', 'practice', 'successTest']) delete historicalProposal.proposals[0][field];
assert.doesNotThrow(() => validateResident(historicalProposal, noNotes));
const invalidPractice = structuredClone(noNotes.resident);
invalidPractice.proposals[0].successTest = 'x'.repeat(501);
assert.throws(() => validateResident(invalidPractice, noNotes), /improvement test/);
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
assert.equal(modelHouse.resident.proposals[0].concept, 'perspective');
assert.match(modelHouse.resident.proposals[0].successTest, /one conversation/);
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
  // A fresh explicit request may reconsider an earlier refusal. Autonomous
  // critiques do not continually re-propose a feature the owner declined.
  history = proposeCritique(history, 'math', {...options, feature: 'question_board'});
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

// Both online transports share bounded personal history, actual room functions,
// and decisions. The outgoing request is inspected through a fake fetch only.
let personalized = observeRoom(imported, 'math', options);
personalized = converse(personalized, 'math', 'I value clear explanations. What counts as a good example?', options);
personalized = proposeCritique(personalized, 'math', options);
personalized = decideProposal(personalized, personalized.resident.proposals[0].id, 'decline', {now: later});
personalized.learning = {days: [{date: '2026-10-07', reflections: [{roomId: 'math', answer: 'One example did not cover the boundary.'}]}]};
const boundedContext = selectedContext(personalized, 'math');
assert.match(boundedContext.ownerMemory.values[0], /clear explanations/);
assert.match(boundedContext.ownerMemory.openQuestions[0], /good example/);
assert.equal(boundedContext.residentVisits.count, 2);
assert.equal(boundedContext.recentDecisions[0].decision, 'decline');
assert.equal(boundedContext.recentReflections[0].date, '2026-10-07');
assert.equal(boundedContext.room.ideaFunctions.reflect, 1);
assert.deepEqual(boundedContext.designObjects, [{title: 'Handmade discussion desk', kind: 'object', action: 'question', note: 'Try discussing one claim at this desk.'}]);
assert.doesNotMatch(JSON.stringify(boundedContext), /private asset bytes|must-not-be-sent|asset-secret-hash/);
const prompt = buildGptPrompt(personalized, {message: 'Does the house help me think?', roomId: 'math'});
assert.match(prompt[0].content, /counterexamples/);
assert.match(prompt[0].content, /rest, care, conversation/);
assert.match(prompt[0].content, /missing recorded evidence/);
assert.match(prompt[0].content, /Never invent a historical quotation/);
assert.match(prompt[0].content, /next visit/);
assert.match(prompt[1].content, /recentDecisions/);
assert.equal(prompt.at(-1).role, 'user');
let outgoing;
const reply = await requestGptReply({apiKey: 'sk-only-a-test-not-a-real-key', model: DEFAULT_MODEL, input: {message: 'What should we improve?', roomId: 'math'}, house: personalized, fetchImpl: async (url, request) => {
  outgoing = JSON.parse(request.body);
  return new Response(JSON.stringify({status: 'completed', output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify({reply: 'Which definition would make the desk discussion clearer?', concept: 'clarify', suggestion: null})}]}]}), {status: 200});
}});
assert.equal(reply.suggestion, null);
assert.equal(outgoing.store, false);
assert.deepEqual(outgoing.input, buildGptPrompt(personalized, {message: 'What should we improve?', roomId: 'math'}));
const overlongDesigns = structuredClone(personalized);
overlongDesigns.designObjects = Array.from({length: 30}, (_, n) => ({...imported.designObjects[0], title: `Design ${n}`, note: 'n'.repeat(1000)}));
overlongDesigns.learning.days = Array.from({length: 10}, (_, n) => ({date: `2026-09-${String(n + 1).padStart(2, '0')}`, reflections: [{roomId: 'math', answer: 'r'.repeat(1200)}]}));
const limitedContext = selectedContext(overlongDesigns, 'math');
assert.equal(limitedContext.designObjects.length, 6);
assert.equal(limitedContext.designObjects[0].note.length, 240);
assert.equal(limitedContext.recentReflections.length, 4);
assert.equal(limitedContext.recentReflections[0].answer.length, 400);
assert.deepEqual(personalized.designObjects[0], imported.designObjects[0]);
console.log('Verified resident: purposeful philosophical critiques, rest and conversation, object functions, explicit practical tests, remembered goals/refusals, contextual dialogue, approval-only changes, archival compatibility, bounded designer metadata and personalized GPT prompts with no live requests.');
