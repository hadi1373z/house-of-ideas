import assert from 'node:assert/strict';
import * as Real from '../web/vendor/three.module.js';
import {ARTISTS as originalArtists} from '../web/art-city-data.js';
import {ARTISTS} from '../web/artist-catalog.js';
import {DALI_OBJECTS} from '../web/dali-data.js';
import {buildArtCity} from '../web/art-city-scene.js';
import {addDaliHouse} from '../web/dali-house-scene.js';
import {buildArtistResidents} from '../web/artist-residents.js';
import {buildArtistCityEditions} from '../web/artist-city-editions.js';
import {findCityPath} from '../web/art-city-navigation.js';
import {initialCityNetwork,validateCityNetwork} from '../web/city-network.js';
import {converseWithArtist,artistConversation} from '../web/artist-dialogue.js';
import {proposeArtistHome,decideArtistHome} from '../web/artist-homes.js';
import {worldInventory} from '../web/world-guide.js';
import {starter} from '../web/model.js';
const THREE={...Real,TextureLoader:class{load(){return new Real.Texture();}}};
const base=buildArtCity(THREE,originalArtists),oldLots=base.houses.map(h=>[h.id,h.cx,h.cz,h.group.uuid]),oldColliders=structuredClone(base.colliders);
const city=addDaliHouse(THREE,base);assert.equal(city.houses.length,11);assert.deepEqual(city.houses.slice(0,10).map(h=>[h.id,h.cx,h.cz,h.group.uuid]),oldLots);assert.deepEqual(city.colliders.slice(0,oldColliders.length),oldColliders);
let routes=0;for(const home of city.houses){const destination=city.entryFor(home.artistId);assert.ok(city.canStand(destination.x,destination.z));const path=findCityPath(city,city.spawn,destination);assert.ok(path.length,home.name+' can be reached from the city entrance');for(const point of path)assert.ok(city.canStand(point.x,point.z));routes++;}
const hosts=buildArtistResidents(THREE,ARTISTS,city);assert.equal(hosts.states().length,11);assert.equal(city.insideAt(hosts.state('dali').position.x,hosts.state('dali').position.z),'dali');const first=hosts.state('dali').position;assert.ok(Math.hypot(city.entryFor('dali').x-first.x,city.entryFor('dali').z-first.z)<3.2,'Arrival must be within talking distance');
for(let i=0;i<1200;i++){hosts.update(.1);const p=hosts.state('dali').position;assert.ok(city.canStand(p.x,p.z));assert.equal(city.insideAt(p.x,p.z),'dali');}
assert.notDeepEqual(hosts.state('dali').position,first,'Dalí explores his own residence');
const found=new Set();city.group.traverse(o=>{if(o.userData.daliObjectId)found.add(o.userData.daliObjectId);});assert.deepEqual([...found].sort(),DALI_OBJECTS.map(o=>o.id).sort());
const old=initialCityNetwork(),oldBytes=JSON.stringify(old);let network=converseWithArtist(old,{artistId:'dali',text:'How could the library help me make unexpected associations?',workId:'galatea'});assert.equal(JSON.stringify(old),oldBytes);assert.equal(artistConversation(validateCityNetwork(JSON.parse(JSON.stringify(network))),'dali').length,2);network=proposeArtistHome(network,'dali');network=decideArtistHome(network,network.artistHomes.proposals[0].id,'approved');const editions=buildArtistCityEditions(THREE,ARTISTS,city,network.artistHomes.editions);assert.ok(editions.entryFor('dali'));assert.ok(editions.entryFor('dali',network.artistHomes.editions[0].id));
const house=starter(),inventory=worldInventory(house,{roomInventory:id=>[{roomId:id,bookId:'assumptions',label:'Read a book'}]},network);assert.equal(inventory.filter(i=>i.kind==='Residence').length,11);assert.equal(inventory.filter(i=>i.daliObjectId).length,5);assert.ok(inventory.find(i=>i.daliObjectId==='drawer-library').z===-25);assert.equal(inventory.filter(i=>i.kind==='Room').length,house.rooms.length);assert.equal(inventory.filter(i=>i.kind==='Floor').length,8);assert.ok(inventory.some(i=>i.artistEditionId===network.artistHomes.editions[0].id));
editions.dispose();hosts.dispose();city.dispose();console.log('Dalí/world guide passed: 11 reachable preserved lots, safe resident patrol, five physical activities, durable dialogue/approved annex and complete room/painting/floor inventory; '+routes+' city routes.');
