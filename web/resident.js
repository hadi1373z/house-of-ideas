// Persistent, local Socratic dialogue. This module has no network/model calls.
// Optional model replies are data validated into the same approval-only actions.
const clone = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(value);
const LIMITS = {messages: 80, observations: 40, proposals: 48, pending: 12, features: 64};
export const FEATURES = ['discussion_circle', 'question_board', 'reflection_lamp', 'experiment_table'];
export const CONCEPTS = {
  clarify: {title: 'Clarify the claim', description: 'Ask what a word or claim means before deciding whether it is true.'},
  assumptions: {title: 'Examine assumptions', description: 'Make the beliefs supporting a claim visible so they can be questioned.'},
  evidence: {title: 'Ask for reasons', description: 'Distinguish a belief from the observations and reasons that support it.'},
  counterexample: {title: 'Test a counterexample', description: 'Elenchus: test a claim against a case that might reveal a contradiction.'},
  perspective: {title: 'Try another perspective', description: 'Invite an alternative account before treating your first explanation as complete.'},
  examined_life: {title: 'An examined life', description: 'Connect what you believe with the choices, habits and values you want to live by.'},
};
const PERSONA = {
  name: 'Socrates', role: 'Resident philosopher and constructive critic',
  goals: ['Help you explain ideas clearly.', 'Question assumptions with care.', 'Ask whether a room serves the life you want to live.', 'Turn reflection into small, approved improvements to this house.'],
  character: 'Curious, patient, candid, attentive to rest and conversation, and willing to revise an earlier judgment.',
};
const FEATURE_COPY = {
  question_board: {name: 'question board', title: 'Give this room a question board', practice: 'Put a claim, its meaning, and one open question on the board.'},
  discussion_circle: {name: 'discussion circle', title: 'Make a place for two perspectives', practice: 'Take the two seats in turn: explain your view, then make the strongest case for an alternative.'},
  reflection_lamp: {name: 'reflection lamp', title: 'Create a quiet reflection corner', practice: 'Pause by the lamp after exploring. Write what changed your mind and what remains uncertain.'},
  experiment_table: {name: 'experiment table', title: 'Give this room a place to test ideas', practice: 'At the table, write a prediction, try a small example, and compare what happened with your claim.'},
};

function text(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw Error(`${label} must have ${min}–${max} characters.`);
  return value.trim();
}
function id(value, label) {
  if (!validId(value)) throw Error(`${label} needs a valid identifier.`);
  return value;
}
function timestamp(value) {
  if (!(value instanceof Date) && (typeof value !== 'string' || value.length > 40)) throw Error('Use a valid timestamp.');
  const instant = new Date(value);
  if (!Number.isFinite(instant.valueOf())) throw Error('Use a valid timestamp.');
  return instant.toISOString();
}
const nowAt = options => timestamp(options?.now || new Date());
function array(value, max, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw Error(`${label} supports up to ${max} entries.`);
  return value;
}
function unique(values, label) {
  if (new Set(values).size !== values.length) throw Error(`${label} must have unique identifiers.`);
}
const truncate = (value, max) => value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

export function createResident() {
  return {
    version: 1, persona: clone(PERSONA), nextId: 1,
    preferences: {pace: 'gentle', focus: 'clarity'},
    messages: [], observations: [], proposals: [], roomFeatures: [],
    memory: {values: [], openQuestions: [], lastConcept: 'clarify', lastRoomId: null, rooms: []},
  };
}

function normalizeAction(action, roomId) {
  if (!action || typeof action !== 'object' || action.roomId !== roomId) throw Error('A proposal action must belong to its reviewed room.');
  if (action.type === 'add_room_feature') {
    if (!FEATURES.includes(action.feature)) throw Error('Choose one of the four safe room features.');
    return {type: 'add_room_feature', roomId, feature: action.feature, featureId: id(action.featureId, 'The feature')};
  }
  if (action.type === 'add_learning_idea') return {
    type: 'add_learning_idea', roomId, ideaId: id(action.ideaId, 'The learning idea'),
    title: text(action.title, 1, 100, 'The learning idea title'),
    text: text(action.text, 1, 6000, 'The learning idea notes'), cue: 'book',
  };
  throw Error('A resident proposal can only add a safe room feature or learning book.');
}

export function validateResident(input, house) {
  if (input === undefined) return createResident();
  if (!input || input.version !== 1) throw Error('Resident records support version 1.');
  const result = createResident();
  if (input.nextId !== undefined && (!Number.isSafeInteger(input.nextId) || input.nextId < 1 || input.nextId > 1000000000)) throw Error('The resident sequence must be a positive bounded integer.');
  result.nextId = input.nextId ?? 1;
  const preferences = input.preferences || {};
  if (preferences.pace !== undefined && !['gentle', 'direct'].includes(preferences.pace)) throw Error('Choose a gentle or direct conversational pace.');
  if (preferences.focus !== undefined && !['clarity', 'evidence', 'connections'].includes(preferences.focus)) throw Error('Choose clarity, evidence or connections as the focus.');
  result.preferences = {pace: preferences.pace || 'gentle', focus: preferences.focus || 'clarity'};
  result.messages = array(input.messages, LIMITS.messages, 'Conversation history').map(message => {
    if (!message || !['user', 'resident'].includes(message.role) || !['local', 'gpt'].includes(message.source)) throw Error('Conversation messages need a speaker and source.');
    const normalized = {
      id: id(message.id, 'A message'), at: timestamp(message.at),
      role: message.role, source: message.source, roomId: id(message.roomId, 'The conversation room'),
      text: text(message.text, 1, message.role === 'user' ? 1200 : 2200, 'A conversation message'),
    };
    if (message.role === 'resident') {
      if (!Object.hasOwn(CONCEPTS, message.concept)) throw Error('A resident reply needs a supported Socratic concept.');
      normalized.concept = message.concept;
    }
    return normalized;
  });
  unique(result.messages.map(item => item.id), 'Conversation messages');
  result.observations = array(input.observations, LIMITS.observations, 'Room observations').map(observation => {
    if (!observation) throw Error('A room observation needs a record.');
    return {
      id: id(observation.id, 'An observation'), at: timestamp(observation.at),
      roomId: id(observation.roomId, 'The observed room'), roomName: text(observation.roomName, 1, 60, 'The observed room name'),
      summary: text(observation.summary, 1, 1200, 'An observation'),
      evidence: array(observation.evidence, 8, 'Observation evidence').map(item => text(item, 1, 400, 'An observed fact')),
    };
  });
  unique(result.observations.map(item => item.id), 'Room observations');
  result.proposals = array(input.proposals, LIMITS.proposals, 'Proposal history').map(proposal => {
    if (!proposal || !['pending', 'approved', 'declined', 'applied'].includes(proposal.status) || !['local', 'gpt'].includes(proposal.source)) throw Error('A resident proposal needs a valid status and source.');
    const roomId = id(proposal.roomId, 'The proposed room');
    const normalized = {
      id: id(proposal.id, 'A proposal'), createdAt: timestamp(proposal.createdAt), status: proposal.status, source: proposal.source,
      roomId, roomName: text(proposal.roomName, 1, 60, 'The proposed room name'),
      title: text(proposal.title, 1, 100, 'The proposal title'), reason: text(proposal.reason, 1, 1200, 'The proposal reason'),
      question: text(proposal.question, 1, 500, 'The proposal question'),
      evidence: array(proposal.evidence, 8, 'Proposal evidence').map(item => text(item, 1, 400, 'A proposal fact')),
      action: normalizeAction(proposal.action, roomId),
    };
    // Older proposals remain valid; newer critiques explain their method and test.
    if (proposal.concept !== undefined) {
      if (!Object.hasOwn(CONCEPTS, proposal.concept)) throw Error('A proposal needs a supported Socratic concept.');
      normalized.concept = proposal.concept;
    }
    if (proposal.practice !== undefined) normalized.practice = text(proposal.practice, 1, 500, 'The proposed practice');
    if (proposal.successTest !== undefined) normalized.successTest = text(proposal.successTest, 1, 500, 'The improvement test');
    if (proposal.status !== 'pending') {
      if (!['approve', 'decline'].includes(proposal.decision)) throw Error('A decided proposal needs its explicit user decision.');
      normalized.decision = proposal.decision;
      normalized.decidedAt = timestamp(proposal.decidedAt);
      if (normalized.decidedAt < normalized.createdAt) throw Error('A proposal decision must follow its creation.');
      if (proposal.status !== 'declined' && proposal.decision !== 'approve') throw Error('An applied feature needs the user’s approval.');
    } else if (proposal.decision !== undefined || proposal.decidedAt !== undefined || proposal.appliedAt !== undefined) throw Error('A pending proposal cannot already have a decision.');
    if (proposal.status === 'applied') {
      normalized.appliedAt = timestamp(proposal.appliedAt);
      if (normalized.appliedAt < normalized.decidedAt) throw Error('An improvement must follow its explicit approval.');
    } else if (proposal.appliedAt !== undefined) throw Error('Only an applied proposal has an installation time.');
    if (proposal.resolution !== undefined) normalized.resolution = text(proposal.resolution, 1, 400, 'The proposal resolution');
    return normalized;
  });
  unique(result.proposals.map(item => item.id), 'Resident proposals');
  if (result.proposals.filter(item => item.status === 'pending').length > LIMITS.pending) throw Error(`Resolve a pending suggestion before keeping more than ${LIMITS.pending}.`);
  const roomIds = new Set(house?.rooms?.map(room => room.id) || []);
  result.roomFeatures = array(input.roomFeatures, LIMITS.features, 'Room features').map(feature => {
    if (!feature || !FEATURES.includes(feature.type)) throw Error('Choose one of the four safe physical features.');
    return {id: id(feature.id, 'A room feature'), roomId: id(feature.roomId, 'The furnished room'), type: feature.type, installedAt: timestamp(feature.installedAt)};
  }).filter(feature => roomIds.has(feature.roomId));
  unique(result.roomFeatures.map(item => item.id), 'Installed features');
  unique(result.roomFeatures.map(item => `${item.roomId}:${item.type}`), 'Each room feature');
  const memory = input.memory || {};
  result.memory.values = array(memory.values, 8, 'Remembered values').map(item => text(item, 1, 240, 'A remembered value'));
  result.memory.openQuestions = array(memory.openQuestions, 8, 'Remembered questions').map(item => text(item, 1, 240, 'A remembered question'));
  if (memory.lastConcept !== undefined && !Object.hasOwn(CONCEPTS, memory.lastConcept)) throw Error('Choose a supported remembered concept.');
  result.memory.lastConcept = memory.lastConcept || 'clarify';
  if (memory.lastRoomId !== undefined && memory.lastRoomId !== null) result.memory.lastRoomId = id(memory.lastRoomId, 'The last visited room');
  result.memory.rooms = array(memory.rooms, 32, 'Resident room memory').map(room => {
    if (!room || !Number.isSafeInteger(room.visits) || room.visits < 1 || room.visits > 1000000000) throw Error('Remembered room visits must be positive bounded counts.');
    return {roomId: id(room.roomId, 'A remembered room'), visits: room.visits, lastVisitedAt: timestamp(room.lastVisitedAt)};
  });
  unique(result.memory.rooms.map(item => item.roomId), 'Resident room memory');
  return result;
}

function working(house) {
  if (!house || !Array.isArray(house.rooms) || !Array.isArray(house.ideas) || !Array.isArray(house.doors)) throw Error('The resident needs a valid house.');
  const result = clone(house);
  result.resident = validateResident(house.resident, house);
  return result;
}
function roomIn(house, roomId) {
  const room = house.rooms.find(item => item.id === roomId);
  if (!room) throw Error('Choose a room that is still in the house.');
  return room;
}
function newId(house, kind) {
  if (house.resident.nextId >= 1000000000) throw Error('The resident record sequence has reached its limit.');
  const taken = new Set([
    ...house.resident.messages, ...house.resident.observations, ...house.resident.proposals,
    ...house.resident.roomFeatures, ...house.ideas,
  ].map(item => item.id));
  for (const proposal of house.resident.proposals) taken.add(proposal.action.ideaId || proposal.action.featureId);
  let value;
  do {
    if (house.resident.nextId >= 1000000000) throw Error('The resident record sequence has reached its limit.');
    value = `resident-${kind}-${house.resident.nextId++}`;
  } while (taken.has(value));
  return value;
}
function appendMessage(house, roomId, role, content, source, concept, at) {
  const message = {id: newId(house, 'message'), at, role, source, roomId, text: content};
  if (role === 'resident') message.concept = concept;
  house.resident.messages.push(message);
  house.resident.messages = house.resident.messages.slice(-LIMITS.messages);
  return message;
}
function remember(list, content) {
  if (!list.includes(content)) list.push(content);
  return list.slice(-8);
}
function recordUserMemory(house, content) {
  const memory = house.resident.memory;
  if (/\?|\b(wonder|uncertain|not sure|don't know|do not know)\b/i.test(content)) memory.openQuestions = remember(memory.openQuestions, truncate(content, 240));
  if (/\b(value|important|care about|want to learn|my goal|i want|i believe)\b/i.test(content)) memory.values = remember(memory.values, truncate(content, 240));
  if (/\b(be direct|more direct|brief answers)\b/i.test(content)) house.resident.preferences.pace = 'direct';
  if (/\b(be gentle|slow down|more gently)\b/i.test(content)) house.resident.preferences.pace = 'gentle';
}

function roomFacts(house, roomId) {
  const room = roomIn(house, roomId);
  const notes = house.ideas.filter(idea => idea.roomId === roomId);
  const blank = notes.filter(idea => !idea.text.trim());
  const neighborIds = new Set();
  for (const door of house.doors) {
    if (door.a === roomId && house.rooms.some(item => item.id === door.b)) neighborIds.add(door.b);
    if (door.b === roomId && house.rooms.some(item => item.id === door.a)) neighborIds.add(door.a);
  }
  const neighbors = house.rooms.filter(item => neighborIds.has(item.id));
  const reflections = (house.learning?.days || []).flatMap(day => day.reflections || []).filter(reflection => reflection.roomId === roomId);
  const features = (house.resident?.roomFeatures || []).filter(feature => feature.roomId === roomId).map(feature => feature.type);
  const purpose = typeof room.purpose === 'string' ? truncate(room.purpose.trim(), 400) : '';
  const actions = {read: 0, question: 0, experiment: 0, reflect: 0};
  for (const note of notes) {
    const action = note.action || {book: 'read', ring: 'question', sphere: 'experiment', crystal: 'reflect'}[note.cue];
    if (Object.hasOwn(actions, action)) actions[action]++;
  }
  // Only authored metadata is known here. Geometry, comfort and reachability need
  // a real visit and cannot be inferred from an imported asset's title.
  const designObjects = (Array.isArray(house.designObjects) ? house.designObjects : [])
    .filter(object => object?.roomId === roomId && object.placement !== 'garden')
    .slice(0, 24).map(object => ({
      title: truncate(typeof object.title === 'string' ? object.title : 'Untitled design', 100),
      kind: object.kind === 'house' ? 'house' : 'object',
      action: Object.hasOwn(actions, object.action) ? object.action : 'read',
      note: truncate(typeof object.note === 'string' ? object.note : '', 400),
    }));
  const visits = house.resident?.memory?.rooms?.find(item => item.roomId === roomId)?.visits || 0;
  const evidence = [
    `${room.name}: ${notes.length} idea object${notes.length === 1 ? '' : 's'}; ${blank.length} without written notes.`,
    `Door connections: ${neighbors.length ? neighbors.map(item => item.name).join(', ') : 'none'}.`,
    `Saved learning reflections: ${reflections.length}.`,
    `Installed learning furniture: ${features.length ? features.map(type => FEATURE_COPY[type].name).join(', ') : 'none'}.`,
    `Declared purpose: ${purpose || 'not written yet'}. Assigned idea functions: ${Object.entries(actions).map(([action, count]) => `${action} ${count}`).join(', ')}.`,
  ];
  if (notes[0]) evidence.push(`Idea: “${truncate(notes[0].title, 100)}”. Notes: ${truncate(notes[0].text || '(empty)', 220)}`);
  if (reflections.at(-1)) evidence.push(`Latest reflection: ${truncate(reflections.at(-1).answer, 260)}`);
  if (designObjects.length) evidence.push(`Imported designs: ${designObjects.length}; “${designObjects[0].title}” is assigned to ${designObjects[0].action}. ${designObjects[0].note}`);
  const summary = `${room.name} has ${notes.length} idea${notes.length === 1 ? '' : 's'}, ${reflections.length} saved reflection${reflections.length === 1 ? '' : 's'}, and ${neighbors.length} connected room${neighbors.length === 1 ? '' : 's'}.`;
  return {room, purpose, notes, blank, neighbors, reflections, features, actions, designObjects, visits, evidence: evidence.map(item => truncate(item, 400)), summary};
}

export function observeRoom(house, roomId, options = {}) {
  const result = working(house), at = nowAt(options), facts = roomFacts(result, roomId);
  result.resident.observations.push({id: newId(result, 'observation'), at, roomId, roomName: facts.room.name, summary: facts.summary, evidence: facts.evidence});
  result.resident.observations = result.resident.observations.slice(-LIMITS.observations);
  let remembered = result.resident.memory.rooms.find(item => item.roomId === roomId);
  if (!remembered) {
    remembered = {roomId, visits: 0, lastVisitedAt: at};
    result.resident.memory.rooms.push(remembered);
    result.resident.memory.rooms = result.resident.memory.rooms.slice(-32);
  }
  remembered.visits = Math.min(remembered.visits + 1, 1000000000);
  remembered.lastVisitedAt = at;
  result.resident.memory.lastRoomId = roomId;
  return result;
}

function conceptFor(content, house) {
  if (/\b(life|value|important|purpose|habit|meaningful|care about|rest|tired|sleep|comfort)\b/i.test(content)) return 'examined_life';
  if (/\b(assume|assumption|believe|always|never|everyone|certain)\b/i.test(content)) return 'assumptions';
  if (/\b(counterexample|wrong|false|contradict|disprove)\b/i.test(content)) return 'counterexample';
  if (/\b(evidence|proof|test|experiment|reason|why)\b/i.test(content)) return 'evidence';
  if (/\b(connect|alternative|another|different|perspective|compare)\b/i.test(content)) return 'perspective';
  if (/\b(mean|define|definition|what is|uncertain|not sure|don't know|do not know)\b/i.test(content)) return 'clarify';
  if (house.resident.preferences.focus === 'evidence') return 'evidence';
  if (house.resident.preferences.focus === 'connections') return 'perspective';
  const order = Object.keys(CONCEPTS);
  const turns = house.resident.messages.filter(message => message.role === 'user').length;
  return order[turns % order.length];
}

function chosenIdea(facts, content = '') {
  const words = content.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const scored = facts.notes.map(idea => ({idea, score: words.filter(word => idea.title.toLowerCase().includes(word)).length}));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.idea;
}

function questionFor(concept, facts, content) {
  const idea = chosenIdea(facts, content)?.title || facts.designObjects[0]?.title || facts.room.name;
  if (concept === 'clarify') return `When you say “${truncate(content, 100)}”, which part needs a clearer meaning? Give one concrete example from ${facts.room.name}.`;
  if (concept === 'assumptions') return `Which assumption supports your view of “${truncate(idea, 100)}”? What changes if that assumption is false?`;
  if (concept === 'evidence') return `What observation in ${facts.room.name} supports your answer, and what evidence would make you revise it?`;
  if (concept === 'counterexample') return `Can you find one case where your explanation of “${truncate(idea, 100)}” fails? What boundary does that reveal?`;
  if (concept === 'perspective') return facts.neighbors.length ? `How would someone in ${facts.neighbors[0].name} explain this differently? What can you learn from that comparison?` : `What is the strongest alternative explanation, and what would distinguish it from yours?`;
  if (/\b(rest|tired|sleep|comfort)\b/i.test(content) || roomOrientation(facts) === 'care') return `What would a useful pause in ${facts.room.name} let you notice? When you return, which thought could you examine without turning rest into another obligation?`;
  return `What value does this idea serve in your life? Does the way you use ${facts.room.name} support its declared purpose? Which small choice today would show that value in practice?`;
}

function safeProposalSlot(house) {
  if (house.resident.proposals.filter(proposal => proposal.status === 'pending').length >= LIMITS.pending) throw Error('Please approve or decline one of the pending house suggestions first.');
  if (house.resident.proposals.length >= LIMITS.proposals) {
    const resolved = house.resident.proposals.findIndex(proposal => proposal.status !== 'pending');
    if (resolved < 0) throw Error('The proposal journal is full. Resolve a pending suggestion first.');
    house.resident.proposals.splice(resolved, 1);
  }
}

function roomOrientation(facts) {
  const description = `${facts.room.name} ${facts.purpose}`;
  if (/\b(bedroom|rest|sleep|recovery)\b/i.test(description)) return 'care';
  if (/\b(living room|talk|conversation|dialogue|viewpoints)\b/i.test(description)) return 'dialogue';
  if (/\b(kitchen|making|recipes|practical|daily experiment)\b/i.test(description)) return 'practice';
  return 'inquiry';
}

function exerciseFor(feature, facts) {
  const subject = facts.notes[0]?.title || facts.designObjects[0]?.title || `one idea in ${facts.room.name}`;
  const target = `“${truncate(subject, 100)}”`;
  if (feature === 'question_board') return {
    concept: 'clarify',
    question: `What does ${target} mean, and what example would make it clear to someone else?`,
    practice: `Write a claim about ${target}, define its key word, then give an example and a case it excludes.`,
    successTest: 'On your next visit, explain the claim without reading the board. Record which definition still needs work.',
  };
  if (feature === 'discussion_circle') return {
    concept: 'perspective',
    question: `How would someone who disagrees with ${target} explain their reasons?`,
    practice: `Use the two seats to state your account of ${target}, then the strongest alternative. Ask what each account overlooks.`,
    successTest: 'After one conversation, save a question or revision that came from the alternative account. Decide whether the circle helped you listen.',
  };
  if (feature === 'experiment_table') return {
    concept: 'evidence',
    question: `What prediction can you test about ${target}, and what result would count against your belief?`,
    practice: `For ${target}, write one prediction and one possible counterexample. Try a small example and record what actually happens.`,
    successTest: 'Compare the result with the prediction on your next visit. Keep, narrow or revise the claim, explaining why.',
  };
  return {
    concept: 'examined_life',
    question: `Does the way you use ${facts.room.name} support its purpose and the life you want to live?`,
    practice: roomOrientation(facts) === 'care' ? 'Take a short pause without a task. Return to an idea afterwards and write what you notice differently.' : `Pause after examining ${target}. Write what changed your mind, what remains uncertain and why this matters to you.`,
    successTest: 'On your next visit, compare your before-and-after account. Say whether this quiet pause was useful; a new lamp alone is not evidence of learning.',
  };
}

function critiquePlan(house, roomId) {
  const facts = roomFacts(house, roomId), orientation = roomOrientation(facts);
  let preferred, reason;
  if (orientation === 'care') {
    preferred = 'reflection_lamp';
    reason = `${facts.room.name} is described as a place for rest. ${facts.notes.length} idea objects and ${facts.reflections.length} saved reflections are recorded here. An examined life needs room for a pause as well as a task; we can test a quiet reflection corner without judging how rested you are.`;
  } else if (orientation === 'dialogue') {
    preferred = 'discussion_circle';
    reason = `${facts.room.name} has a stated purpose of conversation, with ${facts.notes.length} idea objects and ${facts.reflections.length} saved reflections. A discussion circle can make taking another viewpoint an activity you actually try.`;
  } else if (orientation === 'practice') {
    preferred = 'experiment_table';
    reason = `${facts.room.name} is described as a place for making and testing. It holds ${facts.notes.length} idea objects; ${facts.actions.experiment} are assigned to experiments. A table can support a small prediction-and-result exercise instead of leaving the purpose only in a description.`;
  } else if (!facts.purpose) {
    preferred = 'question_board';
    reason = `${facts.room.name} has no written purpose. It contains ${facts.notes.length} idea objects. Let us first ask what you want to do here, then use a question board to connect one activity with that purpose.`;
  } else if (!facts.notes.length || facts.blank.length) {
    preferred = 'question_board';
    reason = !facts.notes.length ? `${facts.room.name} has no idea objects yet. A visible question board gives this room an entry point for inquiry.` : `“${facts.blank[0].title}” has no explanation in its notes. A question board makes its claim and missing reasons visible.`;
  } else if (!facts.reflections.length) {
    preferred = 'reflection_lamp';
    reason = `${facts.room.name} has written ideas, but no saved learning reflection. This does not mean you have learned nothing; a quiet lamp can give you a place to record what you learned and what remains uncertain.`;
  } else if (facts.neighbors.length < 2) {
    preferred = 'discussion_circle';
    reason = `${facts.room.name} connects to ${facts.neighbors.length} other room${facts.neighbors.length === 1 ? '' : 's'}. A discussion circle makes space to compare a claim with another perspective. Door counts alone do not tell us whether a conversation is good.`;
  } else {
    preferred = 'experiment_table';
    reason = `${facts.room.name} has ${facts.notes.length} ideas and ${facts.reflections.length} saved reflections. An experiment table turns an explanation into a small test with an observable result.`;
  }
  if (facts.purpose) reason += ` Declared purpose: ${truncate(facts.purpose, 180)}`;
  if (facts.designObjects.length) reason += ` The imported “${facts.designObjects[0].title}” is assigned to ${facts.designObjects[0].action}; its appearance alone cannot tell me whether it serves that function.`;
  const candidates = [preferred, ...FEATURES.filter(item => item !== preferred)].filter(item => !facts.features.includes(item));
  const decisions = house.resident.proposals.filter(item => item.roomId === roomId && item.status !== 'pending');
  const latestByFeature = new Map(decisions.filter(item => item.action.feature).map(item => [item.action.feature, item.decision]));
  const declined = new Set([...latestByFeature].filter(([, decision]) => decision === 'decline').map(([feature]) => feature));
  const feature = candidates.find(item => !declined.has(item));
  if (feature) {
    if (feature !== preferred) {
      reason += declined.has(preferred) ? ` You declined my previous ${FEATURE_COPY[preferred].name}; I am offering a different exercise for you to consider.` : ` The room already has a ${FEATURE_COPY[preferred].name}; let us test a ${FEATURE_COPY[feature].name} next.`;
    }
    const exercise = exerciseFor(feature, facts);
    return {facts, feature, title: `${FEATURE_COPY[feature].title} in ${facts.room.name}`, reason, ...exercise};
  }
  if (candidates.length) return {facts, unavailable: true, reason: `${facts.room.name} has ${facts.notes.length} idea objects. You have declined the remaining furniture suggestions, so I will stop proposing them unless you ask for a particular feature. We can examine an existing idea or decide on a useful activity together.`};
  if (facts.notes.length >= 12 || house.ideas.length >= 192) return {facts, unavailable: true};
  if ([...decisions].reverse().find(item => item.action.type === 'add_learning_idea')?.decision === 'decline') return {facts, unavailable: true, reason: `You declined the exercise book for ${facts.room.name}. Let us try one of the existing objects before suggesting another addition. What question could we investigate with what is already here?`};
  return {
    facts, book: true, concept: 'counterexample', title: `Add an examined-idea exercise in ${facts.room.name}`,
    reason: `${facts.room.name} already has all four learning furnishings. A new exercise book can connect discussion, reflection and testing without changing the room structure. ${facts.reflections.length} reflections are recorded; we should examine the result before assuming that more furniture improves learning.`,
    question: 'Which belief will you test, what would change your mind, and how will you record the result?',
    practice: 'Choose one existing idea. State it in your own words, offer a counterexample, and decide what a fair test would show.',
    successTest: 'Next visit, explain whether the test strengthened or changed the idea. Record an honest result, including uncertainty.',
  };
}

function putProposal(house, roomId, specification, source, at) {
  const facts = roomFacts(house, roomId);
  const same = house.resident.proposals.find(proposal => proposal.status === 'pending' && proposal.roomId === roomId && (
    specification.feature ? proposal.action.type === 'add_room_feature' && proposal.action.feature === specification.feature : proposal.action.type === 'add_learning_idea'
  ));
  if (same) return same;
  safeProposalSlot(house);
  const action = specification.feature ? {
    type: 'add_room_feature', roomId, feature: specification.feature, featureId: newId(house, 'feature'),
  } : {
    type: 'add_learning_idea', roomId, ideaId: newId(house, 'idea'),
    title: truncate(`Examined idea: ${facts.room.name}`, 100), cue: 'book',
    text: `${specification.reason}\n\nQuestion\n${specification.question}\n\nPractice\nWrite a claim in your own words. Give supporting evidence and a counterexample. Explain what you would change after testing it.`,
  };
  const proposal = {
    id: newId(house, 'proposal'), createdAt: at, status: 'pending', source,
    roomId, roomName: facts.room.name,
    title: truncate(specification.title, 100), reason: truncate(specification.reason, 1200),
    question: truncate(specification.question, 500), evidence: facts.evidence, action,
    ...(specification.concept ? {concept: specification.concept} : {}),
    ...(specification.practice ? {practice: truncate(specification.practice, 500)} : {}),
    ...(specification.successTest ? {successTest: truncate(specification.successTest, 500)} : {}),
  };
  house.resident.proposals.push(proposal);
  return proposal;
}

function describeProposal(proposal) {
  if (proposal.action.type === 'add_room_feature') return `I propose a ${FEATURE_COPY[proposal.action.feature].name} in ${proposal.roomName}. ${FEATURE_COPY[proposal.action.feature].practice}`;
  return `I propose an exercise book in ${proposal.roomName}, so you can test a claim and revisit the result.`;
}

export function proposeCritique(house, roomId, options = {}) {
  const at = nowAt(options);
  const result = observeRoom(house, roomId, {now: at});
  let plan = critiquePlan(result, roomId);
  if (options.feature !== undefined) {
    if (!FEATURES.includes(options.feature)) throw Error('Choose one of the four safe room features.');
    if (plan.facts.features.includes(options.feature)) {
      appendMessage(result, roomId, 'resident', `${plan.facts.room.name} already has a ${FEATURE_COPY[options.feature].name}. ${FEATURE_COPY[options.feature].practice} What would you like to investigate with it?`, 'local', 'clarify', at);
      return result;
    }
    plan = {
      facts: plan.facts, feature: options.feature,
      title: `${FEATURE_COPY[options.feature].title} in ${plan.facts.room.name}`,
      reason: `You asked for a ${FEATURE_COPY[options.feature].name}. ${plan.facts.summary} ${FEATURE_COPY[options.feature].practice}`,
      ...exerciseFor(options.feature, plan.facts),
    };
  }
  if (plan.unavailable) {
    appendMessage(result, roomId, 'resident', plan.reason || `${plan.facts.summary} This room has all four furnishings and is full of idea objects. I will keep the structure and notes intact. Which existing idea should we examine together?`, 'local', 'examined_life', at);
    return result;
  }
  const proposal = putProposal(result, roomId, plan, 'local', at);
  const concept = proposal.concept || plan.concept || 'examined_life';
  appendMessage(result, roomId, 'resident', truncate(`${proposal.reason}\n\n${CONCEPTS[concept].title}: ${describeProposal(proposal)}\n\n${proposal.question}\n\nTry it: ${proposal.practice || FEATURE_COPY[proposal.action.feature]?.practice || 'Examine one claim.'}\nNext visit: ${proposal.successTest || 'Record whether the exercise helped.'}\n\nYou choose whether to build this improvement in the next house; it is still a suggestion.`, 2200), 'local', concept, at);
  result.resident.memory.lastConcept = concept;
  return result;
}

export function converse(house, roomId, content, options = {}) {
  const message = text(content, 1, 1200, 'Your message'), at = nowAt(options);
  let result = working(house);
  const facts = roomFacts(result, roomId);
  const prior = [...result.resident.messages].reverse().find(item => item.role === 'user' && item.roomId === roomId);
  const concept = conceptFor(message, result);
  appendMessage(result, roomId, 'user', message, 'local', null, at);
  recordUserMemory(result, message);
  result.resident.memory.lastRoomId = roomId;
  result.resident.memory.lastConcept = concept;
  const requestedFeature = /\b(add|place|install|put)\b/i.test(message) ? FEATURES.find(feature => message.toLowerCase().includes(feature.replaceAll('_', ' '))) : undefined;
  const wantsHouseChange = /\b(furnish|decorate|critique)\b|\b(improve|change|build|propose|suggest)\b.{0,80}\b(houses?|homes?|rooms?|space|furniture|feature)\b|\b(houses?|homes?|rooms?|physical)\s+(proposal|suggestion|improvement)\b|\bmake.{0,60}\b(houses?|homes?|rooms?).{0,40}\bbetter\b|\bideas?.{0,40}\b(for|to improve).{0,30}\b(houses?|homes?|rooms?)\b|^improve[.!? ]*$/i.test(message);
  if (wantsHouseChange || requestedFeature) {
    result = proposeCritique(result, roomId, {now: at, ...(requestedFeature ? {feature: requestedFeature} : {})});
    return result;
  }
  let reply;
  if (/\b(who are you|are you ai|are you real|language model|how do you work)\b/i.test(message)) {
    reply = `I am Socrates, the house's resident philosopher character. In local mode I use guided dialogue rules, your saved room observations and our conversation; I am not a language model. I ask about definitions, assumptions, reasons and choices. ${facts.summary}\n\n${questionFor('clarify', facts, 'a useful idea')}`;
  } else {
    const opening = result.resident.preferences.pace === 'direct' ? 'Let us test that carefully.' : 'Let us stay with that question for a moment.';
    const continuity = prior ? ` Earlier in this room you said: “${truncate(prior.text, 180)}”. How does your present view connect with that?` : '';
    const uncertainty = /\b(uncertain|not sure|don't know|do not know)\b/i.test(message) ? ' Being unsure is a useful starting point: name the gap before rushing to close it.' : '';
    const selectedIdea = chosenIdea(facts, message);
    const idea = selectedIdea ? ` Your idea “${truncate(selectedIdea.title, 100)}” gives us something concrete to examine.` : ` This room's purpose is ${truncate(facts.room.purpose || 'still open for you to define', 180)}.`;
    const design = facts.designObjects[0] ? ` The imported “${facts.designObjects[0].title}” is assigned to ${facts.designObjects[0].action}. What would you do with it to make that function useful?` : '';
    const rememberedValue = result.resident.memory.values.filter(value => value !== truncate(message, 240)).at(-1);
    const memory = concept === 'examined_life' && rememberedValue ? ` You previously told me: “${truncate(rememberedValue, 160)}”. We can ask whether this room helps you live by that aim.` : '';
    reply = `${opening}${continuity}${uncertainty}${idea}${design}${memory}\n\n${questionFor(concept, facts, message)}\n\n${CONCEPTS[concept].description}`;
  }
  appendMessage(result, roomId, 'resident', truncate(reply, 2200), 'local', concept, at);
  return result;
}

export function pendingProposals(house) {
  return clone(validateResident(house.resident, house).proposals.filter(proposal => proposal.status === 'pending'));
}

export function decideProposal(house, proposalId, decision, options = {}) {
  if (!['approve', 'decline'].includes(decision)) throw Error('Choose approve or decline for this house improvement.');
  const result = working(house), at = nowAt(options);
  const proposal = result.resident.proposals.find(item => item.id === proposalId);
  if (!proposal) throw Error('That resident proposal was not found.');
  if (proposal.status !== 'pending') {
    if (proposal.decision === decision) return result;
    throw Error('This resident proposal already has a final decision.');
  }
  if (at < proposal.createdAt) throw Error('A proposal decision must follow its creation.');
  proposal.decision = decision;
  proposal.decidedAt = at;
  proposal.status = 'declined';
  if (decision === 'decline') {
    proposal.resolution = 'You declined this improvement. The rooms and idea objects were left intact.';
    return result;
  }
  const room = result.rooms.find(item => item.id === proposal.roomId);
  if (!room) {
    proposal.resolution = 'The proposed room was removed. Ask me to inspect an existing room for a new suggestion.';
    return result;
  }
  if (proposal.action.type === 'add_room_feature') {
    const installed = result.resident.roomFeatures.find(feature => feature.roomId === room.id && feature.type === proposal.action.feature);
    if (installed) {
      proposal.status = 'applied'; proposal.appliedAt = at;
      proposal.resolution = `This room already has a ${FEATURE_COPY[proposal.action.feature].name}; no duplicate was installed.`;
      return result;
    }
    if (result.resident.roomFeatures.length >= LIMITS.features || result.resident.roomFeatures.some(feature => feature.id === proposal.action.featureId)) {
      proposal.resolution = 'This feature cannot be safely installed because its collection or identifier is already occupied.';
      return result;
    }
    result.resident.roomFeatures.push({id: proposal.action.featureId, roomId: room.id, type: proposal.action.feature, installedAt: at});
    proposal.resolution = `Your approved ${FEATURE_COPY[proposal.action.feature].name} is now in ${room.name}.`;
  } else {
    if (result.ideas.some(idea => idea.id === proposal.action.ideaId)) {
      proposal.resolution = 'An idea already uses this identifier. Existing notes were left intact.';
      return result;
    }
    if (result.ideas.length >= 192 || result.ideas.filter(idea => idea.roomId === room.id).length >= 12) {
      proposal.resolution = 'The room is full of idea objects. Existing notes were left intact.';
      return result;
    }
    result.ideas.push({id: proposal.action.ideaId, roomId: room.id, title: proposal.action.title, text: proposal.action.text, cue: 'book'});
    proposal.resolution = `Your approved exercise book is now in ${room.name}.`;
  }
  proposal.status = 'applied';
  proposal.appliedAt = at;
  return result;
}

export function setResidentPreferences(house, patch) {
  const result = working(house);
  result.resident.preferences = validateResident({...result.resident, preferences: {...result.resident.preferences, ...patch}}, result).preferences;
  return result;
}

export function normalizeGptResult(input, house, fallbackRoomId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('The optional model response needs a structured object.');
  const reply = text(input.reply, 1, 2200, 'The model reply');
  if (!Object.hasOwn(CONCEPTS, input.concept)) throw Error('The model reply needs a supported Socratic concept.');
  if (input.suggestion !== null && (typeof input.suggestion !== 'object' || !input.suggestion || Array.isArray(input.suggestion))) throw Error('The model suggestion must be a safe feature proposal or null.');
  let suggestion = null;
  if (input.suggestion !== null) {
    const roomId = input.suggestion.roomId === undefined ? fallbackRoomId : input.suggestion.roomId;
    roomIn(house, roomId);
    if (!FEATURES.includes(input.suggestion.feature)) throw Error('The model may suggest only one of the four safe room features.');
    suggestion = {
      roomId, feature: input.suggestion.feature,
      title: text(input.suggestion.title, 1, 100, 'The model proposal title'),
      reason: text(input.suggestion.reason, 1, 1200, 'The model proposal reason'),
      question: text(input.suggestion.question, 1, 500, 'The model proposal question'),
    };
  }
  return {reply, concept: input.concept, suggestion};
}

export function receiveGptResult(house, roomId, userText, input, options = {}) {
  const result = working(house), at = nowAt(options);
  roomIn(result, roomId);
  const response = normalizeGptResult(input, result, roomId);
  const content = text(userText, 1, 1200, 'Your message');
  appendMessage(result, roomId, 'user', content, 'gpt', null, at);
  recordUserMemory(result, content);
  appendMessage(result, roomId, 'resident', response.reply, 'gpt', response.concept, at);
  result.resident.memory.lastConcept = response.concept;
  result.resident.memory.lastRoomId = roomId;
  if (response.suggestion) {
    const facts = roomFacts(result, response.suggestion.roomId);
    putProposal(result, response.suggestion.roomId, {...exerciseFor(response.suggestion.feature, facts), ...response.suggestion, concept: response.concept}, 'gpt', at);
  }
  return result;
}

export function residentContext(house, roomId) {
  const resident = validateResident(house.resident, house), facts = roomFacts({...house, resident}, roomId);
  return {
    persona: resident.persona, preferences: resident.preferences,
    room: {id: facts.room.id, name: facts.room.name, purpose: facts.purpose, facts: facts.evidence, ideaFunctions: {...facts.actions}, designObjects: clone(facts.designObjects)},
    rooms: house.rooms.map(room => ({id: room.id, name: room.name})),
    recentMessages: resident.messages.slice(-12), memory: resident.memory,
    pendingSuggestions: resident.proposals.filter(proposal => proposal.status === 'pending').map(proposal => ({id: proposal.id, roomId: proposal.roomId, title: proposal.title})),
    recentDecisions: resident.proposals.filter(proposal => proposal.roomId === roomId && proposal.status !== 'pending').slice(-6).map(proposal => ({title: proposal.title, status: proposal.status, decision: proposal.decision, reason: truncate(proposal.reason, 300), resolution: proposal.resolution || ''})),
    allowedFeatures: [...FEATURES], concepts: clone(CONCEPTS),
    rule: 'Ask questions and make constructive suggestions. Physical changes require explicit owner approval. Do not claim a change has already been made.',
  };
}

export function buildHandoff(house) {
  const resident = validateResident(house.resident, house);
  const lines = [
    'House of Ideas — source improvement brief',
    'Use the resident dialogue and observed house state below to prepare reviewable improvements to the game source.',
    'Keep existing saved ideas and approval gates. This brief does not authorize source publication or destructive house edits.',
    '', 'House:',
    ...house.rooms.map(room => `- ${room.name} (${room.id}): ${house.ideas.filter(idea => idea.roomId === room.id).length} ideas.`),
    '', 'Resident goals:', ...resident.persona.goals.map(goal => `- ${goal}`),
    '', 'Remembered owner values and questions:',
    ...[...resident.memory.values, ...resident.memory.openQuestions].map(value => `- ${value}`),
    '', 'Recent observed evidence:',
    ...resident.observations.slice(-5).flatMap(observation => [`- ${observation.roomName}: ${observation.summary}`, ...observation.evidence.map(fact => `  ${fact}`)]),
    '', 'Recent approved and declined physical suggestions:',
    ...resident.proposals.slice(-10).map(proposal => `- [${proposal.status}${proposal.decision ? `; owner ${proposal.decision}` : ''}] ${proposal.title}: ${proposal.reason}${proposal.concept ? ` Method: ${CONCEPTS[proposal.concept].title}.` : ''}${proposal.practice ? ` Practice: ${proposal.practice}` : ''}${proposal.successTest ? ` Next-visit test: ${proposal.successTest}` : ''}${proposal.resolution ? ` Resolution: ${proposal.resolution}` : ''}`),
    '', 'Recent conversation:',
    ...resident.messages.slice(-12).map(message => `${message.role === 'user' ? 'Owner' : 'Socrates'} (${message.source}; room ${message.roomId}): ${message.text}`),
    '', 'Requested next step: identify a concrete improvement supported by this evidence, implement it in an isolated checkout, validate it, and show the owner the resulting change for review.',
  ];
  return lines.join('\n');
}
