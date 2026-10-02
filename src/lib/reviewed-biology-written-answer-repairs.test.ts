import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { BankSlug } from '@/lib/banks';
import { normalizeBankQuestions,type UnifiedQuestion } from '@/lib/questions';
import { reviewedMarkschemePaths } from '@/lib/reviewed-mcq-answer-repairs';
import biology from '@/data/production/igcse-biology-0610.json';
import { metadataFromRaw } from '../../scripts/generate-bank-index.mjs';

type Written={oldPaths:string[];newPaths:string[];sha256:string[]};
const repairs=JSON.parse(readFileSync('src/data/reviewed-biology-written-answer-repairs.json','utf8'))as Record<string,Written>;
const ignored=new Set(['questionImages','questionAssetPaths','questionImageCount','markschemeImages','markschemeAssetPaths','markschemeImageCount']);
const stable=(q:UnifiedQuestion)=>Object.fromEntries(Object.entries(q).filter(([k])=>!ignored.has(k)));

describe('source-grid verified written Biology answers',()=>{
  it('replaces all182 exact source-verified IDs without rewriting any original question',()=>{
    const frozen=JSON.stringify(biology);
    const before=normalizeBankQuestions('igcse-biology-0610',biology.questions as Array<Record<string,unknown>>,{economicsAssetMode:'private'});
    const after=normalizeBankQuestions('igcse-biology-0610',biology.questions as Array<Record<string,unknown>>,{economicsAssetMode:'private',applyReviewedBlankPages:true});
    const writtenChanged=after.filter((q,i)=>repairs[q.id]&&JSON.stringify(q.markschemeAssetPaths)!==JSON.stringify(before[i].markschemeAssetPaths));
    expect(writtenChanged.map(q=>q.id).sort()).toEqual(Object.keys(repairs).sort());
    expect(writtenChanged).toHaveLength(182);expect(after).toHaveLength(4913);
    expect(after.map(q=>q.id)).toEqual(before.map(q=>q.id));
    for(let i=0;i<after.length;i++)expect(stable(after[i])).toEqual(stable(before[i]));
    for(const q of writtenChanged){expect(q.markschemeAssetPaths).toEqual(repairs[q.id].newPaths.map(p=>'igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/'+p));expect(q.markschemeImageCount).toBe(repairs[q.id].newPaths.length);}
    expect(JSON.stringify(biology)).toBe(frozen);
  });
  it('uses the complete six owned Q2 source bands and rejects stale old paths',()=>{
    const qid='0610-2026-m-42-q2',r=repairs[qid];
    expect(reviewedMarkschemePaths('igcse-biology-0610',qid,r.oldPaths)).toEqual(r.newPaths);
    expect(r.newPaths).toHaveLength(6);
    expect(()=>reviewedMarkschemePaths('igcse-biology-0610',qid,['wrong.webp'])).toThrow(/disagrees/);
  });
  it('public index answer-image counts match all reviewed written replacements',()=>{
    const byId=new Map(biology.questions.map(q=>[q.id,q]));
    for(const [qid,r]of Object.entries(repairs))expect(metadataFromRaw(byId.get(qid),{bank:'igcse-biology-0610',normalizedProduction:true}).markschemeImageCount).toBe(r.newPaths.length);
  });
  it('pins all182 replacements to the immutable999-object complete remote readback receipt',()=>{
    type Asset={objectKey:string;relativePath:string;sha256:string;size:number};
    type Replacement={questionId:string;oldPaths:string[];newPaths:string[];sha256:string[]};
    const bytes=readFileSync('data/storage/biology-written-answer-repairs.manifest.json');
    const manifest=JSON.parse(bytes.toString())as{assets:Asset[];replacements:Replacement[];objectPrefix:string;replacementCount:number;logicalCropCount:number;uniqueObjectCount:number;runtimeSha256:string};
    const receipt=JSON.parse(readFileSync('data/storage/biology-written-answer-repairs.receipt.json','utf8'))as{state:string;count:number;expectedCount:number;manifestSha256:string;completed:Array<Asset&{contentType:string}>};
    expect(receipt.state).toBe('verified_readback');expect(receipt.count).toBe(999);expect(receipt.expectedCount).toBe(999);expect(receipt.completed).toHaveLength(999);
    expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(manifest.runtimeSha256).toBe(createHash('sha256').update(readFileSync('src/data/production/igcse-biology-0610.json')).digest('hex'));
    expect(manifest.replacementCount).toBe(182);expect(manifest.logicalCropCount).toBe(1006);expect(manifest.uniqueObjectCount).toBe(999);
    const remote=new Map(receipt.completed.map(a=>[a.objectKey,a]));expect(remote.size).toBe(999);
    for(const a of manifest.assets)expect(remote.get(a.objectKey)).toEqual(expect.objectContaining({sha256:a.sha256,size:a.size,contentType:'image/webp'}));
    for(const r of manifest.replacements){expect(repairs[r.questionId]).toEqual({oldPaths:r.oldPaths,newPaths:r.newPaths,sha256:r.sha256});for(let i=0;i<r.newPaths.length;i++)expect(remote.get(manifest.objectPrefix+r.newPaths[i])?.sha256).toBe(r.sha256[i]);}
  });
  it('never applies written Bio repairs to another bank or a held Bio question',()=>{
    for(const bank of ['igcse-physics-0625','igcse-chemistry-0620','igcse-coordinated-sciences-0654']as BankSlug[])expect(reviewedMarkschemePaths(bank,'0610-2026-m-42-q2',['original.webp'])).toEqual(['original.webp']);
    expect(reviewedMarkschemePaths('igcse-biology-0610','0610-2023-w-31-q2',['original.webp'])).toEqual(['original.webp']);
  });
});
