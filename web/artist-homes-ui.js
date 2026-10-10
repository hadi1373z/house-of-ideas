import {ARTISTS} from './artist-catalog.js';
import {artistHomeArchive, proposeArtistHome, decideArtistHome, artistImprovementBrief} from './artist-homes.js';
import {ARTIST_HOME_FEATURES, ARTIST_HOME_ATMOSPHERES} from './artist-home-data.js';

export function initArtistHomesUI({document, window, getNetwork, saveNetwork, isSaving, visit, reload, notify = () => {}}) {
  const drafts = new Map(), selectedProposals = new Map();
  let artistId = null, proposalId = null, boundProposalId = null, resolvedProposalId = null, busy = false, reloadNeeded = false;
  const node = (tag, text, id) => {const element = document.createElement(tag); if (text) element.textContent = text; if (id) element.id = id; return element;};
  const dialog = node('dialog', null, 'artist-homes-dialog');
  dialog.setAttribute('aria-label', 'Artist house editions'); dialog.className = 'artist-homes-dialog';
  const head = node('div'); head.className = 'dialog-head';
  const title = node('h2'), closeButton = node('button', 'Close'); closeButton.type = 'button'; closeButton.onclick = close;
  head.append(title, closeButton); dialog.append(head);
  dialog.append(node('p', 'Talk with the artist, review a design, then build a new house next door. Every original and approved edition remains in the city.'));
  const pending = node('select', null, 'artist-house-proposal'), pendingLabel = node('label', 'Pending house ideas');
  pendingLabel.append(pending); dialog.append(pendingLabel);
  const form = node('form'), fields = {};
  for (const [name, label, max] of [['title', 'House title', 100], ['reason', 'Why this suits the artist', 1200], ['exercise', 'What to try in this house', 500]]) {
    const wrap = node('label', label), input = node(name === 'title' ? 'input' : 'textarea', null, 'artist-house-' + name);
    input.maxLength = max; input.required = true; if (name !== 'title') input.rows = 3;
    wrap.append(input); form.append(wrap); fields[name] = input;
  }
  for (const [name, label, values] of [['feature', 'Learning object', ARTIST_HOME_FEATURES], ['atmosphere', 'House atmosphere', ARTIST_HOME_ATMOSPHERES]]) {
    const wrap = node('label', label), select = node('select', null, 'artist-house-' + name);
    for (const value of values) {const option = node('option', value.replaceAll('-', ' ')); option.value = value; select.append(option);}
    wrap.append(select); form.append(wrap); fields[name] = select;
  }
  const actions = node('div'); actions.className = 'dialog-actions';
  const decline = node('button', 'Decline idea'), approve = node('button', 'Approve and build a new house');
  decline.type = 'button'; approve.type = 'submit'; approve.className = 'primary'; actions.append(decline, approve); form.append(actions); dialog.append(form);
  const draft = node('button', 'Draft a house idea from our latest discussion', 'artist-house-draft'); draft.type = 'button'; dialog.append(draft);
  const message = node('p', null, 'artist-house-status'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const reloadButton = node('button', 'Reload saved house ideas', 'artist-house-reload'); reloadButton.type = 'button'; reloadButton.hidden = true;
  dialog.append(message, reloadButton, node('h3', 'Visit preserved houses'));
  const editions = node('div', null, 'artist-house-editions'); dialog.append(editions);
  dialog.append(node('h3', 'Bring an approved design to GitHub'), node('p', '1. Run the offline Windows house. In the artist conversation, connect ChatGPT, sign in and choose a plan model. 2. Discuss the artist’s home and approve a design here. 3. Export the update brief, attach it to this Codex chat and ask to update hadi1373z/house-of-ideas. After review and testing, the published city can include the new edition.'));
  const exportButton = node('button', 'Export approved GitHub update brief', 'artist-house-export'); exportButton.type = 'button'; dialog.append(exportButton);
  dialog.append(node('small', 'GitHub Pages demonstrates the city. Your connection and private conversations stay in the offline app. The exported brief contains the approved titles, reasons and exercises shown here; it excludes the conversation transcript.'));
  document.body.append(dialog);

  const design = () => Object.fromEntries(Object.entries(fields).map(([key, element]) => [key, element.value]));
  function remember() {if (boundProposalId) drafts.set(boundProposalId, design());}
  function close() {remember(); dialog.close();}
  for (const field of Object.values(fields)) {field.oninput = remember; field.onchange = remember;}
  dialog.addEventListener?.('close', remember); dialog.addEventListener?.('cancel', remember);
  function render() {
    if (!artistId) return;
    const artist = ARTISTS.find(item => item.id === artistId), archive = artistHomeArchive(getNetwork());
    const proposals = archive.proposals.filter(item => item.artistId === artistId && item.decision === 'pending');
    title.textContent = artist.name + ' · house editions';
    if (!resolvedProposalId && !proposals.some(item => item.id === proposalId)) proposalId = proposals[0]?.id ?? null;
    const placeholder = resolvedProposalId ? (() => {const option = node('option', 'Choose another pending idea'); option.value = ''; return [option];})() : [];
    pending.replaceChildren(...placeholder, ...proposals.map(item => {const option = node('option', item.title); option.value = item.id; return option;}));
    pending.value = proposalId ?? ''; pendingLabel.hidden = !proposals.length; form.hidden = !proposalId; draft.hidden = !!proposals.length;
    const proposal = proposals.find(item => item.id === proposalId);
    if (proposal?.id !== boundProposalId) {
      remember(); boundProposalId = proposal?.id ?? null;
      if (proposal) {
        const values = drafts.get(proposal.id) || proposal;
        for (const key of Object.keys(fields)) fields[key].value = values[key];
      }
    }
    if (proposalId) selectedProposals.set(artistId, proposalId);
    const own = archive.editions.filter(edition => edition.artistId === artistId);
    const visitButton = (label, id) => {const button = node('button', label); button.type = 'button'; button.onclick = () => {const host = artistId; close(); visit(host, id);}; return button;};
    editions.replaceChildren(visitButton('Original gallery house'), ...own.map(edition => visitButton('Edition ' + edition.number + ' · ' + edition.title, edition.id)));
    exportButton.disabled = !own.length || busy || isSaving();
    for (const button of [approve, decline, draft, pending, reloadButton]) button.disabled = busy || isSaving();
    reloadButton.hidden = !reloadNeeded || typeof reload !== 'function';
  }
  async function save(mutator, text) {
    if (busy || isSaving()) return;
    remember(); const host = artistId, reviewed = proposalId; busy = true; message.textContent = 'Saving house decision…'; render();
    try {
      await saveNetwork(mutator(getNetwork()));
      reloadNeeded = false;
      if (artistId === host) {
        const record = artistHomeArchive(getNetwork()).proposals.find(item => item.id === reviewed);
        if (record && record.decision !== 'pending') {remember(); resolvedProposalId = record.id; proposalId = null;}
        message.textContent = text;
      }
      notify(text);
    } catch (error) {reloadNeeded = true; message.textContent = error.message + ' Your edited design is kept. Reload saved house ideas before retrying.';}
    finally {busy = false; render();}
  }
  pending.onchange = () => {remember(); proposalId = pending.value || null; resolvedProposalId = null; if (proposalId) selectedProposals.set(artistId, proposalId); render();};
  draft.onclick = () => {
    if (busy || isSaving()) return;
    try {
      const next = proposeArtistHome(getNetwork(), artistId);
      if (!artistHomeArchive(next).proposals.some(item => item.artistId === artistId && item.decision === 'pending')) {
        message.textContent = 'This discussion already has a recorded house idea. Talk with the artist again before drafting another.'; return;
      }
      return save(() => next, 'House idea ready for your review.');
    } catch (error) {message.textContent = error.message;}
  };
  form.onsubmit = event => {event.preventDefault(); const id = proposalId, reviewed = design(); return save(network => decideArtistHome(network, id, 'approved', reviewed), 'New gallery house built. Choose its edition below to enter.');};
  decline.onclick = () => {const id = proposalId; return save(network => decideArtistHome(network, id, 'declined'), 'House idea declined and preserved in the archive.');};
  reloadButton.onclick = async () => {
    if (busy || isSaving() || typeof reload !== 'function') return;
    remember(); const host = artistId, reviewed = proposalId || resolvedProposalId; busy = true; render();
    try {
      if (await reload() === false) throw Error('Saved house ideas could not be reloaded.');
      reloadNeeded = false;
      if (host === artistId) {
        const record = artistHomeArchive(getNetwork()).proposals.find(item => item.id === reviewed);
        if (record && record.decision !== 'pending') {
          remember(); resolvedProposalId = record.id; proposalId = null;
          message.textContent = 'This idea is already ' + record.decision + ' in the saved city. Your unsent design draft is kept.';
        } else message.textContent = 'Saved house ideas reloaded. Your edited design is kept; review it before retrying.';
      }
    } catch (error) {reloadNeeded = true; message.textContent = error.message + ' Your edited design is kept.';}
    finally {busy = false; render();}
  };
  exportButton.onclick = () => {
    if (busy || isSaving()) return;
    try {
      const brief = artistImprovementBrief(getNetwork(), artistId), url = window.URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2) + '\n'], {type: 'application/json'}));
      const link = node('a'); link.href = url; link.download = 'house-of-ideas-' + artistId + '-update.json'; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      message.textContent = 'Approved update brief exported. Attach it to this Codex chat to update GitHub.';
    } catch (error) {message.textContent = error.message;}
  };
  return {show(id, editionId) {
    if (!ARTISTS.some(item => item.id === id)) throw Error('Choose a known artist house.');
    remember(); artistId = id; proposalId = selectedProposals.get(id) || null; resolvedProposalId = null; message.textContent = ''; render();
    if (editionId) {
      const edition = artistHomeArchive(getNetwork()).editions.find(item => item.id === editionId && item.artistId === id);
      if (edition) message.textContent = edition.title + '\n\n' + edition.reason + '\n\nTry this: ' + edition.exercise;
    }
    if (!dialog.open) dialog.showModal();
  }, close, render};
}
