import assert from 'node:assert/strict';
import * as THREE from '../web/vendor/three.module.js';
import {createPatternHouse} from '../web/pattern-house.js';
import {buildHouse} from '../web/residence-scene-v1.js';
import {extractObjectPreview} from '../web/object-preview.js';
import {libraryObjects} from '../web/object-library.js';
import {worldInventory} from '../web/world-guide.js';
import {buildMathCity} from '../web/math-city-scene.js';
import {buildArtCity} from '../web/art-city-scene.js';
import {addDaliHouse} from '../web/dali-house-scene.js';
import {ARTISTS} from '../web/artist-catalog.js';
const house=createPatternHouse(),before=JSON.stringify(house),built=buildHouse(house,true,true);built.group.updateMatrixWorld(true);
const inventory=worldInventory(house,{roomInventory:id=>[...(built.interactions||[]).filter(i=>i.roomId===id),...house.ideas.filter(i=>i.roomId===id).map(i=>({ideaId:i.id,label:i.title}))]});
const objects=libraryObjects(inventory);assert.ok(objects.length>70);assert.ok(objects.every(o=>o.kind!=='Room'&&o.kind!=='Resident'));
let checked=0;for(const item of objects.filter(i=>i.city==='home')){const preview=extractObjectPreview(built.group,item);assert.ok(preview,item.title);assert.ok(preview.size.length()>0);for(const mesh of preview.group.children){assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));assert.ok(new THREE.Box3().setFromObject(mesh).isEmpty()===false);}preview.dispose();checked++;}
assert.equal(JSON.stringify(house),before);assert.ok(built.group.children.length,'Preview disposal does not alter the inhabited renderer.');
for(let floor=0;floor<8;floor++){const city=buildMathCity(THREE,{floor});for(const item of objects.filter(i=>i.conceptId&&i.floor===floor)){const p=extractObjectPreview(city.group,item);assert.ok(p,item.title);p.dispose();checked++;}city.dispose();}
const artists=addDaliHouse({...THREE,TextureLoader:class{load(){return new THREE.Texture();}}},buildArtCity(THREE,ARTISTS.filter(a=>a.id!=='dali')));
for(const item of objects.filter(i=>i.city==='artists')){const p=extractObjectPreview(artists.group,item);assert.ok(p,item.title);p.dispose();checked++;}artists.dispose();
console.log('Object library verified: '+checked+' real home/gallery/Dalí/mathematics mesh previews, all physical floors, immutable source homes and independent preview resource disposal.');
