import {clone,validateHouse} from './model.js';
import {validateGlb,validateDesignObjects,isAssetId,DESIGN_LIMITS,DESIGN_ACTIONS} from './design-objects.js';
import {pragueDate,reflect as recordReflection} from './socrates.js';

const PACKAGE_LIMIT=32*1024*1024,JSON_LIMIT=48*1024*1024;
const instructions={read:'Read the designer’s note. What does the object help you understand?',question:'Which need does this design answer? Give an example and a counterexample.',experiment:'Try using this design. Predict one effect, observe it, and decide what should change.',reflect:'How does this design affect your life here? What would make it more useful or welcoming?'};
export function initDesignerUI({$,document,window,scene,getHouse,getSelected,isReadOnly,isSaving,saveHouse,importAsset,assetUrl,createHome,local,preview,notify,examineDesign}){
 const dialog=$('design-dialog'),nodes={},drafts=new Map(),activityDrafts=new Map();let pending=false,inspected=null,context=0,activityVersion=0;
 function node(tag,id,text){const element=document.createElement(tag);if(id){element.id=id;nodes[id]=element;}if(text!==undefined)element.textContent=text;return element;}
 function button(id,text,handler){const element=node('button',id,text);element.type='button';element.onclick=handler;return element;}
 function label(text,input){const element=node('label');element.append(node('span',null,text),input);return element;}
 function input(id,type='text'){const element=node('input',id);element.type=type;return element;}
 function textarea(id){const element=node('textarea',id);element.maxLength=6000;element.rows=4;return element;}
 function select(id,choices){const element=node('select',id);for(const [value,text] of choices){const option=node('option',null,text);option.value=value;element.append(option);}element.value=choices[0][0];return element;}
 function message(text,error=false){nodes['design-status'].textContent=text;nodes['design-status'].dataset.error=String(error);if(error)notify?.(text,true);}
 const heading=node('div');heading.className='dialog-head';heading.append(node('h2',null,'Design workshop'),button('design-close','Close',()=>dialog.close()));
 const introduction=node('p',null,local?'Bring self-contained GLB objects or houses from your design tools into this computer’s neighbourhood. Each contribution has a purpose you can use.':'Try local GLB objects and house designs in this visit. The preview clears imported files when it closes; export a package to keep them.');
 const status=node('p','design-status');status.className='designer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const contextual=node('p','design-context');
 const list=node('div','design-list');list.className='designer-list';
 const detail=node('section','design-detail');detail.className='designer-inspect';detail.hidden=true;
 const detailTitle=node('h3','design-detail-title'),detailNote=node('p','design-detail-note'),detailAction=node('p','design-detail-action');detailAction.className='designer-question';
 const activity=node('form','design-activity-form'),answer=textarea('design-answer'),activitySave=button('design-activity-save','Save reflection');answer.maxLength=1200;answer.required=true;activitySave.type='submit';
 const activityRoom=node('p','design-activity-room');activity.append(label('Your observation or answer',answer),activityRoom,activitySave);
 const editor=node('form','design-edit-form'),editTitle=input('design-edit-title'),editAction=select('design-edit-action',DESIGN_ACTIONS.map(action=>[action,action[0].toUpperCase()+action.slice(1)])),editNote=textarea('design-edit-note');editTitle.maxLength=100;editTitle.required=true;
 const editScale=input('design-edit-scale','number'),editRotation=input('design-edit-rotation','number'),editX=input('design-edit-x','number'),editY=input('design-edit-y','number'),editZ=input('design-edit-z','number');
 for(const [element,min,max] of [[editScale,.05,8],[editRotation,-180,180],[editX,-40,40],[editY,-2,8],[editZ,-40,40]]){element.min=String(min);element.max=String(max);element.step='any';element.required=true;}
 const editOrigin=node('p','design-edit-placement'),editSpatial=node('div');editSpatial.className='designer-grid';editSpatial.append(label('Display scale · 0.05–8',editScale),label('Rotation · degrees',editRotation),label('Offset X · metres',editX),label('Offset height · metres',editY),label('Offset Z · metres',editZ));
 const editSave=button('design-edit-save','Save design changes');editSave.type='submit';editor.append(label('Design title',editTitle),label('Function',editAction),label('Designer’s note',editNote),editOrigin,editSpatial,editSave);
 const detailButtons=node('div');detailButtons.className='designer-actions';detailButtons.append(button('design-tour','Tour this design',tour),button('design-examine','Ask Socrates about this design',examine),button('design-remove','Remove from this home',remove));
 detail.append(detailTitle,detailNote,detailAction,activity,editor,detailButtons);
 const importForm=node('form','design-import-form');importForm.className='designer-panel';
 const file=input('design-file','file');file.accept='.glb,model/gltf-binary';file.required=true;
 const title=input('design-title');title.maxLength=100;title.required=true;
 const kind=select('design-kind',[['object','Object or furniture'],['house','Complete house exhibit']]);
 const placement=select('design-placement',[['room','Inside the selected room'],['garden','In the garden gallery']]);
 const action=select('design-action',DESIGN_ACTIONS.map(value=>[value,value[0].toUpperCase()+value.slice(1)]));action.value='reflect';
 const note=textarea('design-note'),scale=input('design-scale','number');scale.min='.05';scale.max='2';scale.step='.05';scale.value='1';scale.required=true;
 const fields=node('div');fields.className='designer-grid';fields.append(label('Name',title),label('Design kind',kind),label('Placement',placement),label('Function',action),label('Display scale · 0.05–2',scale));
 const importButton=button('design-import','Place design in a new edition');importButton.type='submit';
 importForm.append(node('h3',null,'Import a 3D design'),node('p',null,'Export a static GLB with embedded geometry and PNG, JPEG or WebP textures. Maximum 12 MiB; no animations or external files.'),label('GLB file',file),fields,label('What is it for?',note),importButton);
 const templateForm=node('form','design-template-form');templateForm.className='designer-panel';const templateFile=input('design-template-file','file');templateFile.accept='.json,application/json';templateFile.required=true;
 const templateButton=button('design-template-import','Build this design next door');templateButton.type='submit';
 templateForm.append(node('h3',null,'Import a house or package'),node('p',null,'A House of Ideas JSON template or exported design package creates a new neighbouring home. Earlier homes retain their notes and conversations.'),label('House JSON or design package',templateFile),templateButton);
 const exports=node('div');exports.className='designer-actions';exports.append(button('design-export','Export portable design package',()=>exportDesign(false)),button('design-template-export','Export house JSON',()=>exportDesign(true)));
 const exportNote=node('p',null,'A package includes this home’s notes, journal, conversations and embedded GLBs, up to 32 MiB of models. House JSON keeps model references; keep its original GLB files separately.');
 dialog.classList.add('designer-panel');dialog.replaceChildren(heading,introduction,contextual,status,list,detail,importForm,templateForm,exports,exportNote);
 $('design-open').onclick=()=>{render();dialog.showModal();};if($('design-return'))$('design-return').onclick=()=>scene?.returnDesign?.();
 const allowed=()=>{if(!local&&!preview)throw Error('Designer imports are available in the offline house and browser preview.');};
 function writable(){allowed();if(isReadOnly())throw Error('This earlier home is preserved. Build a new edition before changing its designs.');if(pending||isSaving())throw Error('Wait for the current save to finish.');}
 const newId=()=>window.crypto?.randomUUID?.()||globalThis.crypto.randomUUID();
 function importDraft(){return {file:file.files?.[0],title:title.value,kind:kind.value,placement:placement.value,action:action.value,note:note.value,scale:scale.value};}
 function sameDraft(before){const after=importDraft();return Object.keys(before).every(key=>before[key]===after[key]);}
 async function work(callback){pending=true;render();try{await callback();}catch(error){message(error.message,true);}finally{pending=false;render();}}
 kind.onchange=()=>{if(kind.value==='house')placement.value='garden';render();};
 importForm.onsubmit=async event=>{event.preventDefault();try{writable();}catch(error){message(error.message,true);return;}const draft=importDraft(),started=context,roomId=getSelected();
  await work(async()=>{
   if(!draft.file)throw Error('Choose a GLB file.');if(draft.file.size>DESIGN_LIMITS.bytes)throw Error('Choose a GLB no larger than 12 MiB.');if((getHouse().designObjects?.length||0)>=DESIGN_LIMITS.objects)throw Error('This home already has 24 designer objects.');
   let candidate={id:newId(),title:draft.title,assetId:'0'.repeat(64),placement:draft.kind==='house'?'garden':draft.placement,kind:draft.kind,roomId,action:draft.action,note:draft.note,scale:Number(draft.scale),rotation:0,position:[0,0,0]};
   if(candidate.scale>2)throw Error('Use a display scale between 0.05 and 2.');candidate=validateDesignObjects([candidate],getHouse().rooms)[0];
   const bytes=new Uint8Array(await draft.file.arrayBuffer());validateGlb(bytes);const imported=await importAsset(bytes);
   if(!isAssetId(imported?.id))throw Error('The imported GLB did not receive a local asset identifier.');if(started!==context||isReadOnly())throw Error('You entered another home while importing. Your file and draft are kept; place it again in this home.');
   candidate.assetId=imported.id;
   if(candidate.placement==='room'){const position=scene?.suggestDesignPosition?.(roomId,candidate.scale);if(!position)throw Error('There is no clear display space in this room. Choose the garden or a smaller scale.');candidate.position=position;}
   const next=clone(getHouse());next.designObjects=[...(next.designObjects||[]),candidate];validateHouse(next);await saveHouse(next);
   if(sameDraft(draft)){file.value='';title.value='';note.value='';}message('The design is placed in a new home edition. Its earlier house is preserved.');inspect(candidate.id);
  });
 };
 function readEditor(){return {title:editTitle.value,action:editAction.value,note:editNote.value,scale:editScale.value,rotation:editRotation.value,x:editX.value,y:editY.value,z:editZ.value};}
 function editorState(item){return {title:item.title,action:item.action,note:item.note,scale:String(item.scale),rotation:String(item.rotation*180/Math.PI),x:String(item.position[0]),y:String(item.position[1]),z:String(item.position[2])};}
 function remember(){if(inspected&&nodes['design-edit-form']){drafts.set(inspected,readEditor());activityDrafts.set(inspected,answer.value);}}
 function inspect(id){remember();const item=getHouse().designObjects?.find(value=>value.id===id);if(!item)return;inspected=id;activityVersion++;const draft=drafts.get(id)||editorState(item);editTitle.value=draft.title;editAction.value=draft.action;editNote.value=draft.note;editScale.value=draft.scale;editRotation.value=draft.rotation;editX.value=draft.x;editY.value=draft.y;editZ.value=draft.z;answer.value=activityDrafts.get(id)||'';render();dialog.showModal();}
 activity.onsubmit=async event=>{event.preventDefault();try{writable();}catch(error){message(error.message,true);return;}const id=inspected,version=activityVersion,started=context,text=answer.value,item=getHouse().designObjects?.find(value=>value.id===id),roomId=item?.placement==='room'?item.roomId:getSelected();remember();
  await work(async()=>{if(!item||started!==context)throw Error('Open this design in its current home before reflecting.');await saveHouse(recordReflection(getHouse(),pragueDate(),roomId,text));if(inspected===id&&version===activityVersion&&started===context){if(answer.value===text){answer.value='';activityDrafts.delete(id);}message('Your answer is saved as today’s reflection in this room’s learning journal.');}});
 };
 editor.onsubmit=async event=>{event.preventDefault();try{writable();}catch(error){message(error.message,true);return;}const id=inspected,started=context,draft=readEditor();remember();
  await work(async()=>{const next=clone(getHouse()),item=next.designObjects?.find(value=>value.id===id);if(!item||started!==context)throw Error('Open this design in its current home before editing.');const rotation=draft.rotation===editorState(item).rotation?item.rotation:Number(draft.rotation)*Math.PI/180;Object.assign(item,{title:draft.title,action:draft.action,note:draft.note,scale:Number(draft.scale),rotation,position:[Number(draft.x),Number(draft.y),Number(draft.z)]});validateHouse(next);await saveHouse(next);if(inspected===id&&Object.entries(draft).every(([key,value])=>readEditor()[key]===value))drafts.delete(id);message('The design’s function, notes and placement are saved. Earlier editions preserve its previous design.');});
 };
 async function remove(){try{writable();}catch(error){message(error.message,true);return;}const id=inspected;await work(async()=>{const next=clone(getHouse());if(!next.designObjects?.some(item=>item.id===id))throw Error('Open a design in this home first.');next.designObjects=next.designObjects.filter(item=>item.id!==id);await saveHouse(next);if(inspected===id){inspected=null;detail.hidden=true;}drafts.delete(id);message('A new edition omits this design. It remains in the earlier home.');});}
 async function tour(){const id=inspected;if(!getHouse().designObjects?.some(item=>item.id===id))return;dialog.close();try{await scene.tourDesign(id);}catch(error){dialog.showModal();message(error.message,true);}}
 async function examine(){const item=getHouse().designObjects?.find(value=>value.id===inspected);if(!item||!examineDesign||pending||isSaving())return;remember();dialog.close();try{await examineDesign(clone(item));}catch(error){dialog.showModal();message(error.message,true);}}
 async function digest(bytes){const crypto=window.crypto||globalThis.crypto;if(!crypto?.subtle)throw Error('Use localhost or HTTPS to verify a portable design package.');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');}
 function fromBase64(text){if(typeof text!=='string'||text.length>Math.ceil(DESIGN_LIMITS.bytes/3)*4||!text.length||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw Error('A package contains invalid or oversized GLB data.');let decoded;try{decoded=(window.atob||globalThis.atob)(text);}catch{throw Error('A package contains invalid GLB encoding.');}const bytes=new Uint8Array(decoded.length);for(let index=0;index<decoded.length;index++)bytes[index]=decoded.charCodeAt(index);return bytes;}
 function toBase64(bytes){let text='';for(let index=0;index<bytes.length;index+=32768)text+=String.fromCharCode(...bytes.subarray(index,index+32768));return (window.btoa||globalThis.btoa)(text);}
 async function fetchAsset(id){const response=await (window.fetch||globalThis.fetch)(await assetUrl(id));if(!response.ok)throw Error('A GLB is missing from this computer. Import its source file before exporting this package.');const bytes=new Uint8Array(await response.arrayBuffer());validateGlb(bytes);if(await digest(bytes)!==id)throw Error('An imported GLB changed. Restore its original file before exporting.');return bytes;}
 templateForm.onsubmit=async event=>{event.preventDefault();try{allowed();if(pending||isSaving())throw Error('Wait for the current save to finish.');}catch(error){message(error.message,true);return;}const selected=templateFile.files?.[0],started=context;
  await work(async()=>{
   if(!selected)throw Error('Choose a house JSON or design package.');if(selected.size>JSON_LIMIT)throw Error('A design package can be no larger than 48 MiB.');let data;try{data=JSON.parse(await selected.text());}catch{throw Error('Choose valid house JSON.');}
   const packaged=data?.type==='house-of-ideas-design-package',source=packaged?data.house:data,validated=validateHouse(source),house={...clone(source),...validated},references=new Set((house.designObjects||[]).map(item=>item.assetId)),assets=[];
   if(packaged){
    if(data.version!==1||!Array.isArray(data.assets)||data.assets.length>DESIGN_LIMITS.objects)throw Error('Choose a supported design package with up to 24 embedded assets.');let total=0;const seen=new Set();
    for(const entry of data.assets){if(!isAssetId(entry?.id)||seen.has(entry.id)||!references.has(entry.id))throw Error('The package asset identifiers do not match its designs.');seen.add(entry.id);const bytes=fromBase64(entry.base64);total+=bytes.length;if(total>PACKAGE_LIMIT)throw Error('Keep package models within a total of 32 MiB.');validateGlb(bytes);if(await digest(bytes)!==entry.id)throw Error('A package asset does not match its content identifier.');assets.push({id:entry.id,bytes});}
    if([...references].some(id=>!seen.has(id)))throw Error('The package is missing a GLB used by its house.');
   }else{for(const id of references)await fetchAsset(id);}
   if(started!==context)throw Error('You entered another home while reading the package. Your file is kept; import it again.');
   for(const asset of assets){const imported=await importAsset(asset.bytes);if(imported.id!==asset.id)throw Error('A local GLB could not be verified.');}
   if(started!==context)throw Error('You entered another home while importing models. Your package is kept; import it again.');await createHome(house);
   if(templateFile.files?.[0]===selected)templateFile.value='';message('The imported house is now a separate home next door. Earlier homes are preserved.');
  });
 };
 async function exportDesign(template){try{allowed();if(pending||isSaving())throw Error('Wait for the current save to finish.');}catch(error){message(error.message,true);return;}
  await work(async()=>{const house=clone(getHouse());validateHouse(house);let data=house;
   if(!template){const assets=[];let total=0;for(const id of new Set((house.designObjects||[]).map(item=>item.assetId))){const bytes=await fetchAsset(id);total+=bytes.length;if(total>PACKAGE_LIMIT)throw Error('This house exceeds the 32 MiB portable package limit. Export house JSON and keep its GLBs separately.');assets.push({id,base64:toBase64(bytes)});}data={version:1,type:'house-of-ideas-design-package',house,assets};}
   const URL=window.URL||globalThis.URL,Blob=window.Blob||globalThis.Blob,url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=node('a');link.href=url;link.download=template?'house-of-ideas-house.json':'house-of-ideas-design-package.json';document.body.append(link);link.click();link.remove();window.setTimeout?.(()=>URL.revokeObjectURL(url),1000);message(template?'House JSON exported. Keep its GLB source files with it.':'Portable design package exported with its local models.');
  });
 }
 function render(){
  const house=getHouse(),room=house.rooms.find(item=>item.id===getSelected()),readOnly=isReadOnly(),busy=pending||isSaving();contextual.textContent=readOnly?'This earlier home is preserved. Explore its designs or import a separate new home.':`Selected room: ${room?.name||'Home'}. New spatial designs preserve an earlier house next door.`;
  list.replaceChildren(...(house.designObjects||[]).map(item=>{const entry=button(null,`${item.title} · ${item.kind==='house'?'house exhibit':item.placement==='garden'?'garden object':house.rooms.find(room=>room.id===item.roomId)?.name||'object'}`,()=>inspect(item.id));entry.className='designer-item';return entry;}));if(!(house.designObjects||[]).length)list.append(node('p',null,'No designer contributions in this home yet.'));
  for(const element of [file,title,kind,placement,action,note,scale,importButton,editTitle,editAction,editNote,editScale,editRotation,editX,editY,editZ,editSave,nodes['design-remove'],answer,activitySave])element.disabled=busy||readOnly;
  if(kind.value==='house'){placement.value='garden';placement.disabled=true;}
  for(const element of [templateFile,templateButton,nodes['design-export'],nodes['design-template-export']])element.disabled=busy;
  const item=house.designObjects?.find(value=>value.id===inspected);detail.hidden=!item;if(item){detailTitle.textContent=item.title;detailNote.textContent=item.note||'This design is waiting for its purpose and notes.';detailAction.textContent=instructions[item.action];editor.hidden=readOnly;activity.hidden=readOnly;editOrigin.textContent=item.placement==='room'?'Offsets are metres from the room’s centre. Reduce the scale or move the object to clear furniture and doorways.':'Offsets are metres from this exhibit’s assigned garden gallery location. Move it back toward the house if it is outside the garden.';const roomId=item.placement==='room'?item.roomId:getSelected();activityRoom.textContent=`Saved as today’s reflection in ${house.rooms.find(room=>room.id===roomId)?.name||'the selected room'}.`;nodes['design-remove'].hidden=readOnly;nodes['design-tour'].disabled=busy;nodes['design-examine'].hidden=!examineDesign;nodes['design-examine'].disabled=busy;}
 }
 function onHomeChange(){context++;remember();message('You entered another home. Import files and unfinished design drafts are kept.');render();}
 render();return {render,inspect,onHomeChange};
}
