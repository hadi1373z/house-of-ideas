import {sharedEdge} from './model.js';

export const centerOf=r=>({x:r.x+r.w/2-10,z:r.y+r.h/2-8,roomId:r.id});
export function houseBounds(house){const minX=Math.min(...house.rooms.map(r=>r.x))-10,maxX=Math.max(...house.rooms.map(r=>r.x+r.w))-10,minZ=Math.min(...house.rooms.map(r=>r.y))-8,maxZ=Math.max(...house.rooms.map(r=>r.y+r.h))-8;return {minX,maxX,minZ,maxZ,w:maxX-minX,d:maxZ-minZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2};}
export function entranceFor(house){const b=houseBounds(house),room=house.rooms.filter(r=>r.y+r.h-8===b.maxZ).sort((a,c)=>Math.abs(centerOf(a).x-b.cx)-Math.abs(centerOf(c).x-b.cx))[0];return {roomId:room.id,x:centerOf(room).x,z:b.maxZ,width:1.5};}
export function roomAtPoint(house,x,z,padding=0){return house.rooms.find(r=>x+10>=r.x+padding&&x+10<=r.x+r.w-padding&&z+8>=r.y+padding&&z+8<=r.y+r.h-padding)?.id||null;}
export function reachableIds(house,start){const seen=new Set([start]),queue=[start];while(queue.length){const id=queue.shift();for(const d of house.doors){const next=d.a===id?d.b:d.b===id?d.a:null;if(next&&!seen.has(next)){seen.add(next);queue.push(next);}}}return [...seen];}
export function roomRoute(house,start,end){
 if(start===end)return [start];const parents=new Map([[start,null]]),queue=[start];
 while(queue.length){const id=queue.shift();for(const d of house.doors){const next=d.a===id?d.b:d.b===id?d.a:null;if(!next||parents.has(next))continue;parents.set(next,id);if(next===end){const route=[end];while(parents.get(route[0])!==null)route.unshift(parents.get(route[0]));return route;}queue.push(next);}}
 return [];
}
export function walkingRoute(house,start,roomId,target){
 const destination=house.rooms.find(r=>r.id===roomId);if(!destination)return [];
 const entrance=entranceFor(house),startRoom=roomAtPoint(house,start.x,start.z)||entrance.roomId,route=roomRoute(house,startRoom,roomId);if(!route.length)return [];
 const points=[];if(!roomAtPoint(house,start.x,start.z)){points.push({x:entrance.x,z:entrance.z+1.1,roomId:null},{x:entrance.x,z:entrance.z-.55,roomId:entrance.roomId});}
 for(let n=0;n<route.length;n++){
  const room=house.rooms.find(r=>r.id===route[n]);points.push(centerOf(room));if(n===route.length-1)continue;
  const next=house.rooms.find(r=>r.id===route[n+1]),edge=sharedEdge(room,next),mid=(edge.lo+edge.hi)/2;
  points.push({x:edge.axis==='x'?mid-10:edge.fixed-10,z:edge.axis==='z'?mid-8:edge.fixed-8,roomId:next.id,door:true});
 }
 if(target)points.push({x:target.x,z:target.z,roomId});return points;
}
export function yardBounds(house){const b=houseBounds(house);return {minX:b.minX-5,maxX:b.maxX+5,minZ:b.minZ-5,maxZ:b.maxZ+8};}
export function canExploreAt(house,walls,x,z,radius=.2){const b=yardBounds(house);if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return false;return !walls.some(w=>{const dist=w.axis==='x'?Math.abs(z+8-w.fixed):Math.abs(x+10-w.fixed),along=w.axis==='x'?x+10:z+8;return dist<radius&&along>w.lo-radius&&along<w.hi+radius;});}
// Advance one small frame along already validated doorway waypoints.
export function stepAlongPath(position,path,distance,canStand=()=>true){
 let remaining=distance,moved=0,heading=null;
 while(path.length&&remaining>0){const next=path[0],dx=next.x-position.x,dz=next.z-position.z,length=Math.hypot(dx,dz);if(length<.025){position.x=next.x;position.z=next.z;path.shift();continue;}
  const step=Math.min(remaining,length),nx=position.x+dx/length*step,nz=position.z+dz/length*step;if(!canStand(nx,nz))break;position.x=nx;position.z=nz;heading=Math.atan2(-dx,-dz);moved+=step;remaining-=step;if(step>=length-.001)path.shift();
 }return {moved,heading,finished:path.length===0};
}
// A bounded yard/doorway search is used only when entering from an arbitrary
// outdoor position. Residents use the smaller, explicit room-and-door graph.
export function findWalkingPath(house,walls,start,target,spacing=.35){
 const b=yardBounds(house),cols=Math.ceil((b.maxX-b.minX)/spacing),rows=Math.ceil((b.maxZ-b.minZ)/spacing),key=(x,z)=>z*cols+x;
 const cell=p=>({x:Math.max(0,Math.min(cols-1,Math.round((p.x-b.minX)/spacing))),z:Math.max(0,Math.min(rows-1,Math.round((p.z-b.minZ)/spacing)))}),world=p=>({x:b.minX+p.x*spacing,z:b.minZ+p.z*spacing});
 const from=cell(start),to=cell(target),queue=[from],parents=new Map([[key(from.x,from.z),null]]);let reached=false;
 for(let n=0;n<queue.length;n++){const current=queue[n];if(current.x===to.x&&current.z===to.z){reached=true;break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:current.x+dx,z:current.z+dz},id=key(next.x,next.z);if(next.x<0||next.x>=cols||next.z<0||next.z>=rows||parents.has(id))continue;const p=world(next);if(!canExploreAt(house,walls,p.x,p.z,.22))continue;parents.set(id,current);queue.push(next);}}
 if(!reached)return [];const route=[],cursor={...to};let prev;while((prev=parents.get(key(cursor.x,cursor.z)))!==null){route.unshift(world(cursor));cursor.x=prev.x;cursor.z=prev.z;}
 // Keep only turns to avoid a stop at every grid cell.
 const turns=[];for(let n=0;n<route.length;n++){if(n===route.length-1||n===0||Math.abs((route[n].x-route[n-1].x)*(route[n+1].z-route[n].z)-(route[n].z-route[n-1].z)*(route[n+1].x-route[n].x))>.001)turns.push(route[n]);}turns.push({x:target.x,z:target.z});return turns;
}
