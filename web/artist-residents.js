import {findCityPath} from './art-city-navigation.js';

// Fictional resident interpretations give every gallery its own human host.
// Historical clothing and tools distinguish them without changing the houses.
const LOOKS={
 monet:{coat:'#bec4a9',shirt:'#687784',trousers:'#59625d',skin:'#d6af8e',hair:'#dddcd0',beard:'long',hat:'beret',hatColor:'#566377',tool:'palette'},
 kandinsky:{coat:'#75564f',shirt:'#e8dec6',trousers:'#474a50',skin:'#d3ac8c',hair:'#4b4541',hairStyle:'receding',glasses:true,tie:'#b08b56',tool:'geometry'},
 'van-gogh':{coat:'#47718a',shirt:'#c6b87e',trousers:'#4e5960',skin:'#d4a17f',hair:'#ab653d',beard:'short',hat:'straw',hatColor:'#c9ab67',tool:'palette'},
 hokusai:{coat:'#3a536a',shirt:'#bcbca8',trousers:'#3a536a',skin:'#c9a887',hair:'#bfc1b8',hairStyle:'tuft',robe:true,sash:'#aeb0a0',tool:'scroll'},
 rodin:{coat:'#826c59',shirt:'#b6a590',trousers:'#625b53',skin:'#cba788',hair:'#c7c5b9',beard:'long',hairStyle:'receding',tool:'sculpture'},
 'hilma-af-klint':{coat:'#9b9da2',shirt:'#ede0cd',trousers:'#50565b',skin:'#ddbb9d',hair:'#7a5140',hairStyle:'bun',skirt:true,brooch:'#b29763',tool:'circles'},
 mondrian:{coat:'#444b53',shirt:'#eee6d7',trousers:'#444b53',skin:'#d5b294',hair:'#555149',hairStyle:'neat',glasses:true,tie:'#343a40',tool:'grid'},
 lange:{coat:'#727860',shirt:'#d0c2a6',trousers:'#535c54',skin:'#cfae92',hair:'#645044',hairStyle:'bob',skirt:true,tool:'camera'},
 morris:{coat:'#69755b',shirt:'#bcb29a',trousers:'#665f50',skin:'#d5b397',hair:'#77614e',hairStyle:'curls',beard:'long',tool:'pattern'},
 klee:{coat:'#74808b',shirt:'#d4c9b5',trousers:'#565f69',skin:'#cfae94',hair:'#8c8474',beard:'point',hat:'cap',hatColor:'#8d7963',tool:'watercolor'}
};

export function buildArtistResidents(THREE,artists,city){
 if(!THREE?.Group||!Array.isArray(artists)||artists.length<1||artists.length>10||!city?.canStand||!Array.isArray(city.houses))throw Error('Artist residents need one to ten artists and a walkable city.');
 const ids=new Set();for(const artist of artists){if(!artist?.id||ids.has(artist.id)||!LOOKS[artist.id]||!city.houses.some(h=>h.artistId===artist.id))throw Error('Each resident needs a unique known artist and their own gallery house.');ids.add(artist.id);}
 const group=new THREE.Group();group.name='Artist residents';
 const geometries=new Map(),materials=new Map(),textures=new Set(),residents=new Map();let disposed=false,lastPlayerHouse=null;
 const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);};
 const material=(color,basic=false)=>{const key=color+':'+basic;if(!materials.has(key))materials.set(key,basic?new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(key);};
 const box=(parent,w,h,d,x,y,z,color)=>{const mesh=new THREE.Mesh(geometry(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),material(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const sphere=(parent,r,x,y,z,color,scale)=>{const mesh=new THREE.Mesh(geometry('sphere:'+r,()=>new THREE.SphereGeometry(r,12,8)),material(color));mesh.position.set(x,y,z);if(scale)mesh.scale.set(...scale);parent.add(mesh);return mesh;};
 const cylinder=(parent,top,bottom,h,x,y,z,color)=>{const mesh=new THREE.Mesh(geometry(`cylinder:${top}:${bottom}:${h}`,()=>new THREE.CylinderGeometry(top,bottom,h,12)),material(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const disc=(parent,r,x,y,z,color)=>{const mesh=new THREE.Mesh(geometry('disc:'+r,()=>new THREE.CircleGeometry(r,16)),material(color,true));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const ring=(parent,r,x,y,z,color)=>{const mesh=new THREE.Mesh(geometry('ring:'+r,()=>new THREE.RingGeometry(r*.78,r,16)),material(color,true));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 function nameplate(parent,artist){
  const mesh=new THREE.Mesh(geometry('nameplate',()=>new THREE.PlaneGeometry(1.8,.27)),material('#354342',true));mesh.position.set(0,2.03,0);parent.add(mesh);
  if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#354342';ctx.fillRect(0,0,768,128);ctx.fillStyle='#fff7e8';ctx.font='600 43px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(artist.name,384,65,730);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});materials.set('name:'+artist.id,mat);mesh.material=mat;}}
  return mesh;
 }
 function tool(parent,look){
  const held=new THREE.Group();held.position.set(-.35,.78,.18);held.rotation.z=.13;parent.add(held);
  switch(look.tool){
   case 'palette':{
    const palette=cylinder(held,.18,.18,.025,0,0,0,'#a68a62');palette.rotation.x=Math.PI/2;palette.scale.x=1.2;
    for(let i=0;i<4;i++)disc(held,.035,-.105+i*.065,.025,.018,['#cb9a54','#567995','#ba6355','#728460'][i]);
    cylinder(parent,.012,.012,.38,.35,.78,.19,'#977b56').rotation.z=-.2;sphere(parent,.021,.389,.962,.19,'#514a3b');break;
   }
   case 'camera':{
    held.position.set(0,1.03,.27);held.rotation.z=0;box(held,.32,.19,.13,0,0,0,'#343937');
    const lens=cylinder(held,.077,.077,.12,0,-.01,.1,'#596360');lens.rotation.x=Math.PI/2;disc(held,.057,0,-.01,.167,'#a4b6b5');box(held,.09,.046,.05,.06,.12,0,'#777a69');
    for(const x of [-.14,.14])box(parent,.018,.37,.018,x,1.24,.22,'#635847').rotation.z=x<0?-.2:.2;break;
   }
   case 'sculpture':{
    box(held,.22,.055,.21,0,-.06,0,'#b7ab94');sphere(held,.075,0,.04,0,'#7d806b',[.8,1.3,.8]);sphere(held,.04,0,.15,0,'#7d806b');
    cylinder(parent,.015,.015,.24,.35,.75,.16,'#b69b71');box(parent,.14,.07,.07,.35,.89,.16,'#81827a');break;
   }
   default:{
    box(held,.3,.39,.025,0,0,0,look.tool==='scroll'?'#ddd1af':'#e1d5bc');
    const front=.017;
    if(look.tool==='geometry'){disc(held,.083,-.04,.07,front,'#4e6c8b');disc(held,.046,.07,-.06,front,'#bd8a48');box(held,.24,.016,.007,0,.02,.022,'#535259').rotation.z=.65;}
    if(look.tool==='circles'){ring(held,.093,0,.05,front,'#b67c91');disc(held,.044,0,.09,front+.003,'#d9ba65');disc(held,.045,0,-.08,front+.003,'#6e929b');}
    if(look.tool==='grid'){box(held,.11,.17,.008,-.07,.07,front,'#af5547');box(held,.09,.09,.008,.06,-.085,front,'#57768e');box(held,.29,.012,.009,0,-.025,front+.005,'#363e40');box(held,.012,.37,.009,.007,0,front+.005,'#363e40');}
    if(look.tool==='scroll'){for(let i=0;i<3;i++){const arc=ring(held,.045,-.09+i*.075,-.07+i*.04,front,'#567289');arc.scale.y=.65;}for(const y of [-.21,.21])cylinder(held,.025,.025,.34,0,y,0,'#8f7856').rotation.z=Math.PI/2;}
    if(look.tool==='pattern'){for(let i=0;i<4;i++){const x=i%2===0?-.068:.068,y=i<2?.085:-.085;const petal=disc(held,.048,x,y,front,'#74856b');petal.scale.set(.65,1,1);disc(held,.018,x,y,front+.003,'#c5b17a');}}
    if(look.tool==='watercolor'){for(let i=0;i<6;i++)box(held,.065,.063,.008,-.08+(i%3)*.078,.065-Math.floor(i/3)*.076,front,['#a68069','#c1ab64','#9c6b67','#779797','#b58d9b','#77906a'][i]);}
    if(look.tool==='scroll'||look.tool==='watercolor')cylinder(parent,.01,.01,.3,.35,.79,.18,'#96794f').rotation.z=-.15;
   }
  }
 }
 function houseNavigation(house){
  const direction=house.row===0?1:-1,nav={bounds:{minX:house.minX+.34,maxX:house.maxX-.34,minZ:house.minZ+.34,maxZ:house.maxZ-.34},colliders:city.colliders||[],collisionRadius:.22,
   canStand(x,z){return x>house.minX+.34&&x<house.maxX-.34&&z>house.minZ+.34&&z<house.maxZ-.34&&city.canStand(x,z);}};
  const entrance={x:house.cx-1.85*direction,z:house.cz+1.4*direction};
  if(!nav.canStand(entrance.x,entrance.z))throw Error('The resident entrance must be clear in '+house.artistId+'’s house.');
  return {nav,entrance,direction};
 }
 function avatar(artist,index){
  const look=LOOKS[artist.id],root=new THREE.Group();root.name=artist.name+' · resident';root.userData={artistResidentId:artist.id,label:'Talk with '+artist.name,appearance:artist.id};group.add(root);
  cylinder(root,.19,.235,.39,0,1.07,0,look.coat);box(root,.18,.28,.02,0,1.12,.188,look.shirt);
  if(look.tie){box(root,.044,.22,.026,0,1.13,.212,look.tie);sphere(root,.025,0,1.267,.216,look.tie);}
  if(look.sash)cylinder(root,.231,.231,.1,0,.915,0,look.sash);
  if(look.brooch)sphere(root,.027,.08,1.19,.209,look.brooch);
  if(look.robe||look.skirt)cylinder(root,.215,look.skirt?.29:.245,.56,0,.62,0,look.trousers);else cylinder(root,.185,.185,.18,0,.8,0,look.trousers);
  cylinder(root,.067,.067,.11,0,1.335,0,look.skin);
  const head=new THREE.Group();head.position.set(0,1.53,0);root.add(head);
  sphere(head,.167,0,0,0,look.skin,[.94,1.09,1]);sphere(head,.029,0,-.012,.166,look.skin,[.8,1.1,1.3]);
  for(const x of [-.058,.058]){sphere(head,.015,x,.035,.151,'#3e403a');sphere(head,.027,x<0?-.16:.16,-.01,0,look.skin,[.42,.9,.8]);}
  const hair=new THREE.Mesh(geometry('hair-cap',()=>new THREE.SphereGeometry(.177,12,8,0,Math.PI*2,0,Math.PI*.58)),material(look.hair));hair.position.y=.012;head.add(hair);
  if(look.hairStyle==='receding')hair.scale.set(1,.6,1.04);
  if(look.hairStyle==='tuft'){hair.scale.set(1,.28,1);sphere(head,.07,0,.12,-.105,look.hair,[1.1,.5,1]);}
  if(look.hairStyle==='bun')sphere(head,.089,0,.06,-.145,look.hair);
  if(look.hairStyle==='bob')for(const x of [-.135,.135])sphere(head,.089,x,-.055,-.035,look.hair,[.6,1.5,1]);
  if(look.hairStyle==='curls')for(const x of [-.13,0,.13])sphere(head,.079,x,.105,-.028,look.hair,[1,1,.9]);
  if(look.beard){const beard=sphere(head,look.beard==='long'?.118:.097,0,look.beard==='long'?-.155:-.1,.105,look.hair,[1,look.beard==='long'?1.55:look.beard==='point'?1.15:.82,.7]);beard.rotation.x=-.12;}
  if(look.glasses){for(const x of [-.061,.061])ring(head,.039,x,.035,.165,'#484947');box(head,.044,.01,.011,0,.035,.167,'#484947');}
  if(look.hat==='beret'){sphere(head,.192,0,.181,0,look.hatColor,[1.13,.31,1]);sphere(head,.017,0,.246,0,look.hatColor);}
  if(look.hat==='straw'){cylinder(head,.285,.285,.023,0,.177,0,look.hatColor);cylinder(head,.142,.177,.12,0,.247,0,look.hatColor);cylinder(head,.177,.177,.028,0,.197,0,'#6e6d53');}
  if(look.hat==='cap'){sphere(head,.185,0,.159,-.01,look.hatColor,[1,.43,1]);box(head,.22,.025,.16,0,.158,.132,look.hatColor);}
  const legs=[],arms=[];
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(side*.102,.76,0);root.add(leg);legs.push(leg);
   cylinder(leg,.073,.068,.31,0,-.15,0,look.trousers);cylinder(leg,.061,.055,.29,0,-.447,0,look.trousers);box(leg,.15,.09,.24,0,-.704,.044,'#4c4941');
   const arm=new THREE.Group();arm.position.set(side*.253,1.25,0);root.add(arm);arms.push(arm);
   cylinder(arm,.068,.062,.27,0,-.124,0,look.coat);cylinder(arm,.061,.046,.25,0,-.373,.015,look.coat);sphere(arm,.054,0,-.524,.028,look.skin,[.85,1.1,.85]);arm.rotation.z=side*.08;
  }
  tool(root,look);const label=nameplate(root,artist);
  root.traverse(object=>{if(object.isMesh)object.userData={artistResidentId:artist.id,label:'Talk with '+artist.name};});
  const house=city.houses.find(h=>h.artistId===artist.id),{nav,entrance,direction}=houseNavigation(house);
  // Leave enough space to see the resident's head, name and held tool from the
  // doorway. This spot stays on the clear side of the central gallery bench.
  root.position.set(entrance.x,0,entrance.z);root.rotation.y=direction===1?0:Math.PI;
  return {artist,root,head,legs,arms,label,house,nav,entrance,anchors:[entrance,...house.approaches],next:index%Math.max(1,house.approaches.length)+1,path:[],pause:2.5+index*.24,walkingTime:0,activity:'observing',focus:null,greeting:false};
 }
 for(let i=0;i<artists.length;i++)residents.set(artists[i].id,avatar(artists[i],i));
 function plan(resident,target){
  const from={x:resident.root.position.x,z:resident.root.position.z};resident.path=Math.hypot(from.x-target.x,from.z-target.z)<.08?[]:findCityPath(resident.nav,from,target);
  resident.focus=target.lookAt||null;resident.activity=resident.path.length?'walking':'observing';
 }
 function face(resident,target,dt){if(!target||![target.x,target.z].every(Number.isFinite))return;const angle=Math.atan2(target.x-resident.root.position.x,target.z-resident.root.position.z);let delta=angle-resident.root.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));resident.root.rotation.y+=delta*Math.min(1,dt*5);}
 function meet(resident){plan(resident,resident.entrance);resident.pause=6;resident.greeting=true;}
 function rehome(id,house){
  const resident=residents.get(id);if(disposed||!resident||!house||house.artistId!==id||typeof house.id!=='string'||![house.cx,house.cz,house.minX,house.maxX,house.minZ,house.maxZ].every(Number.isFinite)||!Array.isArray(house.approaches))return false;
  const changed=resident.house.id!==house.id,{nav,entrance,direction}=houseNavigation(house);
  resident.house=house;resident.nav=nav;resident.entrance=entrance;resident.anchors=[entrance,...house.approaches];
  if(changed){resident.root.position.set(entrance.x,0,entrance.z);resident.root.rotation.y=direction===1?0:Math.PI;resident.path=[];resident.next=1;resident.focus=null;meet(resident);}
  resident.root.traverse(object=>{object.userData={...object.userData,artistEditionId:house.editionId??null};});return true;
 }
 function state(id){const resident=residents.get(id);return resident?{artistId:id,houseId:resident.house.id,editionId:resident.house.editionId??null,position:{x:resident.root.position.x,z:resident.root.position.z},meetingPoint:{...resident.entrance},activity:resident.activity}:null;}
 return {group,targets:[group],state,rehome,states(){return [...residents.keys()].map(state);},greet(id){
  if(disposed)return false;const resident=residents.get(id);if(!resident)return false;meet(resident);return true;
 },update(dt,{player,talkingId=null}={}){
  if(disposed||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);
  const playerRecord=player&&[player.x,player.z].every(Number.isFinite)?(city.insideHouseAt?city.insideHouseAt(player.x,player.z):city.houses.find(h=>h.artistId===city.insideAt(player.x,player.z))):null;
  const playerHouse=playerRecord?.id??null;
  if(playerHouse!==lastPlayerHouse){const host=residents.get(playerRecord?.artistId);if(host){if(host.house.id!==playerHouse)rehome(host.artist.id,playerRecord);if(talkingId!==host.artist.id)meet(host);}lastPlayerHouse=playerHouse;}
  for(const resident of residents.values()){
   const position=resident.root.position,nearPlayer=player&&[player.x,player.z].every(Number.isFinite)&&Math.hypot(player.x-position.x,player.z-position.z)<4;
   if(resident.greeting&&playerHouse!==resident.house.id)resident.greeting=false;
   if(player&&[player.x,player.z].every(Number.isFinite))resident.label.rotation.y=Math.atan2(player.x-position.x,player.z-position.z)-resident.root.rotation.y;
   let moving=false;
   if(talkingId===resident.artist.id){resident.activity='talking';if(nearPlayer)face(resident,player,dt);}
   else if(resident.path.length){
    const target=resident.path[0],dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz),step=Math.min(distance,.7*dt),next=distance?{x:position.x+dx/distance*step,z:position.z+dz/distance*step}:{x:position.x,z:position.z};
    const personalSpace=nearPlayer&&Math.hypot(next.x-player.x,next.z-player.z)<.62;
    if(!resident.nav.canStand(next.x,next.z)){resident.path=[];resident.pause=2;resident.activity='observing';}
    else if(personalSpace){resident.activity='observing';face(resident,player,dt);}
    else {position.x=next.x;position.z=next.z;face(resident,target,dt);moving=distance>.018;resident.activity=moving?'walking':'observing';if(distance<=step+.001)resident.path.shift();if(!resident.path.length){resident.pause=3.2;resident.activity='observing';}}
   }else{
    resident.activity='observing';if(!resident.greeting)resident.pause-=dt;if(nearPlayer)face(resident,player,dt);else if(resident.focus)face(resident,resident.focus,dt);
    if(resident.pause<=0){const target=resident.anchors[resident.next++%resident.anchors.length];plan(resident,target);if(!resident.path.length)resident.pause=2;}
   }
   resident.walkingTime+=dt;const gait=moving?Math.sin(resident.walkingTime*7)*.26:0;
   resident.legs[0].rotation.x=gait;resident.legs[1].rotation.x=-gait;resident.arms[0].rotation.x=-gait*.45;resident.arms[1].rotation.x=gait*.45;
   resident.head.rotation.z=resident.activity==='talking'?Math.sin(resident.walkingTime*2.5)*.024:0;
  }
  group.updateMatrixWorld(true);
 },dispose(){if(disposed)return;disposed=true;for(const texture of textures)texture.dispose();for(const mat of new Set(materials.values()))mat.dispose();for(const geo of geometries.values())geo.dispose();group.clear();residents.clear();}};
}
