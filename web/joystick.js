export function stickVector(dx,dy,radius,deadZone=.12){
 const limit=Math.max(1,radius),distance=Math.hypot(dx,dy),clamped=Math.min(distance,limit),strength=Math.max(0,(clamped/limit-deadZone)/(1-deadZone));
 const direction=distance||1;
 return {x:dx/direction*strength,y:-dy/direction*strength,thumbX:dx/direction*clamped,thumbY:dy/direction*clamped};
}

export function createJoystick(surface,thumb){
 const state={x:0,y:0,active:false},held=new Set();let pointer=null;
 const travel=box=>Math.max(8,(Math.min(box.width,box.height)-(thumb.offsetWidth||50))/2-4);
 function paint(x,y){thumb.style.transform=`translate(${x}px, ${y}px)`;surface.classList.toggle('active',state.active);}
 function reset(){const captured=pointer;pointer=null;held.clear();state.x=0;state.y=0;state.active=false;paint(0,0);if(captured!==null&&surface.hasPointerCapture?.(captured))surface.releasePointerCapture(captured);}
 function update(e){const box=surface.getBoundingClientRect(),radius=travel(box);const vector=stickVector(e.clientX-box.left-box.width/2,e.clientY-box.top-box.height/2,radius);state.x=vector.x;state.y=vector.y;state.active=true;paint(vector.thumbX,vector.thumbY);}
 surface.addEventListener('pointerdown',e=>{if(pointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;surface.setPointerCapture(pointer);update(e);});
 surface.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;e.preventDefault();update(e);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
 const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
 function keyboard(){let x=Number(held.has('right'))-Number(held.has('left')),y=Number(held.has('up'))-Number(held.has('down')),length=Math.hypot(x,y)||1;state.x=x/length;state.y=y/length;state.active=held.size>0;const radius=travel(surface.getBoundingClientRect());paint(state.x*radius,-state.y*radius);}
 surface.addEventListener('keydown',e=>{if(!keys[e.key]||pointer!==null)return;e.preventDefault();e.stopPropagation();held.add(keys[e.key]);keyboard();});
 surface.addEventListener('keyup',e=>{if(!keys[e.key])return;e.preventDefault();e.stopPropagation();held.delete(keys[e.key]);keyboard();});
 surface.addEventListener('blur',reset);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 return {state,reset};
}
