// Original short readings for the offline house; these are not quotations from Socrates.
export const BOOKS=[
 {id:'definitions',title:'What do we mean?',pages:[
  'A useful conversation starts by making a word clear. If you call a house comfortable, which experiences count: warmth, quiet, company, freedom to move? A definition gives you something both people can examine.',
  'Try your definition on two different examples. A crowded kitchen might feel comfortable with friends and uncomfortable while you work. Let the example refine the definition rather than defending the first answer.'],question:'Choose one word you use often. Define it, then give an example that challenges your definition.'},
 {id:'assumptions',title:'The hidden premise',pages:[
  'An argument often carries a premise it never says aloud. “More books will make this a better library” assumes that quantity improves learning. Perhaps access, light or time to read matters more.',
  'Write the claim and the reason separately. Ask what would have to be true for the reason to support the claim. You can test that hidden premise without dismissing the whole idea.'],question:'Which hidden assumption supports one of your ideas? How could you test it?'},
 {id:'counterexamples',title:'The difficult example',pages:[
  'A counterexample is an invitation to make a claim more precise. “Quiet rooms are always best for thinking” becomes doubtful when a conversation helps solve a problem.',
  'Choose a case where your rule might fail. If it fails, narrow the rule or explain the exception. Learning can mean replacing a confident generalisation with a smaller, stronger claim.'],question:'Find a case where a rule you believe might fail. What would you change about the rule?'},
 {id:'care',title:'Making a place to live',pages:[
  'A place supports a life through ordinary things: somewhere to put a coat, a cup within reach, a chair where two people can talk. The purpose of a room is visible in what it lets you do.',
  'Walk through this house and notice one friction. Does the path interrupt a conversation? Is a book hard to find? Start with a small change that improves an actual daily experience.'],question:'What is one small change that would make this house easier to inhabit?'},
 {id:'practice',title:'Learning by trying',pages:[
  'An idea becomes clearer when it meets a small test. State what you expect to happen, choose an action you can repeat, and observe what happens. An unexpected result is useful evidence.',
  'Keep prediction and observation separate in your notes. One trial rarely decides everything. Ask what alternative explanation fits the result and what you would try next.'],question:'Describe a small experiment: your prediction, what you will observe, and what would change your mind.'},
 {id:'dialogue',title:'Thinking together',pages:[
  'A dialogue needs room for both people to revise their view. Before you challenge a claim, try to describe it in words the other person would recognise. A fair summary makes disagreement more useful.',
  'Ask for reasons, offer an example and listen for a distinction you missed. You do not need to agree at the end. A better question can be a worthwhile result of the conversation.'],question:'What is a fair account of a view you disagree with? What question would help you understand it?'}
];
export const bookById=id=>BOOKS.find(book=>book.id===id)||BOOKS[0];
