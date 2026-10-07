import assert from 'node:assert/strict';
import {initArtCityUI} from '../web/art-city-ui.js';
import {starter, validateHouse} from '../web/model.js';
import {pragueDate, reflect} from '../web/socrates.js';

const elements = new Map(), imageLoads = [];
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.textContent = ''; this.value = '';
    this.hidden = false; this.disabled = false; this.dataset = {}; this.attributes = {};
    this.listeners = new Map(); this.open = false;
  }
  set id(value) { this._id = value; elements.set(value, this); }
  get id() { return this._id; }
  set src(value) { this._src = value; imageLoads.push(value); }
  get src() { return this._src || ''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'src') this._src = ''; if (key === 'href') this.href = ''; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.get('close')?.(); }
}
const $ = id => {
  if (!elements.has(id)) { const element = new Element(); element.id = id; }
  return elements.get(id);
};
const document = {createElement: tag => new Element(tag)};
let automaticallyOpened = 0;
const window = {location: {href: 'http://127.0.0.1:4175/'}, open() { automaticallyOpened++; }};
const artists = Array.from({length: 10}, (_, index) => ({
  id: 'artist-' + index, name: 'Artist ' + index, color: '#654321',
  description: 'A house for artist ' + index, approach: 'Study the relationship between shapes and light.',
  websiteUrl: 'https://artist.example/' + index,
  works: ['a', 'b'].map(id => ({id: 'work-' + id, title: 'Work ' + id.toUpperCase(), date: '2024',
    medium: 'Oil on canvas', imageUrl: './art-city/artworks/artist-' + index + '-' + id + '.webp',
    alt: 'The actual source description for ' + id, description: 'A source description of the artwork.',
    sourceUrl: 'https://museum.example/' + index + '/' + id, rights: 'Source rights statement.',
    rightsUrl: 'https://images.example/license/' + index + '/' + id}))
}));
artists[1].works[0].imageUrl = 'https://museum.example/remote.jpg';
artists[2].websiteUrl = 'javascript:alert(1)';
artists[2].works[0].sourceUrl = 'javascript:alert(2)';
artists[2].works[0].rightsUrl = 'javascript:alert(3)';
artists[2].works[0].imageUrl = 'data:text/html,unsafe';
let house = starter(), selected = 'questions', readOnly = false, saving = false;
let failSave = false, saveWait = null;
const sceneCalls = [], saved = [], questions = [], notices = [];
const scene = {
  enterArtCity() { sceneCalls.push(['enter']); },
  leaveArtCity() { sceneCalls.push(['leave']); },
  enterArtistHouse(id) { sceneCalls.push(['visit', id]); }
};
const ui = initArtCityUI({$, document, window, scene, artists,
  getHouse: () => house, getSelected: () => selected, isReadOnly: () => readOnly,
  isSaving: () => saving, async saveHouse(candidate) {
    validateHouse(candidate); saved.push(structuredClone(candidate));
    if (failSave) throw Error('The local disk could not be written.');
    if (saveWait) await saveWait.promise;
    house = candidate;
  },
  async examineArtist(...args) { questions.push(args); },
  notify: (...args) => notices.push(args)
});
const submit = () => $('art-city-reflection-form').onsubmit({preventDefault() {}});
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const roomAnswer = () => house.learning?.days?.find(day => day.date === pragueDate())?.reflections?.find(item => item.roomId === selected)?.answer;

// Every catalog house is reachable, including while personal editions are preserved.
assert.equal($('art-city-list').children.length, 10);
assert.equal($('art-city-return').hidden, true);
assert.equal($('art-city-open').textContent, 'Artists’ City · 10 houses');
assert.equal(imageLoads.length, 0);
await $('art-city-open').onclick();
assert.deepEqual(sceneCalls.at(-1), ['enter']);
assert.equal($('art-city-dialog').open, false, 'The first visit enters the physical city without a modal');
assert.equal($('art-city-open').textContent, 'City guide · 10 houses');
await $('art-city-open').onclick();
assert.equal($('art-city-dialog').open, true, 'The city guide opens only when explicitly requested from inside');
assert.equal(sceneCalls.filter(([action]) => action === 'enter').length, 1);
assert.equal($('art-city-overview').hidden, false);
assert.equal($('art-city-return').hidden, false);
for (const artist of artists) {
  await $('art-city-visit-' + artist.id).onclick();
  assert.deepEqual(sceneCalls.at(-1), ['visit', artist.id]);
  assert.equal($('art-city-dialog').open, false);
}
ui.showArtist('artist-0', 'work-b');
assert.equal($('art-city-title').textContent, 'Artist 0’s house');
assert.equal($('art-city-work').value, 'work-b');
assert.equal($('art-city-image').src, 'http://127.0.0.1:4175/art-city/artworks/artist-0-b.webp');
assert.equal($('art-city-image').alt, artists[0].works[1].alt);
assert.match($('art-city-caption').textContent, /Work B · 2024 · Oil on canvas/);
assert.match($('art-city-question').textContent, /relationship between shapes and light/);
assert.equal($('art-city-rights').textContent, 'Source rights statement.');
assert.equal($('art-city-image-credit').href, 'https://images.example/license/0/b');
assert.equal($('art-city-image-credit').target, '_blank');
assert.equal($('art-city-image-credit').rel, 'noopener');
assert.equal($('art-city-local-website').href, './artists-websites.html#artist-0');
assert.equal($('art-city-original-website').rel, 'noopener');
assert.equal($('art-city-original-website').target, '_blank');
assert.equal(automaticallyOpened, 0);

// Work navigation, native close, and reopening retain each separate unsaved draft.
$('art-city-answer').value = 'My observation of B.';
$('art-city-next').onclick();
assert.equal($('art-city-work').value, 'work-a');
$('art-city-answer').value = 'My experiment with A.';
$('art-city-previous').onclick();
assert.equal($('art-city-answer').value, 'My observation of B.');
$('art-city-work').value = 'work-a'; $('art-city-work').onchange();
assert.equal($('art-city-answer').value, 'My experiment with A.');
$('art-city-dialog').close(); ui.showArtist('artist-0', 'work-a');
assert.equal($('art-city-answer').value, 'My experiment with A.');

// Source images never contact an external service until the owner explicitly loads one.
const beforeRemote = imageLoads.length;
ui.showArtist('artist-1', 'work-a');
assert.equal(imageLoads.length, beforeRemote);
assert.equal($('art-city-image').hidden, true);
assert.equal($('art-city-load-image').hidden, false);
$('art-city-load-image').onclick();
assert.equal(imageLoads.at(-1), 'https://museum.example/remote.jpg');
ui.showArtist('artist-2', 'work-a');
assert.equal($('art-city-original-website').hidden, true);
assert.equal($('art-city-work-source').hidden, true);
assert.equal($('art-city-image-credit').hidden, true);
assert.equal($('art-city-image').src, '');
assert.equal($('art-city-load-image').hidden, true);
assert.equal(automaticallyOpened, 0);

// Read-only homes protect the journal without blocking artist houses and works.
readOnly = true; ui.render();
assert.equal($('art-city-save').disabled, true);
$('art-city-answer').value = 'A preserved-home draft.';
const beforeReadOnly = saved.length;
await submit(); assert.equal(saved.length, beforeReadOnly);
assert.match($('art-city-status').textContent, /earlier home is preserved/);
await $('art-city-visit-artist-8').onclick();
assert.deepEqual(sceneCalls.at(-1), ['visit', 'artist-8']);
readOnly = false; ui.showArtist('artist-0', 'work-a');

// Append attributed answers to the real learning journal and preserve earlier notes.
house = reflect(house, pragueDate(), selected, 'An earlier thought in this room.');
$('art-city-answer').value = 'The contrast helps me see an unexpected shape.';
await submit();
assert.match(roomAnswer(), /^An earlier thought in this room\./);
assert.match(roomAnswer(), /Artist City · Artist 0 · Work A\nThe contrast/);
assert.equal($('art-city-answer').value, '');
assert.match($('art-city-status').textContent, /Living room learning journal/);

// Failed saves and a full journal keep the exact draft; no existing answer is erased.
failSave = true; $('art-city-answer').value = 'Keep this after a disk failure.';
const beforeFailure = roomAnswer(); await submit();
assert.equal(roomAnswer(), beforeFailure);
assert.equal($('art-city-answer').value, 'Keep this after a disk failure.');
assert.match($('art-city-status').textContent, /disk could not be written/);
failSave = false;
house = reflect(house, pragueDate(), selected, 'x'.repeat(1190));
const saveCount = saved.length;
await submit(); assert.equal(saved.length, saveCount);
assert.equal(roomAnswer().length, 1190);
assert.equal($('art-city-answer').value, 'Keep this after a disk failure.');
assert.match($('art-city-status').textContent, /entry in Living room is full/);

// A concurrent edit survives successful persistence of the text originally submitted.
house = starter(); saveWait = deferred();
$('art-city-answer').value = 'The submitted observation.';
const inFlight = submit();
assert.equal($('art-city-save').disabled, true);
$('art-city-answer').value = 'A newer unsaved observation.';
const submissions = saved.length; await submit(); assert.equal(saved.length, submissions);
saveWait.resolve(); await inFlight; saveWait = null;
assert.match(roomAnswer(), /The submitted observation/);
assert.equal($('art-city-answer').value, 'A newer unsaved observation.');

// Switching artwork or home during a save cannot clear a different visible draft.
house = starter(); saveWait = deferred();
$('art-city-answer').value = 'Work A saved in the first home.';
const artworkSave = submit();
$('art-city-next').onclick(); $('art-city-answer').value = 'Work B still being drafted.';
saveWait.resolve(); await artworkSave; saveWait = null;
assert.equal($('art-city-answer').value, 'Work B still being drafted.');
$('art-city-previous').onclick();
assert.equal($('art-city-answer').value, 'Work A saved in the first home.');
saveWait = deferred(); $('art-city-answer').value = 'Do not erase this when I change homes.';
const oldHomeSave = submit();
ui.onHomeChange(); house = starter(); ui.showArtist('artist-0', 'work-a');
$('art-city-answer').value = 'A draft in the new home.';
saveWait.resolve(); await oldHomeSave; saveWait = null;
assert.equal($('art-city-answer').value, 'A draft in the new home.');

// The philosopher receives only an explicit selected-work request; opening makes none.
assert.equal(questions.length, 0);
await $('art-city-examine').onclick();
assert.equal(questions.length, 1);
assert.equal(questions[0][0].id, 'artist-0');
assert.equal(questions[0][1].id, 'work-a');
assert.match(questions[0][2], /Which detail/);
ui.showArtist('artist-0', 'work-a');
assert.equal($('art-city-answer').value, 'A draft in the new home.');
await $('art-city-return').onclick();
assert.deepEqual(sceneCalls.at(-1), ['leave']);
assert.equal($('art-city-return').hidden, true);
assert.equal($('art-city-dialog').open, false);
assert.equal(automaticallyOpened, 0);
// Physical gates and home controls can change the scene without clicking this panel.
let physicalCityState = true;
scene.playerState = () => ({artistCity: physicalCityState});
ui.render(); assert.equal($('art-city-return').hidden, false);
assert.equal($('art-city-open').textContent, 'City guide · 10 houses');
physicalCityState = false;
ui.render(); assert.equal($('art-city-return').hidden, true);
assert.equal($('art-city-open').textContent, 'Artists’ City · 10 houses');
assert.ok(notices.some(([text]) => text.includes('disk could not be written')));
console.log('Artist City UI checks passed: ten houses, attributed journal observations, preserved drafts, offline sources and explicit Socrates discussion.');
