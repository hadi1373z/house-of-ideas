import {MATH_BUILDING,MATH_FLOORS,mathConcept,mathFloorLabel} from './math-city-data.js';

// The mini website is loaded only when the owner selects its monitor or button.
// Isolated iframe state is separate from the persistent city journal.
export function initMathCityUI({$,document,window,scene,notify=()=>{},openTravel,recordNote,discuss,atlasUrl='./math-city/atlas/index.html#ideas',atlasOnlineUrl='https://hadi1373z.github.io/atlas-of-ideas/'}) {
 const drafts=new Map();let mode='guide',activeId=null,boundId=null,busy=false,atlasLoaded=false;
 const node=(tag,text,id)=>{const element=document.createElement(tag);if(text!==undefined&&text!==null)element.textContent=text;if(id)element.id=id;return element;};
 const button=(text,id,action)=>{const element=node('button',text,id);element.type='button';element.onclick=action;return element;};
 const link=(text,href,id)=>{const element=node('a',text,id);element.href=href;element.target='_blank';element.rel='noopener noreferrer';return element;};
 if(!/^\.\/math-city\/atlas\/index\.html(?:#[a-zA-Z0-9/_-]+)?$/.test(atlasUrl))throw Error('Use the bundled local Atlas reader.');
 if(atlasOnlineUrl!=='https://hadi1373z.github.io/atlas-of-ideas/')throw Error('Use the original Atlas of Ideas website.');
 const dialog=node('dialog',null,'math-city-dialog');dialog.className='math-city-dialog';dialog.setAttribute('aria-label','Mathematics City and Atlas of Ideas');
 const header=node('div');header.className='dialog-head';const heading=node('h2',MATH_BUILDING.name,'math-city-heading');header.append(heading,button('Close','math-city-close',close));dialog.append(header);
 const tabs=node('nav');tabs.className='math-city-tabs';tabs.setAttribute('aria-label','Mathematics Institute guide');
 const guideTab=button('Building guide','math-city-guide-tab',showGuide),atlasTab=button('Atlas of Ideas monitor','math-city-atlas-tab',showAtlas);tabs.append(guideTab,atlasTab);dialog.append(tabs);
 const status=node('p',null,'math-city-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');dialog.append(status);
 const guide=node('section',null,'math-city-guide');guide.append(node('p','A separate city for mathematical discovery. Enter an eight-floor institute, choose a subject, examine a claim and try an exercise. The physical floor selector takes you to the real level; the Atlas monitor is in the ground-floor entrance hall.'));
 const controls=node('div');controls.className='math-city-actions';controls.append(button('Enter the building','math-city-enter',async()=>{if(busy)return;close();try{await scene?.enterMathCity?.();focusScene();}catch(error){showGuide();status.textContent=error.message;}}),button('Travel to another city','math-city-travel',()=>{close();openTravel?.();}));guide.append(controls);
 const location=node('p',null,'math-city-location');location.className='math-city-location';guide.append(location);
 const floors=node('div',null,'math-city-floor-guide');floors.className='math-city-floor-guide';guide.append(floors);dialog.append(guide);
 const conceptView=node('section',null,'math-city-concept');conceptView.hidden=true;dialog.append(conceptView);
 const atlasView=node('section',null,'math-city-atlas');atlasView.hidden=true;
 atlasView.append(node('p','The actual Atlas of Ideas website is bundled here as an offline miniature. Browse its thinkers, connections, trails and lenses without an online call. This is a pinned snapshot; it does not automatically synchronise with the original website.'));
 const readerNote=node('p','Notes made inside this isolated reader last only for this page session. Export them with the reader’s JSON export before leaving or reloading. For a reflection kept with your house, save it in the Mathematics City journal instead.','math-city-atlas-note');readerNote.className='math-city-reader-note';atlasView.append(readerNote);
 const frame=node('iframe',null,'math-city-atlas-frame');frame.title='Offline miniature of Atlas of Ideas';frame.setAttribute('sandbox','allow-scripts allow-downloads');frame.setAttribute('referrerpolicy','no-referrer');frame.setAttribute('loading','eager');atlasView.append(frame);
 const online=node('div');online.className='math-city-actions';online.append(link('Open the original website online',atlasOnlineUrl,'math-city-atlas-online'),button('Find the monitor downstairs','math-city-atlas-floor',()=>visitFloor(0)));atlasView.append(online);dialog.append(atlasView);document.body.append(dialog);
 dialog.addEventListener('cancel',()=>rememberDraft());dialog.addEventListener('close',()=>rememberDraft());
 const focusScene=()=>document.querySelector?.('#scene canvas')?.focus?.();
 function rememberDraft(){const input=$?.('math-city-reflection');if(boundId&&input)drafts.set(boundId,input.value);}
 function openDialog(){if(!dialog.open)dialog.showModal();}
 function close(){rememberDraft();dialog.close();focusScene();}
 function showGuide(){rememberDraft();mode='guide';boundId=null;status.textContent='';render();openDialog();return true;}
 function showConcept(id){const item=mathConcept(id);if(!item){notify('This mathematical object is not in the institute guide.');return false;}rememberDraft();activeId=id;mode='concept';status.textContent='';render();openDialog();return true;}
 function showAtlas(){rememberDraft();mode='atlas';boundId=null;status.textContent='';if(!atlasLoaded){frame.src=atlasUrl;atlasLoaded=true;}render();openDialog();return true;}
 async function visitFloor(index){if(busy)return;close();try{if(typeof scene?.visitMathFloor!=='function')throw Error('The floor lift is unavailable.');await scene.visitMathFloor(index);focusScene();}catch(error){status.textContent=error.message;mode='guide';render();openDialog();}}
 async function saveReflection(){if(busy)return;rememberDraft();const item=mathConcept(activeId),id=activeId,draft=drafts.get(id)||'';if(!draft.trim()){status.textContent='Write what you noticed, tried or changed your mind about.';return;}
  const text='[Mathematics · '+item.title+']\n'+draft;if(text.length>2000){status.textContent='Keep this reflection within the city journal’s 2,000-character limit. Your draft is kept.';return;}
  busy=true;render();try{if(typeof recordNote!=='function')throw Error('The city journal is unavailable.');if(await recordNote(text)===false)throw Error('The reflection was not saved.');if(drafts.get(id)===draft)drafts.delete(id);if(activeId===id&&mode==='concept'){const input=$?.('math-city-reflection');if(input)input.value=drafts.get(id)||'';}status.textContent='Saved to the Mathematics City journal. The offline installation keeps this journal; the public preview keeps it for this visit.';notify('Mathematics reflection saved.');}catch(error){status.textContent=error.message+' Your reflection draft is kept for retry.';}finally{busy=false;render();}
 }
 async function discussConcept(){if(busy)return;const item=mathConcept(activeId);close();try{if(typeof discuss!=='function')throw Error('Resident discussion is unavailable.');await discuss({...item});}catch(error){mode='concept';render();status.textContent=error.message;openDialog();}}
 function renderConcept(){const item=mathConcept(activeId);if(!item)return;rememberDraft();boundId=item.id;const title=node('h3',item.title,'math-city-title'),place=node('small',mathFloorLabel(item.floor)),summary=node('p',item.summary,'math-city-summary'),question=node('blockquote',item.question,'math-city-question'),exercise=node('section');exercise.className='math-city-exercise';exercise.append(node('h4','Try it'),node('p',item.exercise,'math-city-exercise-text'));
  const actions=node('div');actions.className='math-city-actions';actions.append(button('Go to this floor','math-city-concept-floor',()=>visitFloor(item.floor)),button('Discuss this question with Socrates','math-city-discuss',discussConcept));if(!discuss)actions.children[1].disabled=true;
  const reflection=node('textarea',null,'math-city-reflection');reflection.rows=5;reflection.maxLength=1750;reflection.value=drafts.get(item.id)||'';reflection.placeholder='What did you try? What surprised you? Which question remains?';reflection.disabled=busy;reflection.oninput=rememberDraft;
  const label=node('label','Your learning reflection');label.htmlFor='math-city-reflection';label.append(reflection);const save=button('Save to Mathematics City journal','math-city-save-reflection',saveReflection);save.disabled=busy||!recordNote;
  const source=link('Further reading · original source',item.sourceUrl,'math-city-source');conceptView.replaceChildren(title,place,summary,question,exercise,actions,label,save,source);
 }
 function render(){if(mode==='concept')renderConcept();guide.hidden=mode!=='guide';conceptView.hidden=mode!=='concept';atlasView.hidden=mode!=='atlas';heading.textContent=mode==='atlas'?'Atlas of Ideas · institute monitor':mode==='concept'?mathConcept(activeId)?.title||MATH_BUILDING.name:MATH_BUILDING.name;guideTab.setAttribute('aria-current',String(mode==='guide'));atlasTab.setAttribute('aria-current',String(mode==='atlas'));
  const current=scene?.mathState?.(),floor=current?.floor;location.textContent=Number.isInteger(floor)&&floor>=0&&floor<MATH_BUILDING.floors?'You are on '+mathFloorLabel(floor)+'.':'Eight physical floors, with a marked lift landing on each level.';
  if(mode==='guide')floors.replaceChildren(...MATH_FLOORS.map(item=>{const card=node('article'),title=node('h3',mathFloorLabel(item.index)),text=node('p',item.description),go=button('Go to '+(item.index===0?'ground floor':'floor '+(item.index+1)),'math-city-floor-'+item.index,()=>visitFloor(item.index)),list=node('ul');for(const id of item.concepts){const concept=mathConcept(id),entry=node('li');entry.append(button(concept.title,'math-city-object-'+id,()=>showConcept(id)));list.append(entry);}card.append(title,text,go,list);if(item.index===0)card.append(button('Use the Atlas monitor','math-city-monitor',showAtlas));if(floor===item.index)card.setAttribute('aria-label',item.name+' · your current floor');return card;}));
 }
 return {open:showGuide,showGuide,showConcept,showAtlas,render,close};
}
