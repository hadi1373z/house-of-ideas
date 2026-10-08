// ChatGPT plan usage has a separate OAuth connection and account model catalog.
// Keep its Responses request within the documented HTTP/SSE preview limits.
import {GptError, cleanModel, validateChatInput, responseSchema, buildGptPrompt} from './gpt.mjs';
import {normalizeGptResult} from '../web/resident.js';

const API_URL = 'https://api.openai.com/v1/responses';

function residentText(payload) {
  if (!payload || payload.status !== 'completed' || !Array.isArray(payload.output)) throw new GptError('ChatGPT returned an incomplete resident response.');
  const contents = payload.output.flatMap(item => item?.type === 'message' && Array.isArray(item.content) ? item.content : []);
  if (contents.some(item => item.type === 'refusal')) throw new GptError('ChatGPT could not answer that message. Try another question or use local Socrates.');
  const text = contents.filter(item => item.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('');
  if (!text || text.length > 12000) throw new GptError('ChatGPT returned no usable resident reply.');
  return text;
}

async function completedStream(response, signal) {
  if (!/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel().catch(() => {}); throw new GptError('ChatGPT did not return its required response stream.'); }
  const reader = response.body?.getReader();
  if (!reader) throw new GptError('ChatGPT returned an empty response.');
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let buffer = '', total = 0, deltaText = '', completed = null;
  function consume(block) {
    if (block.length > 128000) throw new GptError('ChatGPT returned a response event that was too large.');
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data || data === '[DONE]') return;
    let event;
    try { event = JSON.parse(data); } catch { throw new GptError('ChatGPT returned an unreadable response stream.'); }
    if (!event || typeof event.type !== 'string') throw new GptError('ChatGPT returned an unreadable response event.');
    if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) throw new GptError('ChatGPT did not complete its reply. You can try again or use local Socrates.');
    if (event.type === 'response.refusal.delta' || event.type === 'response.refusal.done') throw new GptError('ChatGPT could not answer that message. Try another question or use local Socrates.');
    if (event.type === 'response.output_text.delta') {
      if (typeof event.delta !== 'string') throw new GptError('ChatGPT returned an unreadable text event.');
      deltaText += event.delta;
      if (deltaText.length > 12000) throw new GptError('ChatGPT returned a reply that was too large.');
    }
    if (event.type === 'response.completed') completed = event.response;
  }
  try {
    while (!completed) {
      if (signal.aborted) throw new GptError('The ChatGPT request was cancelled or timed out.');
      const {value, done} = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      total += value.length;
      if (total > 256000) throw new GptError('ChatGPT returned a response stream that was too large.');
      buffer += decoder.decode(value, {stream: true});
      // A CRLF can be split across network chunks.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        consume(block);
        if (completed) break;
      }
      if (!completed && buffer.length > 128000) throw new GptError('ChatGPT returned a response event that was too large.');
    }
    if (!completed && buffer.trim()) consume(buffer);
    if (!completed) throw new GptError('ChatGPT ended before completing its reply.');
    const text = residentText(completed);
    if (deltaText && deltaText !== text) throw new GptError('ChatGPT returned an inconsistent resident reply.');
    return text;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function strictResult(text, house, roomId) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new GptError('ChatGPT returned an invalid resident reply.'); }
  try {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 3 || Object.keys(parsed).some(key => !['reply', 'concept', 'suggestion'].includes(key))) throw Error('Unexpected fields.');
    if (parsed.suggestion !== null && (typeof parsed.suggestion !== 'object' || !parsed.suggestion || Array.isArray(parsed.suggestion) || Object.keys(parsed.suggestion).length !== 5 || Object.keys(parsed.suggestion).some(key => !['title', 'reason', 'question', 'roomId', 'feature'].includes(key)) || parsed.suggestion.roomId !== roomId)) throw Error('Unexpected suggestion.');
    return normalizeGptResult(parsed, house, roomId);
  } catch { throw new GptError('ChatGPT returned a suggestion outside the allowed house actions.'); }
}

export async function requestChatGPTReply({auth, model, input, house, fetchImpl = globalThis.fetch, timeoutMs = 30000, signal} = {}) {
  const checked = validateChatInput(input, house);
  // There is deliberately no API-key default model for a ChatGPT plan account.
  const selectedModel = cleanModel(model);
  if (!model) throw new GptError('Choose an available ChatGPT model in local settings.', 400);
  const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  if (abort.aborted) throw new GptError('The ChatGPT request was cancelled.');
  const accessToken = await auth.accessToken();
  if (abort.aborted) throw new GptError('The ChatGPT request was cancelled.');
  const body = {
    model: selectedModel, store: false, stream: true,
    text: {format: {type: 'json_schema', name: 'socrates_resident', strict: true, schema: responseSchema(checked.roomId)}},
    input: buildGptPrompt(house, checked),
  };
  let response;
  try { response = await fetchImpl(API_URL, {method: 'POST', redirect: 'error', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`}, body: JSON.stringify(body), signal: abort}); }
  catch { throw new GptError(abort.aborted ? 'ChatGPT did not finish in time. You can use local Socrates.' : 'Could not reach ChatGPT. You can continue with local Socrates.'); }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    if ([401, 403].includes(response.status)) throw new GptError('ChatGPT rejected this session or plan permission. Continue with ChatGPT again.');
    if ([400, 404].includes(response.status)) throw new GptError('ChatGPT could not use this model or structured reply. Refresh the model list and choose another available model.');
    if (response.status === 429) throw new GptError('Your ChatGPT usage limit was reached. Try later or use local Socrates.');
    throw new GptError('ChatGPT could not complete this request. Your local house is unchanged.');
  }
  let text;
  try { text = await completedStream(response, abort); }
  catch (error) { if (error instanceof GptError) throw error; throw new GptError('ChatGPT did not finish its response stream.'); }
  if (abort.aborted) throw new GptError('The ChatGPT request was cancelled or timed out.');
  return strictResult(text, house, checked.roomId);
}

export function createChatGPTPlanController({auth, fetchImpl = globalThis.fetch, timeoutMs = 30000} = {}) {
  let selected = null, catalog = [], active = null, generation = 0;
  function config() { const status = auth.status(); return {...status, ready: status.connected, model: status.connected ? selected : null}; }
  const controller = {
    config,
    async models() {
      const version = generation, account = auth.status().account?.id;
      const next = await auth.models();
      if (version !== generation || account !== auth.status().account?.id) throw new GptError('The ChatGPT account changed. Refresh the model list.', 409);
      catalog = next;
      if (!catalog.some(model => model.slug === selected)) selected = catalog[0]?.slug || null;
      return catalog.map(model => ({...model}));
    },
    async selectModel(model) {
      const checked = cleanModel(model);
      if (!auth.status().connected) throw new GptError('Continue with ChatGPT before choosing its model.', 409);
      if (active) throw new GptError('Wait for the current ChatGPT reply to finish.', 409);
      if (!catalog.length) await controller.models();
      if (!catalog.some(model => model.slug === checked)) throw new GptError('Choose a model from your ChatGPT account catalog.', 400);
      selected = checked; return config();
    },
    reset() { ++generation; active?.abort(); catalog = []; selected = null; },
    async disconnect() { controller.reset(); return auth.disconnect(); },
    close() { controller.reset(); auth.close(); },
    async artistChat(input, network, requestReply) {
      if (!auth.status().connected) throw new GptError('Continue with ChatGPT in local settings, or choose Offline.', 409);
      if (active) throw new GptError('Wait for the current ChatGPT reply to finish.', 409);
      const operation=new AbortController(),version=generation,account=auth.status().account?.id;
      active=operation;
      try {
        if(!selected||!catalog.length)await controller.models();
        if(operation.signal.aborted||version!==generation||account!==auth.status().account?.id)throw new GptError('The ChatGPT account changed before this reply.',409);
        if(!selected)throw new GptError('No eligible ChatGPT models are available for this account.',409);
        const result=await requestReply({provider:'chatgpt',auth,model:selected,input,network,fetchImpl,timeoutMs,signal:operation.signal});
        if(operation.signal.aborted||version!==generation||account!==auth.status().account?.id)throw new GptError('The ChatGPT account changed before this reply completed.',409);
        return result;
      }finally{if(active===operation)active=null;}
    },
    async chat(input, house) {
      validateChatInput(input, house);
      if (!auth.status().connected) throw new GptError('Continue with ChatGPT in local settings, or use local Socrates.', 409);
      if (active) throw new GptError('Wait for the current ChatGPT reply to finish.', 409);
      const operation = new AbortController(), version = generation, account = auth.status().account?.id;
      active = operation;
      try {
        if (!selected || !catalog.length) await controller.models();
        if (operation.signal.aborted || version !== generation || account !== auth.status().account?.id) throw new GptError('The ChatGPT account changed before this reply.', 409);
        if (!selected) throw new GptError('No eligible ChatGPT models are available for this account.', 409);
        const result = await requestChatGPTReply({auth, model: selected, input, house, fetchImpl, timeoutMs, signal: operation.signal});
        if (operation.signal.aborted || version !== generation || account !== auth.status().account?.id) throw new GptError('The ChatGPT account changed before this reply completed.', 409);
        return result;
      } finally { if (active === operation) active = null; }
    },
  };
  return controller;
}
