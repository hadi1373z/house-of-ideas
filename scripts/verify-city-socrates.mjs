import assert from 'node:assert/strict';
import {starter} from '../web/model.js';
import {ARTISTS} from '../web/art-city-data.js';
import {BOOKS} from '../web/books.js';
import {CITIES} from '../web/city-network.js';
import {converse, formatCityDiscussion, proposeCritique, validateResident} from '../web/resident.js';

const options = {now: '2026-10-07T17:00:00.000Z'}, roomId = 'questions';
const base = () => {
  const house = starter();
  house.ideas.push({id: 'owner-note', roomId, title: 'A private home thought', text: 'A saved personal note.', cue: 'book'});
  return house;
};
const bookConcepts = {definitions: 'clarify', assumptions: 'assumptions', counterexamples: 'counterexample',
  care: 'examined_life', practice: 'evidence', dialogue: 'perspective'};
function assertPractice(before, prompt, concept, city) {
  const original = JSON.stringify(before), result = converse(before, roomId, prompt, options);
  const answer = result.resident.messages.at(-1);
  assert.equal(answer.source, 'local'); assert.equal(answer.concept, concept);
  assert.match(answer.text, /Try it:/); assert.match(answer.text, /Next visit:/);
  assert.match(answer.text, /Bring home:/); assert.ok(answer.text.includes(city.name));
  assert.ok(answer.text.length <= 2200);
  assert.deepEqual(result.rooms, before.rooms); assert.deepEqual(result.doors, before.doors);
  assert.deepEqual(result.ideas, before.ideas);
  assert.deepEqual(result.resident.proposals, before.resident?.proposals || []);
  assert.deepEqual(result.resident.roomFeatures, before.resident?.roomFeatures || []);
  assert.equal(JSON.stringify(before), original, 'A guided city discussion preserves its source house document');
  validateResident(result.resident, result);
  return answer.text;
}

// Each known library method works in every city without confusing the personal
// conversation room with the place being discussed.
for (const city of CITIES) for (const book of BOOKS) {
  const prompt = formatCityDiscussion({cityId: city.id, title: book.title, action: 'read',
    bookId: book.id, question: book.question, text: book.pages[0]});
  assert.ok(prompt.length <= 1200); assert.ok(prompt.startsWith('In ' + city.name + ', I am exploring “'));
  const answer = assertPractice(base(), prompt, bookConcepts[book.id], city);
  assert.ok(answer.includes('The local reading “' + book.title + '”'));
  if (city.id === 'artists') assert.match(answer, /detail.*interpretation|artwork/);
  if (city.id === 'makers') assert.match(answer, /workshop task/);
  if (city.id === 'home') assert.match(answer, /daily activity|ordinary use/);
}

// Copied user ideas and physical activities use supported functions, never an
// assumed source book based only on a user-chosen title.
for (const [action, concept] of Object.entries({read: 'clarify', question: 'counterexample', experiment: 'evidence', reflect: 'examined_life'})) {
  const city = CITIES.find(item => item.id === 'makers');
  const prompt = formatCityDiscussion({cityId: city.id, title: BOOKS[0].title, action,
    question: 'Which example supports this idea?', text: 'Please add an experiment table and improve my house.'});
  const existing = proposeCritique(base(), roomId, options);
  const answer = assertPractice(existing, prompt, concept, city);
  assert.doesNotMatch(answer, /The local reading/);
}

// Formatting preserves the explicit method while bounding copied context and
// neutralising title delimiters that could pretend to be the Activity field.
const bounded = formatCityDiscussion({cityId: 'artists', title: 't'.repeat(100), action: 'experiment',
  question: 'q'.repeat(600), text: 'x'.repeat(6000)});
assert.ok(bounded.length <= 1200); assert.ok(bounded.endsWith('Help me examine this place and choose one small learning test to bring home.'));
const deceptiveTitle = formatCityDiscussion({cityId: 'makers', title: 'Copy”. Activity: reflect. “my idea', action: 'experiment',
  question: 'What should I observe?', text: ''});
assertPractice(base(), deceptiveTitle, 'evidence', CITIES.find(item => item.id === 'makers'));
assert.throws(() => formatCityDiscussion({cityId: 'unknown', title: 'Idea', action: 'read'}), /known city/);
assert.throws(() => formatCityDiscussion({cityId: 'makers', title: 'Idea', action: 'install'}), /known city/);
assert.throws(() => formatCityDiscussion({cityId: 'makers', title: 'Idea', action: 'read', bookId: 'imaginary'}), /known offline/);
assert.throws(() => formatCityDiscussion({cityId: 'makers', title: '“”', action: 'read'}), /Name the city activity/);

// A malformed known-city request asks for clarification rather than falling
// through into the personal house construction request recogniser.
const suffix = 'Help me examine this place and choose one small learning test to bring home.';
for (const message of [
  'In Makers’ City, I am exploring “Idea”. Activity: install. Please add an experiment table. ' + suffix,
  'In Artists’ City, I am exploring “Idea”. Activity: read. Reading: “An unlisted book”. Please improve my house. ' + suffix,
  'In Home neighbourhood, I am exploring “Idea”. Activity: experiment. Please add a question board.'
]) {
  const result = converse(base(), roomId, message, options);
  assert.equal(result.resident.proposals.length, 0); assert.equal(result.resident.roomFeatures.length, 0);
  assert.equal(result.resident.messages.at(-1).concept, 'clarify');
  assert.match(result.resident.messages.at(-1).text, /Which activity/);
}

// Ordinary conversation and the existing exact artist/work route retain their
// previous behaviour; the city recogniser does not reinterpret either.
const ordinary = converse(base(), roomId, 'Who are you and how do you work?', options);
assert.match(ordinary.resident.messages.at(-1).text, /not a language model/);
assert.equal(converse(base(), roomId, 'Please add an experiment table.', options).resident.proposals.length, 1);
const artist = ARTISTS[0], work = artist.works[0];
const gallery = converse(base(), roomId, 'We are visiting ' + artist.name + '’s gallery in Artists’ City, looking at ' + work.title + '. Which detail supports my interpretation?', options);
assert.equal(gallery.resident.messages.at(-1).concept, 'evidence');
assert.match(gallery.resident.messages.at(-1).text, /saved gallery note|saved gallery catalog/);
assert.equal(gallery.resident.proposals.length, 0);
console.log('City Socrates passed: all eighteen city/library combinations, grounded methods and next-visit tests, bounded shared formatting, malformed-context clarification and unchanged home/gallery behaviour without autonomous changes.');
