// Original short learning prompts. Sources are further reading, never copied
// textbook passages. The Mathematics Institute is separate from saved homes.
export const MATH_BUILDING=Object.freeze({id:'mathematics-institute',name:'Mathematics Institute',floorHeight:4,floors:8});
const sources={
 foundations:'https://openstax.org/books/contemporary-mathematics/pages/1-1-basic-set-concepts',
 algebra:'https://openstax.org/books/college-algebra-2e/pages/preface',
 geometry:'https://openstax.org/books/contemporary-mathematics/pages/index',
 analysis:'https://openstax.org/books/calculus-volume-1/pages/5-3-the-fundamental-theorem-of-calculus',
 discrete:'https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-fall-2005/',
 probability:'https://openstax.org/books/contemporary-mathematics/pages/7-key-concepts',
 topology:'https://ocw.mit.edu/courses/18-901-introduction-to-topology-fall-2004/',
 logic:'https://openstax.org/books/contemporary-mathematics/pages/2-1-statements-and-quantifiers',
};
const concept=(id,title,summary,question,exercise,floor,source)=>Object.freeze({id,title,summary,question,exercise,floor,sourceUrl:sources[source]});
export const MATH_CONCEPTS=Object.freeze([
 concept('sets','Sets & membership','A set is a collection of distinct elements. Membership says whether a particular element belongs to it.','Can two descriptions name the same set?','List A={1,2,3} and B={2,3,4}. Find their shared elements and the elements in either set.',0,'foundations'),
 concept('numbers','Numbers & representations','An integer, fraction or decimal can describe a quantity. Distinct symbols can represent the same value.','When does a representation make a problem easier?','Write 1/2 as a decimal and a percentage. Explain why the three representations agree.',0,'foundations'),
 concept('functions','Functions & correspondence','A function assigns exactly one output to each input in its domain. It may assign the same output to several inputs.','Why does a function need a domain?','Use f(x)=x² on {-2,-1,0,1,2}. Make a table and find different inputs with the same output.',0,'algebra'),
 concept('equations','Equations & balance','An equation asserts that two expressions are equal. A solution is a value that makes the assertion true.','Why must an operation on one side also be applied to the other?','Solve 3x+2=11, explain each step, and substitute your answer into the original equation.',1,'algebra'),
 concept('polynomials','Polynomials & roots','A polynomial combines powers with nonnegative integer exponents. A root is an input giving output zero.','What does a root tell you about a graph?','Factor x²−5x+6. Find both roots and check them in the expanded expression.',1,'algebra'),
 concept('linear-systems','Systems & matrices','A linear system asks for values satisfying several linear equations together. A matrix organises their coefficients.','Can two equations describe the same constraint?','Solve x+y=5 and x−y=1. Sketch how their two lines meet.',1,'algebra'),
 concept('pythagoras','Right triangles','In a Euclidean right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.','What assumption makes the theorem applicable?','Draw a triangle with perpendicular sides of lengths 3 and 4. Find its hypotenuse; explain why a non-right triangle needs another method.',2,'geometry'),
 concept('vectors','Vectors & displacement','A displacement vector records direction and magnitude. Adding vectors combines successive displacements.','How does a vector differ from the position of a point?','Walk 3 units east and 4 north on a sketch. Compare the final displacement with the 7-unit path length.',2,'geometry'),
 concept('symmetry','Transformations & symmetry','A symmetry is a transformation that leaves an object unchanged as a whole. Reflection and rotation are examples.','Does the symmetry depend on which features you preserve?','Draw a square. Count its mirror axes and rotations that preserve it, including the unchanged position.',2,'geometry'),
 concept('limits','Limits & approaching','A limit describes what function values approach as the input approaches a point. The value at that point may differ.','Can a function have a limit where it is not defined?','For x≠1 simplify (x²−1)/(x−1). Compare values near 1 and explain the limit.',3,'analysis'),
 concept('derivatives','Derivatives & local change','Where it exists, a derivative is the limit of average rates of change over shrinking intervals.','How can the same journey have an average and an instantaneous speed?','For f(x)=x² at x=2, calculate [f(2+h)−f(2)]/h for h=0.1 and 0.01. Predict its limit.',3,'analysis'),
 concept('integrals','Integrals & accumulation','A definite integral measures signed accumulation. Under suitable conditions, the fundamental theorem connects accumulation with derivatives.','Why can accumulated signed area be smaller than total geometric area?','For f(x)=x on [0,2], use triangle area to compute the integral. Compare with the change in the antiderivative x²/2.',3,'analysis'),
 concept('graphs','Graphs & routes','A graph consists of vertices and edges expressing connections. Edges need not represent physical distances.','What information is lost when a city becomes a graph?','Draw four rooms as vertices and their doors as edges. Find a route visiting every room and identify a door whose removal disconnects your design.',4,'discrete'),
 concept('counting','Counting & combinations','Order matters for ordered arrangements; a combination selects a group without order. Keep those tasks distinct.','Are choosing a team and choosing its first two speakers the same task?','Choose two people from A, B and C. List the unordered teams, then list ordered speaker pairs.',4,'probability'),
 concept('induction','Induction & proof','Induction proves an initial case and shows that each case implies the next, covering the specified integer range.','Why is checking many cases different from proving the next step?','Prove 1+2+…+n=n(n+1)/2 for positive integers: start with n=1, then add n+1 to the induction hypothesis.',4,'discrete'),
 concept('probability','Probability & sample spaces','A probability model assigns weights to possible outcomes. Probabilities of all outcomes together sum to one.','Which assumptions make outcomes equally likely?','Model two independent fair coin tosses. List the outcomes and find the probability of exactly one head.',5,'probability'),
 concept('conditional-probability','Conditional probability','Conditional probability updates the considered possibilities using an event already known to have occurred.','Can knowing one event change the likelihood of another?','Roll a fair six-sided die. Given that the result is even, find the probability that it exceeds 3.',5,'probability'),
 concept('statistics','Statistics & variation','Statistics summarises data and uncertainty. An average alone can hide how widely observations vary.','Can two rooms have the same average brightness but very different experiences?','Compare readings {4,5,6} and {1,5,9}. Find each mean and range; explain what the mean hides.',5,'probability'),
 concept('continuity','Continuity & neighbourhoods','For real functions, continuity at a point means nearby inputs lead to outputs arbitrarily close to the value there.','Is a graph that looks smooth enough evidence for continuity?','Compare x² and a function that is 0 for x<0 and 1 for x≥0. Examine each near zero.',6,'topology'),
 concept('connectedness','Connectedness & separation','A topological space is connected when it cannot be split into two disjoint nonempty open pieces.','How does this precise notion relate to an unbroken path?','Compare the real intervals [0,1] and [2,3] separately and as a union. Explain how the gap separates the union.',6,'topology'),
 concept('homeomorphisms','Homeomorphisms & preserved structure','A homeomorphism is a bijection that is continuous in both directions. It preserves topological structure.','Why does continuity of the inverse matter?','Map [0,1] to [0,2] by f(x)=2x. Give its inverse and explain why both are continuous.',6,'topology'),
 concept('logic','Statements & implication','An implication specifies what follows if its premise holds. It differs from its converse.','Does “if A, then B” guarantee “if B, then A”?','Compare “if an integer is divisible by 4, it is even” with its converse. Find a counterexample to the converse.',7,'logic'),
 concept('quantifiers','Quantifiers & counterexamples','“For every” makes a universal claim; “there exists” makes an existence claim. Their negations differ.','What evidence is enough to disprove a universal claim?','Negate “every book in this room is red”. Explain why one non-red book settles the negation.',7,'logic'),
 concept('algorithms','Algorithms & termination','An algorithm describes precise steps for a task. Correctness and termination must be examined for the allowed inputs.','Can a procedure give the right answer when it stops yet fail to stop?','Trace Euclid’s algorithm on 18 and 12: replace a pair (a,b) with (b,a mod b) until b=0. Explain why nonnegative remainders decrease.',7,'discrete'),
]);
const floors=[
 ['foundations','Foundations','Start with sets, numbers and functions. The entrance hall contains your Atlas of Ideas monitor.'],
 ['algebra','Algebra','Turn symbols into relationships, find unknowns and compare representations.'],
 ['geometry','Geometry','Explore shape, direction, distance and transformations through diagrams.'],
 ['analysis','Calculus & analysis','Study local change, approaching values and accumulated quantities.'],
 ['discrete','Discrete mathematics','Explore networks, arrangements and proofs about whole-number structures.'],
 ['probability','Probability & statistics','Model uncertainty, examine conditions and compare data without hiding variation.'],
 ['topology','Topology','Investigate continuity, separation and properties preserved by continuous maps.'],
 ['observatory','Logic & computation observatory','Look across the city while examining claims, counterexamples and procedures.'],
];
export const MATH_FLOORS=Object.freeze(floors.map(([id,name,description],index)=>Object.freeze({id,index,name,description,concepts:Object.freeze(MATH_CONCEPTS.filter(item=>item.floor===index).map(item=>item.id))})));
export const mathConcept=id=>MATH_CONCEPTS.find(item=>item.id===id)||null;
export const mathFloor=index=>MATH_FLOORS.find(item=>item.index===index)||null;
export const mathFloorLabel=index=>`${index===0?'Ground floor':'Floor '+(index+1)} · ${mathFloor(index)?.name||'Mathematics'}`;
