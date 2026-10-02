import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { BankSlug } from '@/lib/banks';
import { normalizeBankQuestions, type UnifiedQuestion } from '@/lib/questions';
import { reviewedMarkschemePaths } from '@/lib/reviewed-mcq-answer-repairs';
import { authorizeAssetRequests } from '@/lib/asset-access';
import { BANK_PRODUCTS, canViewAnswer } from '@/lib/access';
import { metadataFromRaw } from '../../scripts/generate-bank-index.mjs';

type Repair={oldPaths:string[];newPaths:string[];sha256:string};
type Asset={bank:BankSlug;objectKey:string;relativePath:string;sha256:string;size:number};
type Replacement={bank:BankSlug;questionId:string;oldRelativePaths:string[];relativePath:string;sha256:string};
const repairs=JSON.parse(readFileSync('src/data/reviewed-science-mcq-answer-repairs.json','utf8')) as Record<string,Record<string,Repair>>;
const manifestBytes=readFileSync('data/storage/science-mcq-row-repairs.manifest.json');
const manifest=JSON.parse(manifestBytes.toString()) as {assets:Asset[];replacements:Replacement[];banks:Record<string,{objectPrefix:string;replacementCount:number;heldCount:number;runtimeSha256:string}>};
const ignored=new Set(['markschemeImages','markschemeAssetPaths','questionImages','questionAssetPaths','questionImageCount','markschemeImageCount']);
const stable=(q:UnifiedQuestion)=>Object.fromEntries(Object.entries(q).filter(([key])=>!ignored.has(key)));

describe('exact active science MCQ row projection',()=>{
  for(const [bank,count,held] of [['igcse-chemistry-0620',3838,200],['igcse-physics-0625',4200,39],['igcse-coordinated-sciences-0654',3240,39]] as const){
    it(`${bank}: changes only ${count} exact answer paths and preserves the full sealed cohort`,()=>{
      const bytes=readFileSync(`src/data/production/${bank}.json`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.banks[bank].runtimeSha256);
      const raw=JSON.parse(bytes.toString()) as {questions:Array<Record<string,unknown>>};
      const sealed=JSON.stringify(raw);
      const before=normalizeBankQuestions(bank,raw.questions,{economicsAssetMode:'private'});
      const after=normalizeBankQuestions(bank,raw.questions,{economicsAssetMode:'private',applyReviewedBlankPages:true});
      expect(after.map(q=>q.id)).toEqual(before.map(q=>q.id));
      const changed=after.filter((q,i)=>JSON.stringify(q.markschemeAssetPaths)!==JSON.stringify(before[i].markschemeAssetPaths));
      expect(changed).toHaveLength(count);
      expect(changed.map(q=>q.id).sort()).toEqual(Object.keys(repairs[bank]).sort());
      for(let i=0;i<after.length;i++)expect(stable(after[i])).toEqual(stable(before[i]));
      const rawById=new Map(raw.questions.map(q=>[q.id,q]));
      for(const q of changed){
        expect(q.markschemeAssetPaths).toEqual(repairs[bank][q.id].newPaths.map(p=>manifest.banks[bank].objectPrefix+p));
        expect(q.markschemeImageCount).toBe(1);
        expect(metadataFromRaw(rawById.get(q.id),{bank,normalizedProduction:true}).markschemeImageCount).toBe(1);
      }
      expect(JSON.stringify(raw)).toBe(sealed);
      expect(manifest.banks[bank].heldCount).toBe(held);
    });
    it(`${bank}: authenticated viewer/PDF authorization uses the replacement, anonymous access denied`,async()=>{
      vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');
      vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
      try{
        const questionId=Object.keys(repairs[bank]).find(id=>!canViewAnswer(bank,id,[]))!;
        expect(questionId).toBeDefined();
        const request=[{questionId,kind:'answer' as const}];
        await expect(authorizeAssetRequests(bank,request,[])).rejects.toThrow();
        const signed=await authorizeAssetRequests(bank,request,[{productId:BANK_PRODUCTS[bank]!,status:'active',startsAt:'2020-01-01T00:00:00.000Z',expiresAt:null}]);
        expect(signed[0].paths).toEqual(repairs[bank][questionId].newPaths.map(p=>manifest.banks[bank].objectPrefix+p));
      }finally{vi.unstubAllEnvs();}
    });
  }
  it('rejects stale source refs while unknown IDs and unrelated banks remain unchanged',()=>{
    const bank='igcse-chemistry-0620';const id=Object.keys(repairs[bank])[0];
    expect(()=>reviewedMarkschemePaths(bank,id,['markschemes/wrong.webp'])).toThrow(/disagrees/);
    expect(reviewedMarkschemePaths(bank,'not-reviewed',['markschemes/original.webp'])).toEqual(['markschemes/original.webp']);
    expect(reviewedMarkschemePaths('igcse-economics-0455',id,['markschemes/original.webp'])).toEqual(['markschemes/original.webp']);
  });
  it('joins every one of 11278 replacements to all 3810 real verified remote objects without extra keys',()=>{
    const receipt=JSON.parse(readFileSync('data/storage/science-mcq-row-repairs.receipt.json','utf8')) as {manifestSha256:string;state:string;count:number;expectedCount:number;completed:Array<Asset&{contentType:string}>};
    expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
    expect(receipt.state).toBe('verified_readback');expect(receipt.count).toBe(3810);expect(receipt.expectedCount).toBe(3810);expect(receipt.completed).toHaveLength(3810);
    const remote=new Map(receipt.completed.map(a=>[a.objectKey,a]));const assets=new Map(manifest.assets.map(a=>[a.objectKey,a]));
    expect(remote.size).toBe(3810);expect(assets.size).toBe(3810);expect(manifest.replacements).toHaveLength(11278);
    for(const a of manifest.assets)expect(remote.get(a.objectKey)).toEqual(expect.objectContaining({sha256:a.sha256,size:a.size,contentType:'image/webp'}));
    for(const r of manifest.replacements){
      expect(repairs[r.bank][r.questionId]).toEqual({oldPaths:r.oldRelativePaths,newPaths:[r.relativePath],sha256:r.sha256});
      expect(assets.get(manifest.banks[r.bank].objectPrefix+r.relativePath)?.sha256).toBe(r.sha256);
    }
  });
});
