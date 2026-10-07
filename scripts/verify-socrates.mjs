import assert from 'node:assert/strict';
import {
  pragueDate, nextDate, previousDate, validateLearning, visitRoom, reflect,
  lesson, critique, reviewDay, pendingReview, decideReview, applyApproved,
} from '../web/socrates.js';

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
console.log('Verified Socrates: Prague dates, old documents, opt-in, real recorded activity, immutable reviews, next-entry decisions, approval-only growth, rejection, recurrence, deleted/renamed rooms, capacities and import bounds.');
