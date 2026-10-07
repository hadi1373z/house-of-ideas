// A crowded collection belongs on wall shelves, leaving the room habitable.
import {sharedEdge} from './model.js';
import {entranceFor} from './navigation.js';
export function ideaDisplays(house,room){
 const ideas=house.ideas.filter(i=>i.roomId===room.id),left=room.x-10,top=room.y-8,dense=ideas.length>(Math.min(room.w,room.h)<4?3:6);
 if(!dense){const cols=Math.min(3,Math.max(1,Math.ceil(Math.sqrt(ideas.length*room.w/room.h)))),rows=Math.ceil(ideas.length/cols);return {dense:false,cabinets:[],slots:ideas.map((idea,index)=>({idea,x:left+(.5+index%cols)/cols*room.w,z:top+1.4+(.5+Math.floor(index/cols))/Math.max(1,rows)*(room.h-2.15),y:.93,scale:1,pedestal:true}))};}
 const doors=[];for(const d of house.doors){if(d.a!==room.id&&d.b!==room.id)continue;const other=house.rooms.find(r=>r.id===(d.a===room.id?d.b:d.a)),e=other&&sharedEdge(room,other);if(e){const c=(e.lo+e.hi)/2;doors.push(e.axis==='x'?{minX:c-10-.86,maxX:c-10+.86,minZ:e.fixed-8-.45,maxZ:e.fixed-8+.45}:{minX:e.fixed-10-.45,maxX:e.fixed-10+.45,minZ:c-8-.86,maxZ:c-8+.86});}}
 const entry=entranceFor(house);if(entry.roomId===room.id)doors.push({minX:entry.x-.86,maxX:entry.x+.86,minZ:entry.z-.45,maxZ:entry.z+.45});
 const overlap=(a,b,pad=0)=>a.minX<b.maxX+pad&&a.maxX>b.minX-pad&&a.minZ<b.maxZ+pad&&a.maxZ>b.minZ-pad,points=[{x:left+.45,z:top+.34,yaw:0},{x:left+room.w-.45,z:top+.34,yaw:0},{x:left+.45,z:top+room.h-.34,yaw:Math.PI},{x:left+room.w-.45,z:top+room.h-.34,yaw:Math.PI}];
 for(let x=left+.45;x<=left+room.w-.45;x+=.26)points.push({x,z:top+.34,yaw:0},{x,z:top+room.h-.34,yaw:Math.PI});for(let z=top+.45;z<=top+room.h-.45;z+=.26)points.push({x:left+.34,z,yaw:Math.PI/2},{x:left+room.w-.34,z,yaw:-Math.PI/2});
 const cabinets=[];for(const c of points){const turned=Math.abs(Math.sin(c.yaw))>.5,hx=turned?.21:.26,hz=turned?.26:.21,candidate={...c,width:.48,depth:.38,minX:c.x-hx,maxX:c.x+hx,minZ:c.z-hz,maxZ:c.z+hz};if(doors.some(d=>overlap(candidate,d))||cabinets.some(d=>overlap(candidate,d,.12)))continue;cabinets.push(candidate);if(cabinets.length===4)break;}
 // Twelve ideas still remain selectable if an unusual tiny layout has fewer
 // wall segments: the display grows vertically instead of occupying a route.
 const count=Math.max(1,cabinets.length),levels=Math.ceil(ideas.length/count),step=Math.min(.62,1.55/Math.max(1,levels-1)),scale=Math.min(.48,step/.94),slots=ideas.map((idea,index)=>{const cabinet=cabinets[index%count]||{x:left+.45,z:top+.34,yaw:0},level=Math.floor(index/count),shelf=.55+level*step,radius={book:.065,sphere:.34,crystal:.43,ring:.415}[idea.cue]||.34;return {idea,x:cabinet.x+Math.sin(cabinet.yaw)*.015,z:cabinet.z+Math.cos(cabinet.yaw)*.015,y:shelf+radius*scale+.041,shelf,scale,pedestal:false,cabinet:index%count};});
 return {dense:true,cabinets,slots};
}
