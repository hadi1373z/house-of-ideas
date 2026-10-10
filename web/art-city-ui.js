import {pragueDate, reflect as recordReflection} from './socrates.js';

const REFLECTION_LIMIT = 1200;

export function initArtCityUI({$, document, window, scene, artists, getHouse, getSelected,
  isReadOnly, isSaving, saveHouse, examineArtist, beforeEnter, notify}) {
  const dialog = $('art-city-dialog'), nodes = {}, drafts = new Map();
  let artistId = null, workId = null, inCity = false, pending = false, context = 0, version = 0;

  function node(tag, id, text) {
    const element = document.createElement(tag);
    if (id) { element.id = id; nodes[id] = element; }
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(id, text, handler) {
    const element = node('button', id, text);
    element.type = 'button'; element.onclick = handler;
    return element;
  }
  function label(text, input) {
    const element = node('label'); element.append(node('span', null, text), input); return element;
  }
  function message(text, error = false) {
    status.textContent = text; status.dataset.error = String(error);
    if (error) notify?.(text, true);
  }
  function externalUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
    catch { return null; }
  }
  function localImage(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const base = new URL(window.location?.href || 'http://127.0.0.1/');
      const url = new URL(value, base);
      return url.origin === base.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function setLink(element, href) {
    element.hidden = !href;
    if (href) element.href = href; else element.removeAttribute('href');
  }
  function link(id, text) {
    const element = node('a', id, text); element.target = '_blank'; element.rel = 'noopener'; return element;
  }
  function selection() {
    const artist = artists.find(item => item.id === artistId);
    return {artist, work: artist?.works?.find(item => item.id === workId)};
  }
  const draftKey = (artist = artistId, work = workId) => JSON.stringify([artist, work]);
  function remember() { if (artistId && workId) drafts.set(draftKey(), answer.value); }
  function close() { remember(); dialog.close(); }
  function showDialog() { if (!dialog.open) dialog.showModal(); }
  function currentRoom() {
    const house = getHouse();
    return house?.rooms?.find(room => room.id === getSelected()) || house?.rooms?.[0];
  }
  function questionFor(artist, work) {
    const approach = typeof artist.approach === 'string' ? artist.approach.trim() : '';
    return approach
      ? 'Explore this approach: ' + approach + ' Which detail in “' + work.title + '” supports it, and what would you try differently?'
      : 'Look closely at “' + work.title + '”. Which detail changes how you see it, and what would you try in your own work?';
  }
  function prefixFor(artist, work) { return 'Artist City · ' + artist.name + ' · ' + work.title + '\n'; }

  const head = node('div'); head.className = 'dialog-head';
  const heading = node('h2', 'art-city-title', 'Artists City');
  head.append(heading, button('art-city-close', 'Close', close));
  const status = node('p', 'art-city-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const overview = node('section', 'art-city-overview');
  overview.append(node('p', null, 'Visit an artist’s house, look at their works, and bring one observation back to your own learning journal. Close this guide to walk through the city.'));
  const cityList = node('div', 'art-city-list'); cityList.className = 'art-city-list';
  for (const artist of artists) {
    const card = node('section'); card.className = 'art-city-card';
    card.append(node('h3', null, artist.name), node('p', null, artist.description || ''),
      button('art-city-visit-' + artist.id, 'Visit ' + artist.name + '’s house', () => visit(artist.id)));
    cityList.append(card);
  }
  overview.append(cityList);

  const detail = node('section', 'art-city-detail'); detail.hidden = true;
  const artistDescription = node('p', 'art-city-description'), approach = node('p', 'art-city-approach');
  const websites = node('div'); websites.className = 'art-city-actions';
  const localWebsite = link('art-city-local-website', 'Explore this artist’s local website');
  const originalWebsite = link('art-city-original-website', 'Original website · online');
  websites.append(localWebsite, originalWebsite);
  const workSelect = node('select', 'art-city-work');
  const controls = node('div'); controls.className = 'art-city-actions';
  const previous = button('art-city-previous', 'Previous work', () => shiftWork(-1));
  const next = button('art-city-next', 'Next work', () => shiftWork(1));
  controls.append(previous, label('Choose a work', workSelect), next);
  const figure = node('figure'), image = node('img', 'art-city-image');
  image.loading = 'lazy'; image.decoding = 'async';
  const caption = node('figcaption', 'art-city-caption'); figure.append(image, caption);
  const onlineImage = button('art-city-load-image', 'Load this image from its online source', () => {
    const {work} = selection(), url = externalUrl(work?.imageUrl);
    if (url) { image.src = url; image.hidden = false; onlineImage.hidden = true; }
  });
  const workDescription = node('p', 'art-city-work-description'), rights = node('p', 'art-city-rights');
  const source = link('art-city-work-source', 'Artwork source · online');
  const imageCredit = link('art-city-image-credit', 'Image and license record · online');
  const question = node('p', 'art-city-question');
  const form = node('form', 'art-city-reflection-form'), answer = node('textarea', 'art-city-answer');
  answer.rows = 4; answer.required = true;
  const reflectionRoom = node('p', 'art-city-reflection-room');
  const save = button('art-city-save', 'Save observation to my home'); save.type = 'submit';
  form.append(label('Your observation or experiment', answer), reflectionRoom, save);
  const actions = node('div'); actions.className = 'art-city-actions';
  const examine = button('art-city-examine', 'Discuss this work with the artist', discuss);
  const allHouses = button('art-city-all-houses', 'All artist houses', showOverview);
  actions.append(examine, allHouses);
  detail.append(artistDescription, approach, websites, controls, figure, onlineImage,
    workDescription, rights, source, imageCredit, question, form, actions);
  dialog.replaceChildren(head, status, overview, detail);
  dialog.setAttribute('aria-labelledby', 'art-city-title');
  dialog.addEventListener?.('cancel', remember);
  dialog.addEventListener?.('close', remember);

  async function visit(id) {
    close();
    try { await beforeEnter?.(); await scene.enterArtistHouse(id); }
    catch (error) { showOverview(); message(error.message, true); }
  }
  function showOverview() {
    remember(); artistId = null; workId = null; version++;
    heading.textContent = 'Artists City'; overview.hidden = false; detail.hidden = true;
    message(''); render(); showDialog();
  }
  function showArtist(id, selectedWork) {
    const artist = artists.find(item => item.id === id);
    if (!artist) { message('This artist’s house is not in the city.', true); return; }
    remember(); artistId = id;
    workId = artist.works?.find(item => item.id === selectedWork)?.id || artist.works?.[0]?.id || null;
    version++; inCity = true; answer.value = drafts.get(draftKey()) || '';
    heading.textContent = artist.name + '’s house';
    overview.hidden = true; detail.hidden = false;
    artistDescription.textContent = artist.description || '';
    approach.textContent = typeof artist.approach === 'string' ? artist.approach : '';
    approach.hidden = !approach.textContent;
    localWebsite.href = artist.id==='dali'?artist.websiteUrl:'./artists-websites.html#' + encodeURIComponent(artist.id);
    localWebsite.textContent=artist.id==='dali'?'Explore the real Portlligat house ↗':'Explore the artist website';
    setLink(originalWebsite, externalUrl(artist.websiteUrl));
    workSelect.replaceChildren(...(artist.works || []).map(work => {
      const option = node('option', null, work.title); option.value = work.id; return option;
    }));
    workSelect.value = workId || ''; workSelect.disabled = !workId;
    renderWork(); message(''); render(); showDialog();
  }
  function selectWork(id) {
    const {artist} = selection();
    if (!artist?.works?.some(work => work.id === id)) return;
    remember(); workId = id; version++; answer.value = drafts.get(draftKey()) || '';
    workSelect.value = id; renderWork(); message(''); render();
  }
  function shiftWork(direction) {
    const {artist} = selection(), works = artist?.works || [];
    const index = works.findIndex(work => work.id === workId);
    if (works.length) selectWork(works[(index + direction + works.length) % works.length].id);
  }
  workSelect.onchange = () => selectWork(workSelect.value);
  function renderWork() {
    const {artist, work} = selection();
    image.removeAttribute('src'); image.hidden = true; onlineImage.hidden = true;
    if (!work) {
      caption.textContent = 'No works are available in this house yet.';
      workDescription.textContent = ''; rights.textContent = ''; source.hidden = true; imageCredit.hidden = true;
      question.textContent = ''; form.hidden = true; examine.hidden = true; return;
    }
    const bundled = localImage(work.imageUrl);
    if (bundled) { image.src = bundled; image.hidden = false; }
    else onlineImage.hidden = !externalUrl(work.imageUrl);
    image.alt = work.alt || work.title;
    caption.textContent = [work.title, work.date, work.medium].filter(Boolean).join(' · ');
    workDescription.textContent = work.description || '';
    rights.textContent = work.rights || ''; rights.hidden = !work.rights;
    setLink(source, externalUrl(work.sourceUrl));
    setLink(imageCredit, externalUrl(work.rightsUrl));
    question.textContent = questionFor(artist, work);
    answer.maxLength = Math.max(0, REFLECTION_LIMIT - prefixFor(artist, work).length);
    form.hidden = false; examine.hidden = !examineArtist;
  }
  function render() {
    const {artist, work} = selection(), room = currentRoom();
    const cityState = scene?.playerState?.()?.artistCity;
    if (typeof cityState === 'boolean') inCity = cityState;
    $('art-city-open').textContent = inCity ? 'City guide · 10 houses' : 'Artists’ City · 10 houses';
    $('art-city-return').hidden = !(inCity || scene?.playerState?.()?.cityId === 'makers');
    previous.disabled = next.disabled = (artist?.works?.length || 0) < 2;
    save.disabled = pending || isSaving() || isReadOnly() || !room || !work;
    examine.textContent = selection().artist ? 'Discuss with ' + selection().artist.name : 'Discuss with the artist';
    examine.disabled = pending || isSaving();
    reflectionRoom.textContent = isReadOnly()
      ? 'This earlier home is preserved. You can explore every artist house; save your observation in a current home edition.'
      : room ? 'Save in today’s ' + room.name + ' journal. Existing observations are kept; the daily room entry holds 1,200 characters.'
        : 'Enter your own home before saving an observation.';
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (pending || isSaving()) { message('Wait for the current save to finish.', true); return; }
    if (isReadOnly()) { message('This earlier home is preserved. Enter a current home edition to save your observation.', true); return; }
    const {artist, work} = selection(), room = currentRoom();
    if (!artist || !work || !room) { message('Choose a work and enter your own home before saving.', true); return; }
    const text = answer.value, started = context, selectedVersion = version, key = draftKey();
    remember(); pending = true; render();
    try {
      if (!text.trim()) throw Error('Write an observation or experiment first.');
      const house = getHouse(), date = pragueDate();
      const existing = house.learning?.days?.find(day => day.date === date)?.reflections?.find(item => item.roomId === room.id)?.answer;
      const entry = prefixFor(artist, work) + text;
      const combined = existing ? existing + '\n\n' + entry : entry;
      if (combined.length > REFLECTION_LIMIT) throw Error('Today’s journal entry in ' + room.name + ' is full. Shorten your observation or choose another room; your draft is kept.');
      await saveHouse(recordReflection(house, date, room.id, combined));
      if (started === context && selectedVersion === version && key === draftKey()) {
        if (answer.value === text) { answer.value = ''; drafts.delete(key); }
        message('Your observation is saved in today’s ' + room.name + ' learning journal.');
      }
    } catch (error) {
      if (started === context && selectedVersion === version) message(error.message, true);
      else notify?.(error.message + ' Your artwork draft is kept.', true);
    } finally { pending = false; render(); }
  };
  async function discuss() {
    const {artist, work} = selection();
    if (!artist || !work || !examineArtist || pending || isSaving()) return;
    const started = context, selectedVersion = version;
    close();
    try { await examineArtist(artist, work, questionFor(artist, work)); }
    catch (error) { if (started === context && selectedVersion === version) { showDialog(); message(error.message, true); } }
  }
  $('art-city-open').onclick = async () => {
    const cityState = scene?.playerState?.()?.artistCity;
    const alreadyInCity = typeof cityState === 'boolean' ? cityState : inCity;
    if (alreadyInCity) { showOverview(); return; }
    close();
    try { await beforeEnter?.(); await scene.enterArtCity(); inCity = true; render(); }
    catch (error) { message(error.message, true); }
  };
  $('art-city-return').onclick = async () => {
    close();
    try { await scene.leaveArtCity(); inCity = false; render(); }
    catch (error) { showDialog(); message(error.message, true); }
  };
  function onHomeChange() { close(); context++; version++; inCity = false; render(); }
  render();
  return {render, show:showOverview, showArtist, close, onHomeChange};
}
