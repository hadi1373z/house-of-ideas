import assert from 'node:assert/strict';
import {initArtistResidentUI} from '../web/artist-resident-ui.js';
import {ARTISTS} from '../web/art-city-data.js';
import {artistConversation, converseWithArtist, ARTIST_DIALOGUE_LIMITS} from '../web/artist-dialogue.js';
import {initialCityNetwork, validateCityNetwork, saveCityNote} from '../web/city-network.js';

const elements = new Map();
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.textContent = ''; this.value = '';
    this.hidden = false; this.disabled = false; this.dataset = {}; this.attributes = {};
    this.listeners = new Map(); this.open = false;
    this.style = {setProperty(key, value) { this[key] = value; }};
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
}
const $ = id => {
  if (!elements.has(id)) { const element = new Element(); element.id = id; }
  return elements.get(id);
};
const document = {createElement: tag => new Element(tag), querySelector() { return null; }};
const window = {addEventListener() {}};
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
let cityId = 'artists', gallery = 'monet', near = true, saving = false, loaded = true;
let network = saveCityNote(initialCityNetwork(), 'artists', 'A city journal note made before meeting a resident.');
let failSave = false, waiting = null, reloadFails = false, reloads = 0, clock;
const calls = [], notices = [], saved = [];
const scene = {
  artistResidentState(id) {return {artistId: id, cityId, available: cityId === 'artists', near: cityId === 'artists' && gallery === id && near};},
  playerState() {return {cityId, artistId: gallery};},
  cityState() {return {id: cityId};},
  setArtistTalking(id, talking) {calls.push(['talk', id, talking]);},
  greetArtistResident(id) {calls.push(['greet', id]);}
};
const options = {$, document, window, scene, getNetwork: () => network,
  isLoaded: () => loaded, isSaving: () => saving,
  // An archived personal home still allows city residents to remember their own conversations.
  isReadOnly: () => true,
  async saveNetwork(candidate) {
    validateCityNetwork(candidate); saved.push(structuredClone(candidate));
    if (failSave) throw Error('Revision conflict: another window saved first.');
    if (waiting) await waiting.promise;
    network = candidate;
  },
  async reload() {reloads++; if (reloadFails) return false; return true;},
  notify: (...args) => notices.push(args),
  schedule(fn) {clock = fn; return {unref() {}};}, cancel() {}
};
const ui = initArtistResidentUI(options);
const form = $('artist-resident-form'), input = $('artist-resident-input');
const submit = () => form.onsubmit({preventDefault() {}});
function type(text) {input.value = text; input.oninput();}
function enter(id, closeEnough = true) {cityId = 'artists'; gallery = id; near = closeEnough;}

// Only the actual artist in their own physical house can host a conversation.
assert.equal(ui.show('not-a-resident'), false);
cityId = 'home'; gallery = null;
assert.equal(ui.show('monet'), false);
assert.equal($('artist-resident-dialog').open, false);
assert.equal(calls.length, 0);
enter('klee'); assert.equal(ui.show('monet'), false);
enter('monet'); assert.equal(ui.show('monet'), true);
assert.match($('artist-resident-title').textContent, /Claude Monet/);
assert.match($('artist-resident-subtitle').textContent, /interpretive/i);
assert.equal($('artist-resident-work').children.length, 6);
assert.equal(input.maxLength, ARTIST_DIALOGUE_LIMITS.text);
assert.equal($('artist-resident-send').disabled, false);
assert.equal(artistConversation(network, 'monet').length, 0, 'A welcome does not write a fake conversation');
assert.match($('artist-resident-messages').children[0].textContent, /Water Lilies/);
const unchangedTranscript = $('artist-resident-messages').children;
clock(); assert.equal($('artist-resident-messages').children, unchangedTranscript, 'Presence updates keep scroll position and avoid repeating screen-reader announcements');

// Artist-specific prompts supplement a draft rather than erasing it.
type('My unfinished observation.');
const firstQuestion = $('artist-resident-question-0').textContent;
$('artist-resident-question-0').onclick();
assert.equal(input.value, 'My unfinished observation.\n\n' + firstQuestion);
$('artist-resident-question-0').onclick();
assert.equal(input.value, 'My unfinished observation.\n\n' + firstQuestion);
ui.nextQuestion();
assert.ok(input.value.startsWith('My unfinished observation.'));
type('x'.repeat(ARTIST_DIALOGUE_LIMITS.text));
$('artist-resident-question-0').onclick();
assert.equal(input.value, 'x'.repeat(ARTIST_DIALOGUE_LIMITS.text), 'A suggested question cannot overflow or truncate the existing draft');
assert.match($('artist-resident-status').textContent, /Send or save the current question/);
ui.nextQuestion(); assert.equal(input.value.length, ARTIST_DIALOGUE_LIMITS.text);

// Saving updates only the city network, keeps earlier notes, and attributes a real selected artwork.
const workId = ARTISTS.find(artist => artist.id === 'monet').works[1].id;
$('artist-resident-work').value = workId; $('artist-resident-work').onchange();
type('<img src=x onerror=alert(1)> I notice the changing light.');
const oldNotes = structuredClone(network.notes);
await submit();
assert.equal(input.value, '');
assert.equal(artistConversation(network, 'monet').length, 2);
assert.equal(artistConversation(network, 'monet')[0].workId, workId);
assert.equal(artistConversation(network, 'monet')[0].text, '<img src=x onerror=alert(1)> I notice the changing light.');
assert.deepEqual(network.notes, oldNotes);
assert.equal($('artist-resident-messages').children[0].children[1].textContent,
  '<img src=x onerror=alert(1)> I notice the changing light.');
assert.match($('artist-resident-messages').children[1].children[0].textContent, /CLAUDE MONET · ARTIST RESIDENT/);
assert.match($('artist-resident-status').textContent, /Conversation saved/);

// Closing, native Escape, switching artists and world travel retain distinct drafts.
type('A Monet draft.'); $('artist-resident-dialog').close(); ui.show('monet');
assert.equal(input.value, 'A Monet draft.');
enter('klee'); ui.show('klee'); type('A Klee draft.'); ui.close();
enter('monet'); ui.show('monet'); assert.equal(input.value, 'A Monet draft.');
assert.equal($('artist-resident-work').value, workId);
cityId = 'makers'; gallery = null; clock();
assert.equal($('artist-resident-dialog').open, false);
assert.deepEqual(calls.at(-1), ['talk', 'monet', false]);
enter('klee'); ui.show('klee'); assert.equal(input.value, 'A Klee draft.');
assert.equal(artistConversation(network, 'klee').length, 0);
await submit();
assert.equal(artistConversation(network, 'klee').length, 2);
assert.equal(artistConversation(network, 'monet').length, 2);

// A resident approaching inside their own house can enable chat when physically near.
enter('monet', false); ui.show('monet');
assert.deepEqual(calls.find(call => call[0] === 'greet'), ['greet', 'monet']);
assert.equal($('artist-resident-send').disabled, true);
const beforeFarSubmit = saved.length; await submit(); assert.equal(saved.length, beforeFarSubmit);
near = true; clock(); assert.equal($('artist-resident-send').disabled, false);
assert.deepEqual(calls.at(-1), ['talk', 'monet', true]);
near = false; gallery = null; clock();
assert.equal($('artist-resident-dialog').open, false, 'Leaving the gallery ends the face-to-face conversation');

// A revision conflict never claims a persisted turn, and explicit reload keeps the exact draft.
enter('monet'); ui.show('monet'); type('  Keep this question after a failed save.  ');
const beforeFailure = structuredClone(network); failSave = true; await submit();
assert.deepEqual(network, beforeFailure);
assert.equal(input.value, '  Keep this question after a failed save.  ');
assert.match($('artist-resident-status').textContent, /Revision conflict/);
assert.equal($('artist-resident-reload').hidden, false);
reloadFails = true; await $('artist-resident-reload').onclick();
assert.equal(input.value, '  Keep this question after a failed save.  ');
assert.match($('artist-resident-status').textContent, /could not be reloaded/);
reloadFails = false; failSave = false;
network = converseWithArtist(network, {artistId: 'monet', text: 'Another window saved this question.', workId});
await $('artist-resident-reload').onclick();
assert.equal(reloads, 2); assert.equal($('artist-resident-reload').hidden, true);
assert.equal(input.value, '  Keep this question after a failed save.  ');
await submit();
assert.equal(artistConversation(network, 'monet').length, 6);
assert.equal(artistConversation(network, 'monet').at(-2).text, '  Keep this question after a failed save.  ');
type('\n  A line of looking.\n  Another line of looking.\n'); await submit();
assert.equal(artistConversation(network, 'monet').at(-2).text, '\n  A line of looking.\n  Another line of looking.\n');

// A newer input and a different artist's input survive completion of an earlier save.
waiting = deferred(); type('The submitted thought.'); const pending = submit();
assert.equal($('artist-resident-send').disabled, true);
type('A newer unsaved thought.'); const saveCount = saved.length; await submit(); assert.equal(saved.length, saveCount);
waiting.resolve(); await pending; waiting = null;
assert.equal(input.value, 'A newer unsaved thought.');
assert.equal(artistConversation(network, 'monet').at(-2).text, 'The submitted thought.');
waiting = deferred(); type('One more submitted Monet thought.'); const switchSave = submit();
enter('klee'); ui.show('klee'); type('A Klee thought during Monet’s save.');
waiting.resolve(); await switchSave; waiting = null;
assert.equal(input.value, 'A Klee thought during Monet’s save.');
enter('monet'); ui.show('monet'); assert.equal(input.value, '');
enter('klee'); ui.show('klee'); assert.equal(input.value, 'A Klee thought during Monet’s save.');

// A reloaded UI displays each saved artist history independently; global saves/loading still guard writes.
ui.close(); const restoredUI = initArtistResidentUI(options); restoredUI.show('klee');
assert.equal($('artist-resident-messages').children.length, 2);
loaded = false; restoredUI.render(); assert.equal($('artist-resident-send').disabled, true);
loaded = true; saving = true; restoredUI.render(); assert.equal($('artist-resident-send').disabled, true);
saving = false; restoredUI.render(); assert.equal($('artist-resident-send').disabled, false);
const beforeTenResidents = structuredClone(network);
for (const artist of ARTISTS) {
  enter(artist.id); restoredUI.show(artist.id);
  assert.equal($('artist-resident-title').textContent, 'Conversation with ' + artist.name);
  assert.equal($('artist-resident-work').children.length, artist.works.length);
  assert.equal($('artist-resident-work').value, artist.works[0].id);
  assert.equal($('artist-resident-send').disabled, false);
}
assert.deepEqual(network, beforeTenResidents, 'Visiting all ten residents leaves saved data unchanged');
// Older retained turns are accessible on demand without repeating them during presence updates.
for (let index = 0; index < 12; index++) network = converseWithArtist(network, {
  artistId: 'monet', text: 'A later observation ' + index + '.', workId
});
enter('monet'); restoredUI.show('monet');
assert.equal($('artist-resident-messages').children.length, 24);
assert.equal($('artist-resident-earlier').hidden, false);
const earliest = artistConversation(network, 'monet')[0].text;
const transcriptTexts = () => $('artist-resident-messages').children.map(turn => turn.children[1].textContent);
assert.equal(transcriptTexts().includes(earliest), false);
$('artist-resident-messages').scrollTop = 33;
$('artist-resident-earlier').onclick();
assert.equal($('artist-resident-messages').children.length, artistConversation(network, 'monet').length);
assert.equal(transcriptTexts().includes(earliest), true);
assert.equal($('artist-resident-earlier').hidden, true);
const fullTranscript = $('artist-resident-messages').children;
clock(); assert.equal($('artist-resident-messages').children, fullTranscript);
assert.equal($('artist-resident-messages').scrollTop, 33);
enter('klee'); restoredUI.show('klee'); enter('monet'); restoredUI.show('monet');
assert.equal($('artist-resident-messages').children.length, 24, 'Switching residents restores the compact initial view');
assert.equal($('artist-resident-earlier').hidden, false);
assert.ok(notices.some(([text]) => text.includes('Revision conflict')));

// Online personas require an explicit connected provider and an explicit send.
let config = {local: true, chatgptConnected: false, chatgptModel: 'plan-model', apiReady: false, apiModel: 'api-model'};
let onlineWait = null, onlineError = null, suggestion = null, rejectStage = false, settings = 0;
const onlineRequests = [], stages = [], reviews = [];
const aiUI = initArtistResidentUI({...options, getAIConfig: () => config,
  async requestAIReply(request) {
    onlineRequests.push(structuredClone(request));
    if (onlineWait) await onlineWait.promise;
    if (onlineError) throw Error(onlineError);
    return {reply: 'An actual generated reply to ' + request.message, suggestion};
  },
  openAISettings() {assert.equal($('artist-resident-dialog').open, false); settings++;},
  stageSuggestion(candidate, proposed, context) {
    if (rejectStage) throw Error('House idea could not be staged.');
    stages.push({suggestion: structuredClone(proposed), context: structuredClone(context)});
    return saveCityNote(candidate, 'artists', 'Pending review: ' + proposed.title);
  },
  onReviewHouse(context) {assert.equal($('artist-resident-dialog').open, false); reviews.push(context);}
});
enter('monet'); aiUI.show('monet', workId);
const onlineInput = $('artist-resident-input'), onlineForm = $('artist-resident-form');
const onlineType = text => {onlineInput.value = text; onlineInput.oninput();};
const onlineSubmit = () => onlineForm.onsubmit({preventDefault() {}});
const selectMode = value => {$('artist-resident-mode').value = value; $('artist-resident-mode').onchange();};
assert.equal($('artist-resident-mode').value, 'offline');
assert.equal($('artist-resident-mode').children[1].disabled, true);
assert.equal(onlineRequests.length, 0);
onlineType('A draft kept during sign-in.'); $('artist-resident-connect').onclick();
assert.equal(settings, 1); assert.equal(onlineRequests.length, 0);
config.chatgptConnected = true; aiUI.show('monet', workId);
assert.equal(onlineInput.value, 'A draft kept during sign-in.');
assert.equal($('artist-resident-mode').children[1].disabled, false);
selectMode('chatgpt');
assert.equal(onlineRequests.length, 0, 'Choosing a provider never sends a message');
assert.match($('artist-resident-ai-status').textContent, /ChatGPT connected · plan-model/);
assert.match($('artist-resident-ai-privacy').textContent, /persona, recent conversation, selected artwork and gallery editions/);
assert.match($('artist-resident-ai-procedure').textContent, /Sign in → choose a model/);

// A generated reply is appended to the latest state, while a newer draft stays unsent.
onlineWait = deferred(); onlineType('  My explicit online question.\n');
const beforeOnlineSave = saved.length, beforeOnlineTurns = artistConversation(network, 'monet').length;
const generated = onlineSubmit();
assert.equal(onlineRequests.length, 1); assert.equal(saved.length, beforeOnlineSave);
assert.equal(artistConversation(network, 'monet').length, beforeOnlineTurns);
assert.deepEqual(onlineRequests[0], {artistId: 'monet', message: '  My explicit online question.\n', workId, provider: 'chatgpt'});
onlineType('A newer online draft.');
network = saveCityNote(network, 'makers', 'A separate note saved during generation.');
onlineWait.resolve(); await generated; onlineWait = null;
assert.equal(saved.length, beforeOnlineSave + 1);
assert.equal(artistConversation(network, 'monet').at(-2).text, '  My explicit online question.\n');
assert.equal(artistConversation(network, 'monet').at(-1).text, 'An actual generated reply to   My explicit online question.\n');
assert.ok(network.notes.some(note => note.text === 'A separate note saved during generation.'));
assert.equal(onlineInput.value, 'A newer online draft.');
assert.match($('artist-resident-status').textContent, /ChatGPT · plan-model/);
assert.match($('artist-resident-messages').children.at(-1).children[0].textContent, /ARTIST RESIDENT/);

// A house idea is staged together with its conversation, then opened for review only on request.
suggestion = {title: 'A window study', reason: 'Compare changing light.', exercise: 'Observe twice.', feature: 'window-study', atmosphere: 'quiet'};
onlineType('Help improve this gallery.'); const beforeIdeaSave = saved.length; await onlineSubmit();
assert.equal(saved.length, beforeIdeaSave + 1); assert.equal(stages.length, 1);
assert.deepEqual(stages[0].context, {artistId: 'monet', message: 'Help improve this gallery.', workId});
assert.equal(reviews.length, 0); assert.ok(network.notes.some(note => note.text === 'Pending review: A window study'));
onlineType('Keep this while reviewing.'); $('artist-resident-review').onclick();
assert.deepEqual(reviews[0], {artistId: 'monet', workId});
aiUI.show('monet', workId); assert.equal(onlineInput.value, 'Keep this while reviewing.');

// Online or review-staging errors preserve the question and never produce a fallback reply.
rejectStage = true; const beforeRejectedIdea = structuredClone(network), beforeRejectedSave = saved.length;
await onlineSubmit(); assert.deepEqual(network, beforeRejectedIdea); assert.equal(saved.length, beforeRejectedSave);
assert.equal(onlineInput.value, 'Keep this while reviewing.');
assert.match($('artist-resident-status').textContent, /could not be staged/);
rejectStage = false; suggestion = null; onlineError = 'Sign-in expired.';
const beforeOnlineFailure = structuredClone(network), beforeFailedSave = saved.length;
await onlineSubmit(); assert.deepEqual(network, beforeOnlineFailure); assert.equal(saved.length, beforeFailedSave);
assert.equal(onlineInput.value, 'Keep this while reviewing.');
assert.equal($('artist-resident-mode').value, 'chatgpt');
assert.match($('artist-resident-status').textContent, /Sign-in expired/);
onlineError = null; config.chatgptConnected = false; aiUI.render();
assert.equal($('artist-resident-send').disabled, true);
const requestCount = onlineRequests.length; await onlineSubmit(); assert.equal(onlineRequests.length, requestCount);
assert.equal($('artist-resident-mode').value, 'chatgpt', 'A lost connection does not silently choose Offline');

// A switched artist keeps its own draft while the captured artist receives the generated pair.
config.apiReady = true; selectMode('api'); onlineType('A Monet API question.'); onlineWait = deferred();
const apiGeneration = onlineSubmit();
enter('klee'); aiUI.show('klee'); onlineType('A Klee draft during Monet’s AI reply.');
onlineWait.resolve(); await apiGeneration; onlineWait = null;
assert.equal($('artist-resident-title').textContent, 'Conversation with Paul Klee');
assert.equal(onlineInput.value, 'A Klee draft during Monet’s AI reply.');
assert.equal(artistConversation(network, 'monet').at(-2).text, 'A Monet API question.');
assert.equal(onlineRequests.at(-1).provider, 'api');
near = false; await onlineSubmit(); assert.equal(onlineRequests.at(-1).artistId, 'monet');
near = true; loaded = false; await onlineSubmit(); assert.equal(onlineRequests.at(-1).artistId, 'monet');
loaded = true; saving = true; await onlineSubmit(); assert.equal(onlineRequests.at(-1).artistId, 'monet');
saving = false; selectMode('offline'); await onlineSubmit();
assert.equal(artistConversation(network, 'klee').at(-2).text, 'A Klee draft during Monet’s AI reply.');
assert.equal(onlineRequests.at(-1).artistId, 'monet', 'The offline guide makes no network request');
console.log('Artist resident UI checks passed: physical hosts, retained histories/drafts, explicit AI providers, latest-state saves, staged review and no silent fallback.');
