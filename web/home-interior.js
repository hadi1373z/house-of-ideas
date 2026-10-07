// Domestic furnishings in metres. No DOM, textures, network, or saved-state edits.
import {sharedEdge} from './model.js';
import {entranceFor} from './navigation.js';
import {BOOKS} from './books.js';
import {ideaDisplays} from './idea-display.js';

export const HOME_ROLES = {math:'study',art:'bedroom',work:'kitchen',questions:'living room',learning:'entrance hall',connections:'library'};
export const HOME_BOOKS = Object.fromEntries(BOOKS.map(({id,title})=>[id,title]));
const bookIds=Object.keys(HOME_BOOKS);
const overlap=(a,b,pad=0)=>a.minX<b.maxX+pad&&a.maxX>b.minX-pad&&a.minZ<b.maxZ+pad&&a.maxZ>b.minZ-pad;

function kit(T){
 const books=[],lights=[];let bookSequence=0;
 const material=(color,roughness=.76,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const m={oak:material('#a27c53'),walnut:material('#6b4d36'),cream:material('#eee4d3'),linen:material('#d5c8b3'),sage:material('#889080'),rose:material('#b99283'),ink:material('#3d4545'),metal:material('#9fa7a4',.27,.65),white:material('#e9e7de'),glass:material('#273337',.17,.12),leaf:material('#52745b'),terra:material('#a46d51'),paper:material('#f2ead8'),blue:material('#677d8a'),gold:material('#b69a60',.38,.4)};
 const box=(g,w,h,d,x,y,z,mat)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const cyl=(g,r,h,x,y,z,mat,top=r)=>{const o=new T.Mesh(new T.CylinderGeometry(top,r,h,20),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const ball=(g,r,x,y,z,mat,sx=1,sy=1,sz=1)=>{const o=new T.Mesh(new T.SphereGeometry(r,20,12),mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;g.add(o);return o;};
 const ring=(g,r,t,x,y,z,mat,flat=false)=>{const o=new T.Mesh(new T.TorusGeometry(r,t,8,24),mat);o.position.set(x,y,z);if(flat)o.rotation.x=Math.PI/2;g.add(o);return o;};
 const trackBook=(root,node,x,y,z)=>{const bookId=bookIds[bookSequence%bookIds.length];books.push({root,node,bookId,instance:bookSequence++,target:new T.Vector3(x,y,z)});node.userData.bookId=bookId;return node;};
 const book=(g,x,y,z,w=.24,d=.32,color=m.sage)=>{const n=new T.Group();g.add(n);box(n,w,.045,d,x,y,z,color);box(n,w-.015,.025,d-.02,x,y+.004,z,m.paper);box(n,w,.008,d,x,y+.022,z,color);for(let i=0;i<3;i++)box(n,w-.02,.002,d-.03,x,y-.009+i*.007,z,m.linen);box(n,.015,.048,d,x-w/2+.009,y,z,m.walnut);for(let i=0;i<3;i++)box(n,.02,.004,.007,x-w/2+.017,y+.025,z-d*.3+i*d*.3,m.gold);return trackBook(g,n,x,y,z);};
 const cup=(g,x,y,z)=>{const n=new T.Group();g.add(n);cyl(n,.065,.012,x,y,z,m.white);cyl(n,.047,.085,x,y+.05,z,m.cream,.055);cyl(n,.046,.004,x,y+.094,z,m.walnut);ring(n,.052,.008,x,y+.094,z,m.white,true);ring(n,.029,.009,x+.069,y+.053,z,m.cream);return n;};
 const lamp=(g,x,y,z)=>{const n=new T.Group();g.add(n);cyl(n,.13,.025,x,y+.012,z,m.metal);cyl(n,.015,.45,x,y+.24,z,m.gold);cyl(n,.18,.22,x,y+.54,z,m.cream,.095);const bulb=ball(n,.042,x,y+.47,z,new T.MeshStandardMaterial({color:'#f6dbaa',emissive:'#d6a76e',emissiveIntensity:.35}));bulb.userData.homeBulb=true;const light=new T.PointLight('#ffdda9',1.6,3,2);light.position.set(x,y+.47,z);n.add(light);n.userData.homeLampOn=true;lights.push({root:g,node:n,target:new T.Vector3(x,y+.54,z)});return n;};
 const plant=(g,x,y,z,scale=1)=>{cyl(g,.15*scale,.24*scale,x,y+.12*scale,z,m.terra,.18*scale);cyl(g,.175*scale,.012,x,y+.243*scale,z,m.walnut);for(let i=0;i<5;i++){const a=i*2.4;ball(g,.15*scale,x+Math.cos(a)*.12*scale,y+.36*scale+(i%2)*.12*scale,z+Math.sin(a)*.1*scale,m.leaf,.62,1.5,.85);}};
 const chair=(g,x,z,fabric=m.sage)=>{const n=new T.Group();g.add(n);box(n,.48,.1,.48,x,.47,z,fabric);box(n,.47,.4,.09,x,.71,z-.2,fabric);for(const dx of [-.18,.18])for(const dz of [-.18,.18])cyl(n,.025,.43,x+dx,.215,z+dz,m.walnut);box(n,.48,.025,.025,x,.485,z+.247,m.linen);return n;};
 return {T,m,box,cyl,ball,ring,book,cup,lamp,plant,chair,books,lights,trackBook};
}

function prototype(k,kind,compact=false){
 const {T,m,box,cyl,ball,ring,book,cup,lamp,plant,chair}=k,g=new T.Group(),actions=[];
 const action=(node,type,label,x=0,y=.8,z=0)=>actions.push({node,type,label,target:new T.Vector3(x,y,z)});
 if(kind==='desk'){
  const w=compact?1.05:1.5;box(g,w,.055,.65,0,.76,0,m.oak);for(const dx of [-w/2+.08,w/2-.08])for(const dz of [-.24,.24])box(g,.055,.72,.055,dx,.36,dz,m.walnut);
  box(g,.39,.24,.56,w/2-.24,.59,0,m.oak);for(const y of [.52,.64]){box(g,.35,.095,.018,w/2-.24,y,.29,m.linen);box(g,.12,.014,.027,w/2-.24,y,.308,m.gold);}
  const journal=book(g,-.17,.81,.03,.27,.34,m.blue);action(journal,'journal','Write at the study desk',-.17,.84,.03);
  const reading=book(g,.17,.82,-.13,.19,.26,m.walnut);action(reading,'read','Read the book on the desk',.17,.85,-.13);lamp(g,-w/2+.2,.8,-.14);
  cyl(g,.034,.11,w/2-.16,.86,.08,m.ink);for(let i=0;i<3;i++){const pen=cyl(g,.006,.18,w/2-.17+i*.015,.93,.08,m.oak);pen.rotation.z=(i-1)*.13;}
 }else if(kind==='armchair'){
  box(g,.7,.18,.66,0,.43,0,m.sage);box(g,.68,.56,.16,0,.75,-.25,m.sage);for(const x of [-.32,.32]){box(g,.14,.28,.67,x,.64,0,m.sage);box(g,.105,.11,.66,x,.82,0,m.linen);}for(const x of [-.26,.26])for(const z of [-.23,.23])box(g,.055,.25,.055,x,.125,z,m.walnut);
  box(g,.48,.026,.47,0,.54,.035,m.linen);box(g,.36,.24,.1,0,.73,-.15,m.rose);action(g,'sit','Sit in the reading chair',0,.65,.12);
 }else if(kind==='bed'){
  const w=compact?.92:1.42,d=compact?1.8:2.06;box(g,w,.22,d,0,.24,0,m.oak);for(const x of [-w/2+.07,w/2-.07])for(const z of [-d/2+.09,d/2-.09])box(g,.08,.14,.08,x,.07,z,m.walnut);
  box(g,w-.07,.2,d-.07,0,.45,0,m.cream);box(g,w+.025,.85,.095,0,.57,-d/2,m.walnut);box(g,w-.11,.55,.035,0,.64,-d/2+.065,m.linen);
  box(g,w-.055,.07,d*.66,0,.585,d*.15,m.blue);for(const x of [-w*.21,w*.21])ball(g,.2,x,.64,-d*.31,m.paper,1.25,.35,.7);box(g,w-.06,.026,.16,0,.632,-d*.16,m.linen);
  for(let n=0;n<5;n++)box(g,.018,.004,d*.6,-w*.38+n*w*.19,.623,d*.14,m.sage);
  action(g,'rest','Rest beside the bedroom bed',0,.67,.1);const b=book(g,w*.29,.665,d*.3,.2,.27,m.rose);action(b,'read','Read the bedtime book',w*.29,.69,d*.3);
 }else if(kind==='nightstand'){
  box(g,.44,.56,.41,0,.28,0,m.oak);box(g,.39,.18,.025,0,.37,.221,m.linen);ball(g,.025,0,.37,.244,m.gold);box(g,.47,.035,.45,0,.575,0,m.walnut);lamp(g,-.07,.61,-.04);const c=cup(g,.115,.61,.1);action(c,'tea','Have a quiet evening tea',.115,.7,.1);
 }else if(kind==='wardrobe'){
  const w=compact?.64:1.05;box(g,w,1.97,.48,0,1.02,0,m.oak);for(const x of [-w*.25,w*.25]){box(g,w*.46,1.81,.025,x,1.04,.258,m.linen);cyl(g,.012,.14,x+(x<0?.08:-.08),1.02,.286,m.gold);}box(g,w+.04,.05,.53,0,2.02,0,m.walnut);box(g,w-.1,.1,.39,0,.05,0,m.walnut);
 }else if(kind==='counter'){
  const w=compact?1.32:1.9;box(g,w,.79,.61,0,.415,0,m.white);box(g,w+.035,.047,.67,0,.835,0,m.linen);box(g,w,.06,.51,0,.04,0,m.ink);
  for(let i=0;i<3;i++){const x=-w/2+w*(i+.5)/3;box(g,w/3-.035,.64,.021,x,.44,.32,m.cream);box(g,.11,.015,.028,x,.66,.343,m.metal);}box(g,w,.33,.055,0,1.01,-.31,m.cream);
  const sinkX=-w*.26;box(g,.38,.012,.37,sinkX,.864,0,m.metal);box(g,.31,.014,.28,sinkX,.873,0,m.ink);for(const dx of [-.17,.17])box(g,.025,.043,.31,sinkX+dx,.875,0,m.metal);
  const curve=new T.CatmullRomCurve3([new T.Vector3(sinkX,.88,-.18),new T.Vector3(sinkX,1.16,-.18),new T.Vector3(sinkX,1.18,-.02),new T.Vector3(sinkX,1.08,.03)]);g.add(new T.Mesh(new T.TubeGeometry(curve,20,.015,8,false),m.metal));
  const stoveX=w*.26;box(g,.46,.015,.42,stoveX,.868,0,m.glass);for(const x of [-.12,.12])for(const z of [-.1,.1])ring(g,.073,.009,stoveX+x,.882,z,m.metal,true);
  box(g,.42,.36,.025,stoveX,.48,.337,m.glass);box(g,.31,.025,.035,stoveX,.69,.363,m.metal);for(let i=0;i<3;i++)ball(g,.017,stoveX-.12+i*.12,.75,.347,m.metal);
  const c=cup(g,-.05,.868,.12);action(c,'tea','Make tea at the kitchen counter',-.05,.97,.12);const b=book(g,stoveX,.904,-.12,.17,.22,m.rose);action(b,'read','Read the kitchen recipe',stoveX,.93,-.12);
 }else if(kind==='fridge'){
  box(g,.59,1.77,.6,0,.92,0,m.white);box(g,.56,.42,.032,0,1.54,.321,m.cream);box(g,.56,1.17,.032,0,.715,.321,m.cream);box(g,.025,.2,.045,.225,1.5,.36,m.metal);box(g,.025,.43,.045,.225,.91,.36,m.metal);for(let i=0;i<2;i++)box(g,.09,.08,.006,-.13+i*.19,1.32,.342,i?m.rose:m.sage);
 }else if(kind==='dining'){
  const w=compact?.7:1.0;box(g,w,.06,.65,0,.74,0,m.oak);for(const x of [-w/2+.07,w/2-.07])for(const z of [-.23,.23])box(g,.045,.71,.045,x,.355,z,m.walnut);
  const ch=chair(g,0,.63,m.linen);action(ch,'sit','Sit at the kitchen table',0,.62,.64);const c=cup(g,.16,.783,.1);action(c,'tea','Drink tea at the kitchen table',.16,.87,.1);cyl(g,.12,.009,-.19,.781,-.02,m.paper);box(g,.026,.008,.24,-.36,.784,-.02,m.metal);
 }else if(kind==='sofa'){
  const w=compact?1.12:2.15;box(g,w,.29,.79,0,.39,0,m.sage);box(g,w,.52,.17,0,.69,-.31,m.sage);for(const x of [-w/2+.09,w/2-.09]){box(g,.2,.28,.82,x,.61,0,m.sage);box(g,.17,.04,.76,x,.77,.025,m.linen);}for(const x of [-w/2+.18,w/2-.18])for(const z of [-.25,.25])box(g,.055,.25,.055,x,.125,z,m.walnut);
  const seats=compact?2:3;for(let i=0;i<seats;i++){const x=-w*.39+w*.78*(i+.5)/seats;box(g,w*.76/seats-.018,.1,.55,x,.585,.065,m.linen);}for(const x of [-w*.29,w*.29])ball(g,.18,x,.76,-.125,m.rose,1,.85,.32);action(g,'sit','Sit on the living-room sofa',0,.67,.16);
 }else if(kind==='coffee'){
  const w=compact?.62:1.12;box(g,w,.07,.57,0,.39,0,m.walnut);for(const x of [-w/2+.07,w/2-.07])for(const z of [-.2,.2])box(g,.055,.36,.055,x,.18,z,m.oak);box(g,w-.16,.04,.4,0,.11,0,m.oak);
  const c=cup(g,w*.24,.437,.08);action(c,'tea','Have tea in the living room',w*.24,.52,.08);const b=book(g,-w*.18,.445,-.015,.22,.29,m.blue);action(b,'read','Read beside the sofa',-w*.18,.48,-.015);
 }else if(kind==='fireplace'){
  const w=compact?.76:1.25;box(g,w,1.09,.24,0,.55,0,m.cream);box(g,w*.7,.64,.045,0,.42,.143,m.ink);box(g,w+.09,.07,.36,0,1.12,.03,m.oak);box(g,w+.05,.045,.48,0,.03,.06,m.linen);
  for(let i=0;i<3;i++){const log=cyl(g,.047,w*.4,0,.12+i*.055,.18,m.walnut);log.rotation.z=Math.PI/2;}for(let i=0;i<3;i++)ball(g,.066,-.15+i*.15,.24+(i%2)*.1,.17,new T.MeshStandardMaterial({color:'#c08b53',emissive:'#a85826',emissiveIntensity:.32}),.5,1.6,.4);action(g,'rest','Rest by the living-room fireplace',0,.55,.17);
 }else if(kind==='bookshelf'){
  const w=compact?.68:1.18;box(g,w,1.85,.035,0,.95,-.13,m.walnut);for(const x of [-w/2,w/2])box(g,.047,1.9,.35,x,.97,0,m.oak);const colors=[m.blue,m.rose,m.sage,m.cream,m.oak];let readable;
  for(const y of [.32,.78,1.24,1.7]){box(g,w,.038,.37,0,y,.018,m.oak);for(let i=0;i<Math.floor(w/.115)-1;i++){const x=-w/2+.09+i*.115,h=.24+(i%3)*.035,n=new T.Group();g.add(n);const b=box(n,.077,h,.24,x,y+h/2+.02,.052,colors[i%colors.length]);box(n,.059,.009,.01,x,y+h*.62,.178,m.gold);for(const dy of [.06,h-.035])box(n,.071,.009,.012,x,y+dy,.176,m.walnut);box(n,.008,h-.018,.225,x+.033,y+h/2+.02,.052,m.paper);k.trackBook(g,n,x,y+h/2+.02,.052);if(!readable&&y===.78)readable=n;}}
  action(readable||g,'read','Read a book from the library',0,1.04,.1);
 }else if(kind==='console'){
  const w=compact?.67:1.13;box(g,w,.047,.39,0,.8,0,m.walnut);for(const x of [-w/2+.06,w/2-.06])box(g,.045,.78,.33,x,.39,0,m.oak);box(g,w-.1,.06,.32,0,.19,0,m.oak);
  const j=book(g,-w*.21,.842,.035,.22,.29,m.blue);action(j,'journal','Write in the hall journal',-w*.21,.86,.035);const b=book(g,w*.19,.87,-.02,.18,.25,m.sage);action(b,'read','Read the note by the entrance',w*.19,.9,-.02);cyl(g,.095,.014,w*.32,.84,.04,m.gold);ball(g,.023,w*.32,.863,.04,m.ink);
 }else if(kind==='bench'){
  const w=compact?.63:1.15;box(g,w,.105,.4,0,.47,0,m.oak);box(g,w-.055,.065,.365,0,.55,0,m.linen);for(const x of [-w/2+.05,w/2-.05])for(const z of [-.13,.13])box(g,.045,.43,.045,x,.215,z,m.walnut);
  for(const x of [-w*.18,w*.18])box(g,.17,.085,.27,x,.125,.01,m.ink);action(g,'sit','Sit on the entrance bench',0,.62,.06);
 }else if(kind==='coat'){
  cyl(g,.18,.045,0,.03,0,m.walnut);cyl(g,.035,1.63,0,.86,0,m.oak);for(let i=0;i<3;i++){const a=i*2.1;const arm=cyl(g,.015,.24,Math.cos(a)*.085,1.56,Math.sin(a)*.085,m.oak);arm.rotation.z=Math.sin(a)*.85;box(g,.18,.49,.07,Math.cos(a)*.12,1.25,Math.sin(a)*.12,i?m.sage:m.rose);}
 }else if(kind==='side'){
  cyl(g,.26,.045,0,.57,0,m.oak);cyl(g,.042,.53,0,.285,0,m.walnut);cyl(g,.2,.035,0,.025,0,m.walnut);const c=cup(g,.08,.611,.04);action(c,'tea','Have tea by the reading chair',.08,.7,.04);const b=book(g,-.065,.62,-.025,.17,.23,m.rose);action(b,'journal','Note what your reading changed',-.065,.66,-.025);
 }else if(kind==='globe'){
  cyl(g,.21,.025,0,.035,0,m.walnut);cyl(g,.035,.42,0,.25,0,m.gold);const earth=ball(g,.205,0,.66,0,m.blue);ring(g,.24,.012,0,.66,0,m.gold);for(let i=0;i<4;i++)ball(g,.078,Math.sin(i*1.8)*.15,.69+Math.cos(i*2)*.08,Math.cos(i*1.8)*.13,m.sage,.8,.62,.2);action(earth,'read','Explore the library globe',0,.7,0);
 }else if(kind==='plant')plant(g,0,0,0,compact?.68:1);
 else if(kind==='ledge'){
  box(g,.38,.035,.2,0,.8,0,m.oak);box(g,.025,.18,.14,-.14,.7,0,m.walnut);box(g,.025,.18,.14,.14,.7,0,m.walnut);const b=book(g,-.07,.836,0,.16,.2,m.blue);action(b,'read','Read in this quiet corner',-.07,.86,0);const c=cup(g,.105,.837,.012);action(c,'tea','Pause for tea in this room',.105,.92,.012);
 }
 g.name=`home-${kind}`;return {group:g,actions,kind};
}

function reservedAreas(house,r){
 const out=[],cx=r.w/2,cz=r.h/2,routeHalf=.43;
 const addDoor=(axis,c,fixed)=>{
  if(axis==='x'){out.push({minX:c-.93,maxX:c+.93,minZ:fixed-.57,maxZ:fixed+.57,kind:'door'});out.push({minX:Math.min(c,cx)-routeHalf,maxX:Math.max(c,cx)+routeHalf,minZ:Math.min(fixed,cz)-routeHalf,maxZ:Math.max(fixed,cz)+routeHalf,kind:'route'});}
  else{out.push({minX:fixed-.57,maxX:fixed+.57,minZ:c-.93,maxZ:c+.93,kind:'door'});out.push({minX:Math.min(fixed,cx)-routeHalf,maxX:Math.max(fixed,cx)+routeHalf,minZ:Math.min(c,cz)-routeHalf,maxZ:Math.max(c,cz)+routeHalf,kind:'route'});}
 };
 for(const d of house.doors||[]){if(d.a!==r.id&&d.b!==r.id)continue;const other=house.rooms.find(room=>room.id===(d.a===r.id?d.b:d.a)),edge=other&&sharedEdge(r,other);if(edge)addDoor(edge.axis,(edge.lo+edge.hi)/2-(edge.axis==='x'?r.x:r.y),edge.fixed-(edge.axis==='x'?r.y:r.x));}
 const entry=entranceFor(house);if(entry.roomId===r.id)addDoor('x',entry.x+10-r.x,entry.z+8-r.y);
 out.push({minX:cx-.46,maxX:cx+.46,minZ:cz-.46,maxZ:cz+.46,kind:'center'});
 const display=ideaDisplays(house,r),left=r.x-10,top=r.y-8;
 if(display.dense)for(const b of display.cabinets)out.push({minX:b.minX-left,maxX:b.maxX-left,minZ:b.minZ-top,maxZ:b.maxZ-top,kind:'idea'});
 else for(const slot of display.slots)out.push({minX:slot.x-left-.39,maxX:slot.x-left+.39,minZ:slot.z-top-.39,maxZ:slot.z-top+.39,kind:'idea'});
 return out;
}

function place(T,p,r,reserved,occupied){
 p.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(p.group),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const rotations=[0,Math.PI/2,Math.PI,-Math.PI/2];let best;
 for(const yaw of rotations){const turn=Math.abs(Math.sin(yaw))>.5,w=turn?size.z:size.x,d=turn?size.x:size.z,hw=w/2,hd=d/2;if(w>r.w-.2||d>r.h-.2)continue;
  const xs=[.12+hw,r.w-.12-hw],zs=[.12+hd,r.h-.12-hd];for(let x=.12+hw;x<=r.w-.12-hw+.001;x+=.22)xs.push(x);for(let z=.12+hd;z<=r.h-.12-hd+.001;z+=.22)zs.push(z);
  for(const x of xs)for(const z of zs){const b={minX:x-hw,maxX:x+hw,minZ:z-hd,maxZ:z+hd};if(reserved.some(q=>overlap(b,q))||occupied.some(q=>overlap(b,q,.075)))continue;
   const wallDistance=Math.min(b.minX,r.w-b.maxX,b.minZ,r.h-b.maxZ);if(wallDistance>.55)continue;
   const front={x:Math.sin(yaw),z:Math.cos(yaw)},toward={x:r.w/2-x,z:r.h/2-z},face=front.x*toward.x+front.z*toward.z;
   const score=wallDistance*8+(face<0?8:0)+x*.035+z*.017;if(!best||score<best.score)best={x,z,yaw,b,score};
  }
 }
 if(!best)return null;const rotated=center.clone().applyAxisAngle(new T.Vector3(0,1,0),best.yaw);p.group.rotation.y=best.yaw;p.group.position.set(r.x-10+best.x-rotated.x,0,r.y-8+best.z-rotated.z);p.group.updateMatrixWorld(true);return best;
}

function freeAnchor(r,target,obstacles,preferred){
 const left=r.x-10,top=r.y-8,inside=(x,z)=>x>=left+.2&&x<=left+r.w-.2&&z>=top+.2&&z<=top+r.h-.2;
 const free=(x,z)=>inside(x,z)&&!obstacles.some(b=>x>b.minX-.2&&x<b.maxX+.2&&z>b.minZ-.2&&z<b.maxZ+.2);
 const candidates=[];if(preferred)candidates.push(preferred);for(const radius of [.55,.75,1,1.3])for(let i=0;i<16;i++){const a=i*Math.PI/8;candidates.push({x:target.x+Math.sin(a)*radius,z:target.z+Math.cos(a)*radius});}
 candidates.push({x:left+r.w/2,z:top+r.h/2});for(let x=left+.25;x<left+r.w-.2;x+=.2)for(let z=top+.25;z<top+r.h-.2;z+=.2)candidates.push({x,z});
 const choices=candidates.filter(p=>free(p.x,p.z));choices.sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z));return choices[0]||null;
}

export function buildInterior(house,room,THREE,{walk=true}={}){
 if(!room||![room.x,room.y,room.w,room.h].every(Number.isFinite)||room.w<3||room.h<3)throw Error('A domestic interior needs a room at least 3 × 3 metres.');
 const k=kit(THREE),group=new THREE.Group(),obstacles=[],interactions=[],occupied=[],reserved=reservedAreas(house,room),parts=[],compact=Math.min(room.w,room.h)<4,role=HOME_ROLES[room.id]||'study',primaryNodes=new Map();group.name=`home-interior-${room.id}`;
 const sets={study:['desk','armchair','bookshelf','plant'],bedroom:['bed','wardrobe','nightstand','plant'],kitchen:['counter','dining','fridge','plant'],'living room':['sofa','coffee','fireplace','plant'],'entrance hall':['console','bench','coat','plant'],library:['bookshelf','armchair','side','globe']};
 for(const kind of sets[role]){const p=prototype(k,kind,compact),placement=place(THREE,p,room,reserved,occupied);if(!placement)continue;group.add(p.group);occupied.push(placement.b);parts.push(p);const b=placement.b;obstacles.push({minX:b.minX+room.x-10,maxX:b.maxX+room.x-10,minZ:b.minZ+room.y-8,maxZ:b.maxZ+room.y-8,roomId:room.id,label:kind});}
 // Crowded/minimum rooms use a real narrow wall ledge rather than obstructing
 // their doors or shrinking major furniture to toy scale.
 if(parts.reduce((sum,p)=>sum+p.actions.length,0)<2){for(let attempt=0;attempt<2;attempt++){const p=prototype(k,'ledge',true),placement=place(THREE,p,room,reserved,occupied);if(!placement)break;group.add(p.group);occupied.push(placement.b);parts.push(p);const b=placement.b;obstacles.push({minX:b.minX+room.x-10,maxX:b.maxX+room.x-10,minZ:b.minZ+room.y-8,maxZ:b.maxZ+room.y-8,roomId:room.id,label:'wall ledge'});if(parts.reduce((sum,q)=>sum+q.actions.length,0)>=2)break;}}
 group.updateMatrixWorld(true);
 const anchorObstacles=obstacles.concat(reserved.filter(b=>b.kind==='idea').map(b=>({...b,minX:b.minX+room.x-10,maxX:b.maxX+room.x-10,minZ:b.minZ+room.y-8,maxZ:b.maxZ+room.y-8})));
 for(const part of parts)for(const a of part.actions){if(interactions.length>=4)break;const target=a.target.clone().applyMatrix4(part.group.matrixWorld),front=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),part.group.rotation.y),anchor=freeAnchor(room,target,anchorObstacles,{x:target.x+front.x*.7,z:target.z+front.z*.7});if(!anchor)continue;
  const metadata={homeAction:a.type,roomId:room.id,label:a.label,anchor,lookAt:{x:target.x,z:target.z},height:a.type==='sit'?.96:a.type==='rest'?1.05:1.65,homeRole:role,primary:true};a.node.traverse(node=>{if(node.isMesh)node.userData={...node.userData,...metadata};});interactions.push(metadata);primaryNodes.set(a.node,metadata);
 }
 const placed=new Set(parts.map(p=>p.group));
 for(const b of k.books){if(!placed.has(b.root))continue;const existing=primaryNodes.get(b.node);if(existing&&existing.homeAction==='journal')continue;const target=b.target.clone().applyMatrix4(b.root.matrixWorld),anchor=existing?.anchor||freeAnchor(room,target,anchorObstacles);if(!anchor)continue;
  const data=existing||{homeAction:'read',roomId:room.id,anchor,lookAt:{x:target.x,z:target.z},height:1.65,homeRole:role,primary:false};Object.assign(data,{bookId:b.bookId,bookInstanceId:`home-book-${room.id}-${b.instance}`,label:`Read “${HOME_BOOKS[b.bookId]}”`});b.node.traverse(node=>{if(node.isMesh)node.userData={...node.userData,...data};});if(!existing)interactions.push(data);
 }
 let lampIndex=0;
 for(const l of k.lights){if(!placed.has(l.root))continue;const target=l.target.clone().applyMatrix4(l.root.matrixWorld),anchor=freeAnchor(room,target,anchorObstacles);if(!anchor)continue;const homeLightId=`home-light-${room.id}-${lampIndex++}`,data={homeAction:'light',roomId:room.id,label:'Switch the lamp on or off',anchor,lookAt:{x:target.x,z:target.z},height:1.65,homeRole:role,homeLightId,primary:false};l.node.userData.homeLightId=homeLightId;l.node.traverse(node=>{if(node.isMesh)node.userData={...node.userData,...data};});interactions.push(data);}
 group.userData={homeRole:role,roomId:room.id,obstacles,interactions,reserved:reserved.map(b=>({...b,minX:b.minX+room.x-10,maxX:b.maxX+room.x-10,minZ:b.minZ+room.y-8,maxZ:b.maxZ+room.y-8}))};
 return {group,obstacles,interactions};
}

export function furnishRoom(THREE,room,house,walk=true){return buildInterior(house,room,THREE,{walk}).group;}

export function toggleHomeLight(group,homeLightId){let found=null;group.traverse(node=>{if(node.isGroup&&node.userData.homeLightId===homeLightId)found=node;});if(!found)return null;const on=!found.userData.homeLampOn;found.userData.homeLampOn=on;found.traverse(node=>{if(node.isPointLight)node.intensity=on?1.6:0;if(node.userData.homeBulb&&node.material)node.material.emissiveIntensity=on?.35:0;});return on;}
