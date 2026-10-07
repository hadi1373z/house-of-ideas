import {BOOKS} from './books.js';
import {CITIES, CITY_LIMITS, packIdea, packBook, placeCargo, saveCityNote, recordCityVisit,
  exportCollection, importCollection} from './city-network.js';

const NOTE_LIMIT = CITY_LIMITS.noteText, IMPORT_BYTES = CITY_LIMITS.travelPackBytes;
const prompts = {
  read: 'Read this copied note. Which sentence would you question, and why?',
  question: 'What do you mean by this idea? Give an example and a counterexample.',
  experiment: 'Make a prediction, choose a small test, and record what you observe.',
  reflect: 'How does this idea change your daily experience here?'
};

export function initCityTravelUI({$, document, window, scene, getNetwork, getHouse,
  getNeighborhood, getSelected, isSaving, saveNetwork, beforeTravel, notify, discuss, reload}) {
  const dialog = $('city-travel-dialog'), nodes = {}, activityDrafts = new Map(), journalDrafts = new Map();
  let pending = false, reloadNeeded = false, activity = null, version = 0, context = 0, journalCity = null, shownNotes = 12, bookPage = 0;

  function node(tag, id, text) {
    const element = document.createElement(tag);
    if (id) { element.id = id; nodes[id] = element; }
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(id, text, handler) {
    const element = node('button', id, text); element.type = 'button'; element.onclick = handler; return element;
  }
  function label(text, input) {
    const element = node('label'); element.append(node('span', null, text), input); return element;
  }
  function select(id) { return node('select', id); }
  function fillSelect(element, entries, preferred = element.value) {
    element.replaceChildren(...entries.map(([value, text]) => {
      const option = node('option', null, text); option.value = value; return option;
    }));
    element.value = entries.some(([value]) => value === preferred) ? preferred : entries[0]?.[0] || '';
  }
  function message(text, error = false) {
    status.textContent = text; status.dataset.error = String(error); if (error) notify?.(text, true);
  }
  function cityId() {
    const id = scene?.cityState?.()?.id;
    return CITIES.some(city => city.id === id) ? id : 'home';
  }
  const currentCity = () => CITIES.find(city => city.id === cityId()) || CITIES[0];
  function remember() {
    if (activity) activityDrafts.set(activity.key, activityAnswer.value);
    if (journalCity) journalDrafts.set(journalCity, journalAnswer.value);
  }
  function close() { remember(); scene?.stand?.(); dialog.close(); document.querySelector?.('#scene canvas')?.focus?.(); }
  function show() { render(); if (!dialog.open) dialog.showModal(); }
  function writable() {
    if (pending || isSaving()) throw Error('Wait for the current save to finish.');
    if (!getNetwork()) throw Error('The travel collection is still opening.');
  }
  async function work(callback) {
    try { writable(); } catch (error) { message(error.message, true); return; }
    pending = true; render();
    try { await callback(); reloadNeeded = false; }
    catch (error) { reloadNeeded = true; message(error.message, true); }
    finally { pending = false; render(); }
  }
  async function reloadSavedState() {
    if (pending || typeof reload !== 'function') return;
    remember(); pending = true; render();
    try {
      if (await reload() === false) throw Error('Could not reload saved city state. Your drafts are kept.');
      remember(); reloadNeeded = false;
      message('Saved city state reloaded. Your drafts are kept. Retry the action when you are ready.');
    } catch (error) { reloadNeeded = true; message(error.message, true); }
    finally { pending = false; render(); }
  }
  function sourceHomes() {
    const neighborhood = getNeighborhood?.();
    if (neighborhood?.homes?.length) return neighborhood.homes.filter(home => home.house);
    const house = getHouse?.(); return house ? [{id: 'current', title: 'Current home', house}] : [];
  }
  function sourceHome() { return sourceHomes().find(home => home.id === homeSelect.value); }
  function sourceRoom(home, roomId) { return home?.house.rooms.find(room => room.id === roomId)?.name || 'Home'; }
  const book = id => BOOKS.find(item => item.id === id) || BOOKS[0];

  const head = node('div'); head.className = 'dialog-head';
  head.append(node('h2', 'city-travel-title', 'Travel & collection'), button('city-travel-close', 'Close', close));
  const location = node('p', 'city-travel-location'), status = node('p', 'city-travel-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const reloadButton = button('city-travel-reload', 'Reload saved city state', reloadSavedState);
  reloadButton.hidden = true;
  const destinations = node('div', 'city-travel-destinations'); destinations.className = 'city-travel-actions';
  const destinationButtons = new Map();
  for (const city of CITIES) {
    const destination = button('city-travel-' + city.id, 'Travel to ' + city.name, () => travel(city.id));
    destinationButtons.set(city.id, destination); destinations.append(destination);
  }
  const landmarks = node('div', 'city-travel-landmarks'); landmarks.className = 'city-travel-actions';

  const packing = node('section', 'city-travel-packing');
  packing.append(node('h3', null, 'Carry a book or idea'), node('p', null,
    'Your collection travels with you. Copying keeps the original in its home, including preserved editions. Placing an item makes another display copy and keeps it in your collection.'));
  const homeSelect = select('city-travel-source-home'), ideaSelect = select('city-travel-source-idea');
  const ideaPack = button('city-travel-pack-idea', 'Copy this idea to my collection', copyIdea);
  packing.append(label('Source home', homeSelect), label('Idea to carry', ideaSelect), ideaPack);
  const bookSelect = select('city-travel-book');
  fillSelect(bookSelect, BOOKS.map(item => [item.id, item.title]));
  const bookActions = node('div'); bookActions.className = 'city-travel-actions';
  const bookRead = button('city-travel-read-book', 'Read this book here', () => showActivity({homeAction: 'read', bookId: bookSelect.value}));
  const bookPack = button('city-travel-pack-book', 'Copy this book to my collection', copyBook);
  bookActions.append(bookRead, bookPack); packing.append(label('House library book', bookSelect), bookActions);
  const bag = node('section', 'city-travel-bag');
  bag.append(node('h3', null, 'My travelling collection'));
  const cargoList = node('div', 'city-travel-cargo-list'); cargoList.className = 'city-travel-list'; bag.append(cargoList);
  const placement = node('form', 'city-travel-placement-form');
  const cargoSelect = select('city-travel-cargo'), anchorSelect = select('city-travel-anchor');
  const place = button('city-travel-place', 'Place a display copy in this city'); place.type = 'submit';
  placement.append(label('Collection item', cargoSelect), label('Place in the current city', anchorSelect), place);
  const displays = node('div', 'city-travel-displays'); displays.className = 'city-travel-list'; bag.append(placement, displays);

  const activityPanel = node('section', 'city-travel-activity'); activityPanel.hidden = true;
  const activityTitle = node('h3', 'city-travel-activity-title'), activityText = node('p', 'city-travel-activity-text');
  const activityClose = button('city-travel-activity-close', 'Close activity', () => {
    remember(); activity = null; version++; scene?.stand?.(); render();
  });
  activityText.style.whiteSpace = 'pre-wrap';
  const activityQuestion = node('p', 'city-travel-activity-question');
  const activityOrigin = node('p', 'city-travel-activity-origin');
  const readerControls = node('div', 'city-travel-reader'); readerControls.className = 'city-travel-actions';
  const previous = button('city-travel-book-previous', 'Previous page', () => turnPage(-1));
  const pageLabel = node('span', 'city-travel-book-page');
  const next = button('city-travel-book-next', 'Next page', () => turnPage(1)); readerControls.append(previous, pageLabel, next);
  const activityForm = node('form', 'city-travel-activity-form'), activityAnswer = node('textarea', 'city-travel-activity-answer');
  activityAnswer.rows = 4; activityAnswer.required = true;
  const activitySave = button('city-travel-activity-save', 'Save observation in this city'); activitySave.type = 'submit';
  activityForm.append(label('Your answer, prediction or observation', activityAnswer), activitySave);
  const discussion = button('city-travel-discuss', 'Discuss this with Socrates', discussActivity); discussion.hidden = !discuss;
  activityPanel.append(activityTitle, activityClose, activityOrigin, activityText, readerControls, activityQuestion, activityForm, discussion);

  const journal = node('section', 'city-travel-journal');
  const journalTitle = node('h3', 'city-travel-journal-title', 'City journal');
  const journalForm = node('form', 'city-travel-journal-form'), journalAnswer = node('textarea', 'city-travel-journal-answer');
  journalAnswer.rows = 3; journalAnswer.maxLength = NOTE_LIMIT; journalAnswer.required = true;
  const journalSave = button('city-travel-journal-save', 'Keep this city note'); journalSave.type = 'submit';
  journalForm.append(label('A note about life in this city', journalAnswer), journalSave);
  const notes = node('div', 'city-travel-notes'); notes.className = 'city-travel-list';
  const earlier = button('city-travel-earlier-notes', 'Show earlier city notes', () => { shownNotes += 12; render(); });
  journal.append(journalTitle, node('p', null, 'City notes and travelling copies are saved separately from your home editions.'), journalForm, notes, earlier);

  const transfer = node('section', 'city-travel-transfer'); transfer.append(node('h3', null, 'Portable collection'));
  const exportButton = button('city-travel-export', 'Export collection JSON', exportPack);
  const importForm = node('form', 'city-travel-import-form'), importFile = node('input', 'city-travel-import-file');
  importFile.type = 'file'; importFile.accept = '.json,application/json'; importFile.required = true;
  const importButton = button('city-travel-import', 'Add this collection'); importButton.type = 'submit';
  importForm.append(label('Collection JSON', importFile), importButton);
  transfer.append(node('p', null, 'A collection file includes copied personal idea notes and city journals. Import adds records; it preserves your existing collection and homes.'), exportButton, importForm);
  dialog.replaceChildren(head, location, status, reloadButton, destinations, landmarks, packing, bag, activityPanel, journal, transfer);
  dialog.setAttribute('aria-labelledby', 'city-travel-title');
  dialog.addEventListener?.('close', () => { remember(); scene?.stand?.(); });
  dialog.addEventListener?.('cancel', () => { remember(); scene?.stand?.(); });
  $('city-travel-open').onclick = show;
  homeSelect.onchange = () => renderSourceIdeas();
  bookSelect.onchange = () => {
    if (activity?.bookId) showActivity({homeAction: 'read', bookId: bookSelect.value});
  };

  function renderSourceIdeas() {
    const home = sourceHome();
    fillSelect(ideaSelect, (home?.house.ideas || []).map(idea => [idea.id,
      idea.title + ' · ' + sourceRoom(home, idea.roomId)]));
    ideaPack.disabled = pending || isSaving() || !getNetwork() || !ideaSelect.value;
  }
  async function copyIdea() {
    const home = sourceHome(), idea = home?.house.ideas.find(item => item.id === ideaSelect.value);
    if (!home || !idea) { message('Choose a home idea to copy.', true); return; }
    await work(async () => {
      await saveNetwork(packIdea(getNetwork(), {...idea, sourceHomeTitle: home.title || 'Home', sourceRoomName: sourceRoom(home, idea.roomId)}));
      message('“' + idea.title + '” is in your travelling collection. Its original home is preserved.');
    });
  }
  async function copyBook() {
    const chosen = book(bookSelect.value), home = sourceHome();
    await work(async () => {
      await saveNetwork(packBook(getNetwork(), {...chosen, sourceHomeTitle: home?.title || 'House library',
        sourceRoomName: sourceRoom(home, getSelected?.())}));
      message('“' + chosen.title + '” is in your travelling collection.');
    });
  }
  async function travel(id) {
    await work(async () => {
      remember(); await beforeTravel?.(id);
      await saveNetwork(recordCityVisit(getNetwork(), id));
      await scene.travelToCity(id);
      context++; version++; close(); render();
      notify?.('Arrived in ' + (CITIES.find(city => city.id === id)?.name || id) + '.');
    });
  }
  async function visitLandmark(id) {
    if (pending || isSaving()) { message('Wait for the current save to finish.', true); return; }
    remember();
    try {
      if (typeof scene?.visitCityLandmark !== 'function') throw Error('The city walking guide is unavailable. You can still read and keep notes here.');
      await beforeTravel?.(cityId());
      const reached = await scene.visitCityLandmark(id);
      if (reached === false) throw Error('This city place could not be reached. Your drafts are kept.');
      close();
    } catch (error) { message(error.message, true); }
  }
  placement.onsubmit = async event => {
    event.preventDefault(); const cargoId = cargoSelect.value, anchorId = anchorSelect.value, destination = cityId();
    await work(async () => {
      await saveNetwork(placeCargo(getNetwork(), cargoId, destination, anchorId));
      message('A display copy is placed here. The item is still in your travelling collection.');
    });
  };
  function prefix() { return activity ? activity.title + ' · ' + activity.action + '\n' : ''; }
  function showCargo(id) {
    const network = getNetwork();
    const display = network?.placements?.find(item => item.id === id);
    const cargo = network?.cargo?.find(item => item.id === (display?.cargoId || id));
    if (!cargo) { message('This collection item is no longer available. Your draft is kept.', true); return; }
    remember(); version++; bookPage = 0;
    activity = {key: cityId() + ':cargo:' + cargo.id, cityId: cityId(), cargoId: cargo.id,
      title: cargo.title, text: cargo.text, action: cargo.action || 'read',
      ...(cargo.type === 'book' && cargo.bookId ? {bookId: cargo.bookId} : {}),
      origin: 'Copied from ' + [cargo.sourceHomeTitle, cargo.sourceRoomName].filter(Boolean).join(' · ')};
    activityAnswer.value = activityDrafts.get(activity.key) || ''; renderActivity(); show(); activityPanel.scrollIntoView?.({block:'start'});
  }
  function showActivity(data = {}) {
    remember(); version++; bookPage = 0;
    const action = data.homeAction || data.action || 'reflect', destination = cityId();
    if (action === 'journal') { show(); journalAnswer.focus?.(); return; }
    if (action === 'read') {
      const chosen = book(data.bookId || bookSelect.value); bookSelect.value = chosen.id;
      activity = {key: destination + ':book:' + chosen.id, cityId: destination, title: chosen.title,
        action: 'read', bookId: chosen.id, origin: 'House library · available in every city'};
    } else {
      const activities = {
        sit: ['A moment in this city', 'Sit and look around. What would make this place easier to inhabit?', 'reflect'],
        tea: ['Tea and conversation', 'Pause at the table. Which part of your day deserves more attention?', 'reflect'],
        rest: ['A place to rest', 'Take a pause. What does this city need to feel like somewhere you can return to?', 'reflect'],
        experiment: ['Try a small experiment', 'Choose one change, predict an effect, and compare it with what you observe.', 'experiment'],
        question: ['Examine a claim', 'Give a concrete example, then find a case where your claim might fail.', 'question']
      };
      const [title, text, functionName] = activities[action] || ['An observation in this city', 'Notice one useful feature or friction in this place.', 'reflect'];
      activity = {key: destination + ':activity:' + action, cityId: destination,
        title: data.title || title, text: data.text || text, action: functionName, origin: currentCity().name};
    }
    activityAnswer.value = activityDrafts.get(activity.key) || ''; renderActivity(); show(); activityPanel.scrollIntoView?.({block:'start'});
  }
  function renderActivity() {
    activityPanel.hidden = !activity;
    if (!activity) return;
    activityTitle.textContent = activity.title; activityOrigin.textContent = activity.origin || '';
    const chosen = activity.bookId ? book(activity.bookId) : null;
    activityText.textContent = chosen ? chosen.pages[bookPage] : activity.text || '';
    activityQuestion.textContent = chosen ? chosen.question : prompts[activity.action] || prompts.reflect;
    readerControls.hidden = !chosen;
    pageLabel.textContent = chosen ? 'Page ' + (bookPage + 1) + ' of ' + chosen.pages.length : '';
    activityAnswer.maxLength = Math.max(0, NOTE_LIMIT - prefix().length);
    activitySave.textContent = 'Save observation in ' + (CITIES.find(city => city.id === activity.cityId)?.name || 'this city');
  }
  function turnPage(direction) {
    if (!activity?.bookId) return;
    const chosen = book(activity.bookId); bookPage = (bookPage + direction + chosen.pages.length) % chosen.pages.length;
    renderActivity();
  }
  activityForm.onsubmit = async event => {
    event.preventDefault(); if (!activity) return;
    const text = activityAnswer.value, entry = prefix() + text, target = activity.cityId,
      key = activity.key, selectedVersion = version, started = context;
    remember();
    await work(async () => {
      if (!text.trim()) throw Error('Write an observation or experiment first.');
      if (entry.length > NOTE_LIMIT) throw Error('Keep this observation within ' + activityAnswer.maxLength + ' characters. Your draft is kept.');
      await saveNetwork(saveCityNote(getNetwork(), target, entry));
      if (started === context && selectedVersion === version && activity?.key === key) {
        if (activityAnswer.value === text) { activityAnswer.value = ''; activityDrafts.delete(key); }
        message('Your observation is saved in this city’s journal.');
      }
    });
  };
  journalForm.onsubmit = async event => {
    event.preventDefault(); const target = journalCity, text = journalAnswer.value, started = context;
    remember();
    await work(async () => {
      await saveNetwork(saveCityNote(getNetwork(), target, text));
      if (started === context && journalCity === target) {
        if (journalAnswer.value === text) { journalAnswer.value = ''; journalDrafts.delete(target); }
        message('Your city note is saved.');
      }
    });
  };
  async function discussActivity() {
    if (!activity || !discuss || pending || isSaving()) return;
    const chosen = activity.bookId ? book(activity.bookId) : null;
    const prepared = {...activity, text: chosen ? chosen.pages[bookPage] : activity.text,
      question: chosen ? chosen.question : prompts[activity.action] || prompts.reflect};
    close();
    try { await discuss(prepared); } catch (error) { show(); message(error.message, true); }
  }
  function exportPack() {
    try {
      writable();
      const content = JSON.stringify(exportCollection(getNetwork()), null, 2);
      const urlApi = window.URL || URL, url = urlApi.createObjectURL(new Blob([content], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = 'house-of-ideas-travel-collection.json'; link.click();
      (window.setTimeout || setTimeout)(() => urlApi.revokeObjectURL(url), 1000);
      message('Collection exported with copied personal notes and city journals.');
    } catch (error) { message(error.message, true); }
  }
  importForm.onsubmit = async event => {
    event.preventDefault(); const file = importFile.files?.[0];
    await work(async () => {
      if (!file) throw Error('Choose a portable collection JSON file.');
      if (file.size > IMPORT_BYTES) throw Error('Choose a collection file no larger than 2 MiB.');
      const text = await file.text();
      await saveNetwork(importCollection(getNetwork(), text));
      if (importFile.files?.[0] === file) importFile.value = '';
      message('The imported collection was added. Your existing cargo, city notes and home editions are preserved.');
    });
  };
  function render() {
    const city = currentCity(), network = getNetwork(), blocked = pending || isSaving() || !network;
    reloadButton.hidden = typeof reload !== 'function' || !reloadNeeded;
    reloadButton.disabled = pending;
    if (journalCity !== city.id) {
      if (journalCity) journalDrafts.set(journalCity, journalAnswer.value);
      if (activity && activity.cityId !== city.id) {
        activityDrafts.set(activity.key, activityAnswer.value); activity = null; version++;
      }
      journalCity = city.id; journalAnswer.value = journalDrafts.get(city.id) || ''; shownNotes = 12;
    }
    location.textContent = 'You are in ' + city.name + '. ' + (city.description || '');
    journalTitle.textContent = city.name + ' journal';
    for (const [id, destination] of destinationButtons) {
      destination.disabled = blocked; destination.setAttribute('aria-current', id === city.id ? 'location' : 'false');
    }
    landmarks.replaceChildren(...(city.anchors || []).map(anchor => {
      const visit = button('city-travel-visit-' + anchor.id, 'Visit ' + (anchor.label || anchor.name || anchor.id), () => visitLandmark(anchor.id));
      visit.disabled = pending || isSaving() || typeof scene?.visitCityLandmark !== 'function'; return visit;
    }));
    const homes = sourceHomes(), previousHome = homeSelect.value;
    fillSelect(homeSelect, homes.map(home => [home.id, home.title || 'Home']), previousHome || getNeighborhood?.()?.activeId);
    renderSourceIdeas();
    bookPack.disabled = blocked; place.disabled = blocked || !network?.cargo?.length;
    journalSave.disabled = activitySave.disabled = exportButton.disabled = importButton.disabled = blocked;
    discussion.disabled = pending || isSaving();
    homeSelect.disabled = !homes.length;
    fillSelect(cargoSelect, (network?.cargo || []).map(cargo => [cargo.id, cargo.title]));
    fillSelect(anchorSelect, (city.anchors || []).map(anchor => [anchor.id, anchor.label || anchor.name || anchor.id]));
    cargoList.replaceChildren(...(network?.cargo || []).map(cargo => button(null,
      cargo.title + ' · ' + cargo.action, () => showCargo(cargo.id))));
    if (!network?.cargo?.length) cargoList.append(node('p', null, 'Your collection is empty. Copy one book or idea to carry between cities.'));
    displays.replaceChildren(...(network?.placements || []).filter(item => item.cityId === city.id).map(item => {
      const cargo = network.cargo.find(value => value.id === item.cargoId), anchor = city.anchors.find(value => value.id === item.anchorId);
      return button(null, (cargo?.title || 'Collection item') + ' · ' + (anchor?.label || anchor?.name || item.anchorId), () => showCargo(item.id));
    }));
    const journalNotes = (network?.notes || []).filter(note => note.cityId === city.id);
    notes.replaceChildren(...journalNotes.slice(-shownNotes).reverse().map(note => {
      const article = node('article'), date = node('small', null, new Date(note.date).toLocaleString(undefined, {timeZone: 'Europe/Prague'}));
      const text = node('p', null, note.text); text.style.whiteSpace = 'pre-wrap'; article.append(date, text); return article;
    }));
    if (!journalNotes.length) notes.append(node('p', null, 'No notes in this city yet.'));
    earlier.hidden = journalNotes.length <= shownNotes;
    renderActivity();
  }
  function onNetworkChange() { render(); }
  function onHomeChange() { remember(); context++; version++; render(); }
  render();
  return {render, show, close, showCargo, showActivity, travel, onNetworkChange, onHomeChange,
    nextPage: () => turnPage(1)};
}
