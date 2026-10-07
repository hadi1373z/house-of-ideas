import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {initDesignerUI} from '../web/designer-ui.js';
import {starter,clone} from '../web/model.js';
import {pragueDate} from '../web/socrates.js';
import {triangleGlb} from './verify-design-fixture.mjs';

const elements=new Map(),downloads=[],blobs=new Map();let blobSequence=0;
class Element{
 constructor(tag='DIV'){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.files=[];this._value='';this.textContent='';this.classList={add(){}};}
 set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
 set value(value){this._value=value;if(this.type==='file'&&!value)this.files=[];}get value(){return this._value;}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=[...children];}setAttribute(key,value){this.attributes[key]=value;}
 showModal(){this.open=true;}close(){this.open=false;}remove(){}click(){if(this.tagName==='A')downloads.push({name:this.download,blob:blobs.get(this.href)});else return this.onclick?.();}
}
for(const id of ['design-dialog','design-open','design-return']){const element=new Element(id.endsWith('dialog')?'DIALOG':'BUTTON');element.id=id;}
const $=id=>{assert.ok(elements.has(id),`Expected UI element ${id}`);return elements.get(id);},document={body:new Element('BODY'),createElement:tag=>new Element(tag)};
const bytes=triangleGlb(),assetId=createHash('sha256').update(bytes).digest('hex'),assetMap=new Map(),window={crypto:webcrypto,atob:globalThis.atob,btoa:globalThis.btoa,Blob:globalThis.Blob,URL:{createObjectURL(blob){const id=`blob:design-test-${++blobSequence}`;blobs.set(id,blob);return id;},revokeObjectURL(){}},setTimeout:callback=>callback(),async fetch(url){const value=assetMap.get(url.replace('local:',''));return {ok:!!value,arrayBuffer:async()=>value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)};}};
let house=starter(),readOnly=false,saving=false,failSave=false,failImport=false,saveCalls=0,importCalls=0,createCalls=0,selected='math',position=[-1.5,0,-1],tourId=null,returns=0,pendingImport=null,pendingSave=null,deferImport=false,deferSave=false,askedDesign=null,askCalls=0;
const scene={suggestDesignPosition:()=>position,async tourDesign(id){tourId=id;},returnDesign(){returns++;}};
const ui=initDesignerUI({$,document,window,scene,getHouse:()=>house,getSelected:()=>selected,isReadOnly:()=>readOnly,isSaving:()=>saving,
 async saveHouse(next){saveCalls++;if(failSave)throw Error('Local disk is unavailable');if(deferSave)await new Promise(resolve=>pendingSave=resolve);house=clone(next);},
 async importAsset(value){importCalls++;if(failImport)throw Error('Asset storage is unavailable');if(deferImport)await new Promise(resolve=>pendingImport=resolve);const id=createHash('sha256').update(value).digest('hex');assetMap.set(id,Buffer.from(value));return {id,bytes:value.length};},
 assetUrl:id=>`local:${id}`,async createHome(next){createCalls++;house=clone(next);},examineDesign(item){askCalls++;askedDesign=item;},local:true,preview:false,notify(){}});
const submit=id=>$(id).onsubmit({preventDefault(){}}),chooseGlb=(name='A reading chair')=>{$('design-file').files=[new File([bytes],'chair.glb')];$('design-title').value=name;$('design-note').value='A seat for examining a difficult belief.';$('design-scale').value='1';$('design-kind').value='object';$('design-placement').value='room';$('design-action').value='question';};
const chooseJson=data=>{$('design-template-file').files=[new File([JSON.stringify(data)],'design.json',{type:'application/json'})];};

// Physical designer objects receive safe placement and a useful inspectable function.
chooseGlb();await submit('design-import-form');assert.equal(saveCalls,1);assert.equal(house.designObjects.length,1);const chair=house.designObjects[0];assert.equal(chair.assetId,assetId);assert.deepEqual(chair.position,[-1.5,0,-1]);assert.equal(chair.roomId,'math');assert.equal(chair.action,'question');assert.equal($('design-file').files.length,0);assert.match($('design-detail-action').textContent,/example and a counterexample/);
await $('design-tour').onclick();assert.equal(tourId,chair.id);assert.equal($('design-dialog').open,false);$('design-return').onclick();assert.equal(returns,1);

// A failed durable edit keeps its exact note and function for retry.
ui.inspect(chair.id);$('design-edit-title').value='My quiet reading chair';$('design-edit-action').value='experiment';$('design-edit-note').value='Predict whether the seat helps me concentrate.';failSave=true;await submit('design-edit-form');assert.equal($('design-edit-note').value,'Predict whether the seat helps me concentrate.');assert.equal(house.designObjects[0].action,'question');assert.match($('design-status').textContent,/disk is unavailable/);failSave=false;await submit('design-edit-form');assert.equal(house.designObjects[0].action,'experiment');assert.match($('design-detail-action').textContent,/Predict one effect/);

// Bad template placement is recoverable through real validated spatial controls.
assert.equal($('design-edit-scale').value,'1');assert.equal($('design-edit-rotation').value,'0');assert.equal($('design-edit-x').value,'-1.5');assert.match($('design-edit-placement').textContent,/room’s centre/);
$('design-edit-scale').value='.65';$('design-edit-rotation').value='45';$('design-edit-x').value='-1.25';$('design-edit-y').value='.1';$('design-edit-z').value='-.75';failSave=true;await submit('design-edit-form');assert.equal(house.designObjects[0].scale,1);assert.equal($('design-edit-scale').value,'.65');assert.equal($('design-edit-rotation').value,'45');assert.equal($('design-edit-x').value,'-1.25');assert.equal($('design-edit-y').value,'.1');assert.equal($('design-edit-z').value,'-.75');failSave=false;await submit('design-edit-form');const moved=house.designObjects[0];assert.equal(moved.scale,.65);assert.equal(moved.rotation,Math.PI/4);assert.deepEqual(moved.position,[-1.25,.1,-.75]);assert.equal(moved.assetId,assetId);assert.equal(moved.roomId,'math');assert.equal(moved.kind,'object');assert.equal(moved.action,'experiment');
const beforeInvalidTransform=saveCalls;$('design-edit-x').value='41';await submit('design-edit-form');assert.equal(saveCalls,beforeInvalidTransform);assert.equal($('design-edit-x').value,'41');assert.deepEqual(house.designObjects[0].position,[-1.25,.1,-.75]);assert.match($('design-status').textContent,/position/);$('design-edit-x').value='-1.25';
$('design-edit-scale').value='8.1';await submit('design-edit-form');assert.equal(saveCalls,beforeInvalidTransform);assert.equal($('design-edit-scale').value,'8.1');assert.match($('design-status').textContent,/scale/);$('design-edit-scale').value='.65';

// Object activities save actual daily learning records and preserve a failed answer.
$('design-answer').value='The chair helped me explain a difficult assumption.';failSave=true;await submit('design-activity-form');assert.equal($('design-answer').value,'The chair helped me explain a difficult assumption.');assert.equal(house.learning,undefined);failSave=false;await submit('design-activity-form');assert.equal($('design-answer').value,'');let day=house.learning.days.find(item=>item.date===pragueDate());assert.equal(day.reflections.find(item=>item.roomId==='math').answer,'The chair helped me explain a difficult assumption.');assert.match($('design-status').textContent,/learning journal/);
const beforeAskSave=saveCalls,beforeAskImports=importCalls;await $('design-examine').onclick();assert.equal(askCalls,1);assert.deepEqual(askedDesign,house.designObjects[0]);assert.notEqual(askedDesign,house.designObjects[0],'Conversation handoff receives independent data.');assert.equal(saveCalls,beforeAskSave);assert.equal(importCalls,beforeAskImports);assert.equal($('design-dialog').open,false,'The button prepares a conversation without silently sending or saving one.');

// Inspection changes during a pending save must retain the later design draft.
chooseGlb('A second design');$('design-placement').value='garden';await submit('design-import-form');const second=house.designObjects[1];ui.inspect(chair.id);$('design-edit-note').value='First pending note';deferSave=true;const oldEdit=submit('design-edit-form');assert.equal(typeof pendingSave,'function');ui.inspect(second.id);$('design-edit-note').value='Second unfinished note';$('design-edit-scale').value='.4';$('design-edit-rotation').value='-30';$('design-edit-x').value='-.7';$('design-edit-y').value='.2';$('design-edit-z').value='-2';pendingSave();await oldEdit;deferSave=false;assert.equal($('design-edit-note').value,'Second unfinished note');assert.equal($('design-edit-scale').value,'.4');assert.equal($('design-edit-rotation').value,'-30');assert.equal($('design-edit-x').value,'-.7');assert.equal($('design-edit-y').value,'.2');assert.equal($('design-edit-z').value,'-2');assert.equal($('design-detail-title').textContent,second.title);assert.match($('design-edit-placement').textContent,/assigned garden gallery location/);

// A delayed reflection must not erase another object's answer, even with equal text.
ui.inspect(chair.id);$('design-answer').value='A shared observation';deferSave=true;const oldActivity=submit('design-activity-form');ui.inspect(second.id);$('design-answer').value='A shared observation';pendingSave();await oldActivity;deferSave=false;assert.equal($('design-answer').value,'A shared observation');assert.equal($('design-detail-title').textContent,second.title);
selected='art';$('design-answer').value='The garden exhibit changes how I see the bedroom.';await submit('design-activity-form');day=house.learning.days.find(item=>item.date===pragueDate());assert.equal(day.reflections.find(item=>item.roomId==='art').answer,'The garden exhibit changes how I see the bedroom.','Garden activities use the selected room.');assert.equal($('design-answer').value,'');selected='math';

// Failed uploads and crowded rooms retain the chosen file and import draft.
chooseGlb('Keep this import draft');const failedFile=$('design-file').files[0];failImport=true;await submit('design-import-form');assert.equal($('design-file').files[0],failedFile);assert.equal($('design-title').value,'Keep this import draft');assert.match($('design-status').textContent,/Asset storage/);failImport=false;position=null;const beforeCrowding=saveCalls;await submit('design-import-form');assert.equal(saveCalls,beforeCrowding);assert.equal($('design-file').files[0],failedFile);assert.match($('design-status').textContent,/no clear display space/);position=[-1.5,0,-1];

// Entering another home during upload cannot write the old draft into that home.
chooseGlb('A draft for the first home');deferImport=true;const oldHomeImport=submit('design-import-form');await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof pendingImport,'function');const beforeChanging=saveCalls;house=starter();ui.onHomeChange();pendingImport();await oldHomeImport;deferImport=false;assert.equal(saveCalls,beforeChanging);assert.equal(house.designObjects,undefined);assert.equal($('design-title').value,'A draft for the first home');assert.match($('design-status').textContent,/another home/);

// Archived houses allow tours and exports while mutation entry points stay guarded.
house={...starter(),designObjects:[chair]};readOnly=true;ui.inspect(chair.id);assert.equal($('design-edit-form').hidden,true);assert.equal($('design-activity-form').hidden,true);assert.equal($('design-remove').hidden,true);const archivedSaves=saveCalls,archivedImports=importCalls;await submit('design-edit-form');$('design-answer').value='Do not overwrite the archive';await submit('design-activity-form');await $('design-remove').onclick();chooseGlb();await submit('design-import-form');assert.equal(saveCalls,archivedSaves);assert.equal(importCalls,archivedImports);assert.match($('design-status').textContent,/earlier home is preserved/);readOnly=false;ui.render();

// A complete house is always a garden exhibit; its GLB remains self-contained.
chooseGlb('A designer’s full house');$('design-kind').value='house';$('design-kind').onchange();assert.equal($('design-placement').value,'garden');assert.equal($('design-placement').disabled,true);await submit('design-import-form');assert.equal(house.designObjects.at(-1).kind,'house');assert.equal(house.designObjects.at(-1).placement,'garden');assert.equal(house.designObjects.at(-1).roomId,undefined);

// Portable export really embeds the bytes; importing it builds an independent house.
await $('design-export').onclick();assert.equal(downloads.at(-1).name,'house-of-ideas-design-package.json');const packaged=JSON.parse(await downloads.at(-1).blob.text());assert.equal(packaged.type,'house-of-ideas-design-package');assert.equal(packaged.assets.length,1,'Repeated asset instances are exported once.');assert.deepEqual(Buffer.from(packaged.assets[0].base64,'base64'),bytes);
house=starter();chooseJson(packaged);await submit('design-template-form');assert.equal(createCalls,1);assert.deepEqual(house.designObjects,packaged.house.designObjects);assert.equal($('design-template-file').files.length,0);
// Editing only a note leaves an imported non-round-degree rotation byte-identical.
const exactRotation=Math.PI/7;house.designObjects.push({...clone(chair),id:'rotation-roundtrip',rotation:exactRotation});ui.inspect('rotation-roundtrip');$('design-edit-note').value='Keep the designer’s precise rotation.';await submit('design-edit-form');assert.equal(house.designObjects.find(item=>item.id==='rotation-roundtrip').rotation,exactRotation);
await $('design-template-export').onclick();const raw=JSON.parse(await downloads.at(-1).blob.text());assert.ok(raw.rooms);assert.equal(raw.assets,undefined);assert.match($('design-status').textContent,/GLB source files/);

// Invalid and incomplete packages are rejected before any local upload or new house.
const beforeInvalid=importCalls,homesBeforeInvalid=createCalls,broken=clone(packaged);broken.assets[0].id='f'.repeat(64);chooseJson(broken);const badFile=$('design-template-file').files[0];await submit('design-template-form');assert.equal(createCalls,homesBeforeInvalid);assert.equal(importCalls,beforeInvalid);assert.equal($('design-template-file').files[0],badFile);assert.match($('design-status').textContent,/identifiers/);
const missing=clone(packaged);missing.assets=[];chooseJson(missing);await submit('design-template-form');assert.equal(createCalls,homesBeforeInvalid);assert.match($('design-status').textContent,/missing a GLB/);
const wrongBytes=clone(packaged);wrongBytes.assets[0].base64=triangleGlb(json=>json.asset.generator='Different bytes').toString('base64');chooseJson(wrongBytes);await submit('design-template-form');assert.equal(importCalls,beforeInvalid);assert.match($('design-status').textContent,/content identifier/);

// House JSON can build next door from an archived home; original history remains external.
readOnly=true;const template=starter();template.rooms[0].name='Designer study';template.localMetadata={keep:'designer provenance'};chooseJson(template);await submit('design-template-form');assert.equal(createCalls,homesBeforeInvalid+1);assert.equal(house.rooms[0].name,'Designer study');assert.deepEqual(house.localMetadata,template.localMetadata);readOnly=false;
console.log('Designer UI: recoverable spatial controls, placement/tours, real activity reflections, Socratic handoff, failed/concurrent transform drafts, archive guards and portable independent imports passed.');
