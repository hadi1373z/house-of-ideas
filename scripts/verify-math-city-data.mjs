import assert from 'node:assert/strict';
import {MATH_BUILDING,MATH_FLOORS,MATH_CONCEPTS,mathFloor,mathConcept,mathFloorLabel} from '../web/math-city-data.js';
assert.equal(MATH_BUILDING.floors,8);assert.equal(MATH_BUILDING.floorHeight,4);
assert.equal(MATH_FLOORS.length,8);assert.equal(MATH_CONCEPTS.length,24);
assert.equal(new Set(MATH_FLOORS.map(item=>item.id)).size,8);assert.equal(new Set(MATH_CONCEPTS.map(item=>item.id)).size,24);
const assigned=new Set();
for(const [index,floor]of MATH_FLOORS.entries()){
 assert.equal(floor.index,index);assert.equal(mathFloor(index),floor);assert.equal(floor.concepts.length,3);assert.match(mathFloorLabel(index),new RegExp(floor.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 for(const id of floor.concepts){assert.equal(assigned.has(id),false);assigned.add(id);const item=mathConcept(id);assert.equal(item.floor,index);assert.ok(Object.isFrozen(item));for(const key of ['title','summary','question','exercise'])assert.ok(typeof item[key]==='string'&&item[key].trim().length>8&&item[key].length<500,key+' useful and bounded');assert.equal(new URL(item.sourceUrl).protocol,'https:');}
 assert.ok(Object.isFrozen(floor));assert.ok(Object.isFrozen(floor.concepts));
}
assert.equal(assigned.size,24);assert.equal(mathConcept('unknown'),null);assert.equal(mathFloor(-1),null);assert.equal(mathFloor(8),null);
assert.match(mathConcept('functions').summary,/exactly one output/);assert.match(mathConcept('pythagoras').summary,/Euclidean right triangle/);assert.match(mathConcept('homeomorphisms').summary,/both directions/);assert.match(mathConcept('logic').exercise,/counterexample/);
assert.throws(()=>{MATH_CONCEPTS[0].floor=7;},TypeError);assert.throws(()=>MATH_FLOORS[0].concepts.push('foreign'),TypeError);
console.log('Mathematics data verified: eight physical floors, 24 bounded learning objects, complete unique floor assignments, immutable source-linked content and accurate key qualifications.');
