import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MUSIC_MODELS} from '../web/object-store/music-models.js';
import {assignStoreObject,STORE_OBJECTS} from '../web/object-store.js';
import {constructionDraft} from '../web/construction-data.js';
import {starter} from '../web/model.js';
import {validateGlb} from '../web/design-objects.js';
import {MARKET_STALLS} from '../web/object-market-scene.js';
assert.equal(MUSIC_MODELS.length,10);assert.equal(new Set(MUSIC_MODELS.map(m=>m.audioSha256)).size,10);
for(const item of MUSIC_MODELS){const audio=await fs.readFile('web/'+item.audioUrl.slice(2));assert.equal(createHash('sha256').update(audio).digest('hex'),item.audioSha256);assert.equal(audio.length,item.audioBytes);assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.toString('ascii',8,12),'WAVE');assert.equal(audio.readUInt32LE(4),audio.length-8);assert.equal(audio.readUInt32LE(40),audio.length-44);assert.equal(audio.readUInt16LE(20),1);assert.equal(audio.readUInt16LE(22),1);assert.equal(audio.readUInt32LE(24),22050);assert.equal(audio.readUInt16LE(34),16);assert.ok(Math.abs((audio.length-44)/44100-item.duration)<.001);let energy=0;for(let i=44;i<audio.length;i+=2)energy+=audio.readInt16LE(i)**2;assert.ok(Math.sqrt(energy/((audio.length-44)/2))>100,'The track contains audible, non-silent PCM audio.');validateGlb(await fs.readFile('web/object-store/assets/'+item.assetId+'.glb'));assert.ok(MARKET_STALLS.find(s=>s.id===item.id).x<-30,'Every music poster belongs to the Listening Garden.');const home=assignStoreObject(constructionDraft(starter()),'math',item.id);assert.equal(STORE_OBJECTS.find(i=>i.assetId===home.designObjects[0].assetId).audioUrl,item.audioUrl,'Placed poster retains a known bundled player identity.');}
console.log('Listening Garden: ten distinct non-silent PCM songs with exact duration/hash/source records, valid 3D posters, dedicated physical stalls and retained player identities after Construction passed.');
