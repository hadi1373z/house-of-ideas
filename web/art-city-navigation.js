export function findCityPath(artCity,from,to){
  if(!artCity||![from.x,from.z,to.x,to.z].every(Number.isFinite)||!artCity.canStand(from.x,from.z)||!artCity.canStand(to.x,to.z))return [];
  const b=artCity.bounds||{minX:-30,maxX:30,minZ:-20,maxZ:20},step=.4,cols=Math.ceil((b.maxX-b.minX)/step)+1,rows=Math.ceil((b.maxZ-b.minZ)/step)+1;
  const cell=p=>({x:Math.round((p.x-b.minX)/step),z:Math.round((p.z-b.minZ)/step)}),point=c=>({x:b.minX+c.x*step,z:b.minZ+c.z*step}),start=cell(from),end=cell(to),key=c=>c.z*cols+c.x;
  const queue=[start],parents=new Map([[key(start),null]]);let found=null;
  for(let n=0;n<queue.length&&n<22000;n++){const c=queue[n];if(c.x===end.x&&c.z===end.z){found=c;break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:c.x+dx,z:c.z+dz},k=key(next);if(next.x<0||next.z<0||next.x>=cols||next.z>=rows||parents.has(k))continue;const p=point(next),previous=point(c);if(!artCity.canStand(p.x,p.z)||!artCity.canStand((p.x+previous.x)/2,(p.z+previous.z)/2))continue;parents.set(k,c);queue.push(next);}}
  if(!found)return [];
  const result=[{x:to.x,z:to.z}];while(found&&key(found)!==key(start)){result.push(point(found));found=parents.get(key(found));}return result.reverse();
 }
