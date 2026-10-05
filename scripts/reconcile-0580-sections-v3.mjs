import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { metadataFromRaw } from './generate-bank-index.mjs';
import { IGCSE_0580_SECTIONS, IGCSE_0580_SECTION_OVERLAY } from '../src/lib/igcse-0580-section-retrieval-v3.mjs';
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const raw=read('src/data/raw/igcse.json').questions;
const seal=read('docs/0580-section-legacy-filter-seal-v3.json');
const rows=raw.map(q=>metadataFromRaw(q,{bank:'igcse'}));
const evidence=new Map(IGCSE_0580_SECTION_OVERLAY.rows.map(r=>[r.id,r]));
const directSource=read('docs/0580-direct-source-input-v4.json');
const sourceReviews=new Map(directSource.reviews.map(r=>[r.id,r]));
const lookup=new Map(rows.map(q=>[q.id,q]));
if(rows.length!==3967||lookup.size!==3967)throw new Error('0580 inventory mismatch');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const legacy=Object.entries(seal.fineFilterIds).map(([label,before])=>{
 const after=rows.filter(r=>[...r.subtopics,...r.skills].includes(label)).map(r=>r.id).sort();
 if(!same(before,after))throw new Error(`Legacy filter drift: ${label}`);
 return {label,count:after.length,ids:after};
});
const sections=IGCSE_0580_SECTIONS.map(s=>({code:s.code,title:s.displayTitle,topic:s.topic,ids:rows.filter(r=>[...r.subtopics,...r.skills].includes(s.displayTitle)).map(r=>r.id).sort()}));
const indexSections=sections.filter(s=>['1.7','2.4','1.18'].includes(s.code));
const union=new Set(indexSections.flatMap(s=>s.ids));
const oldIndices=seal.fineFilterIds['Indices and surds'];
const sourceLinks=(id)=>{const e=evidence.get(id);return e?e.sectionCodes.map(code=>({code,evidenceType:e.evidenceByCode?.[code]??e.evidenceType})):[];};
const remainder=oldIndices.filter(id=>!union.has(id)).map(id=>{
 const r=sourceReviews.get(id);if(!r)throw new Error(`Missing indices-family source disposition ${id}`);
 return {id,disposition:r.disposition==='historical-only'?'Source-image historical-only at current tier; legacy retrieval retained':'Different assessed current objective; legacy retrieval retained',otherApprovedLinks:sourceLinks(id),sourceHashes:r.sourceHashes,parts:r.parts};
});
const reviewedIndexExtras=[...union].filter(id=>!oldIndices.includes(id)).sort().map(id=>({id,evidence:sourceLinks(id).filter(l=>['C1.7','E1.7','C2.4','E2.4','E1.18'].includes(l.code))}));
const mutableClassification=new Set(['secondaryTopics','subtopics','skills','officialCodeRefs']);
const previous=read(process.argv[2]??'docs/0580-section-public-baseline-v3.json');
const previousById=new Map(previous.questions.map(r=>[r.id,r]));
for(const r of rows){const p=previousById.get(r.id);if(!p)throw new Error(`Missing served ID ${r.id}`);for(const key of new Set([...Object.keys(r),...Object.keys(p)].filter(k=>!mutableClassification.has(k))))if(!same(r[key],p[key]))throw new Error(`Unauthorized metadata delta ${r.id}/${key}`);}
const statuses=rows.map(r=>({id:r.id,level:evidence.has(r.id)?'section-plus-preserved-fine':sourceReviews.get(r.id)?.disposition==='historical-only'?'preserved-topic-and-fine; historical-only-source-image-review':'preserved-topic-and-fine; current-section-unresolved',links:sourceLinks(r.id)}));
const result={schemaVersion:1,scope:'0580 additive official tree with conservative per-link evidence; not exhaustive source accuracy',sourceRawSha256:crypto.createHash('sha256').update(fs.readFileSync('src/data/raw/igcse.json')).digest('hex'),questionCount:rows.length,officialTopics:9,officialSections:sections.length,sectionLevel:evidence.size,legacyOnly:rows.length-evidence.size,legacyFilters:legacy,sections,zeroSections:sections.filter(s=>!s.ids.length).map(s=>s.title),indices:{legacyCount:oldIndices.length,officialUnion:union.size,matchedLegacy:oldIndices.filter(id=>union.has(id)).length,remainder,additions:reviewedIndexExtras},rows:statuses};
const dest=path.resolve(process.argv[3]??'docs/0580-section-reconciliation-v3.json');fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:dest,questionCount:result.questionCount,sectionLevel:result.sectionLevel,legacyOnly:result.legacyOnly,legacyFilters:legacy.length,zeroSections:result.zeroSections,indices:{legacy:oldIndices.length,officialUnion:union.size,matchedLegacy:result.indices.matchedLegacy,remainder:remainder.length}}));
