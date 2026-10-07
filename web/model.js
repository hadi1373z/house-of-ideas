export const GRID={width:20,height:16};
export const CUES=['crystal','ring','sphere','book'];
export const clone=o=>JSON.parse(JSON.stringify(o));
export function starter(){
 const themes=[['math','Mathematics','Patterns, proofs, and connections.','#7871d9',0,0],['art','Art','Images, experiments, and ways of seeing.','#df795b',6,0],['work','Work','Projects and the next useful step.','#457ca9',12,0],['questions','Questions','Keep open questions somewhere you can return to.','#be9750',0,5],['learning','Learning','New knowledge and things to practise.','#428d83',6,5],['connections','Connections','Bring ideas from different rooms together.','#a26b96',12,5]];
 return {rooms:themes.map(([id,name,purpose,color,x,y])=>({id,name,purpose,color,x,y,w:6,h:5})),doors:[['math','art'],['art','work'],['math','questions'],['art','learning'],['work','connections'],['questions','learning'],['learning','connections']].map(([a,b])=>({a,b})),ideas:[]};
}
export function sharedEdge(a,b){
 const lowX=Math.max(a.x,b.x),highX=Math.min(a.x+a.w,b.x+b.w),lowY=Math.max(a.y,b.y),highY=Math.min(a.y+a.h,b.y+b.h);
 if(highY-lowY>=2&&(a.x+a.w===b.x||b.x+b.w===a.x))return {axis:'z',fixed:a.x+a.w===b.x?b.x:a.x,lo:lowY,hi:highY};
 if(highX-lowX>=2&&(a.y+a.h===b.y||b.y+b.h===a.y))return {axis:'x',fixed:a.y+a.h===b.y?b.y:a.y,lo:lowX,hi:highX};
 return null;
}
export function validateHouse(input){
 if(!input||!Array.isArray(input.rooms)||input.rooms.length<1||input.rooms.length>16)throw Error('Use between 1 and 16 rooms.');
 const ids=new Set();const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(s);
 const rooms=input.rooms.map(r=>{
  if(!validId(r.id)||ids.has(r.id))throw Error('Each room needs a unique identifier.');ids.add(r.id);
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>60)throw Error('Room names must have 1–60 characters.');
  if(typeof r.purpose!=='string'||r.purpose.length>400)throw Error('Room descriptions must be under 400 characters.');
  if(!/^#[a-f0-9]{6}$/i.test(r.color))throw Error('Choose a valid room color.');
  if(![r.x,r.y,r.w,r.h].every(Number.isInteger)||r.x<0||r.y<0||r.w<3||r.h<3||r.x+r.w>GRID.width||r.y+r.h>GRID.height)throw Error('Rooms must be at least 3 × 3 cells and fit inside the grid.');
  return {id:r.id,name:r.name.trim(),purpose:r.purpose,color:r.color,x:r.x,y:r.y,w:r.w,h:r.h};
 });
 for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)throw Error('Rooms cannot overlap.');}
 if(!Array.isArray(input.doors)||input.doors.length>40)throw Error('Use up to 40 doors.');
 const doors=[],pairs=new Set();for(const d of input.doors){const a=rooms.find(r=>r.id===d.a),b=rooms.find(r=>r.id===d.b);if(!a||!b||a===b||!sharedEdge(a,b))throw Error('A door needs two rooms sharing at least two cells of wall.');const key=[d.a,d.b].sort().join('|');if(pairs.has(key))throw Error('Those rooms already have a door.');pairs.add(key);doors.push({a:d.a,b:d.b});}
 if(!Array.isArray(input.ideas)||input.ideas.length>192)throw Error('The house can hold up to 192 ideas.');
 const ideaIds=new Set(),counts={};const ideas=input.ideas.map(i=>{
  if(!validId(i.id)||ideaIds.has(i.id))throw Error('Each idea needs a unique identifier.');ideaIds.add(i.id);
  if(!ids.has(i.roomId))throw Error('Choose a room for every idea.');counts[i.roomId]=(counts[i.roomId]||0)+1;if(counts[i.roomId]>12)throw Error('A room can hold up to 12 ideas.');
  if(typeof i.title!=='string'||!i.title.trim()||i.title.length>100||typeof i.text!=='string'||i.text.length>6000)throw Error('Ideas need a title (up to 100 characters) and notes (up to 6,000).');
  if(!CUES.includes(i.cue))throw Error('Choose a memory object.');
  return {id:i.id,roomId:i.roomId,title:i.title.trim(),text:i.text,cue:i.cue};
 });return {rooms,doors,ideas};
}
export function reachableRooms(house,start){const seen=new Set([start]);let changed=true;while(changed){changed=false;for(const d of house.doors){if(seen.has(d.a)&&!seen.has(d.b)){seen.add(d.b);changed=true;}if(seen.has(d.b)&&!seen.has(d.a)){seen.add(d.a);changed=true;}}}return seen;}
