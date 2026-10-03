import{test,expect}from'vitest';
import{createHash}from'node:crypto';
import{readFileSync}from'node:fs';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{loadBankQuestions}from'@/lib/question-loader';
const repairs=JSON.parse(readFileSync('src/data/reviewed-ib-boundary-batch-repairs.json','utf8')).banks['ib-hl']as Record<string,{oldPaths:string[];newPaths:string[]}>;
test('sealed manifest binds all16 image objects on both providers',()=>{
 const bytes=readFileSync('data/storage/ib-boundary-batch-repairs.manifest.json');const m=JSON.parse(bytes.toString());const receipt=JSON.parse(readFileSync('data/storage/ib-boundary-batch-repairs.receipt.json','utf8'));expect(m.banks['ib-hl']).toEqual(repairs);expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));expect(receipt.state).toBe('verified_readback');expect(receipt.records).toHaveLength(32);
 const expected=['supabase','r2'].flatMap(provider=>m.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({provider,objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'}))).sort((a,b)=>(a.provider+':'+a.objectKey).localeCompare(b.provider+':'+b.objectKey));expect(receipt.records).toEqual(expected);
});
test('exact source-supported boundary batch activates through real legacy loader',async()=>{
 const raw=JSON.parse(readFileSync('src/data/raw/ib-hl.json','utf8')).questions;const before=JSON.stringify(raw);const qs=await loadBankQuestions('ib-hl');const byId=new Map(qs.map(q=>[q.id,q]));expect(qs).toHaveLength(raw.length);expect(Object.keys(repairs)).toHaveLength(20);
 for(const r of raw){const q=byId.get(r.id);const paths=[...(r.markschemeImages??[]),...(r.officialMarkscheme?.images??[])];const expected=repairs[r.id]?.newPaths??paths;expect(q?.markschemeAssetPaths,r.id).toEqual(expected.map((p:string)=>'ib-hl/'+p));expect(q?.questionAssetPaths,r.id).toEqual((r.questionImages??[]).map((p:string)=>'ib-hl/'+p));if(repairs[r.id])expect(reviewedMarkschemePaths('ib-hl',r.id,paths)).toEqual(expected);}
 expect(JSON.stringify(raw)).toBe(before);
});
test('stale old paths fail closed and another bank remains untouched',()=>{
 const [id,entry]=Object.entries(repairs)[0];expect(()=>reviewedMarkschemePaths('ib-hl',id,['markschemes/stale.webp'])).toThrow();expect(reviewedMarkschemePaths('ib-sl',id,entry.oldPaths)).toEqual(entry.oldPaths);
});
