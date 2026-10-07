// A local, deterministic Socratic guide. These prompts are not historical quotes
// or AI-generated judgments. No service is called and no house changes silently.
const clone = value => JSON.parse(JSON.stringify(value));
const LIMIT_DAYS = 366;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(value);
const STATUSES = ['pending', 'approved', 'declined', 'applied'];

export function pragueDate(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const part = type => parts.find(value => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Use a calendar date in YYYY-MM-DD format.');
  const instant = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(instant.valueOf()) || instant.toISOString().slice(0, 10) !== value) throw Error('Use a real calendar date.');
  return value;
}

export function nextDate(date) {
  dateValue(date);
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + 1);
  return instant.toISOString().slice(0, 10);
}

export function previousDate(date) {
  dateValue(date);
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() - 1);
  return instant.toISOString().slice(0, 10);
}

function notFuture(value) {
  dateValue(value);
  if (value > pragueDate()) throw Error('Learning activity cannot be recorded in the future.');
  return value;
}

function string(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw Error(`${label} must have ${min}–${max} characters.`);
  return value.trim();
}

// Historical room references deliberately survive renames, moves and deletion.
// Only a fresh visit/reflection requires a room that exists in the current house.
export function validateLearning(input, house) {
  if (input === undefined) return {version: 1, enabled: false, days: []};
  if (!input || input.version !== 1 || !Array.isArray(input.days) || input.days.length > LIMIT_DAYS) throw Error(`Learning records support version 1 and up to ${LIMIT_DAYS} days.`);
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') throw Error('Choose whether guided learning is enabled.');
  const dates = new Set();
  const days = input.days.map(day => {
    if (!day || typeof day !== 'object') throw Error('Each learning day needs a record.');
    const date = notFuture(day.date);
    if (dates.has(date)) throw Error('Each learning date must be unique.');
    dates.add(date);
    if (!Array.isArray(day.visits) || day.visits.length > 16 || day.visits.some(id => !validId(id)) || new Set(day.visits).size !== day.visits.length) throw Error('Record up to 16 different room visits per day.');
    if (!Array.isArray(day.reflections) || day.reflections.length > 16) throw Error('Record up to 16 room reflections per day.');
    const reflected = new Set();
    const reflections = day.reflections.map(item => {
      if (!item || !validId(item.roomId) || reflected.has(item.roomId) || !day.visits.includes(item.roomId)) throw Error('Each reflection belongs to a different room visited that day.');
      reflected.add(item.roomId);
      return {roomId: item.roomId, answer: string(item.answer, 1, 1200, 'A reflection')};
    });
    const record = {date, visits: [...day.visits], reflections};
    if (day.review === undefined || day.review === null) return record;
    const review = day.review;
    if (!review || review.id !== `socrates-${date}` || review.forDate !== nextDate(date) || !STATUSES.includes(review.status) || !validId(review.roomId) || !day.visits.includes(review.roomId)) throw Error('A daily review needs its date, room and valid decision status.');
    const roomName = string(review.roomName, 1, 60, 'The reviewed room name');
    const title = string(review.title, 1, 100, 'The proposal title');
    const reason = string(review.reason, 1, 1800, 'The proposal reason');
    const question = string(review.question, 1, 1000, 'The proposal question');
    const exercise = string(review.exercise, 1, 1800, 'The next learning exercise');
    const evidence = review.evidence;
    if (!evidence || !Number.isInteger(evidence.ideaCount) || evidence.ideaCount < 0 || evidence.ideaCount > 12 || !Array.isArray(evidence.ideaTitles) || evidence.ideaTitles.length > 12) throw Error('A review needs a bounded snapshot of its evidence.');
    const ideaTitles = evidence.ideaTitles.map(item => string(item, 1, 100, 'An evidence title'));
    if (ideaTitles.length !== evidence.ideaCount) throw Error('The idea evidence count must match its title snapshot.');
    const reflection = string(evidence.reflection, 0, 1200, 'The reflected evidence');
    const action = review.action;
    if (!action || action.type !== 'add_learning_idea' || action.ideaId !== `socratic-${date}` || action.cue !== 'book') throw Error('A proposal can only add its own learning book.');
    const normalized = {
      id: review.id, forDate: review.forDate, status: review.status,
      roomId: review.roomId, roomName, title, reason, question, exercise,
      evidence: {ideaCount: evidence.ideaCount, ideaTitles, reflection},
      action: {
        type: 'add_learning_idea', ideaId: action.ideaId,
        title: string(action.title, 1, 100, 'The learning book title'),
        text: string(action.text, 1, 6000, 'The learning book notes'), cue: 'book',
      },
    };
    if (review.status !== 'pending') {
      normalized.decidedOn = notFuture(review.decidedOn);
      if (normalized.decidedOn < review.forDate) throw Error('Confirm a proposal when you return on or after its next day.');
    } else if (review.decidedOn !== undefined || review.appliedOn !== undefined) throw Error('A pending proposal cannot have a decision or application date.');
    if (review.status === 'applied') {
      normalized.appliedOn = notFuture(review.appliedOn);
      if (normalized.appliedOn < normalized.decidedOn) throw Error('An improvement must follow its approval.');
    } else if (review.appliedOn !== undefined) throw Error('Only an applied proposal has an application date.');
    if (review.resolution !== undefined) normalized.resolution = string(review.resolution, 1, 400, 'The proposal resolution');
    record.review = normalized;
    return record;
  });
  return {version: 1, enabled: input.enabled === true, days: days.sort((a, b) => a.date.localeCompare(b.date))};
}

function workingHouse(house) {
  if (!house || !Array.isArray(house.rooms) || !Array.isArray(house.ideas)) throw Error('Learning needs a valid house.');
  const result = clone(house);
  result.learning = validateLearning(house.learning, house);
  return result;
}

function dayRecord(house, date, create = true) {
  notFuture(date);
  let day = house.learning.days.find(item => item.date === date);
  if (!day && create) {
    if (house.learning.days.length >= LIMIT_DAYS) throw Error('The learning journal is full. Export it before starting a fresh journal.');
    day = {date, visits: [], reflections: []};
    house.learning.days.push(day);
    house.learning.days.sort((a, b) => a.date.localeCompare(b.date));
  }
  return day;
}

function roomById(house, id) {
  const room = house.rooms.find(item => item.id === id);
  if (!room) throw Error('Choose a room that is still in the house.');
  return room;
}

export function visitRoom(house, date = pragueDate(), roomId) {
  const result = workingHouse(house);
  roomById(result, roomId);
  const day = dayRecord(result, date);
  if (!day.visits.includes(roomId)) {
    if (day.visits.length >= 16) throw Error('A learning day can record up to 16 room visits.');
    day.visits.push(roomId);
  }
  return result;
}

export function reflect(house, date = pragueDate(), roomId, text) {
  const result = visitRoom(house, date, roomId);
  const day = dayRecord(result, date);
  const answer = string(text, 1, 1200, 'A reflection');
  const existing = day.reflections.find(item => item.roomId === roomId);
  if (existing) existing.answer = answer;
  else day.reflections.push({roomId, answer});
  // A published end-of-day review remains a snapshot even if notes change later.
  return result;
}

const LESSONS = {
  math: {
    title: 'Learn by finding an example and a counterexample',
    concept: 'A mathematical claim becomes clearer when you identify its assumptions and test its limits.',
    question: 'Which assumption does your claim depend on, and what happens if you remove it?',
    exercise: 'Choose one claim. Write a small example where it works, then look for a counterexample. Explain which assumption makes the difference.',
  },
  art: {
    title: 'Learn by changing one creative choice',
    concept: 'Comparing two deliberate alternatives helps you see what a creative choice contributes.',
    question: 'What does your choice help someone notice, and what would a different choice reveal?',
    exercise: 'Choose a visual or creative idea. Make two small versions that differ in one choice. Describe what each version makes you notice.',
  },
  work: {
    title: 'Learn by running the smallest useful test',
    concept: 'A small finished experiment teaches more than a large plan with no observable result.',
    question: 'What is the smallest action that would give you evidence this idea helps?',
    exercise: 'Choose a project idea. Define a ten-minute experiment, its expected result and one way to check whether it worked. Record the result.',
  },
  questions: {
    title: 'Learn by making an uncertainty precise',
    concept: 'A useful question names what is unknown and what evidence could settle it.',
    question: 'What exactly do you not know, and what observation would change your answer?',
    exercise: 'Rewrite an open question so it can be investigated. Name one possible answer, one alternative and the evidence that would distinguish them.',
  },
  learning: {
    title: 'Learn by teaching an idea from memory',
    concept: 'Trying to explain without looking exposes the gaps that rereading can hide.',
    question: 'Can you explain this in your own words and give an example without looking at the note?',
    exercise: 'Read one idea, then close the note. Explain it in three sentences from memory, give an example and reopen the note to check what you missed.',
  },
  connections: {
    title: 'Learn by building a bridge between rooms',
    concept: 'A useful connection explains a shared relationship rather than only a surface similarity.',
    question: 'What relationship connects these two ideas, and where does that relationship stop working?',
    exercise: 'Choose ideas from two different rooms. Describe their shared pattern, one useful transfer and one important difference.',
  },
};

export function lesson(room) {
  const selected = Object.hasOwn(LESSONS, room.id) ? LESSONS[room.id] : LESSONS.learning;
  return {...selected, roomId: room.id, roomName: room.name};
}

export function critique(room, house) {
  const notes = house.ideas.filter(item => item.roomId === room.id);
  const selected = lesson(room);
  const unfinished = notes.find(item => !item.text.trim());
  if (!notes.length) return {
    ...selected, method: 'Local guided questions',
    observation: `${room.name} has no idea objects yet. Its purpose is: ${room.purpose}`,
    question: `What is one example that belongs in ${room.name}, and why does it belong here?`,
    exercise: 'Write one idea in your own words. Add an example and one question you still have about it.',
  };
  if (unfinished) return {
    ...selected, method: 'Local guided questions', ideaId: unfinished.id,
    observation: `“${unfinished.title}” has a title but no explanation in its notes.`,
    question: `What does “${unfinished.title}” mean, and what example would help someone understand it?`,
    exercise: 'Explain the idea in three sentences, give one concrete example and name one assumption you are making.',
  };
  return {
    ...selected, method: 'Local guided questions', ideaId: notes[0].id,
    observation: `You have ${notes.length} idea${notes.length === 1 ? '' : 's'} in ${room.name}. Use “${notes[0].title}” as the starting point.`,
  };
}

function truncate(value, length) {
  return value.length <= length ? value : `${value.slice(0, length - 1).trimEnd()}…`;
}

export function reviewDay(house, date = pragueDate()) {
  const result = workingHouse(house);
  const day = dayRecord(result, date, false);
  if (!day || day.review || !day.visits.length) return result;
  const visited = day.visits.map(id => result.rooms.find(room => room.id === id)).filter(Boolean);
  if (!visited.length) return result;
  // First address a visited room without a written reflection. If all have one,
  // challenge the room most recently explored. Both choices use recorded activity.
  const room = visited.find(item => !day.reflections.some(note => note.roomId === item.id)) || visited.at(-1);
  const notes = result.ideas.filter(item => item.roomId === room.id);
  const reflection = day.reflections.find(item => item.roomId === room.id)?.answer || '';
  const guidance = critique(room, result);
  const unfinished = notes.find(item => !item.text.trim());
  let title, reason, question, exercise;
  if (!notes.length) {
    title = `Give ${room.name} its first learning anchor`;
    reason = `You explored ${room.name} on ${date}, but it has no idea objects to revisit. A first example will make this room easier to learn from.`;
    question = guidance.question;
    exercise = guidance.exercise;
  } else if (unfinished) {
    title = `Turn “${unfinished.title}” into an explanation`;
    reason = `You explored ${room.name} on ${date}. “${unfinished.title}” has no written explanation, so there is no reasoning to test or recall yet.`;
    question = guidance.question;
    exercise = guidance.exercise;
  } else if (!reflection) {
    title = `Add a recall challenge to ${room.name}`;
    reason = `You explored ${room.name} on ${date} and it has ${notes.length} written idea${notes.length === 1 ? '' : 's'}, but you have not recorded what you learned there.`;
    question = lesson(room).question;
    exercise = `${lesson(room).exercise} Save what surprised you as a reflection in this room.`;
  } else {
    title = `Test your explanation in ${room.name}`;
    reason = `You explored ${room.name} on ${date} and wrote: “${truncate(reflection, 500)}” A test can show whether this explanation holds up.`;
    question = `What evidence would support or challenge your reflection: “${truncate(reflection, 400)}”?`;
    exercise = `${lesson(room).exercise} Compare the result with your previous reflection and record what changed.`;
  }
  const bookTitle = truncate(`Socratic exercise: ${room.name}`, 100);
  const bookText = `Observed on ${date}\n${reason}\n\nQuestion\n${question}\n\nNext learning exercise\n${exercise}\n\nThis exercise was proposed by the house's local Socratic guide. You chose whether to add it.`;
  day.review = {
    id: `socrates-${date}`, forDate: nextDate(date), status: 'pending',
    roomId: room.id, roomName: room.name,
    title: truncate(title, 100), reason, question, exercise,
    evidence: {ideaCount: notes.length, ideaTitles: notes.map(item => item.title), reflection},
    action: {type: 'add_learning_idea', ideaId: `socratic-${date}`, title: bookTitle, text: bookText, cue: 'book'},
  };
  return result;
}

export function pendingReview(house, today = pragueDate()) {
  notFuture(today);
  const learning = validateLearning(house.learning, house);
  const review = learning.days.map(day => day.review).find(item => item?.status === 'pending' && item.forDate <= today);
  return review ? clone(review) : null;
}

export function decideReview(house, id, decision, today = pragueDate()) {
  notFuture(today);
  const status = decision === 'approve' || decision === 'approved' ? 'approved'
    : decision === 'decline' || decision === 'declined' ? 'declined' : null;
  if (!status) throw Error('Choose approve or decline for the proposal.');
  const result = workingHouse(house);
  const review = result.learning.days.map(day => day.review).find(item => item?.id === id);
  if (!review) throw Error('That daily proposal was not found.');
  if (today < review.forDate) throw Error('Confirm this proposal when you return on or after its next day.');
  if (review.status !== 'pending') {
    if (review.status === status || (review.status === 'applied' && status === 'approved')) return result;
    throw Error('This proposal already has a decision.');
  }
  review.status = status;
  review.decidedOn = today;
  if (status === 'declined') review.resolution = 'You declined this proposal. The house was not changed.';
  return result;
}

export function applyApproved(house, today = pragueDate()) {
  notFuture(today);
  const result = workingHouse(house);
  for (const day of result.learning.days) {
    const review = day.review;
    if (review?.status !== 'approved' || review.forDate > today || review.decidedOn > today) continue;
    const room = result.rooms.find(item => item.id === review.roomId);
    const existing = result.ideas.find(item => item.id === review.action.ideaId);
    let problem = '';
    if (!room) problem = 'The reviewed room was removed. Choose a new exercise during your next room visit.';
    else if (existing) problem = 'An idea already uses this proposal’s identifier. The house was not changed.';
    else if (result.ideas.length >= 192 || result.ideas.filter(item => item.roomId === room.id).length >= 12) problem = 'The reviewed room has reached its idea capacity. Make space before a future exercise.';
    if (problem) {
      review.status = 'declined';
      review.resolution = problem;
      continue;
    }
    result.ideas.push({
      id: review.action.ideaId, roomId: room.id,
      title: review.action.title, text: review.action.text, cue: 'book',
    });
    review.status = 'applied';
    review.appliedOn = today;
    review.resolution = `Your approved learning book was added to ${room.name}.`;
  }
  return result;
}
