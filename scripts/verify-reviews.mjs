import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import worker, {runDailyReview, dailyReviewStatus, mergeQueuedReviews} from '../worker/index.js';
import {starter, clone} from '../web/model.js';
import {pragueDate, previousDate, visitRoom, decideReview, applyApproved} from '../web/socrates.js';

const sql = new DatabaseSync(':memory:');
for (const file of (await fs.readdir('drizzle')).filter(file => file.endsWith('.sql')).sort()) {
  sql.exec(await fs.readFile(`drizzle/${file}`, 'utf8'));
}
const DB = {prepare(query) {
  const queryFor = params => ({
    async first() { return sql.prepare(query).get(...params) || null; },
    async all() { return {results: sql.prepare(query).all(...params)}; },
  });
  return {...queryFor([]), bind(...params) { return queryFor(params); }};
}};
const env = {DB, ASSETS: {fetch: () => new Response('asset')}};
const today = pragueDate();
const yesterday = previousDate(today);
const enrolled = (room, date) => {
  const house = visitRoom(starter(), date, room);
  house.learning.enabled = true;
  return house;
};
let first = enrolled('math', yesterday);
first = visitRoom(first, today, 'art');
const second = enrolled('work', today);
const disabled = visitRoom(starter(), today, 'questions');
const idle = starter();
idle.learning = {version: 1, enabled: true, days: []};
const insert = sql.prepare('INSERT INTO houses (user_id, document, revision, updated_at) VALUES (?, ?, 1, ?)');
for (const [user, house] of [['owner-one', first], ['owner-two', second], ['disabled', disabled], ['idle', idle]]) {
  insert.run(user, JSON.stringify(house), 'isolated-fixture');
}
const baseline = JSON.stringify(sql.prepare('SELECT * FROM houses ORDER BY user_id').all());
assert.equal((await dailyReviewStatus(DB, today)).lastRun, null);

let result = await runDailyReview(DB, yesterday);
assert.equal(result.created, 1);
assert.equal(result.enrolled, 3);
assert.equal(result.noActivity, 2);
result = await runDailyReview(DB, today);
assert.equal(result.created, 2);
assert.equal(result.enrolled, 3);
assert.equal(result.noActivity, 1);
result = await runDailyReview(DB, today);
assert.equal(result.created, 0);
assert.equal(result.existing, 2);
assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM review_proposals').get().count, 3);
assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM review_runs').get().count, 2, 'Each date has one latest operational receipt.');
let receipt = await dailyReviewStatus(DB, today);
assert.deepEqual(receipt.lastRun, result, 'Status reads the actual stored successful-run aggregate.');
assert.ok(Number.isFinite(new Date(receipt.lastRun.completedAt).valueOf()));
assert.equal(sql.prepare('SELECT summary FROM review_runs WHERE review_date = ?').get(today).summary.includes('owner-one'), false);
assert.equal(JSON.stringify(sql.prepare('SELECT * FROM houses ORDER BY user_id').all()), baseline, 'Service never writes house content or revisions.');
assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM review_proposals WHERE user_id = ?').get('disabled').count, 0);

const request = (path, method = 'GET', {user, body, headers = {}} = {}) => new Request(`https://house.test${path}`, {
  method, headers: {...headers, ...(user ? {'oai-authenticated-user-id': user} : {})},
  ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
});
let response = await worker.fetch(request('/api/review/run', 'POST'), env);
assert.equal(response.status, 200);
let summary = await response.json();
assert.equal(summary.created, 0);
assert.equal(summary.existing, 2);
const emptyStreamPost = new Request('https://house.test/api/review/run', {method: 'POST', body: ''});
assert.notEqual(emptyStreamPost.body, null, 'Regression fixture matches the Sites bridge empty POST stream.');
response = await worker.fetch(emptyStreamPost, env);
assert.equal(response.status, 200, 'An empty stream carries no service request data.');
summary = await response.json();
assert.equal(summary.created, 0);
assert.equal(summary.existing, 2);
const serviceRun = summary;
assert.equal(JSON.stringify(summary).includes('owner-one'), false);
assert.equal(JSON.stringify(summary).includes('Mathematics'), false);
assert.equal((await worker.fetch(request('/api/review/run?date=2099-01-01', 'POST'), env)).status, 400);
assert.equal((await worker.fetch(request('/api/review/run', 'POST', {body: {user: 'owner-one', approve: true}}), env)).status, 400);
assert.equal((await worker.fetch(new Request('https://house.test/api/review/run', {method: 'POST', body: ' '}), env)).status, 400, 'Even whitespace is actual request data.');
assert.equal((await worker.fetch(request('/api/review/run', 'POST', {headers: {origin: 'https://house.test'}}), env)).status, 403);
assert.equal((await worker.fetch(request('/api/review/run', 'POST', {user: 'owner-one'}), env)).status, 403);
assert.equal((await worker.fetch(request('/api/review/run'), env)).status, 405);
summary = await (await worker.fetch(request('/api/review/status'), env)).json();
assert.equal(summary.queued, 2);
assert.equal(summary.pending, 2);
assert.deepEqual(summary.lastRun, serviceRun, 'Service readback confirms the receipt written by its actual run.');
assert.equal((await worker.fetch(request('/api/house'), env)).status, 401);

response = await worker.fetch(request('/api/house', 'GET', {user: 'owner-one'}), env);
let loaded = await response.json();
assert.equal(loaded.revision, 1);
assert.equal(loaded.house.ideas.length, 0);
assert.equal(loaded.house.learning.days.find(day => day.date === yesterday).review.status, 'pending');
assert.equal(loaded.house.learning.days.find(day => day.date === today).review.roomId, 'art');
assert.equal(JSON.stringify(sql.prepare('SELECT * FROM houses ORDER BY user_id').all()), baseline, 'Reading the queue never saves or applies it.');
const another = await (await worker.fetch(request('/api/house', 'GET', {user: 'owner-two'}), env)).json();
assert.equal(another.house.learning.days.length, 1);
assert.equal(another.house.learning.days[0].review.roomId, 'work');

const approved = applyApproved(decideReview(loaded.house, `socrates-${yesterday}`, 'approve', today), today);
assert.equal(approved.ideas.length, 1);
assert.equal((await worker.fetch(request('/api/house', 'PUT', {user: 'owner-one', body: {house: approved, revision: loaded.revision}}), env)).status, 200);
assert.equal((await worker.fetch(request('/api/house', 'PUT', {user: 'owner-one', body: {house: loaded.house, revision: loaded.revision}}), env)).status, 409);
loaded = await (await worker.fetch(request('/api/house', 'GET', {user: 'owner-one'}), env)).json();
assert.equal(loaded.revision, 2);
assert.equal(loaded.house.learning.days.find(day => day.date === yesterday).review.status, 'applied', 'Queued pending snapshot cannot undo a saved decision.');
assert.equal(loaded.house.ideas.length, 1);

// Preserve reflections written after the evening snapshot, including a saved
// decline. Queue evidence stays frozen and is never a replacement document.
const queued = sql.prepare('SELECT review_date, proposal FROM review_proposals WHERE user_id = ? ORDER BY review_date').all('owner-one');
const changed = clone(first);
changed.learning.days.find(day => day.date === today).reflections.push({roomId: 'art', answer: 'My newer reflection.'});
const merged = mergeQueuedReviews(changed, queued, today);
assert.equal(merged.learning.days.find(day => day.date === today).reflections[0].answer, 'My newer reflection.');
const declined = decideReview(merged, `socrates-${yesterday}`, 'decline', today);
assert.equal(mergeQueuedReviews(declined, queued, today).learning.days.find(day => day.date === yesterday).review.status, 'declined');
const off = clone(second);
off.learning.enabled = false;
assert.deepEqual(mergeQueuedReviews(off, queued, today), off);
sql.prepare('UPDATE houses SET document = ? WHERE user_id = ?').run(JSON.stringify(off), 'owner-two');
const offLoaded = await (await worker.fetch(request('/api/house', 'GET', {user: 'owner-two'}), env)).json();
assert.equal(offLoaded.house.learning.days[0].review, undefined, 'Revoked enrollment excludes queued proposals.');
assert.equal((await dailyReviewStatus(DB, today)).enrolled, 2);

// Enrollment is rechecked during the insert, so an opt-out between the read and
// write cannot create a new proposal. This fixture stays in the in-memory DB.
const raceUser = 'revoked-during-run';
insert.run(raceUser, JSON.stringify(enrolled('learning', today)), 'isolated-fixture');
let revoked = false;
const racingDB = {prepare(query) {
  const prepared = DB.prepare(query);
  if (!query.startsWith('INSERT INTO review_proposals')) return prepared;
  return {bind(...params) {
    if (params[0] === raceUser && !revoked) {
      const no = enrolled('learning', today);
      no.learning.enabled = false;
      sql.prepare('UPDATE houses SET document = ? WHERE user_id = ?').run(JSON.stringify(no), raceUser);
      revoked = true;
    }
    return prepared.bind(...params);
  }};
}};
result = await runDailyReview(racingDB, today);
assert.equal(result.revoked, 1);
assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM review_proposals WHERE user_id = ?').get(raceUser).count, 0);

// An actual empty installation still saves a useful run receipt, without any
// synthetic user, activity, proposal, house content or house revision changes.
const empty = new DatabaseSync(':memory:');
for (const file of (await fs.readdir('drizzle')).filter(file => file.endsWith('.sql')).sort()) empty.exec(await fs.readFile(`drizzle/${file}`, 'utf8'));
const emptyDB = {prepare(query) {
  const methods = params => ({
    async first() { return empty.prepare(query).get(...params) || null; },
    async all() { return {results: empty.prepare(query).all(...params)}; },
  });
  return {...methods([]), bind(...params) { return methods(params); }};
}};
const emptyResult = await runDailyReview(emptyDB, today);
assert.equal(emptyResult.enrolled, 0);
assert.equal(emptyResult.created, 0);
assert.deepEqual((await dailyReviewStatus(emptyDB, today)).lastRun, emptyResult);
assert.equal(empty.prepare('SELECT COUNT(*) AS count FROM houses').get().count, 0);
assert.equal(empty.prepare('SELECT COUNT(*) AS count FROM review_proposals').get().count, 0);
assert.equal(empty.prepare('SELECT COUNT(*) AS count FROM review_runs').get().count, 1);
console.log('Verified isolated daily queue: idempotent proposals and real aggregate run receipts, no service house writes, opt-out race, body/date rejection, user isolation, preserved decisions/reflections, authenticated approval and stale revision rejection.');
