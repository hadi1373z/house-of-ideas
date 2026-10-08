import {clone} from '../web/model.js';
import {pragueDate, reviewDay} from '../web/socrates.js';

export const DAILY_REVIEW_TIMEZONE = 'Europe/Prague';
export const DAILY_REVIEW_HOUR = 21;

function validInstant(value) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.valueOf())) throw Error('Use a valid local review time.');
  return instant;
}

// This is a pending-review transaction only. In particular, it never applies
// previously approved changes, selects a home, or visits a preserved edition.
export function reviewDueDays(neighborhood, value = new Date()) {
  const instant = validInstant(value);
  const result = clone(neighborhood), latest = result.homes.at(-1);
  if (latest.house.learning?.enabled !== true) return result;
  const today = pragueDate(instant);
  const hour = Number(new Intl.DateTimeFormat('en', {
    timeZone: DAILY_REVIEW_TIMEZONE, hour: 'numeric', hourCycle: 'h23',
  }).format(instant));
  for (const day of latest.house.learning.days) {
    if (!day.review && day.visits.length && (day.date < today || (day.date === today && hour >= DAILY_REVIEW_HOUR))) {
      latest.house = reviewDay(latest.house, day.date);
    }
  }
  return result;
}

export function createDailyReviewService({review, read, now = () => new Date(), intervalMs = 60000, schedule = setInterval, cancel = clearInterval}) {
  if (typeof review !== 'function' || typeof read !== 'function' || typeof now !== 'function' || typeof schedule !== 'function' || typeof cancel !== 'function' || !Number.isInteger(intervalMs) || intervalMs < 1) {
    throw Error('Use valid local daily-review settings.');
  }
  let timer, inFlight, stopped = false, started = false;
  let lastCheckedAt = null, lastError;
  function check() {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    const operation = (async () => {
      try {
        const instant = validInstant(now());
        lastCheckedAt = instant.toISOString();
        await review(instant);
        lastError = undefined;
      } catch {
        // Filesystem internals and authored journal contents never enter this
        // aggregate status endpoint. The next check can retry safely.
        lastError = 'The local review could not be saved. Your existing house is preserved; Socrates will retry.';
      }
    })();
    inFlight = operation;
    operation.finally(() => { if (inFlight === operation) inFlight = undefined; });
    return operation;
  }
  return {
    async start() {
      if (started || stopped) return;
      started = true;
      await check();
      if (!stopped) { timer = schedule(check, intervalMs); timer?.unref?.(); }
    },
    status() {
      const saved = read(), latest = saved.neighborhood.homes.at(-1);
      return {
        running: started && !stopped, timezone: DAILY_REVIEW_TIMEZONE, hour: DAILY_REVIEW_HOUR, mode: 'local',
        latestHomeId: latest.id, revision: saved.revision,
        pendingCount: (latest.house.learning?.days ?? []).filter(day => day.review?.status === 'pending').length,
        lastCheckedAt, ...(lastError ? {lastError} : {}),
      };
    },
    async close() {
      stopped = true;
      if (timer !== undefined) { cancel(timer); timer = undefined; }
      await inFlight;
    },
  };
}
