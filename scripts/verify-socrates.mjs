import assert from 'node:assert/strict';
import {
  pragueDate, nextDate, previousDate, validateLearning, visitRoom, reflect,
  lesson, critique, reviewDay, pendingReview, decideReview, applyApproved,
} from '../web/socrates.js';
import {FEATURES, dailyCritiquePractice, dailyFeatureDeclined, proposeCritique, decideProposal} from '../web/resident.js';
import {starter} from '../web/model.js';
import {initialNeighborhood, saveEdition} from '../web/neighborhood.js';

const base = () => ({
  rooms: [
    {id: 'math', name: 'Mathematics', purpose: 'Patterns and proofs.'},
    {id: 'learning', name: 'Learning', purpose: 'Learn and practise.'},
  ], doors: [], ideas: [],
});
const yesterday = previousDate(pragueDate());
const today = pragueDate();
const tomorrow = nextDate(today);

// Calendar calculations use Prague time even around midnight and DST changes.
assert.equal(pragueDate(new Date('2026-10-06T22:30:00Z')), '2026-10-07');
assert.equal(pragueDate(new Date('2026-01-06T22:30:00Z')), '2026-01-06');
assert.equal(nextDate('2024-02-28'), '2024-02-29');
assert.equal(nextDate('2024-12-31'), '2025-01-01');
assert.equal(previousDate('2024-03-01'), '2024-02-29');
assert.throws(() => nextDate('2026-02-30'), /real calendar/);

// Old documents load without learning, and feature opt-in survives validation.
assert.deepEqual(validateLearning(undefined, base()), {version: 1, enabled: false, days: []});
assert.equal(validateLearning({version: 1, enabled: true, days: []}, base()).enabled, true);
assert.throws(() => validateLearning({version: 1, enabled: 'yes', days: []}, base()), /enabled/);
let house = base();
const original = structuredClone(house);
house = visitRoom(house, yesterday, 'math');
assert.deepEqual(original, base());
house = visitRoom(house, yesterday, 'math');
assert.deepEqual(house.learning.days[0].visits, ['math']);
house = reflect(house, yesterday, 'math', ' An example makes an assumption visible. ');
house = reflect(house, yesterday, 'math', 'A counterexample tests the boundary of the claim.');
assert.equal(house.learning.days[0].reflections.length, 1);
assert.equal(house.learning.days[0].reflections[0].answer, 'A counterexample tests the boundary of the claim.');
assert.throws(() => reflect(house, yesterday, 'math', ' '), /reflection/);
assert.throws(() => visitRoom(house, tomorrow, 'math'), /future/);
assert.throws(() => visitRoom(house, today, 'missing'), /still in/);

// A review never invents activity and repeats do not generate another proposal.
assert.equal(reviewDay(base(), yesterday).learning.days.length, 0);
house = reviewDay(house, yesterday);
const proposal = pendingReview(house, today);
assert.equal(proposal.id, `socrates-${yesterday}`);
assert.equal(proposal.forDate, today);
assert.equal(proposal.evidence.reflection, 'A counterexample tests the boundary of the claim.');
assert.match(proposal.reason, /no idea objects/);
assert.equal(house.ideas.length, 0);
assert.equal(pendingReview(house, yesterday), null);
assert.deepEqual(reviewDay(house, yesterday), house);
proposal.title = 'Caller edited a detached snapshot';
assert.notEqual(pendingReview(house, today).title, proposal.title);
const immutable = structuredClone(house.learning.days[0].review);
const revised = reflect(house, yesterday, 'math', 'A later reflection');
assert.deepEqual(revised.learning.days[0].review, immutable);

// Tomorrow's improvement cannot be approved or applied on its observation day.
assert.throws(() => decideReview(house, immutable.id, 'approve', yesterday), /next day/);
assert.deepEqual(applyApproved(house, yesterday), house);
const approved = decideReview(house, immutable.id, 'approve', today);
assert.equal(approved.ideas.length, 0);
assert.equal(approved.learning.days[0].review.status, 'approved');
assert.deepEqual(applyApproved(approved, yesterday), approved);
const applied = applyApproved(approved, today);
assert.equal(applied.ideas.length, 1);
assert.equal(applied.ideas[0].id, `socratic-${yesterday}`);
assert.equal(applied.learning.days[0].review.status, 'applied');
assert.equal(applied.learning.days[0].review.appliedOn, today);
assert.deepEqual(applyApproved(applied, today), applied);
assert.deepEqual(decideReview(applied, immutable.id, 'approve', today), applied);
assert.throws(() => decideReview(applied, immutable.id, 'decline', today), /already/);
assert.throws(() => decideReview(house, immutable.id, '__proto__', today), /approve or decline/);
assert.equal(pendingReview(applied, today), null);

// Declines are final; later entries or repeated approvals never alter the house.
const declined = decideReview(house, immutable.id, 'decline', today);
assert.equal(declined.ideas.length, 0);
assert.deepEqual(applyApproved(declined, today), declined);
assert.throws(() => decideReview(declined, immutable.id, 'approve', today), /already/);
assert.deepEqual(decideReview(declined, immutable.id, 'decline', today), declined);

// A deleted room remains valid evidence, but cannot receive an approved object.
const removed = structuredClone(approved);
removed.rooms = removed.rooms.filter(room => room.id !== 'math');
assert.doesNotThrow(() => validateLearning(removed.learning, removed));
const resolved = applyApproved(removed, today);
assert.equal(resolved.ideas.length, 0);
assert.equal(resolved.learning.days[0].review.status, 'declined');
assert.match(resolved.learning.days[0].review.resolution, /removed/);
const renamed = structuredClone(approved);
renamed.rooms[0].name = 'Proof Studio';
const renamedApplied = applyApproved(renamed, today);
assert.equal(renamedApplied.ideas[0].roomId, 'math');
assert.equal(renamedApplied.learning.days[0].review.roomName, 'Mathematics');
assert.match(renamedApplied.learning.days[0].review.resolution, /Proof Studio/);

// An edited house is checked at application time, rather than overwriting ideas.
const full = structuredClone(approved);
for (let n = 0; n < 12; n++) full.ideas.push({id: `existing-${n}`, roomId: 'math', title: 'Existing', text: 'Notes', cue: 'book'});
assert.equal(applyApproved(full, today).ideas.length, 12);
assert.match(applyApproved(full, today).learning.days[0].review.resolution, /capacity/);
const collision = structuredClone(approved);
collision.ideas.push({id: immutable.action.ideaId, roomId: 'learning', title: 'Keep', text: 'User notes', cue: 'ring'});
const collisionResult = applyApproved(collision, today);
assert.equal(collisionResult.ideas.length, 1);
assert.equal(collisionResult.ideas[0].text, 'User notes');
assert.match(collisionResult.learning.days[0].review.resolution, /identifier/);

// Different days get independent proposals; the earliest due one is shown first.
let recurring = visitRoom(base(), previousDate(yesterday), 'learning');
recurring = reviewDay(recurring, previousDate(yesterday));
recurring = visitRoom(recurring, yesterday, 'math');
recurring = reviewDay(recurring, yesterday);
assert.equal(recurring.learning.days.length, 2);
assert.equal(pendingReview(recurring, today).id, `socrates-${previousDate(yesterday)}`);
recurring = decideReview(recurring, pendingReview(recurring, today).id, 'decline', today);
assert.equal(pendingReview(recurring, today).id, `socrates-${yesterday}`);

// Critiques reflect real notes and give room-specific practice, with honest copy.
const notes = base();
notes.ideas.push({id: 'claim', roomId: 'math', title: 'A claim', text: '', cue: 'crystal'});
assert.match(critique(notes.rooms[0], notes).observation, /A claim/);
assert.match(critique(notes.rooms[0], notes).observation, /no explanation/);
notes.ideas[0].text = 'Every example I tried was positive.';
assert.match(critique(notes.rooms[0], notes).question, /assumption/);
assert.equal(critique(notes.rooms[0], notes).method, 'Local guided questions');
assert.match(lesson(notes.rooms[1]).exercise, /memory/);
assert.match(lesson({id: 'constructor', name: 'A custom room'}).exercise, /memory/);
let noted = reviewDay(visitRoom(notes, yesterday, 'math'), yesterday);
assert.match(noted.learning.days[0].review.reason, /not recorded/);
noted = reviewDay(reflect(visitRoom(notes, yesterday, 'math'), yesterday, 'math', 'I assume it holds for all values.'), yesterday);
assert.match(noted.learning.days[0].review.question, /I assume/);

// Imported records are bounded and may not forge incompatible dates or actions.
const invalid = structuredClone(house.learning);
invalid.days[0].review.action.type = 'delete_room';
assert.throws(() => validateLearning(invalid, house), /only add/);
const future = {version: 1, days: [{date: tomorrow, visits: [], reflections: []}]};
assert.throws(() => validateLearning(future, house), /future/);
const duplicate = structuredClone(house.learning);
duplicate.days.push(structuredClone(duplicate.days[0]));
assert.throws(() => validateLearning(duplicate, house), /unique/);
const badEvidence = structuredClone(house.learning);
badEvidence.days[0].review.evidence.ideaCount = 2;
assert.throws(() => validateLearning(badEvidence, house), /count/);
const unsupported = structuredClone(house.learning);
unsupported.version = 2;
assert.throws(() => validateLearning(unsupported, house), /version 1/);
const oversized = {version: 1, days: Array.from({length: 367}, () => ({date: yesterday, visits: [], reflections: []}))};
assert.throws(() => validateLearning(oversized, house), /366/);
assert.doesNotThrow(() => validateLearning(applied.learning, applied));

// New reviews turn a purpose-aware critique into a bounded physical practice.
// Preparing, approving and installing remain three distinct immutable steps.
const recordedAt = `${yesterday}T12:00:00.000Z`;
const decisionAt = `${today}T12:00:00.000Z`;
let withPendingResident = proposeCritique(base(), 'math', {now: recordedAt});
withPendingResident = visitRoom(withPendingResident, yesterday, 'math');
const beforeDaily = structuredClone(withPendingResident);
const daily = reviewDay(withPendingResident, yesterday);
assert.deepEqual(withPendingResident, beforeDaily);
assert.deepEqual(daily.resident, beforeDaily.resident, 'Daily preparation records no dialogue, observation, furniture or resident decision.');
assert.equal(daily.ideas.length, 0);
assert.equal(daily.learning.days[0].review.furnishing.feature, 'question_board');
assert.match(daily.learning.days[0].review.title, /question board/);
assert.deepEqual(Object.keys(daily.learning.days[0].review.furnishing).sort(), ['concept', 'feature', 'practice', 'successTest']);
const dailyApproved = decideReview(daily, `socrates-${yesterday}`, 'approve', today);
assert.equal(dailyApproved.learning.days[0].review.decision, 'approve');
assert.deepEqual(dailyApproved.resident, daily.resident);
const dailyBuilt = applyApproved(dailyApproved, today);
assert.equal(dailyBuilt.ideas.length, 1);
assert.deepEqual(dailyBuilt.resident.roomFeatures, [{id: `socratic-feature-${yesterday}`, roomId: 'math', type: 'question_board', installedAt: decisionAt}]);
assert.deepEqual(dailyBuilt.resident.proposals, beforeDaily.resident.proposals, 'Daily approval never approves a separate pending resident proposal.');
assert.deepEqual(dailyBuilt.resident.messages, beforeDaily.resident.messages);
assert.deepEqual(applyApproved(dailyBuilt, today), dailyBuilt);
assert.match(dailyBuilt.ideas[0].text, /Socratic method\nClarify the claim/);
assert.match(dailyBuilt.ideas[0].text, /Next visit/);

for (const [name, purpose, feature, concept] of [
  ['Bedroom', 'Rest, dreams and personal thoughts.', 'reflection_lamp', 'examined_life'],
  ['Living room', 'Talk through different viewpoints.', 'discussion_circle', 'perspective'],
  ['Kitchen', 'Recipes, practical projects and their results.', 'experiment_table', 'evidence'],
]) {
  const place = base();
  place.rooms[0] = {...place.rooms[0], name, purpose};
  const prepared = reviewDay(visitRoom(place, yesterday, 'math'), yesterday);
  const furnishing = prepared.learning.days[0].review.furnishing;
  assert.equal(furnishing.feature, feature);
  assert.equal(furnishing.concept, concept);
  assert.equal(prepared.learning.days[0].review.title, dailyCritiquePractice(place, 'math').title);
  if (feature === 'reflection_lamp') assert.match(furnishing.practice, /pause without a task/);
  assert.equal(prepared.resident, undefined);
}

// The existing save coordinator keeps every complete older document and builds
// one neighbour for the approved book and furniture together.
let neighbourhood = initialNeighborhood(starter(), {now: recordedAt});
const learningHome = reviewDay(visitRoom(neighbourhood.homes.at(-1).house, yesterday, 'art'), yesterday);
neighbourhood = saveEdition(neighbourhood, learningHome, {now: recordedAt});
assert.equal(neighbourhood.homes.length, 2, 'Preparation only updates a journal, never the physical neighbourhood.');
const olderHomes = structuredClone(neighbourhood.homes);
const nextHome = applyApproved(decideReview(learningHome, `socrates-${yesterday}`, 'approve', today), today);
neighbourhood = saveEdition(neighbourhood, nextHome, {now: decisionAt});
assert.equal(neighbourhood.homes.length, 3);
assert.deepEqual(neighbourhood.homes.slice(0, 2), olderHomes, 'Book, notes, conversations and the pending review stay intact in earlier homes.');
assert.equal(neighbourhood.homes.at(-1).house.resident.roomFeatures[0].type, 'reflection_lamp');
assert.equal(neighbourhood.homes.at(-1).house.ideas.length, 1);

// Historical book-only snapshots are neither upgraded nor given new decisions.
const oldJournal = structuredClone(daily.learning);
delete oldJournal.days[0].review.furnishing;
assert.deepEqual(validateLearning(oldJournal, daily), oldJournal);
const oldHouse = {...base(), learning: oldJournal};
const oldBuilt = applyApproved(decideReview(oldHouse, `socrates-${yesterday}`, 'approve', today), today);
assert.equal(oldBuilt.resident, undefined);
assert.equal(oldBuilt.ideas.length, 1);
const oldApplied = structuredClone(oldBuilt.learning);
delete oldApplied.days[0].review.decision;
assert.deepEqual(validateLearning(oldApplied, oldBuilt), oldApplied);

// Rejections guide future furniture choices; a failed approved installation is
// not falsely remembered as the owner's refusal.
const dailyDeclined = decideReview(daily, `socrates-${yesterday}`, 'decline', today);
assert.equal(dailyDeclined.learning.days[0].review.decision, 'decline');
assert.equal(dailyFeatureDeclined(dailyDeclined, 'math', 'question_board'), true);
assert.deepEqual(applyApproved(dailyDeclined, today), dailyDeclined);
assert.notEqual(dailyCritiquePractice(dailyDeclined, 'math').feature, 'question_board');
let rejected = base();
let recordedDay = previousDate(previousDate(previousDate(yesterday)));
for (let n = 0; n < FEATURES.length; n++) {
  rejected = reviewDay(visitRoom(rejected, recordedDay, 'math'), recordedDay);
  rejected = decideReview(rejected, `socrates-${recordedDay}`, 'decline', today);
  recordedDay = nextDate(recordedDay);
}
assert.equal(new Set(rejected.learning.days.map(day => day.review.furnishing.feature)).size, FEATURES.length);
assert.equal(dailyCritiquePractice(rejected, 'math'), null, 'All four explicitly declined features stop being proposed.');
const afterRefusal = reviewDay(visitRoom(rejected, today, 'math'), today);
assert.equal(afterRefusal.learning.days.at(-1).review.furnishing, undefined, 'A learning exercise is still available after refusing furniture.');

const failedBook = structuredClone(dailyApproved);
for (let n = 0; n < 12; n++) failedBook.ideas.push({id: `occupied-${n}`, roomId: 'math', title: 'Keep this', text: 'Personal note', cue: 'book'});
const failedBookResult = applyApproved(failedBook, today);
assert.deepEqual(failedBookResult.ideas, failedBook.ideas);
assert.deepEqual(failedBookResult.resident, failedBook.resident, 'An overfull room cannot receive furniture separately from its approved book.');
assert.equal(failedBookResult.learning.days[0].review.decision, 'approve');
assert.equal(dailyFeatureDeclined(failedBookResult, 'math', 'question_board'), false);
const spaceMade = structuredClone(failedBookResult);
spaceMade.ideas = [];
assert.equal(dailyCritiquePractice(spaceMade, 'math').feature, 'question_board');

const refusedMeanwhile = decideProposal(dailyApproved, dailyApproved.resident.proposals[0].id, 'decline', {now: decisionAt});
const refusedResult = applyApproved(refusedMeanwhile, today);
assert.equal(refusedResult.ideas.length, 0);
assert.equal(refusedResult.resident.roomFeatures.length, 0);
assert.match(refusedResult.learning.days[0].review.resolution, /since been declined/);
const installedMeanwhile = decideProposal(dailyApproved, dailyApproved.resident.proposals[0].id, 'approve', {now: decisionAt});
const installedResult = applyApproved(installedMeanwhile, today);
assert.equal(installedResult.ideas.length, 1);
assert.deepEqual(installedResult.resident.roomFeatures, installedMeanwhile.resident.roomFeatures);
assert.match(installedResult.learning.days[0].review.resolution, /already there/);

const occupiedFeatureId = structuredClone(dailyApproved);
occupiedFeatureId.resident.roomFeatures.push({id: `socratic-feature-${yesterday}`, roomId: 'learning', type: 'discussion_circle', installedAt: recordedAt});
const featureCollision = applyApproved(occupiedFeatureId, today);
assert.equal(featureCollision.ideas.length, 0);
assert.deepEqual(featureCollision.resident, occupiedFeatureId.resident);
assert.match(featureCollision.learning.days[0].review.resolution, /identifier/);
const featureCapacity = structuredClone(dailyApproved);
featureCapacity.rooms = Array.from({length: 16}, (_, n) => ({id: `full-room-${n}`, name: 'Preserved room', purpose: 'Keep existing learning furniture.'}));
featureCapacity.resident.roomFeatures = featureCapacity.rooms.flatMap((room, n) => FEATURES.map((type, index) => ({id: `kept-${n}-${index}`, roomId: room.id, type, installedAt: recordedAt})));
assert.equal(dailyCritiquePractice(featureCapacity, 'full-room-0'), null);
// Replace a room while preserving the old raw feature records. Application must
// not grow a full collection or silently delete its removed-room furniture.
featureCapacity.rooms[0] = base().rooms[0];
const capacityResult = applyApproved(featureCapacity, today);
assert.deepEqual(capacityResult.resident.roomFeatures, featureCapacity.resident.roomFeatures);
assert.equal(capacityResult.ideas.length, 0);
assert.match(capacityResult.learning.days[0].review.resolution, /capacity/);

// The optional physical schema and explicit votes are strictly bounded, while
// absence of either field keeps historical records supported.
for (const patch of [
  {feature: 'delete_room'}, {concept: '__proto__'}, {practice: 'x'.repeat(501)},
  {successTest: ''}, {featureId: 'caller-chosen-feature'},
]) {
  const altered = structuredClone(daily.learning);
  Object.assign(altered.days[0].review.furnishing, patch);
  assert.throws(() => validateLearning(altered, daily));
}
const pendingVote = structuredClone(daily.learning);
pendingVote.days[0].review.decision = 'approve';
assert.throws(() => validateLearning(pendingVote, daily), /pending/);
const contradictoryVote = structuredClone(dailyBuilt.learning);
contradictoryVote.days[0].review.decision = 'decline';
assert.throws(() => validateLearning(contradictoryVote, dailyBuilt), /compatible/);
assert.deepEqual(validateLearning(dailyBuilt.learning, dailyBuilt), dailyBuilt.learning);
console.log('Verified Socrates: Prague dates, old book-only snapshots, purpose-aware furniture practices, immutable preparation, next-day owner decisions, independent resident approvals, complete neighbouring editions, refusal memory, later installation conflicts, capacities and strict import bounds.');
