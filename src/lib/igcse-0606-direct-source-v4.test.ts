import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {project0606ApprovedSections} from './igcse-0606-section-retrieval-v3.mjs';
const raw=JSON.parse(readFileSync('src/data/raw/igcse-additional.json','utf8')).questions;
it('projects source-image additions with honest provenance rather than verified-model laundering',()=>{
 for(const [id,code] of [['0606-2016-june-13-q4','5.1'],['0606-2025-march-12-q12','14.12'],['0606-2025-march-12-q12','14.1'],['0606-2026-june-11-q10','14.1']]){
  const result=project0606ApprovedSections(raw.find((r:{id:string})=>r.id===id));
  if (!result) throw new Error(`Missing reviewed projection: ${id}`);
  expect(result.codeRefs).toContain(`current_2025:${code}`);
  expect(result.codeRefs).toContain(`source_image_model_0606_v4:${code}`);
 }
});
