import {ARTISTS} from './artist-catalog.js';
import {artistPersona} from './artist-dialogue.js';
import {validateCityNetwork} from './city-network.js';
import {validateArtistDesign,validateArtistHomes,ARTIST_HOME_LIMITS} from './artist-home-data.js';

const defaults={dali:['composition-wall','contrast'],monet:['observation-alcove','garden'],kandinsky:['composition-wall','contrast'],'van-gogh':['observation-alcove','contrast'],hokusai:['composition-wall','quiet'],rodin:['material-table','quiet'],'hilma-af-klint':['composition-wall','garden'],mondrian:['composition-wall','contrast'],lange:['observation-alcove','quiet'],morris:['material-table','garden'],klee:['material-table','contrast']};
const fresh=(prefix,records)=>{let n=records.length+1;while(records.some(r=>r.id===prefix+'-'+n))n++;return prefix+'-'+n;};
const artist=id=>{const found=ARTISTS.find(a=>a.id===id);if(!found)throw Error('Choose a known artist resident.');return found;};
export const artistHomeArchive=network=>validateCityNetwork(network).artistHomes??{version:1,proposals:[],editions:[]};
export function proposeArtistHome(network,artistId,suggestion){
 const next=validateCityNetwork(network),a=artist(artistId),archive=artistHomeArchive(next),history=next.artistConversations?.[artistId]??[];
 if(!history.length)throw Error('Talk with this artist before designing a new edition together.');
 const latest=history.at(-1),duplicate=archive.proposals.find(p=>p.artistId===artistId&&p.sourceMessageId===latest.id);
 if(duplicate)return next;
 if(archive.proposals.length>=ARTIST_HOME_LIMITS.proposals)throw Error('Your artist house review archive is full. Back it up before adding more; nothing was removed.');
 const [feature,atmosphere]=defaults[artistId];
 const practice=artistPersona(artistId);
 const design=validateArtistDesign(suggestion??{title:a.name+' · a new study house',reason:practice.room+' Use our discussion to decide what this study should test before building.',exercise:practice.exercise,feature,atmosphere});
 archive.proposals.push({id:fresh('artist-proposal',archive.proposals),artistId,date:new Date().toISOString(),decision:'pending',sourceMessageId:latest.id,...design});
 next.artistHomes=validateArtistHomes(archive);return validateCityNetwork(next);
}
export function decideArtistHome(network,proposalId,decision,design){
 const next=validateCityNetwork(network),archive=artistHomeArchive(next),p=archive.proposals.find(p=>p.id===proposalId);
 if(!p||p.decision!=='pending'||!['approved','declined'].includes(decision))throw Error('Choose a pending artist house idea and record your decision.');
 if(decision==='approved'){
  if(archive.editions.length>=ARTIST_HOME_LIMITS.editions)throw Error('The new gallery district holds 20 preserved editions. Nothing was replaced.');
  Object.assign(p,validateArtistDesign(design??Object.fromEntries(['title','reason','exercise','feature','atmosphere'].map(k=>[k,p[k]]))));
  p.decision=decision;
  archive.editions.push({id:fresh('artist-house',archive.editions),artistId:p.artistId,number:2+archive.editions.filter(e=>e.artistId===p.artistId).length,proposalId:p.id,createdAt:new Date().toISOString(),...Object.fromEntries(['title','reason','exercise','feature','atmosphere'].map(k=>[k,p[k]]))});
 }else p.decision=decision;
 next.artistHomes=validateArtistHomes(archive);return validateCityNetwork(next);
}
export function artistImprovementBrief(network,artistId){
 const a=artist(artistId),archive=artistHomeArchive(network),editions=archive.editions.filter(e=>e.artistId===artistId);
 if(!editions.length)throw Error('Approve a house edition before exporting its GitHub update brief.');
 return {format:'house-of-ideas-artist-update',version:1,repository:'hadi1373z/house-of-ideas',artist:{id:a.id,name:a.name,approach:a.approach},approvedEditions:editions,
  procedure:['Open hadi1373z/house-of-ideas in Codex and attach this JSON brief.','Ask Codex to implement the approved artist house editions as new neighbouring houses, preserving originals and all artwork attribution.','Review the visible changes and tests, then commit and publish the GitHub Pages update.','Update the offline program after stopping it; keep the entire data folder.'],
  instruction:'Only the approved editions are included. This brief cannot execute code, sign in, or publish automatically.'};
}
