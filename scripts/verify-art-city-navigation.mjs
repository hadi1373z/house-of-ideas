import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../web/vendor/three.module.js';
import {ARTISTS} from '../web/art-city-data.js';
import {buildArtCity} from '../web/art-city-scene.js';
import {findCityPath} from '../web/art-city-navigation.js';
import {starter} from '../web/model.js';
import {pragueDate, reflect} from '../web/socrates.js';
import {centerOf, canExploreAt, canOccupy, roomAtPoint, entranceFor} from '../web/navigation.js';

const city = buildArtCity(THREE, ARTISTS);
assert.equal(city.houses.length, 10);
assert.equal(city.houses.reduce((count, house) => count + house.approaches.length, 0), 60);
let position = {x: city.spawn.x + 1.2, z: city.spawn.z + 1.2}, routes = 0;
assert.ok(city.canStand(position.x, position.z));
function follow(target, description) {
  assert.ok(city.canStand(target.x, target.z), description + ' has a clear destination');
  const route = findCityPath(city, position, target);
  assert.ok(route.length, description + ' is reachable by Socrates');
  assert.deepEqual(route.at(-1), {x: target.x, z: target.z});
  let previous = position;
  for (const point of route) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
    const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
    const steps = Math.max(1, Math.ceil(distance / .04));
    for (let sample = 0; sample <= steps; sample++) {
      const t = sample / steps;
      assert.ok(city.canStand(previous.x + (point.x - previous.x) * t,
        previous.z + (point.z - previous.z) * t), description + ' route stays clear between waypoints');
    }
    previous = point;
  }
  position = {x: target.x, z: target.z}; routes++;
}
for (const artist of ARTISTS) {
  const house = city.houses.find(item => item.artistId === artist.id);
  follow(house.entry, artist.name + ' doorway');
  follow(city.entryFor(artist.id), artist.name + ' interior');
  for (const work of artist.works) {
    const anchor = house.approaches.find(item => item.workId === work.id);
    assert.ok(anchor, work.title + ' has an inspection anchor');
    follow(anchor, artist.name + ' / ' + work.title);
  }
}
follow(city.spawn, 'return to the city gate');
assert.deepEqual(findCityPath(city, position, {x: 100, z: 0}), []);
assert.deepEqual(findCityPath(city, {x: -100, z: 0}, city.spawn), []);
const unsafeStart = {x: city.bounds.minX + .21, z: 0};
assert.equal(city.canStand(unsafeStart.x, unsafeStart.z), false);
assert.deepEqual(findCityPath(city, unsafeStart, city.spawn), [], 'Grid rounding must not accept a blocked starting position');
assert.deepEqual(findCityPath(city, position, {x: NaN, z: 0}), []);
assert.deepEqual(findCityPath(city, {x: 0, z: Infinity}, city.spawn), []);
assert.deepEqual(findCityPath(null, position, city.spawn), []);
const wall = city.colliders.find(item => item.label === 'Back wall');
assert.ok(wall);
assert.deepEqual(findCityPath(city, position, {x: (wall.minX + wall.maxX) / 2,
  z: (wall.minZ + wall.maxZ) / 2}), []);
// A valid destination across a fully closed barrier is unreachable, rather than
// a blocked destination being treated as a successful pathfinding exercise.
const divided = {bounds: {minX: -2, maxX: 2, minZ: -2, maxZ: 2},
  canStand: (x, z) => x > -1.8 && x < 1.8 && z > -1.8 && z < 1.8 && Math.abs(x) > .25};
assert.deepEqual(findCityPath(divided, {x: -1.2, z: 0}, {x: 1.2, z: 0}), []);

// Execute the real scene functions without creating a WebGL renderer. The
// source extraction keeps this regression tied to the shipped implementation.
const source = await readFile(new URL('../web/scene.js', import.meta.url), 'utf8');
function declaration(name) {
  const start = source.indexOf(' function ' + name + '(');
  assert.ok(start >= 0, 'scene exports an internal ' + name + ' declaration');
  const end = source.indexOf('\n function ', start + 1);
  assert.ok(end > start, 'scene declaration is followed by another function');
  return source.slice(start, end);
}
const actualFunctions = ['resetInput', 'faceDirection', 'placeCityPlayer', 'homeReturnPoint', 'leaveArtCity']
  .map(declaration).join('\n');
function verifyReturn(presenting, fromNeighborhood, blockSaved = false) {
  const camera = new THREE.PerspectiveCamera(); camera.position.set(city.spawn.x, 1.65, city.spawn.z);
  const visitor = new THREE.Group(); visitor.position.set(city.spawn.x + 1.2, 0, city.spawn.z + 1.2);
  const saved = {position: fromNeighborhood ? new THREE.Vector3(-5.7, 1.65, 8.3) : new THREE.Vector3(-7.8, 1.65, -5.9),
    yaw: .84, pitch: -.21, neighborhood: fromNeighborhood,
    resident: new THREE.Vector3(-1.8, 0, -5.9), roomId: 'art'};
  const built = {group: new THREE.Group()}, neighborhoodGroup = new THREE.Group(), designs = {group: new THREE.Group()};
  built.group.visible = neighborhoodGroup.visible = designs.group.visible = false;
  const bodyClasses = new Set(['art-city-mode']), returnButton = {hidden: false}, relocations = [], sceneEvents = [];
  let resets = 0;
  const privateHouse = reflect(starter(), pragueDate(), 'questions', 'A private reflection to preserve.');
  privateHouse.ideas.push({id: 'private-note', roomId: 'art', title: 'Private note', text: 'Personal sketch notes.', cue: 'book'});
  privateHouse.resident = {messages: [{role: 'user', text: 'A private conversation.'}], memories: [{text: 'A private memory.'}]};
  const before = JSON.stringify(privateHouse);
  // New furnishings can occupy the original player and companion positions
  // during a gallery visit. Room centres remain clear in this collision fixture.
  const furniture = blockSaved ? [saved.position, saved.resident].map(point => ({
    minX: point.x - .25, maxX: point.x + .25, minZ: point.z - .25, maxZ: point.z + .25
  })) : [];
  const homeClear = (x, z) => canExploreAt(privateHouse, [], x, z) && canOccupy(furniture, x, z);
  const freeRoom = room => { const point = centerOf(room); return new THREE.Vector3(point.x, 0, point.z); };
  assert.equal(homeClear(saved.position.x, saved.position.z), !blockSaved);
  assert.equal(homeClear(saved.resident.x, saved.resident.z), !blockSaved);
  const context = vm.createContext({THREE, camera, visitor, built, neighborhoodGroup, designs,
    artCity: city, makersCity: null, cityId: 'artists', artCityMode: true, artCitySaved: saved, house: privateHouse,
    neighborhoodMode: false, residentRoomId: null, path: [{x: 2, z: 4}], pause: 0,
    residentTalking: true, summoning: true, yaw: -1.8, pitch: .4, firstPersonPosition: null,
    held: new Set(['up']), stick: {reset() { resets++; }}, look: {id: 1},
    playerPath: [{x: 1, z: 2}], seatTarget: {height: 1.1}, landmarkLookAt: {x: 4, z: 2},
    showCityLayers() {},
    xr: {setFloorHeight(){},presenting, relocate(...args) { relocations.push(args); }},
    currentFloor:0,navigationHouse:()=>privateHouse,groundFloor(){},canStand: homeClear, canNavigate: homeClear, freePoint: freeRoom, roomAtPoint, entranceFor,
    onPick(data) { sceneEvents.push({data, cityMode: context.artCityMode, returnHidden: returnButton.hidden}); },
    document: {body: {classList: {remove(value) { bodyClasses.delete(value); }}},
      getElementById(id) { assert.equal(id, 'art-city-return'); return returnButton; }}
  });
  vm.runInContext(actualFunctions, context, {filename: 'scene-city-return-regression.js'});
  city.group.visible = true;
  vm.runInContext('leaveArtCity()', context);
  assert.equal(context.artCityMode, false); assert.equal(context.artCitySaved, null);
  assert.equal(context.cityId, 'home'); assert.equal(context.landmarkLookAt, null);
  assert.equal(city.group.visible, false);
  assert.equal(built.group.visible, true); assert.equal(neighborhoodGroup.visible, true);
  assert.equal(designs.group.visible, true); assert.equal(visitor.visible, true);
  if (blockSaved) {
    assert.ok(homeClear(visitor.position.x, visitor.position.z), 'The companion returns to a clear point after furnishing changes');
    assert.notDeepEqual(visitor.position.toArray(), saved.resident.toArray());
    assert.equal(roomAtPoint(privateHouse, visitor.position.x, visitor.position.z), 'art');
  } else assert.deepEqual(visitor.position.toArray(), saved.resident.toArray());
  assert.equal(context.residentRoomId, 'art'); assert.equal(context.neighborhoodMode, fromNeighborhood);
  assert.equal(context.residentTalking, false); assert.equal(context.summoning, false);
  assert.equal(context.yaw, saved.yaw); assert.equal(context.pitch, saved.pitch);
  assert.equal(camera.rotation.order, 'YXZ'); assert.equal(camera.rotation.x, saved.pitch);
  assert.equal(camera.rotation.y, saved.yaw);
  const returned = context.firstPersonPosition;
  assert.ok(homeClear(returned.x, returned.z), 'The player returns to a currently clear point');
  if (blockSaved) {
    assert.notDeepEqual(returned.toArray(), saved.position.toArray());
    const returnedRoom = roomAtPoint(privateHouse, returned.x, returned.z);
    if (fromNeighborhood) assert.ok(privateHouse.rooms.some(room => room.id === returnedRoom), 'An obstructed outdoor point falls back to a clear current room');
    else assert.equal(returnedRoom, 'math', 'An obstructed indoor point returns within its original room');
  } else assert.deepEqual(returned.toArray(), saved.position.toArray());
  assert.equal(context.held.size, 0); assert.equal(context.look, null);
  assert.equal(context.playerPath.length, 0); assert.equal(context.seatTarget, null);
  assert.equal(context.path.length, 0); assert.equal(resets, 1);
  assert.equal(bodyClasses.has('art-city-mode'), false); assert.equal(returnButton.hidden, true);
  for (const event of sceneEvents) {
    assert.equal(event.data.artAction, 'city-state');
    assert.equal(event.cityMode, false); assert.equal(event.returnHidden, true);
  }
  assert.equal(JSON.stringify(privateHouse), before, 'Returning preserves all personal house data');
  if (presenting) assert.deepEqual(relocations, [[returned.x, returned.z, saved.yaw, 0]]);
  else { assert.deepEqual(camera.position.toArray(), returned.toArray()); assert.equal(relocations.length, 0); }
  vm.runInContext('leaveArtCity()', context);
  assert.equal(resets, 1, 'Returning again is a harmless no-op');
}
verifyReturn(false, false);
verifyReturn(false, true);
verifyReturn(true, false);
verifyReturn(true, true);
verifyReturn(false, false, true);
verifyReturn(false, true, true);
verifyReturn(true, false, true);
verifyReturn(true, true, true);
city.dispose();
console.log('Artist City navigation passed: ' + routes + ' real routes through ten houses and sixty artwork anchors, segment collisions, unreachable targets and source-backed desktop/XR return before and after furnishing changes with personal data preserved.');
