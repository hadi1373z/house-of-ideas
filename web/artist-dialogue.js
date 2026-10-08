import {ARTISTS} from './art-city-data.js';
import {CITY_LIMITS,validateCityNetwork} from './city-network.js';

export const ARTIST_RESIDENT_NOTE='An interpretive artist resident, with offline conversations inspired by the works in this gallery.';
export const ARTIST_DIALOGUE_LIMITS=Object.freeze({messages:CITY_LIMITS.artistMessages,text:CITY_LIMITS.artistMessageText,bytes:CITY_LIMITS.artistConversationBytes});

// These are original learning prompts for fictional residents. They are not
// historical quotations or claims that the artists actually spoke these words.
const practices=Object.freeze({
  monet:{welcome:'Stay with a view long enough to notice what changes.',focus:'light, reflections and the edges that seem to dissolve',
    question:'Where does a reflection stop being sky and start being water?',exercise:'Choose one view through a window. Make three tiny colour studies at different times, keeping the viewpoint fixed.',
    room:'Choose a quiet seat beside a window and leave one clear surface for comparing studies. Observe its light before deciding where an artwork belongs.',reply:'Let us slow the looking down.'},
  kandinsky:{welcome:'A shape becomes interesting through the space around it.',focus:'circles, diagonals and the intervals between forms',
    question:'Which interval makes the arrangement feel tense, and which lets it rest?',exercise:'Arrange a circle, triangle and line on paper. Move just one shape and compare the balance before and after.',
    room:'Try a small arrangement of three coloured objects. Change one interval at a time, leaving clear space around the arrangement.',reply:'Let us consider the forces between the forms.'},
  'van-gogh':{welcome:'Look at how a mark can carry the movement of a scene.',focus:'directional strokes, colour contrasts and the energy of the surface',
    question:'Where do the marks pull your eye, and where do they let it stop?',exercise:'Draw the same small object twice: once with calm parallel marks, once with marks that follow its curves. Compare the feeling.',
    room:'Place a small drawing table near something you can observe each day. Compare a calm wall colour with one lively accent through paper samples first.',reply:'Let us follow the direction of the marks.'},
  hokusai:{welcome:'A strong view can emerge from a few carefully chosen lines.',focus:'contour, cropped viewpoints and the rhythm of large and small forms',
    question:'What does the cropping let us imagine beyond the edge?',exercise:'Sketch one scene with three different crops. Use only contour and two areas of tone; choose the version with the clearest rhythm.',
    room:'Frame a view from one doorway. Keep its sightline clear, then compare two possible positions for a print or screen.',reply:'Let us find the line that holds the view together.'},
  rodin:{welcome:'A body occupies space even in the parts you cannot see.',focus:'weight, gesture and the changing silhouette of a sculpture',
    question:'Where does the figure seem to bear weight, and how would that change from another side?',exercise:'Shape a small gesture in paper or clay. Walk around it and draw three silhouettes before adding detail.',
    room:'Give a sculpture space to be viewed from several sides. Compare its silhouette from the entrance, a seated position and a standing position.',reply:'Let us think through the body and its surrounding space.'},
  'hilma-af-klint':{welcome:'A diagram can invite interpretation without closing it down.',focus:'symbols, contrasting colours and relationships between organic and geometric forms',
    question:'Which relationship can you describe before deciding what a symbol means?',exercise:'Draw three symbols for ideas you care about. Place them in two different relationships and write one possible reading of each.',
    room:'Set aside a place for an evolving diagram of your ideas. Keep observation and interpretation in separate notes so that each arrangement can be reconsidered.',reply:'Let us distinguish a visible relationship from the meaning we give it.'},
  mondrian:{welcome:'A simple arrangement gives every proportion more work to do.',focus:'horizontal and vertical lines, colour blocks and unequal intervals',
    question:'Which proportion would change the balance most if you moved one line?',exercise:'Make a grid of five horizontal and vertical lines. Add one colour block, then change only its size and compare the balance.',
    room:'Compare the horizontal and vertical lines made by a shelf, window and table. Test one proportion on paper before moving furniture.',reply:'Let us examine the balance of unequal parts.'},
  lange:{welcome:'Begin with what you can observe, and be careful about what you assume.',focus:'framing, gesture and the limits of what a photograph tells us',
    question:'What is visible in the photograph, and what would you need to ask the person to know?',exercise:'Describe a photograph in two columns: visible evidence and unanswered questions. Do not fill the second column with guesses.',
    room:'Create a place for photographs and their context. Leave room beside each image for its date, source and questions about what the frame leaves out.',reply:'Let us separate the evidence from the story we bring to it.'},
  morris:{welcome:'A useful object can reward both the hand and the eye.',focus:'repeating patterns, natural forms and the relationship between craft and daily use',
    question:'Where does a repeated motif join its neighbour without an obvious seam?',exercise:'Draw a leaf or flower as a small motif. Repeat it four times, changing the spacing until the gaps form a pattern too.',
    room:'Choose one useful object and study its material, repairability and pattern. Try a paper repeat before covering a larger surface.',reply:'Let us begin with making and with use.'},
  klee:{welcome:'A small line can become an experiment rather than an answer.',focus:'playful line, colour relationships and the boundary between signs and images',
    question:'At what point does a mark begin to suggest a figure or a place?',exercise:'Draw a line without naming what it is. Add five small colour areas, then write three different things the image could suggest.',
    room:'Make a small experiment wall where unfinished studies can remain visible. Arrange them by a question rather than by a finished style.',reply:'Let us allow the mark to find an unexpected direction.'},
});

function identity(id){
  const artist=ARTISTS.find(item=>item.id===id);if(!artist)throw Error('Choose the resident of a known artist house.');return artist;
}
function selection(artist,workId){
  if(workId===undefined)return artist.works[0];
  const work=artist.works.find(item=>item.id===workId);if(!work)throw Error('Choose a work from this artist’s own gallery.');return work;
}
function intent(value){
  if(/\b(houses?|homes?|rooms?|furniture|designs?|shel(?:f|ves)|walls?|windows?|improv(?:e|ing|ement))\b/i.test(value))return 'room';
  if(/\b(practi(?:ce|se|cing|sing)|exercises?|mak(?:e|ing)|draw(?:ing)?|paint(?:ing)?|try(?:ing)?|learn(?:ing)?|sketch(?:ing)?|experiments?)\b/i.test(value))return 'practice';
  if(/\b(compare|different|another|previous|change|again)\b/i.test(value))return 'compare';
  if(/\b(who|biography|life|born|history|historical|quote|said)\b/i.test(value))return 'identity';
  return 'observe';
}
function reply(artist,work,question,history){
  const practice=practices[artist.id],kind=intent(question),previous=history.filter(message=>message.role==='user').at(-1);
  const feature=question.toLowerCase().match(/\b(red|orange|yellow|green|blue|violet|purple|pink|black|white|grey|gray|light|shadow|reflection|contour|line|curve|diagonal|circle|pattern|repetition|gesture|weight|movement|balance|framing|texture)\b/)?.[0];
  const responseToObservation=feature?` You bring up ${feature}. Find one visible example, or say if it is absent, before interpreting its effect.`:'';
  const invitation=practice.reply+responseToObservation;
  const observation=`In ${work.title} (${work.date}), look for ${practice.focus}. ${work.description}`;
  if(kind==='identity')return `I am the interpretive ${artist.name} resident of this gallery, rather than a source of historical quotations. We can explore the works shown here: ${observation}\n\n${practice.question}`;
  if(kind==='room')return `${invitation} ${practice.room}\n\n${observation}\n\nTry this as a study before changing your house. What would you observe to decide whether the new arrangement helps?`;
  if(kind==='practice')return `${invitation}\n\n${observation}\n\nA small practice: ${practice.exercise}\n\n${previous?'If you try this study, compare it with your earlier observation. What would you keep for a second attempt?':practice.question}`;
  if(kind==='compare')return `${invitation}\n\n${observation}\n\nChoose one feature to keep constant and one to change. ${practice.exercise}\n\n${previous?'Compare this with your earlier observation. What evidence supports a difference?':practice.question}`;
  return `${invitation}\n\n${observation}\n\n${practice.question}\n\nA small practice: ${practice.exercise}`;
}

export function artistOpening(artistId,workId){
  const artist=identity(artistId),work=selection(artist,workId),practice=practices[artistId];
  return `Welcome to my gallery house. ${practice.welcome} We can begin with ${work.title}. ${practice.question}`;
}

export function artistQuestions(artistId,workId){
  const artist=identity(artistId),work=selection(artist,workId);
  return [`Help me look closely at ${work.title}.`,`Give me a small practice inspired by ${work.title}.`,`How could your approach help me design a room in my house?`];
}

export function artistConversation(network,artistId){
  identity(artistId);return validateCityNetwork(network).artistConversations?.[artistId]??[];
}

export function converseWithArtist(network,options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))throw Error('Use a plain artist conversation request.');
  if(Object.keys(options).some(key=>!['artistId','text','workId','date'].includes(key)))throw Error('The artist conversation request contains an unsupported field.');
  const {artistId,text,workId,date}=options;
  const result=validateCityNetwork(network),artist=identity(artistId),work=selection(artist,workId);
  if(typeof text!=='string'||!text.trim()||text.length>CITY_LIMITS.artistMessageText)throw Error(`Your message needs 1–${CITY_LIMITS.artistMessageText} characters.`);
  const history=result.artistConversations?.[artistId]??[],response=reply(artist,work,text,history);
  const dateValue=date instanceof Date?date.toISOString():date??new Date().toISOString();
  // IDs stay unique across all residents, including validated imported state.
  const used=new Set(Object.values(result.artistConversations??{}).flat().map(message=>message.id));
  let next=history.length+1;
  const fresh=()=>{while(used.has(`${artistId}-message-${next}`))next++;const id=`${artistId}-message-${next++}`;used.add(id);return id;};
  result.artistConversations={...result.artistConversations,[artistId]:[...history,
    {id:fresh(),role:'user',date:dateValue,text,workId:work.id},
    {id:fresh(),role:'artist',date:dateValue,text:response,workId:work.id}]};
  return validateCityNetwork(result);
}
