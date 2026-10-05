import taxonomy from '../data/igcse-0606-numbered-subtopics.json' with {type:'json'};
import overlay from '../data/igcse-0606-section-retrieval-v3.json' with {type:'json'};
export const SECTIONS_0606_V3=Object.freeze(taxonomy.sections);
export const OVERLAY_0606_V3=overlay;
const byCode=new Map(SECTIONS_0606_V3.map(s=>[s.code,s]));
const byId=new Map(overlay.rows.map(r=>[r.id,r]));
if(overlay.schemaVersion!==1||overlay.expectedInventoryCount!==1633||overlay.syllabusPdfSha256!==taxonomy.sourcePdfSha256||byCode.size!==67||byId.size!==overlay.rows.length)throw new Error('0606 retrieval snapshot drift');
export function fingerprint0606(r){
 let h=2166136261;
 const text=JSON.stringify([r.id,r.year,r.component,r.primaryTopic,r.secondaryTopics??[],r.subtopics??[],r.skills??[],r.accessibleText??'',r.questionImages??[]]);
 for(const b of new TextEncoder().encode(text))h=Math.imul(h^b,16777619)>>>0;
 return h.toString(16);
}
export function project0606ApprovedSections(raw){
 const row=byId.get(raw.id);if(!row)return null;
 if(fingerprint0606(raw)!==row.inputFingerprint)throw new Error(`0606 approved input drift: ${raw.id}`);
 const types=['source-reviewed','deterministic-correspondence','sample-calibrated-model','direct-image-model-review'];
 for(const code of row.sectionCodes)if(!byCode.has(code)||!types.includes(row.evidenceByCode[code]))throw new Error(`0606 invalid per-link evidence: ${raw.id}/${code}`);
 const sections=SECTIONS_0606_V3.filter(s=>row.sectionCodes.includes(s.code));
 const evidenceRef={
  'source-reviewed':'source_reviewed_0606_v3',
  'deterministic-correspondence':'deterministic_0606_v3',
  'sample-calibrated-model':'sample_calibrated_0606_v3',
  'direct-image-model-review':'source_image_model_0606_v4',
 };
 return {subtopics:sections.map(s=>s.displayTitle),secondaryTopics:[...new Set(sections.map(s=>s.topic))],codeRefs:sections.flatMap(s=>[`current_2025:${s.code}`,`${evidenceRef[row.evidenceByCode[s.code]]}:${s.code}`])};
}
