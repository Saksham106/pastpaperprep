// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PaperArchiveDetail, PaperArchiveSummary } from '../src/lib/paper-archive-types';
import { inventorySources, SOURCE_ROOT } from './build-chemistry-paper-archive.mjs';
import { CHEMISTRY_0620_TOPICS, CHEMISTRY_0620_PRACTICAL_TOPIC } from '../src/lib/igcse-0620-official.mjs';
import { existsSync } from 'node:fs';
// Needs private source files that exist only on the owner's machine; CI skips these cases.
const HAS_PRIVATE_SOURCES = existsSync('private/chemistry-paper-archive/archive.json') && existsSync(SOURCE_ROOT);
type Evidence = {sha256:string;bytes:number;pageCount:number;cover:{identityValid:boolean;maxMarks:number|null};totals?:number[]};
type ArchiveEntry={summary:PaperArchiveSummary;detail:PaperArchiveDetail;source:{id:string;question:string;markscheme:string};evidence:{question:Evidence;markscheme:Evidence};reconciliation:{marks:number[];available:boolean;runtimeQuestionCount:number;sourceQuestionCount:number}};
const load=async()=>JSON.parse(await fs.readFile('private/chemistry-paper-archive/archive.json','utf8')) as {papers:ArchiveEntry[];receipt:{sourceCount:number;runtimeQuestionCount:number;runtimePaperCount:number;identityFailures:string[];reportAvailableCount:number;sourceQuestionCount:number;missingQuestionCount:number;missingClassificationSearch:unknown[];corrections:{id:string;to:number;questionSha256:string}[];discrepancies:{id:string;missingQuestionIds:string[]}[]}};

describe.skipIf(!HAS_PRIVATE_SOURCES)('generated whole-bank source reconciliation', () => {
  it('accounts for 314 originals, 312 runtime papers, and every exact report holdback', async () => {
    const archive=await load();
    expect(archive.papers.map(p=>p.summary.id)).toEqual((await inventorySources()).map(s=>s.id));
    expect(archive.receipt).toMatchObject({sourceCount:628,runtimeQuestionCount:5129,runtimePaperCount:312,identityFailures:[],sourceQuestionCount:5337,missingQuestionCount:208,reportAvailableCount:290,missingClassificationSearch:[]});
    const held=archive.papers.filter(p=>!p.summary.reportAvailable);
    expect(held).toHaveLength(24);
    expect(held.filter(p=>p.summary.paper<=2)).toHaveLength(22);
    expect(held.filter(p=>p.reconciliation.runtimeQuestionCount===0).map(p=>p.summary.id)).toEqual(['0620-2019-w-53','0620-2020-w-53']);
    expect(held.every(p=>p.detail.questions.length===0 && p.summary.reportReason)).toBe(true);
    expect(archive.receipt.discrepancies.flatMap(p=>p.missingQuestionIds)).toHaveLength(208);
  });
  it('rechecks hashes and cover identities for all 628 PDFs and all structured maxima',async()=>{
    const archive=await load();let count=0;
    for(const entry of archive.papers){
      expect(entry.summary.paperName.length).toBeLessThan(40);
      expect(entry.summary.durationMinutes).toBeGreaterThan(0);
      for(const kind of ['question','markscheme'] as const){
        const bytes=await fs.readFile(path.join(SOURCE_ROOT,entry.source[kind]));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.evidence[kind].sha256);
        expect(bytes.length).toBe(entry.evidence[kind].bytes);
        expect(entry.evidence[kind].cover.identityValid).toBe(true);
        count++;
      }
      expect(entry.evidence.markscheme.cover.maxMarks).toBe(entry.summary.maxMarks);
      if(entry.summary.paper>=3){
        expect(entry.evidence.question.totals?.reduce((s,n)=>s+n,0)).toBe(entry.summary.maxMarks);
        expect(entry.evidence.question.totals).toHaveLength(entry.summary.questionCount);
        const checkpoint=JSON.parse(await fs.readFile(`private/chemistry-paper-archive/checkpoints/${entry.summary.id}-question.json`,'utf8')) as {questions:{number:number;text:string;maxMarks:number}[]};
        for(const [i,q] of checkpoint.questions.entries()){
          expect(q.number).toBe(i+1);
          expect([...q.text.matchAll(/\[\s*Total\s*:/gi)].length).toBeLessThanOrEqual(1);
          expect(q.maxMarks).toBe(entry.evidence.question.totals?.[i]);
        }
      }
    }
    expect(count).toBe(628);
  });
  it('fully reconciles every enabled report against source-owned question marks and official topics',async()=>{
    const archive=await load();let reports=0;
    for(const p of archive.papers.filter(p=>p.summary.reportAvailable)){
      expect(p.detail.questions).toHaveLength(p.summary.questionCount);
      expect(p.detail.questions.reduce((s,q)=>s+q.maxMarks,0)).toBe(p.summary.maxMarks);
      expect(new Set(p.detail.questions.map(q=>q.id)).size).toBe(p.summary.questionCount);
      for(const [i,q] of p.detail.questions.entries()){
        expect(q.id).toBe(`${p.summary.id}-q${i+1}`);
        expect(q.maxMarks).toBe(p.summary.paper<=2?1:p.evidence.question.totals?.[i]);
        expect(q.topics.length).toBeGreaterThan(0);
        for(const topic of q.topics)expect([...CHEMISTRY_0620_TOPICS,CHEMISTRY_0620_PRACTICAL_TOPIC]).toContain(topic);
      }
      reports++;
    }
    expect(reports).toBe(290);
    expect(archive.receipt.corrections).toHaveLength(63);
    expect(archive.receipt.corrections.find(q=>q.id==='0620-2026-m-32-q3')).toMatchObject({to:14,questionSha256:'6f96e8fbca4390d6a5a110ea8a313862eea0964d4d667cee8ef1ece855632fde'});
  });
});
