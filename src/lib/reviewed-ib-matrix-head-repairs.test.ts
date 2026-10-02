import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {reviewedMarkschemePaths} from '@/lib/reviewed-mcq-answer-repairs';
import {loadBankQuestions} from '@/lib/question-loader';
import {metadataFromRaw} from '../../scripts/generate-bank-index.mjs';
const raw=JSON.parse(readFileSync('src/data/raw/ib-ai-hl.json','utf8')).questions;
const id12='2025-november-tz0-p1-q12',id13='2025-november-tz0-p1-q13';
const row12=raw.find((q:{id:string})=>q.id===id12),row13=raw.find((q:{id:string})=>q.id===id13);
test('sealed receipt binds exact reviewed cohort, original paths, and one fully read-back object',()=>{
 const bytes=readFileSync('data/storage/ib-matrix-head-repairs.manifest.json');const manifest=JSON.parse(bytes.toString());const receipt=JSON.parse(readFileSync('data/storage/ib-matrix-head-repairs.receipt.json','utf8'));const repairs=JSON.parse(readFileSync('src/data/reviewed-ib-matrix-head-repairs.json','utf8'));
 expect(manifest.entries).toEqual(repairs.entries);expect(Object.keys(repairs.entries).sort()).toEqual([id12,id13]);expect(manifest.objects).toHaveLength(1);
 expect(receipt.state).toBe('verified_readback');expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'})));
});
test('exact foreign-only Q12 tail is retired and stale source paths fail closed',()=>{
 expect(reviewedMarkschemePaths('ib-ai-hl',id12,row12.officialMarkscheme.images)).toEqual([row12.officialMarkscheme.images[0]]);
 expect(()=>reviewedMarkschemePaths('ib-ai-hl',id12,['markschemes/stale.webp'])).toThrow();
});
test('actual legacy IB loader activates both repairs and preserves all unrelated answer paths',async()=>{
 const before=JSON.stringify(raw);const all=await loadBankQuestions('ib-ai-hl');expect(all).toHaveLength(409);
 const byId=new Map(all.map(q=>[q.id,q]));
 expect(byId.get(id12)?.markschemeAssetPaths).toEqual([`ib-ai-hl/${row12.officialMarkscheme.images[0]}`]);
 expect(byId.get(id13)?.markschemeAssetPaths[0]).toMatch(/^ib-ai-hl\/repairs\/ib-matrix-head-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/);
 for(const r of raw){const q=byId.get(r.id);expect(q?.questionAssetPaths).toEqual(r.questionImages.map((p:string)=>`ib-ai-hl/${p}`));if(r.id!==id12&&r.id!==id13)expect(q?.markschemeAssetPaths).toEqual(r.officialMarkscheme.images.map((p:string)=>`ib-ai-hl/${p}`));}
 expect(JSON.stringify(raw)).toBe(before);
});
test('canonical metadata updates only reviewed answer count, other banks unaffected',()=>{
 expect(metadataFromRaw(row12,{bank:'ib-ai-hl'}).markschemeImageCount).toBe(1);
 expect(metadataFromRaw(row13,{bank:'ib-ai-hl'}).markschemeImageCount).toBe(1);
 expect(reviewedMarkschemePaths('ib-ai-sl',id12,row12.officialMarkscheme.images)).toEqual(row12.officialMarkscheme.images);
});
