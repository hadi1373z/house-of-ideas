import {BUNDLED_MODELS} from './object-store/models.js';
import {PAINTINGS} from './residence-data.js';
import {clone} from './model.js';
import {addConstructionObject} from './construction-data.js';
export const STORE_OBJECTS=Object.freeze([
 ...BUNDLED_MODELS.map(m=>({...m,type:'model',scale:m.scale??(m.model==='SheenChair'?1.3:m.model==='Lantern'?1.1:.7),action:m.action||'reflect'})),
 ...[['reflection_lamp','Reflection lamp','Pause and record what changed your mind.'],['question_board','Question board','Clarify a claim and look for a counterexample.'],['experiment_table','Experiment table','Make a prediction, then compare it with an observation.'],['discussion_circle','Discussion circle','Take two perspectives in turn.']].map(([id,title,description])=>({id,title,description,type:'furnishing',category:'Learning furniture',creator:'House of Ideas',license:'Project source',sourceUrl:'https://github.com/hadi1373z/house-of-ideas/blob/main/web/residence-scene-v1.js'})),
 ...['book','crystal','ring','sphere'].map(cue=>({id:'idea-'+cue,cue,title:cue[0].toUpperCase()+cue.slice(1)+' idea object',type:'idea',category:'Idea objects',description:'Give a note, question or experiment a physical place in your room.',creator:'House of Ideas',license:'Project source',sourceUrl:'https://github.com/hadi1373z/house-of-ideas/blob/main/web/idea-display.js'})),
 ...PAINTINGS.map(p=>({...p,id:'painting:'+p.id,title:p.title,type:'painting',category:'Paintings',creator:p.artistName,license:p.rights,licenseUrl:p.rightsUrl,sourceUrl:p.sourceUrl,description:p.description}))
]);
export const storeAssetUrl=id=>BUNDLED_MODELS.some(m=>m.assetId===id)?'./object-store/assets/'+id+'.glb':null;
export function assignStoreObject(source,roomId,id,{title,text='',action,position=[0,0,0]}={}){
 const item=STORE_OBJECTS.find(m=>m.id===id);if(!item)throw Error('Choose a store object.');const activity=action||item.action||'reflect';const next=clone(source);if(!next.rooms.some(r=>r.id===roomId))throw Error('Choose a room.');
 if(item.type==='painting'||item.type==='furnishing')return addConstructionObject(next,roomId,item.id);
 if(item.type==='idea'){if(next.ideas.filter(i=>i.roomId===roomId).length>=12)throw Error('A room supports twelve idea objects.');if(!title?.trim())throw Error('Give your idea object a title.');next.ideas.push({id:'idea-'+crypto.randomUUID(),roomId,title:title.trim(),text,cue:item.cue,action:activity});}
 else{next.designObjects??=[];if(next.designObjects.length>=24)throw Error('A home supports twenty-four model objects.');next.designObjects.push({id:'store-'+crypto.randomUUID(),title:title?.trim()||item.title,assetId:item.assetId,placement:'room',kind:'object',roomId,action:activity,note:text||item.description,scale:item.scale,rotation:0,position:[...position]});}
 return next;
}
