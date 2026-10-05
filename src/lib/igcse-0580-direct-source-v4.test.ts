import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {project0580Sections} from './igcse-0580-section-retrieval-v3.mjs';
const raw=JSON.parse(readFileSync('src/data/raw/igcse.json','utf8')).questions;
it('projects new source-image secondary links with honest evidence provenance',()=>{
 const r=raw.find((r:{id:string})=>r.id==='0580-2025-march-22-q18');
 const p=project0580Sections(r);if(!p)throw new Error('missing approved geometry question');
 expect(p.codeRefs).toContain('current_2025:E5.5');expect(p.codeRefs).toContain('source_image_model_0580_v4:E5.5');expect(p.codeRefs).toContain('current_2025:E1.18');
});
it('removes only the source-adjudicated false standard-form link without inventing a surd link',()=>{
 const p=project0580Sections(raw.find((r:{id:string})=>r.id==='0580-2022-november-22-q10'));if(!p)throw new Error('missing calculator row');
 expect(p.codeRefs).not.toContain('current_2025:E1.8');expect(p.codeRefs).not.toContain('current_2025:E1.18');expect(p.codeRefs).toContain('current_2025:E1.14');
});
