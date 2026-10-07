import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import * as model from '../web/model.js';
import worker from '../worker/index.js';
// DOM-action integration harness. This checks state flows; it is not a browser/GPU test.
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.hidden=false;this.checked=false;this.textContent='';this.style={};this.attributes={};this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}setAttribute(k,v){this.attributes[k]=v;}setPointerCapture(){}showModal(){this.open=true;}close(){this.open=false;}createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}};}getScreenCTM(){return {inverse(){return {};}};}
}
const elements=new Map(),html=await fs.readFile('web/index.html','utf8');for(const match of html.matchAll(/<([^\s>]+)[^>]*\bid="([^"]+)"([^>]*)>/g)){const e=new Element(match[1]);e.hidden=match[3].includes('hidden');elements.set(match[2],e);}
const radios=model.CUES.map(value=>{const r=new Element('input');r.value=value;r.checked=value==='crystal';return r;});const saveArea=new Element();
const document={getElementById:id=>{assert.ok(elements.has(id),'Expected element '+id);return elements.get(id);},createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),body:new Element('body'),querySelectorAll:()=>[],querySelector:selector=>{if(selector==='.save-area')return saveArea;if(selector.includes(':checked'))return radios.find(r=>r.checked);const value=selector.match(/value="([^"]+)"/)?.[1];return radios.find(r=>r.value===value);}};
const sql=new DatabaseSync(':memory:');const file=(await fs.readdir('drizzle')).find(f=>f.endsWith('.sql'));sql.exec(await fs.readFile('drizzle/'+file,'utf8'));
const DB={prepare(query){return {bind(...p){return {async first(){return sql.prepare(query).get(...p)||null;}};}};}};let lastHouse=null,selected=null,failSave=false;
const context=vm.createContext({...model,document,console,crypto,window:{addEventListener(){}},setInterval(){},createScene(){return {load(h){lastHouse=model.clone(h);},select(id){selected=id;},setWalk(){},reset(){}};},async fetch(path,opts={}){if(failSave&&opts.method==='PUT')return Response.json({error:'Test save unavailable'},{status:503});return worker.fetch(new Request('https://house.test'+path,{...opts,headers:{...opts.headers,'oai-authenticated-user-id':'ui-user'}}),{DB});}});
const source=(await fs.readFile('web/app.js','utf8')).replace(/^import .*$/gm,'');vm.runInContext(source,context);const $=id=>elements.get(id);for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal($('save-state').textContent,'All changes saved');assert.equal(lastHouse.rooms.length,6);
const submit=()=>$('idea-form').onsubmit({preventDefault(){},submitter:new Element('button')});
$('add-idea').onclick();$('idea-title').value='A proof worth remembering';$('idea-text').value='The central observation goes here.';await submit();assert.equal(lastHouse.ideas.length,1);assert.equal($('idea-dialog').open,false);
// A failed save leaves both the previously saved house and the visible draft intact.
$('add-idea').onclick();$('idea-title').value='Draft survives';failSave=true;await submit();assert.equal(lastHouse.ideas.length,1);assert.equal($('idea-title').value,'Draft survives');assert.equal($('idea-dialog').open,true);assert.match($('idea-message').textContent,/unavailable/);failSave=false;await submit();assert.equal(lastHouse.ideas.length,2);
// Draw a room, connect it, switch to the house while keeping the draft, then build.
$('plan-tab').onclick();assert.equal($('plan-workspace').hidden,false);$('draw-room').onclick();$('plan-grid').onpointerdown({button:0,pointerId:1,clientX:0,clientY:10,preventDefault(){}});$('plan-grid').onpointermove({pointerId:1,clientX:5,clientY:15});$('plan-grid').onpointerup({pointerId:1,clientX:5,clientY:15});assert.equal($('plan-w').value,5);$('plan-name').value='New connections';$('room-form').onsubmit({preventDefault(){}});assert.equal($('room-list').children.length,7);
$('door-target').value='questions';$('add-door').onclick();$('house-tab').onclick();assert.equal($('plan-workspace').hidden,true);$('room-list').children[1].onclick();assert.equal(selected,'art');assert.equal($('room-name').textContent,'Art');$('plan-tab').onclick();await $('apply-plan').onclick();assert.equal(lastHouse.rooms.length,7);assert.equal(lastHouse.doors.length,8);assert.equal(lastHouse.ideas.length,2);assert.equal($('plan-workspace').hidden,true);
// Editing/moving an idea uses the same real storage action after a rebuild.
$('room-list').children[0].onclick();$('idea-list').children[0].onclick();$('idea-room').value='art';$('idea-text').value='Moved with its note';await submit();assert.equal(lastHouse.ideas[0].roomId,'art');assert.equal(lastHouse.ideas[0].text,'Moved with its note');
// Do not remove a room holding ideas. A staged overlap also leaves the plan intact.
$('plan-tab').onclick();$('room-list').children[1].onclick();$('remove-room').onclick();assert.match($('plan-message').textContent,/Move this room/);$('plan-x').value=5;$('room-form').onsubmit({preventDefault(){}});assert.match($('plan-message').textContent,/overlap/);$('cancel-plan').onclick();assert.equal(lastHouse.rooms.length,7);
console.log('Verified UI actions: add/edit/move ideas, failed-save draft retention, draw/connect/build rooms, staged-layout switching, idea preservation, and safe room removal. Browser visual testing and supported-context WebMCP validation remain unavailable.');
