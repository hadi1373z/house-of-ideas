import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {IDEA_ARTIFACTS,buildIdeaArtifact} from '../web/idea-artifacts.js';
import {glb} from './store-glb-export.mjs';
import {validateGlb} from '../web/design-objects.js';
const models=[];
for(const spec of IDEA_ARTIFACTS){const model=buildIdeaArtifact(spec.id),bytes=glb(model.group);validateGlb(bytes);model.dispose();const assetId=createHash('sha256').update(bytes).digest('hex');const record={...spec,id:'artifact-'+spec.id,category:'Thinking artifacts',creator:'House of Ideas project',license:'Project-created model; see project source',sourceUrl:'https://github.com/hadi1373z/house-of-ideas/blob/main/web/idea-artifacts.js',sourceRecord:'./object-store/sources/'+spec.id+'.txt',sourceType:'project',revision:'Idea artifacts v1',assetId,bytes:bytes.length,modifications:'Original procedural geometry created for House of Ideas. Static sculpture with an explicit learning activity; no external model or texture used.'};models.push(record);await fs.writeFile('web/object-store/assets/'+assetId+'.glb',bytes);await fs.writeFile('web/object-store/sources/'+spec.id+'.txt',JSON.stringify(record,null,2)+'\n');}
await fs.writeFile('web/object-store/idea-models.js','export const IDEA_MODELS='+JSON.stringify(models,null,2)+';\n');console.log('Built eight original thinking artifacts with local source records.');
