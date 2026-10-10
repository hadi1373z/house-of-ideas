import {ARTISTS} from './art-city-data.js';
import {artistConversation, converseWithArtist, appendArtistReply, artistOpening, artistQuestions, ARTIST_RESIDENT_NOTE, ARTIST_DIALOGUE_LIMITS} from './artist-dialogue.js';

export function initArtistResidentUI({$, document, window, scene, getNetwork, saveNetwork,
  isLoaded, isSaving, notify, reload, getAIConfig, requestAIReply, openAISettings, stageSuggestion,
  onReviewHouse, schedule = setInterval, cancel = clearInterval}) {
  const dialog = $('artist-resident-dialog'), drafts = new Map(), works = new Map();
  let selected = null, busy = false, reloadNeeded = false, questionIndex = 0, transcriptKey = '', shownTurns = 24, dialogueMode = 'offline';
  function node(tag, id, text) {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(id, text, handler) {
    const element = node('button', id, text); element.type = 'button'; element.onclick = handler; return element;
  }
  const head = node('div'); head.className = 'artist-resident-head';
  const identity = node('div'), title = node('h2', 'artist-resident-title', 'Meet the artist');
  const subtitle = node('p', 'artist-resident-subtitle', ARTIST_RESIDENT_NOTE);
  identity.append(title, subtitle); head.append(identity, button('artist-resident-close', 'Close', close));
  const presence = node('p', 'artist-resident-presence'); presence.setAttribute('aria-live', 'polite');
  const ai = node('section'); ai.className = 'artist-resident-ai';
  const mode = node('select', 'artist-resident-mode'), modeLabel = node('label');
  modeLabel.htmlFor = mode.id; modeLabel.textContent = 'Conversation mode';
  const modes = new Map();
  for (const [value, text] of [['offline', 'Offline'], ['chatgpt', 'ChatGPT plan'], ['api', 'API key']]) {
    const option = node('option', null, text); option.value = value; modes.set(value, option); mode.append(option);
  }
  const aiStatus = node('p', 'artist-resident-ai-status'), aiPrivacy = node('p', 'artist-resident-ai-privacy');
  const procedure = node('p', 'artist-resident-ai-procedure', 'Sign in → choose a model → talk with the artist → review house ideas.');
  const aiActions = node('div'); aiActions.className = 'artist-resident-ai-actions';
  const connect = button('artist-resident-connect', 'Connect ChatGPT', () => {close(); openAISettings?.();});
  const review = button('artist-resident-review', 'Review house ideas', () => {
    if (!selected || busy || isSaving() || !isLoaded()) return;
    const context = {artistId: selected, workId: currentWork()?.id}; close(); onReviewHouse?.(context);
  });
  connect.hidden = typeof openAISettings !== 'function'; review.hidden = typeof onReviewHouse !== 'function';
  aiActions.append(connect, review); ai.append(modeLabel, mode, aiStatus, aiPrivacy, aiActions, procedure);
  const work = node('select', 'artist-resident-work'), workLabel = node('label');
  workLabel.htmlFor = work.id; workLabel.textContent = 'Artwork to discuss';
  const workDescription = node('p', 'artist-resident-work-description');
  const questions = node('div', 'artist-resident-questions'); questions.className = 'artist-resident-questions';
  const messages = node('div', 'artist-resident-messages'); messages.setAttribute('role', 'log');
  messages.setAttribute('aria-label', 'Conversation with the artist'); messages.setAttribute('aria-live', 'polite');
  const earlier = button('artist-resident-earlier', 'Show earlier conversation', () => {
    const top = Number(messages.scrollTop) || 0, height = Number(messages.scrollHeight) || 0;
    shownTurns = ARTIST_DIALOGUE_LIMITS.messages; renderMessages();
    messages.scrollTop = top + (Number(messages.scrollHeight) || 0) - height;
  }); earlier.hidden = true;
  const form = node('form', 'artist-resident-form'), input = node('textarea', 'artist-resident-input');
  const inputLabel = node('label'); inputLabel.htmlFor = input.id; inputLabel.textContent = 'Your question or observation';
  input.rows = 3; input.required = true; input.maxLength = ARTIST_DIALOGUE_LIMITS.text;
  input.placeholder = 'What do you notice? What would you like to try?';
  const send = button('artist-resident-send', 'Ask the artist'); send.type = 'submit';
  form.append(inputLabel, input, send);
  const status = node('p', 'artist-resident-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const reloadButton = button('artist-resident-reload', 'Reload saved conversations', reloadSaved);
  reloadButton.hidden = true;
  dialog.replaceChildren(head, presence, ai, workLabel, work, workDescription, questions, earlier, messages, form, status, reloadButton);
  dialog.setAttribute('aria-labelledby', title.id);

  const artist = id => ARTISTS.find(item => item.id === id);
  const currentWork = () => artist(selected)?.works.find(item => item.id === work.value);
  const location = id => scene?.artistResidentState?.(id) || {available: false, near: false};
  const aiConfig = () => getAIConfig?.() || {local: false, chatgptConnected: false, apiReady: false};
  const providerName = provider => provider === 'chatgpt' ? 'ChatGPT' : provider === 'api' ? 'GPT API' : aiConfig().hosted ? 'Artist guide' : 'Offline art guide';
  const providerModel = (provider, config = aiConfig()) => provider === 'chatgpt' ? config.chatgptModel || '' : provider === 'api' ? config.apiModel || '' : '';
  function ready(provider, config = aiConfig()) {
    return provider === 'offline' || Boolean(config.local && typeof requestAIReply === 'function' &&
      (provider === 'chatgpt' ? config.local && config.chatgptConnected : provider === 'api' && config.apiReady));
  }
  function renderAI() {
    const config = aiConfig(), model = providerModel(dialogueMode, config);
    for (const [provider, option] of modes) {option.disabled = !ready(provider, config);option.hidden = Boolean(config.hosted && provider !== 'offline');}
    modes.get('offline').textContent = config.hosted ? 'Artist guide · rules' : 'Offline';
    modes.get('api').textContent = 'API key';
    connect.textContent = config.hosted ? 'ChatGPT plan · local house' : 'Connect ChatGPT';
    procedure.textContent = config.hosted ? 'Open the local house → Continue with ChatGPT → talk with the artist → export private conversations for review here.' : 'Sign in → choose a model → talk with the artist → review house ideas.';
    mode.value = dialogueMode; mode.disabled = busy;
    aiStatus.textContent = dialogueMode === 'offline' ? (config.hosted ? 'Artist guide · rule-based · no GPT request' : 'Offline art guide · no online request') :
      ready(dialogueMode, config) ? providerName(dialogueMode) + ' connected' + (model ? ' · ' + model : '') :
      (config.hosted ? 'ChatGPT-plan conversations run in the local house. Choose the artist guide here.' : providerName(dialogueMode) + ' is disconnected. Connect it or choose Offline.');
    aiPrivacy.textContent = dialogueMode === 'offline' ? (config.hosted ? 'The rule-based guide uses this artist’s works and saved conversation. New exchanges are saved in your signed-in private online house; internet is required.' : 'The offline guide uses this artist’s works and saved conversation.') :
      'Sending a question shares your message, this artist’s persona, recent conversation, selected artwork and gallery editions with OpenAI.' + (config.hosted ? ' The saved exchange is kept in your private online archive.' : '') + ' House ideas wait for your review.';
    subtitle.textContent = dialogueMode === 'offline' ? ARTIST_RESIDENT_NOTE :
      'Interpretive artist persona · replies generated through ' + providerName(dialogueMode) + '.';
    connect.disabled = busy || isSaving(); review.disabled = busy || isSaving() || !isLoaded();
    procedure.hidden = typeof openAISettings !== 'function';
  }
  function remember() { if (selected) { drafts.set(selected, input.value); works.set(selected, work.value); } }
  function message(text, error = false) {
    status.textContent = text; status.dataset.error = String(error); if (error) notify?.(text, true);
  }
  function close() {
    remember(); if (selected) scene?.setArtistTalking?.(selected, false);
    if (dialog.open) dialog.close();
    document.querySelector?.('#scene canvas')?.focus?.();
  }
  function physicallyHere(id) {
    const state = location(id), player = scene?.playerState?.() || {};
    const cityId = scene?.cityState?.()?.id || player.cityId || state.cityId;
    return state.available !== false && (!cityId || cityId === 'artists') &&
      (!Object.hasOwn(player, 'artistId') || player.artistId === id || state.near);
  }
  function addQuestion(question) {
    if (!question || !selected) return;
    const next = !input.value.trim() ? question : input.value.includes(question) ? input.value : input.value + '\n\n' + question;
    if (next.length > input.maxLength) {
      message('Send or save the current question before adding another.'); return;
    }
    input.value = next;
    remember(); input.focus?.();
  }
  function renderWork() {
    if (!selected) return;
    const item = currentWork();
    works.set(selected, work.value);
    workDescription.textContent = item ? [item.title, item.date, item.medium].filter(Boolean).join(' · ') + '\n' + item.description : '';
    questions.replaceChildren(...artistQuestions(selected, item?.id).map((text, index) =>
      button('artist-resident-question-' + index, text, () => addQuestion(text))));
  }
  function renderMessages() {
    const resident = artist(selected); if (!resident) return;
    const conversation = artistConversation(getNetwork(), selected);
    earlier.hidden = conversation.length <= shownTurns;
    const key = JSON.stringify([selected, currentWork()?.id, shownTurns, conversation.slice(-shownTurns)]);
    if (key === transcriptKey) return;
    transcriptKey = key;
    const intro = node('p', null, artistOpening(selected, currentWork()?.id)); intro.className = 'artist-resident-opening';
    const turns = conversation.slice(-shownTurns).map(turn => {
      const article = node('article'); article.className = 'artist-resident-turn ' + (turn.role === 'user' ? 'you' : 'artist');
      const label = node('small', null, turn.role === 'user' ? 'YOU' : resident.name.toUpperCase() + ' · ARTIST RESIDENT');
      const text = node('p', null, turn.text); article.append(label, text); return article;
    });
    messages.replaceChildren(...(conversation.length ? turns : [intro]));
    messages.scrollTop = messages.scrollHeight;
  }
  function render() {
    if (!selected) return;
    if (dialog.open && !physicallyHere(selected)) { close(); return; }
    const state = location(selected), resident = artist(selected);
    presence.textContent = state.near ? resident.name + ' is here with you in this house.' :
      'Wait here for ' + resident.name + ', or walk closer inside this house.';
    if (dialog.open) scene?.setArtistTalking?.(selected, Boolean(state.near));
    renderAI();
    send.disabled = busy || isSaving() || !isLoaded() || !state.near || !physicallyHere(selected) || !ready(dialogueMode);
    work.disabled = busy;
    reloadButton.hidden = !reloadNeeded || typeof reload !== 'function';
    reloadButton.disabled = busy || isSaving();
    renderMessages();
  }
  function show(id, workId, question) {
    const resident = artist(id); if (!resident) return false;
    const state = location(id), player = scene?.playerState?.() || {};
    if (!physicallyHere(id) || (!state.near && player.artistId !== id)) {
      notify?.('Enter ' + resident.name + '’s house and meet its resident first.', true); return false;
    }
    remember(); if (selected !== id) shownTurns = 24;
    if (selected && selected !== id) scene?.setArtistTalking?.(selected, false);
    selected = id; questionIndex = 0;
    title.textContent = 'Conversation with ' + resident.name;
    dialog.style.setProperty('--artist-resident-color', resident.color);
    work.replaceChildren(...resident.works.map(item => {const option = node('option', null, item.title); option.value = item.id; return option;}));
    const preferred = workId || works.get(id);
    work.value = resident.works.some(item => item.id === preferred) ? preferred : resident.works[0]?.id || '';
    input.value = drafts.get(id) || '';
    message(''); renderWork();
    if (!state.near && player.artistId === id) scene?.greetArtistResident?.(id);
    if (!dialog.open) dialog.showModal();
    if (question) addQuestion(question);
    render(); return true;
  }
  async function reloadSaved() {
    if (busy || isSaving() || typeof reload !== 'function') return;
    remember(); busy = true; render();
    try {
      if (await reload() === false) throw Error('Saved conversations could not be reloaded. Your drafts are kept.');
      reloadNeeded = false; message('Saved conversations reloaded. Your draft is kept; send it when you are ready.');
    } catch (error) { reloadNeeded = true; message(error.message, true); }
    finally { busy = false; render(); }
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (!selected || busy || isSaving() || !isLoaded() || !location(selected).near || !physicallyHere(selected)) return;
    const id = selected, draft = input.value, workId = currentWork()?.id, provider = dialogueMode, model = providerModel(provider);
    if (!draft.trim()) return;
    if (!ready(provider)) {message('Connect ' + providerName(provider) + ' first, or choose Offline. Your question is kept.', true); return;}
    remember(); busy = true; message(provider === 'offline' ? 'The artist is considering your observation…' :
      artist(id).name + ' is thinking with ' + providerName(provider) + (model ? ' · ' + model : '') + '…'); render();
    try {
      let next;
      if (provider === 'offline') next = converseWithArtist(getNetwork(), {artistId: id, text: draft, workId});
      else {
        const result = await requestAIReply({artistId: id, message: draft, workId, provider});
        if (!isLoaded() || isSaving()) throw Error('Wait for saved city state to finish loading before trying again.');
        next = appendArtistReply(getNetwork(), {artistId: id, text: draft, workId, reply: result?.reply});
        if (result?.suggestion) {
          if (typeof stageSuggestion !== 'function') throw Error('The house idea could not be staged for review.');
          next = stageSuggestion(next, result.suggestion, {artistId: id, message: draft, workId});
        }
      }
      await saveNetwork(next);
      if (drafts.get(id) === draft) drafts.set(id, '');
      if (selected === id && input.value === draft) input.value = '';
      reloadNeeded = false; if (selected === id) message('Conversation saved in this artist’s house.' +
        (provider === 'offline' ? '' : ' ' + providerName(provider) + (model ? ' · ' + model : '') + '. Review house ideas when you are ready.'));
    } catch (error) {
      reloadNeeded = true;
      message((selected === id ? '' : artist(id).name + ': ') + error.message +
        ' Your question is kept. Reload saved conversations before retrying.', true);
    } finally { busy = false; render(); }
  };
  input.oninput = remember;
  mode.onchange = () => {dialogueMode = ['offline', 'chatgpt', 'api'].includes(mode.value) ? mode.value : 'offline'; render();};
  work.onchange = () => { remember(); renderWork(); render(); };
  dialog.addEventListener('close', () => { remember(); if (selected) scene?.setArtistTalking?.(selected, false); });
  const presenceClock = schedule(() => { if (dialog.open) render(); }, 500); presenceClock?.unref?.();
  window.addEventListener('pagehide', () => { remember(); cancel(presenceClock); });
  return {show, close, render, nextQuestion() {
    if (!selected || !dialog.open) return false;
    const prompts = artistQuestions(selected, currentWork()?.id);
    addQuestion(prompts[questionIndex++ % prompts.length]); return true;
  }};
}
