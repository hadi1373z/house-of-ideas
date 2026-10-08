export function findCityPath(city,from,to){
 if(!city||!from||!to||![from.x,from.z,to.x,to.z].every(Number.isFinite)||!city.canStand(from.x,from.z)||!city.canStand(to.x,to.z))return [];
 const b=city.bounds||{minX:-30,maxX:30,minZ:-20,maxZ:20},step=.4,cols=Math.ceil((b.maxX-b.minX)/step)+1,rows=Math.ceil((b.maxZ-b.minZ)/step)+1;
 const cell=p=>({x:Math.round((p.x-b.minX)/step),z:Math.round((p.z-b.minZ)/step)}),point=c=>({x:b.minX+c.x*step,z:b.minZ+c.z*step}),key=c=>c.z*cols+c.x;
 const crossesBox=(a,c,o)=>{let low=0,high=1;const radius=city.collisionRadius??.22;for(const [axis,min,max] of [['x',o.minX-radius,o.maxX+radius],['z',o.minZ-radius,o.maxZ+radius]]){const delta=c[axis]-a[axis];if(Math.abs(delta)<1e-12){if(a[axis]<=min||a[axis]>=max)return false;continue;}const first=(min-a[axis])/delta,last=(max-a[axis])/delta;low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));if(low>=high)return false;}return high>0&&low<1;};
 const segmentClear=(a,c,fine=false)=>{if((city.colliders||[]).some(o=>[o.minX,o.maxX,o.minZ,o.maxZ].every(Number.isFinite)&&crossesBox(a,c,o)))return false;const n=Math.max(1,Math.ceil(Math.hypot(c.x-a.x,c.z-a.z)/(fine?.005:.06)));for(let i=0;i<=n;i++)if(!city.canStand(a.x+(c.x-a.x)*i/n,a.z+(c.z-a.z)*i/n))return false;return true;};
 // A rounded valid position can land inside a wall or cut a building corner.
 // Connect both real endpoints to clear cells, checking the entire segment.
 const connectors=p=>{const center=cell(p),result=[];for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const c={x:center.x+dx,z:center.z+dz};if(c.x<0||c.x>=cols||c.z<0||c.z>=rows)continue;const world=point(c),distance=Math.hypot(world.x-p.x,world.z-p.z);if(distance<=step*2&&segmentClear(p,world,true))result.push({c,distance});}return result.sort((a,c)=>a.distance-c.distance).map(item=>item.c);};
 const starts=connectors(from),ends=new Set(connectors(to).map(key));if(!starts.length||!ends.size)return [];
 const queue=[...starts],parents=new Map(starts.map(c=>[key(c),null]));let found=null;
 const searchLimit=Math.min(cols*rows,60000);
 for(let n=0;n<queue.length&&n<searchLimit;n++){const c=queue[n];if(ends.has(key(c))){found=c;break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:c.x+dx,z:c.z+dz},k=key(next);if(next.x<0||next.z<0||next.x>=cols||next.z>=rows||parents.has(k)||!segmentClear(point(c),point(next)))continue;parents.set(k,c);queue.push(next);}}
 if(!found)return [];
 const result=[{x:to.x,z:to.z}];while(found){result.push(point(found));found=parents.get(key(found));}return result.reverse();
}
