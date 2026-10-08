import {ARTISTS} from './art-city-data.js';

export const ARTIST_HOME_FEATURES = Object.freeze(['observation-alcove','composition-wall','material-table']);
export const ARTIST_HOME_ATMOSPHERES = Object.freeze(['garden','contrast','quiet']);
export const ARTIST_HOME_LIMITS = Object.freeze({proposals:40,editions:20});
const plain=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('Use a supported artist house record.');};
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Artist house text needs 1–${max} characters.`);return v;};
const id=v=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(v))throw Error('Use a valid artist house identifier.');return v;};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)throw Error('Use a valid artist house date.');return v;};
export function validateArtistDesign(v){
 plain(v,['title','reason','exercise','feature','atmosphere']);
 if(!ARTIST_HOME_FEATURES.includes(v.feature)||!ARTIST_HOME_ATMOSPHERES.includes(v.atmosphere))throw Error('Choose a supported gallery feature and atmosphere.');
 return {title:text(v.title,100),reason:text(v.reason,1200),exercise:text(v.exercise,500),feature:v.feature,atmosphere:v.atmosphere};
}
export function validateArtistHomes(input){
 plain(input,['version','proposals','editions']);
 if(input.version!==1||!Array.isArray(input.proposals)||input.proposals.length>ARTIST_HOME_LIMITS.proposals||!Array.isArray(input.editions)||input.editions.length>ARTIST_HOME_LIMITS.editions)throw Error('The artist house archive is full or unsupported. Nothing was removed.');
 const ids=new Set(),known=artistId=>{if(!ARTISTS.some(a=>a.id===artistId))throw Error('Choose a known artist house.');return artistId;};
 const unique=v=>{id(v);if(ids.has(v))throw Error('Artist house records need distinct identities.');ids.add(v);return v;};
 const proposals=input.proposals.map(p=>{
  plain(p,['id','artistId','date','decision','sourceMessageId','title','reason','exercise','feature','atmosphere']);
  if(!['pending','approved','declined'].includes(p.decision))throw Error('Record the owner’s artist house decision.');
  return {id:unique(p.id),artistId:known(p.artistId),date:date(p.date),decision:p.decision,...(p.sourceMessageId===undefined?{}:{sourceMessageId:id(p.sourceMessageId)}),...validateArtistDesign(Object.fromEntries(['title','reason','exercise','feature','atmosphere'].map(k=>[k,p[k]])))};
 });
 const editionProposals=new Set(),counts=new Map();
 const editions=input.editions.map(e=>{
  plain(e,['id','artistId','number','proposalId','createdAt','title','reason','exercise','feature','atmosphere']);
  const proposal=proposals.find(p=>p.id===e.proposalId),number=(counts.get(e.artistId)||1)+1;counts.set(e.artistId,number);
  if(!proposal||proposal.artistId!==e.artistId||proposal.decision!=='approved'||editionProposals.has(e.proposalId)||e.number!==number)throw Error('Each new artist house needs its own recorded approval and edition number.');
  editionProposals.add(e.proposalId);
  const design=validateArtistDesign(Object.fromEntries(['title','reason','exercise','feature','atmosphere'].map(k=>[k,e[k]])));
  if(['title','reason','exercise','feature','atmosphere'].some(k=>design[k]!==proposal[k]))throw Error('Build the approved artist house design.');
  return {id:unique(e.id),artistId:known(e.artistId),number,proposalId:proposal.id,createdAt:date(e.createdAt),...design};
 });
 if(proposals.some(p=>p.decision==='approved'&&!editionProposals.has(p.id)))throw Error('An approved artist house must have its preserved edition.');
 return {version:1,proposals,editions};
}
