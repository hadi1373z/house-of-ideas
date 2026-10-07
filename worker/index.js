import {validateHouse, starter, clone} from '../web/model.js';
import {pragueDate, reviewDay, validateLearning} from '../web/socrates.js';

const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

// Sites may forward a bodyless POST as a non-null, empty stream. Reject actual
// bytes rather than the stream itself, and stop reading at the first byte.
async function hasRequestBytes(request) {
  const reader = request.body?.getReader();
  if (!reader) return false;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) return false;
      if (value?.byteLength) { await reader.cancel(); return true; }
    }
  } catch {
    return true;
  } finally {
    reader.releaseLock();
  }
}

async function readBounded(request) {
  if (Number(request.headers.get('content-length') || 0) > 1300000) throw Error('too-large');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Empty request.');
  let size = 0;
  const chunks = [];
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1300000) { await reader.cancel(); throw Error('too-large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function load(db, user) {
  return db.prepare('SELECT document, revision FROM houses WHERE user_id = ?').bind(user).first();
}

async function save(db, user, house, revision) {
  return db.prepare('INSERT INTO houses (user_id, document, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET document = excluded.document, revision = houses.revision + 1, updated_at = excluded.updated_at WHERE houses.revision = ? RETURNING revision')
    .bind(user, JSON.stringify(house), new Date().toISOString(), revision).first();
}

function earliestReviewDate(today) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 365);
  return date.toISOString().slice(0, 10);
}

// Queued proposals are an independent snapshot. A user's saved decision always
// wins, and reading the queue never increments or overwrites a house revision.
export function mergeQueuedReviews(house, rows, today = pragueDate()) {
  if (house.learning?.enabled !== true) return house;
  const result = clone(house);
  const earliest = earliestReviewDate(today);
  for (const row of rows) {
    if (row.review_date < earliest || row.review_date > today) continue;
    let queued;
    try {
      queued = JSON.parse(row.proposal);
      const normalized = validateLearning({version: 1, enabled: true, days: [queued]}, result).days[0];
      if (normalized.date !== row.review_date || normalized.review?.status !== 'pending') continue;
      queued = normalized;
    } catch {
      console.error('Skipped an invalid daily proposal snapshot.');
      continue;
    }
    const current = result.learning.days.find(day => day.date === queued.date);
    if (current?.review) continue;
    if (current) {
      // Preserve reflections edited after the evening snapshot. The proposal
      // carries its own original evidence and needs its reviewed room in visits.
      if (!current.visits.includes(queued.review.roomId)) {
        if (current.visits.length >= 16) continue;
        current.visits.push(queued.review.roomId);
      }
      current.review = clone(queued.review);
    } else if (result.learning.days.length < 366) {
      result.learning.days.push(clone(queued));
    }
  }
  result.learning.days.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

async function readUserQueue(db, user, today) {
  const result = await db.prepare('SELECT review_date, proposal FROM review_proposals WHERE user_id = ? AND review_date >= ? AND review_date <= ? ORDER BY review_date')
    .bind(user, earliestReviewDate(today), today).all();
  return result.results || [];
}

async function dailyInputs(db, today) {
  const [houses, proposals] = await Promise.all([
    db.prepare('SELECT user_id, document FROM houses').all(),
    db.prepare('SELECT user_id, proposal FROM review_proposals WHERE review_date = ?').bind(today).all(),
  ]);
  return {houses: houses.results || [], queued: new Map((proposals.results || []).map(row => [row.user_id, row.proposal]))};
}

// Internal date injection permits isolated clock tests. The public route never
// accepts a date, user ID, decision, house, or action in the request.
export async function runDailyReview(db, today = pragueDate()) {
  const {houses, queued} = await dailyInputs(db, today);
  const counts = {date: today, enrolled: 0, created: 0, existing: 0, noActivity: 0, revoked: 0, invalid: 0};
  for (const row of houses) {
    let house;
    try { house = JSON.parse(row.document); } catch { counts.invalid++; continue; }
    if (house.learning?.enabled !== true) continue;
    counts.enrolled++;
    const recorded = house.learning.days?.find(day => day.date === today);
    if (queued.has(row.user_id) || recorded?.review) { counts.existing++; continue; }
    let proposal;
    try {
      const reviewed = reviewDay(clone(house), today);
      proposal = reviewed.learning.days.find(day => day.date === today);
      if (proposal?.review?.status !== 'pending') { counts.noActivity++; continue; }
    } catch {
      counts.invalid++;
      console.error('Skipped a house with invalid daily learning records.');
      continue;
    }
    // Recheck enrollment in the same statement as insertion. Nightly service
    // work cannot change the house document or approve/apply this proposal.
    const saved = await db.prepare('INSERT INTO review_proposals (user_id, review_date, proposal, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM houses WHERE user_id = ? AND json_extract(document, \'$.learning.enabled\') = 1) ON CONFLICT(user_id, review_date) DO NOTHING RETURNING review_date')
      .bind(row.user_id, today, JSON.stringify(proposal), new Date().toISOString(), row.user_id).first();
    if (saved) counts.created++;
    else {
      const existing = await db.prepare('SELECT review_date FROM review_proposals WHERE user_id = ? AND review_date = ?').bind(row.user_id, today).first();
      if (existing) counts.existing++;
      else counts.revoked++;
    }
  }
  // This real operational receipt makes a successful run observable even when
  // no one has enrolled yet. It contains only date, aggregate counts and time.
  const completedAt = new Date().toISOString();
  const receipt = await db.prepare('INSERT INTO review_runs (review_date, summary, completed_at) VALUES (?, ?, ?) ON CONFLICT(review_date) DO UPDATE SET summary = excluded.summary, completed_at = excluded.completed_at RETURNING completed_at')
    .bind(today, JSON.stringify(counts), completedAt).first();
  if (!receipt) throw Error('The evening review run receipt could not be saved.');
  return {...counts, completedAt: receipt.completed_at};
}

export async function dailyReviewStatus(db, today = pragueDate()) {
  const {houses, queued} = await dailyInputs(db, today);
  const counts = {date: today, enrolled: 0, queued: 0, pending: 0, decided: 0, noActivity: 0, invalid: 0};
  for (const row of houses) {
    let house;
    try { house = JSON.parse(row.document); } catch { counts.invalid++; continue; }
    if (house.learning?.enabled !== true) continue;
    counts.enrolled++;
    if (queued.has(row.user_id)) counts.queued++;
    const day = house.learning.days?.find(value => value.date === today);
    const review = day?.review || (queued.has(row.user_id) ? JSON.parse(queued.get(row.user_id)).review : undefined);
    if (review?.status === 'pending') counts.pending++;
    else if (review) counts.decided++;
    else counts.noActivity++;
  }
  // Keep yesterday's last completed run visible on the next morning as well.
  const receipt = await db.prepare('SELECT summary, completed_at FROM review_runs ORDER BY completed_at DESC, review_date DESC LIMIT 1').first();
  const lastRun = receipt ? {...JSON.parse(receipt.summary), completedAt: receipt.completed_at} : null;
  return {...counts, lastRun};
}

export default {async fetch(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!env.DB) return json({error: 'Your house storage is unavailable. Please try again.'}, 503);

  // PRIVATE SITE SERVICE ACCESS: Sites dispatch verifies and consumes the
  // OAI-Sites-Authorization credential before forwarding this request. These
  // shared endpoints rely on the confirmed owner-private hosting boundary, not
  // a fabricated visitor identity. Disable them before widening Site access.
  // Browser-originated requests are excluded; service routes never make user
  // decisions and expose only aggregate counts, never IDs or idea contents.
  const serviceRoute = url.pathname === '/api/review/run' || url.pathname === '/api/review/status';
  if (serviceRoute) {
    if (request.headers.has('origin') || request.headers.has('oai-authenticated-user-id')) return json({error: 'Use the private evening review service.'}, 403);
    if (url.search || await hasRequestBytes(request)) return json({error: 'The evening review service takes no request data.'}, 400);
    const method = url.pathname.endsWith('/run') ? 'POST' : 'GET';
    if (request.method !== method) return json({error: 'Method not allowed.'}, 405);
    try {
      const today = pragueDate();
      return json(method === 'POST' ? await runDailyReview(env.DB, today) : await dailyReviewStatus(env.DB, today));
    } catch (error) {
      console.error('Evening review storage error', error);
      return json({error: 'The evening review could not be saved. It can be retried safely.'}, 503);
    }
  }

  const user = request.headers.get('oai-authenticated-user-id');
  if (!user) return json({error: 'Sign in to open your house.'}, 401);
  if (url.pathname !== '/api/house') return json({error: 'Not found.'}, 404);
  try {
    if (request.method === 'GET') {
      const row = await load(env.DB, user);
      const house = row ? JSON.parse(row.document) : starter();
      const queue = house.learning?.enabled === true ? await readUserQueue(env.DB, user, pragueDate()) : [];
      return json({house: mergeQueuedReviews(house, queue), revision: row?.revision || 0});
    }
    if (request.method === 'PUT') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({error: 'Save from this house.'}, 403);
      let data, house;
      try {
        data = await readBounded(request);
        if (!Number.isInteger(data.revision) || data.revision < 0) throw Error('Invalid revision.');
        house = validateHouse(data.house);
      } catch (error) {
        return json({error: error.message === 'too-large' ? 'Your house data is too large.' : error.message}, error.message === 'too-large' ? 413 : 400);
      }
      const row = await save(env.DB, user, house, data.revision);
      if (!row) return json({error: 'This house changed in another tab. Your draft is still here. Reload before making further changes.'}, 409);
      return json({revision: row.revision});
    }
    return json({error: 'Method not allowed.'}, 405);
  } catch (error) {
    console.error('House storage error', error);
    return json({error: 'Could not load or save the house. Your draft is still here; please try again.'}, 503);
  }
}};
