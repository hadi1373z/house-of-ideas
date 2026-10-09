import assert from 'node:assert/strict';
import {initCityTravelUI} from '../web/city-travel-ui.js';
import {initialCityNetwork, validateCityNetwork, packIdea, placeCargo, exportCollection,
  CITY_LIMITS, CITIES} from '../web/city-network.js';
import {BOOKS} from '../web/books.js';
import {starter} from '../web/model.js';

const elements = new Map(), downloads = [], blobs = new Map(), timers = [], revoked = [];
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.value = ''; this.textContent = '';
    this.hidden = false; this.disabled = false; this.dataset = {}; this.attributes = {};
    this.style = {}; this.listeners = new Map(); this.open = false; this.files = [];
  }
  set id(value) { this._id = value; elements.set(value, this); }
  get id() { return this._id; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.get('close')?.(); }
  focus() { this.focused = true; }
  click() { if (this.tagName === 'a') downloads.push(this); return this.onclick?.({preventDefault() {}}); }
}
const $ = id => {
  if (!elements.has(id)) { const element = new Element(); element.id = id; }
  return elements.get(id);
};
const document = {createElement: tag => new Element(tag)};
let remoteCalls = 0;
const window = {URL: {
  createObjectURL(blob) { const id = 'blob:collection-' + (blobs.size + 1); blobs.set(id, blob); return id; },
  revokeObjectURL(id) { revoked.push(id); }
}, setTimeout(callback) { timers.push(callback); return timers.length; },
  open() { remoteCalls++; }, fetch() { remoteCalls++; throw Error('No external service is used.'); }};
const oldHome = starter(), newHome = starter();
oldHome.ideas.push({id: 'old-idea', roomId: 'art', title: 'A preserved drawing question',
  text: 'Which line changes the meaning of this sketch?', cue: 'ring', action: 'question'});
newHome.ideas.push({id: 'new-idea', roomId: 'work', title: 'A kitchen experiment',
  text: 'Predict how a small change improves a daily task.', cue: 'sphere', action: 'experiment'});
const neighborhood = {activeId: 'latest', homes: [
  {id: 'older', title: 'Preserved first home', house: oldHome},
  {id: 'latest', title: 'Current home', house: newHome}
]};
const originals = JSON.stringify(neighborhood);
let house = newHome, selected = 'work', network = initialCityNetwork(), city = 'home', saving = false;
let failSave = false, failVisit = false, saveWait = null, prepareWait = null, planVisible = true, stands = 0;
const operations = [], saved = [], notices = [], discussions = [];
const stagedPlan = {name: 'My unbuilt layout'};
const scene = {cityState: () => CITIES.find(item => item.id === city), stand() { stands++; },
  visitCityLandmark(id) {
    assert.equal(planVisible, false); assert.ok(CITIES.find(item => item.id === city).anchors.some(anchor => anchor.id === id));
    if (failVisit) throw Error('The walking path is blocked.');
    operations.push('visit:' + id); return true;
  },
  travelToCity(id) {
    assert.equal(planVisible, false, 'Planning UI closes before entering another city');
    assert.ok(network.visits[id] > 0, 'The visit persists before scene travel');
    operations.push('travel:' + id); city = id;
  }};
const ui = initCityTravelUI({$, document, window, scene, getNetwork: () => network,
  getHouse: () => house, getNeighborhood: () => neighborhood, getSelected: () => selected,
  isSaving: () => saving, async saveNetwork(candidate) {
    validateCityNetwork(candidate); saved.push(structuredClone(candidate)); operations.push('save');
    if (failSave) throw Error('Collection disk write failed.');
    if (saveWait) await saveWait.promise;
    network = candidate; return network;
  }, async beforeTravel(id) {
    assert.ok(CITIES.some(destination => destination.id === id), 'The destination reaches geometry preparation');
    operations.push('prepare'); if (prepareWait) await prepareWait.promise; planVisible = false;
  }, notify: (...args) => notices.push(args), discuss: data => discussions.push(data)});
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const submit = id => $(id).onsubmit({preventDefault() {}});
const choose = (id, value) => { $(id).value = value; $(id).onchange?.(); };
const file = (name, value) => ({name, size: new TextEncoder().encode(value).byteLength, text: async () => value});

// The chooser presents every real city, reads every source home, and has no network service.
$('city-travel-open').onclick();
assert.equal($('city-travel-dialog').open, true);
assert.equal($('city-travel-destinations').children.length, CITIES.length);
assert.equal($('city-travel-source-home').value, 'latest');
assert.equal($('city-travel-source-home').children.length, 2);
assert.match($('city-travel-location').textContent, /Home neighbourhood/);
assert.deepEqual($('city-travel-anchor').children.map(item => item.value), ['library', 'table', 'plaza']);
assert.equal(remoteCalls, 0);

// A preserved home is a valid copy source; neither it nor the latest edition changes.
choose('city-travel-source-home', 'older');
await $('city-travel-pack-idea').onclick();
assert.equal(network.cargo.length, 1);
assert.equal(network.cargo[0].sourceIdeaId, 'old-idea');
assert.equal(network.cargo[0].action, 'question');
assert.equal(network.cargo[0].sourceHomeTitle, 'Preserved first home');
assert.equal(network.cargo[0].sourceRoomName, 'Bedroom');
assert.equal(network.cargo[0].text, oldHome.ideas[0].text);
assert.equal(JSON.stringify(neighborhood), originals);
choose('city-travel-book', 'practice');
await $('city-travel-pack-book').onclick();
assert.equal(network.cargo.length, 2);
assert.equal(network.cargo[1].type, 'book'); assert.equal(network.cargo[1].bookId, 'practice');
assert.match(network.cargo[1].text, /Keep prediction and observation separate/);
ui.showCargo(network.cargo[1].id);
assert.equal($('city-travel-reader').hidden, false, 'Copied physical books keep their page controls');
$('city-travel-book-next').onclick();
assert.match($('city-travel-book-page').textContent, /Page 2 of 2/);

// Canonical local books have selectable pages and separate per-city answer drafts.
$('city-travel-read-book').onclick();
assert.equal($('city-travel-activity-title').textContent, BOOKS.find(item => item.id === 'practice').title);
assert.match($('city-travel-book-page').textContent, /Page 1 of 2/);
const firstPage = $('city-travel-activity-text').textContent;
$('city-travel-book-next').onclick();
assert.match($('city-travel-book-page').textContent, /Page 2 of 2/);
assert.notEqual($('city-travel-activity-text').textContent, firstPage);
$('city-travel-activity-answer').value = 'A prediction I want to try at home.';
choose('city-travel-book', 'care');
$('city-travel-activity-answer').value = 'One friction in the city.';
choose('city-travel-book', 'practice');
assert.equal($('city-travel-activity-answer').value, 'A prediction I want to try at home.');
const beforeVisitSaves = saved.length; planVisible = true;
await $('city-travel-visit-library').onclick();
assert.equal($('city-travel-dialog').open, false); assert.equal(saved.length, beforeVisitSaves);
assert.deepEqual(operations.slice(-2), ['prepare', 'visit:library']);
ui.showActivity({homeAction: 'read', bookId: 'practice'});
assert.equal($('city-travel-activity-answer').value, 'A prediction I want to try at home.');
failVisit = true; await $('city-travel-visit-plaza').onclick();
assert.equal($('city-travel-dialog').open, true);
assert.match($('city-travel-status').textContent, /walking path is blocked/);
assert.equal($('city-travel-activity-answer').value, 'A prediction I want to try at home.');
failVisit = false;
ui.close(); assert.ok(stands > 0);
ui.showActivity({homeAction: 'read', bookId: 'practice'});
assert.equal($('city-travel-activity-answer').value, 'A prediction I want to try at home.');

// Prepare and persist the visit before changing worlds; layout and note drafts survive.
$('city-travel-journal-answer').value = 'An unsaved home city note.';
prepareWait = deferred(); const artistsTrip = $('city-travel-artists').onclick();
assert.equal(city, 'home'); assert.equal(network.visits.artists, 0);
assert.equal($('city-travel-makers').disabled, true);
prepareWait.resolve(); await artistsTrip; prepareWait = null;
assert.deepEqual(operations.slice(-3), ['prepare', 'save', 'travel:artists']);
assert.equal(city, 'artists'); assert.equal(network.visits.artists, 1);
assert.equal($('city-travel-dialog').open, false);
assert.equal(stagedPlan.name, 'My unbuilt layout');
ui.show(); assert.equal($('city-travel-activity').hidden, true);
assert.equal($('city-travel-journal-answer').value, '');
assert.deepEqual($('city-travel-anchor').children.map(item => item.value), ['library', 'table', 'plaza']);
$('city-travel-journal-answer').value = 'A distinct draft in Artists’ City.';
await $('city-travel-home').onclick(); ui.show();
assert.equal($('city-travel-journal-answer').value, 'An unsaved home city note.');
ui.showActivity({homeAction: 'read', bookId: 'practice'});
assert.equal($('city-travel-activity-answer').value, 'A prediction I want to try at home.');

// Placement adds display copies at validated landmarks; items remain in the travelling bag.
choose('city-travel-cargo', network.cargo[0].id); choose('city-travel-anchor', 'library');
await submit('city-travel-placement-form');
assert.equal(network.placements.length, 1); assert.equal(network.cargo.length, 2);
assert.equal(network.placements[0].cityId, 'home'); assert.equal(network.placements[0].anchorId, 'library');
ui.showCargo(network.placements[0].id);
assert.equal($('city-travel-activity-text').textContent, oldHome.ideas[0].text);
assert.match($('city-travel-activity-question').textContent, /example and a counterexample/);
assert.match($('city-travel-activity-origin').textContent, /Preserved first home · Bedroom/);
$('city-travel-activity-answer').value = 'An example that challenges the copied idea.';
await submit('city-travel-activity-form');
assert.equal(network.notes.length, 1); assert.equal(network.notes[0].cityId, 'home');
assert.match(network.notes[0].text, /^A preserved drawing question · question\nAn example/);
assert.equal($('city-travel-activity-answer').value, '');
assert.equal(JSON.stringify(neighborhood), originals);

// Save failure retains exact activity and city-journal drafts without replacing saved notes.
failSave = true; const notesBeforeFailure = JSON.stringify(network.notes);
$('city-travel-activity-answer').value = 'Keep my failed activity answer.';
await submit('city-travel-activity-form');
assert.equal($('city-travel-activity-answer').value, 'Keep my failed activity answer.');
assert.equal(JSON.stringify(network.notes), notesBeforeFailure);
assert.match($('city-travel-status').textContent, /disk write failed/);
$('city-travel-journal-answer').value = 'Keep my failed city note.';
await submit('city-travel-journal-form');
assert.equal($('city-travel-journal-answer').value, 'Keep my failed city note.');
failSave = false;
// A failed visit save does not move the world or discard the open drafts.
failSave = true;
const visitsBeforeFailure = structuredClone(network.visits), cityBeforeFailure = city;
await ui.travel('makers');
assert.equal(city, cityBeforeFailure);
assert.deepEqual(network.visits, visitsBeforeFailure);
assert.equal($('city-travel-journal-answer').value, 'Keep my failed city note.');
assert.equal($('city-travel-activity-answer').value, 'Keep my failed activity answer.');
failSave = false;

// Saving an older draft cannot erase newer typing or an activity opened during its save.
saveWait = deferred(); $('city-travel-activity-answer').value = 'The submitted answer.';
const answerSave = submit('city-travel-activity-form');
const countDuringSave = saved.length;
await submit('city-travel-journal-form'); assert.equal(saved.length, countDuringSave);
$('city-travel-activity-answer').value = 'A newer answer while saving.';
saveWait.resolve(); await answerSave; saveWait = null;
assert.equal($('city-travel-activity-answer').value, 'A newer answer while saving.');
assert.match(network.notes.at(-1).text, /The submitted answer/);
saveWait = deferred(); $('city-travel-activity-answer').value = 'The original item’s submitted answer.';
const switchedActivitySave = submit('city-travel-activity-form');
ui.showActivity({homeAction: 'experiment'}); $('city-travel-activity-answer').value = 'A different experiment draft.';
saveWait.resolve(); await switchedActivitySave; saveWait = null;
assert.equal($('city-travel-activity-answer').value, 'A different experiment draft.');
ui.showCargo(network.cargo[0].id);
assert.equal($('city-travel-activity-answer').value, 'The original item’s submitted answer.');

// Physical travel during a pending save changes the journal view, not the draft’s destination.
saveWait = deferred(); $('city-travel-journal-answer').value = 'A home note submitted before the gate.';
const oldCitySave = submit('city-travel-journal-form');
city = 'makers'; ui.onNetworkChange(); $('city-travel-journal-answer').value = 'A fresh Makers’ City draft.';
assert.equal($('city-travel-activity').hidden, true);
saveWait.resolve(); await oldCitySave; saveWait = null;
assert.equal(network.notes.at(-1).cityId, 'home');
assert.equal($('city-travel-journal-answer').value, 'A fresh Makers’ City draft.');
assert.deepEqual($('city-travel-anchor').children.map(item => item.value), ['library', 'workshop', 'plaza']);

// Home activities and discussions are explicit, local, and do not mutate archived houses.
ui.showActivity({homeAction: 'tea'});
assert.match($('city-travel-activity-title').textContent, /Tea and conversation/);
$('city-travel-activity-answer').value = 'Attention belongs in a shared place.';
await submit('city-travel-activity-form');
assert.equal(network.notes.at(-1).cityId, 'makers');
assert.match(network.notes.at(-1).text, /^Tea and conversation · reflect/);
assert.equal(discussions.length, 0);
await $('city-travel-discuss').onclick();
assert.equal(discussions.length, 1); assert.equal(discussions[0].cityId, 'makers');
assert.equal(discussions[0].action, 'reflect'); assert.match(discussions[0].question, /daily experience/);
ui.showActivity({homeAction: 'rest'}); $('city-travel-activity-answer').value = 'A rest draft.';
const standsBeforeClose = stands;
$('city-travel-activity-close').onclick();
assert.equal($('city-travel-activity').hidden, true); assert.ok(stands > standsBeforeClose);
ui.showActivity({homeAction: 'rest'}); assert.equal($('city-travel-activity-answer').value, 'A rest draft.');

// Note bounds are enforced before persistence and a busy house save cannot duplicate cargo.
$('city-travel-activity-answer').value = 'x'.repeat(CITY_LIMITS.noteText);
const boundedSaveCount = saved.length; await submit('city-travel-activity-form');
assert.equal(saved.length, boundedSaveCount);
assert.equal($('city-travel-activity-answer').value.length, CITY_LIMITS.noteText);
assert.match($('city-travel-status').textContent, /draft is kept/);
saving = true; ui.render();
const beforeBusy = network.cargo.length; await $('city-travel-pack-book').onclick();
assert.equal(network.cargo.length, beforeBusy); assert.equal($('city-travel-pack-book').disabled, true);
saving = false; ui.render();

// Export is a local, explicit download with copied private notes; no service receives it.
$('city-travel-export').onclick(); assert.equal(downloads.length, 1);
const downloaded = JSON.parse(await blobs.get(downloads[0].href).text());
assert.equal(downloaded.format, 'house-of-ideas-travel-pack');
assert.equal(downloaded.network.notes.length, network.notes.length);
assert.equal(downloaded.network.cargo[0].text, oldHome.ideas[0].text);
assert.equal(downloads[0].download, 'house-of-ideas-travel-collection.json');
timers.forEach(callback => callback()); assert.deepEqual(revoked, [downloads[0].href]);
assert.equal(remoteCalls, 0);

// Defensive imports preserve file drafts on malformed/oversized data and merge identity collisions.
const bad = file('bad.json', '{"format":"unexpected"}'); $('city-travel-import-file').files = [bad];
const beforeBad = JSON.stringify(network); await submit('city-travel-import-form');
assert.equal(JSON.stringify(network), beforeBad); assert.equal($('city-travel-import-file').files[0], bad);
let oversizedRead = false;
$('city-travel-import-file').files = [{size: CITY_LIMITS.travelPackBytes + 1, text() { oversizedRead = true; return '{}'; }}];
await submit('city-travel-import-form'); assert.equal(oversizedRead, false);
assert.equal(JSON.stringify(network), beforeBad);
let incoming = packIdea(initialCityNetwork(), {title: 'Someone else’s cargo', text: 'An independent copied note.', cue: 'crystal'});
incoming = placeCargo(incoming, incoming.cargo[0].id, 'makers', 'workshop');
const validFile = file('portable.json', JSON.stringify(exportCollection(incoming)));
$('city-travel-import-file').files = [validFile]; $('city-travel-import-file').value = 'portable.json';
await submit('city-travel-import-form');
assert.equal(network.cargo.length, 3); assert.equal(network.cargo[0].title, 'A preserved drawing question');
const imported = network.cargo.find(item => item.title === 'Someone else’s cargo');
assert.notEqual(imported.id, network.cargo[0].id);
assert.ok(network.placements.some(item => item.cargoId === imported.id && item.cityId === 'makers'));
assert.equal($('city-travel-import-file').value, '');
assert.equal(JSON.stringify(neighborhood), originals);
assert.ok($('city-travel-notes').children.some(article => article.children.some(child => child.textContent.includes('Tea and conversation'))));
assert.equal(remoteCalls, 0);

// Switching home context during a save cannot erase a newly edited city draft.
ui.showCargo(imported.id); saveWait = deferred(); $('city-travel-activity-answer').value = 'An answer begun in this home.';
const contextSave = submit('city-travel-activity-form');
house = oldHome; selected = 'art'; ui.onHomeChange(); $('city-travel-activity-answer').value = 'A draft after changing homes.';
saveWait.resolve(); await contextSave; saveWait = null;
assert.equal($('city-travel-activity-answer').value, 'A draft after changing homes.');
assert.equal(JSON.stringify(neighborhood), originals);
assert.ok(notices.some(([text]) => text.includes('disk write failed')));
console.log('City travel UI passed: all city destinations, preserved-home copies, books and physical activities, landmark displays, independent journals, concurrent drafts and defensive local collection import/export.');
