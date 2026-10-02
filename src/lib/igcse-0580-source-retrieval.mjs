import additions from '../data/igcse-0580-source-retrieval-additions.json' with {type:'json'};
const byId=new Map(additions.records.map(row=>[row.id,row]));
if(byId.size!==additions.records.length)throw new Error('Duplicate 0580 source retrieval additions');
/** Source drift check, not a cryptographic authentication seal. @param {any} raw */
export function source0580Fingerprint(raw){
 const fields=['id','year','paper','number','component','accessibleText','primaryTopic','secondaryTopics','subtopics','detailedSubtopics','questionImages','markschemeImages','sourceQuestionUrl','sourceMarkSchemeUrl'];
 const bytes=new TextEncoder().encode(JSON.stringify(fields.map(key=>raw[key]??null)));
 let hash=2166136261;
 for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;
 return hash.toString(16).padStart(8,'0');
}
/** @param {any} raw */
export function verified0580RetrievalAdditions(raw){
 const row=byId.get(raw.id);
 if(!row)return null;
 if(source0580Fingerprint(raw)!==row.sourceFingerprint)throw new Error(`0580 retrieval source drift: ${raw.id}`);
 return row;
}
