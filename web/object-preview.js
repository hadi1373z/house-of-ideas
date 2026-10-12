import * as THREE from './vendor/three.module.js';

export function matchesObject(data,item){
 if(item.daliObjectId)return data.daliObjectId===item.daliObjectId;
 if(item.conceptId)return data.conceptId===item.conceptId;
 if(item.cargoId)return data.cargoId===item.cargoId&&(!item.placementId||data.placementId===item.placementId);
 if(item.designId)return data.designId===item.designId;
 if(item.ideaId)return data.ideaId===item.ideaId;
 if(item.featureId)return data.featureId===item.featureId;
 if(item.id?.startsWith('gallery:'))return data.artistId===item.artistId&&(item.id.endsWith(':bench')?data.label?.startsWith('Reflect on '):data.label?.startsWith('Try '));
 if(item.workId)return data.workId===item.workId&&(!item.artistId||data.artistId===item.artistId)&&(!item.roomId||data.roomId===item.roomId);
 if(item.bookInstanceId)return data.bookInstanceId===item.bookInstanceId;
 if(item.bookId)return data.bookId===item.bookId&&data.roomId===item.roomId;
 if(item.homeLightId)return data.homeLightId===item.homeLightId;
 return Boolean(item.homeAction&&data.homeAction===item.homeAction&&data.roomId===item.roomId&&data.label===item.title);
}

export function extractObjectPreview(root,item){
 root.updateMatrixWorld(true);const selected=[],instances=[];
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;let n=o;while(n){if(matchesObject(n.userData||{},item)){selected.push(o);break;}n=n.parent;}});
 if((item.id?.startsWith('gallery:')||item.daliObjectId==='soft-clock')&&selected.length){const area=new THREE.Box3();for(const o of selected)area.union(new THREE.Box3().setFromObject(o));area.min.y=0;area.min.x-=.08;area.max.x+=.08;area.min.z-=.08;area.max.z+=.08;root.traverse(o=>{if(o.isInstancedMesh){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){const matrix=new THREE.Matrix4();o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);if(area.containsBox(o.geometry.boundingBox.clone().applyMatrix4(matrix)))instances.push({source:o,matrix});}}else if(o.isMesh&&!selected.includes(o)&&area.containsBox(new THREE.Box3().setFromObject(o)))selected.push(o);});}
 const group=new THREE.Group(),resources=[];
 for(const {source,matrix} of [...selected.map(source=>({source,matrix:source.matrixWorld})),...instances]){const geometry=source.geometry.clone(),material=(Array.isArray(source.material)?source.material:[source.material]).map(m=>m.clone()),copy=new THREE.Mesh(geometry,Array.isArray(source.material)?material:material[0]);copy.matrixAutoUpdate=false;copy.matrix.copy(matrix);copy.matrixWorldNeedsUpdate=true;copy.frustumCulled=false;group.add(copy);resources.push(geometry,...material);}
 if(!selected.length)return null;
 group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 group.position.copy(center).multiplyScalar(-1);group.updateMatrixWorld(true);
 return {group,size,parts:selected.length+instances.length,dispose(){for(const r of resources)r.dispose();group.clear();}};
}

export function createObjectViewer(container){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(480,320);renderer.setClearColor('#ece4d4');renderer.outputColorSpace=THREE.SRGBColorSpace;container.append(renderer.domElement);
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','3D object preview. Drag to rotate.');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1.5,.01,1000);scene.add(new THREE.HemisphereLight('#fff9eb','#6b6e62',2.5));const light=new THREE.DirectionalLight('#fff5db',3);light.position.set(4,6,5);scene.add(light);
 let current=null,yaw=.5,pitch=.2,distance=4,drag=null;
 function render(){camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,0,0);renderer.render(scene,camera);}
 function clear(){if(current){scene.remove(current.group);current.dispose();current.release?.();current=null;}render();}
 function set(value,title){clear();current=value;scene.add(value.group);distance=Math.max(value.size.x,value.size.y,value.size.z,.1)*2.7;yaw=.5;pitch=.2;renderer.domElement.setAttribute('aria-label','3D preview of '+title+'. Drag to rotate.');render();}
 const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.012;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag.y)*.012,-1.2,1.2);drag={x:e.clientX,y:e.clientY};render();};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
 render();return {set,clear,rotate(delta){yaw+=delta;render();},snapshot:()=>renderer.domElement.toDataURL('image/png'),dispose(){clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
