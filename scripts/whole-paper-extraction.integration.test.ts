// @vitest-environment node
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractPdf, parseHeader, parseIdentity } from './whole-paper-extraction.mjs';
const source=process.env.WHOLE_PAPER_CHEMISTRY_SOURCE_ROOT ?? path.resolve('../../..','igcse-chemistry-0620-topic-practice/data/raw');
const question=path.join(source,'0620-2023-w-42-question.pdf');
const ms=path.join(source,'0620-2023-w-42-markscheme.pdf');
describe.skipIf(!existsSync(question)||!existsSync(ms))('real Chemistry 0620 winter 2023 paper 42',()=>{
  it('reuses only hash- and field-parity-verified legacy Chemistry geometry',async()=>{
    const cache=await fs.mkdtemp(path.join(process.env.TMPDIR??process.cwd(),'whole-paper-legacy-pilot-'));
    try {
      const old=path.resolve('private/chemistry-paper-archive/checkpoints');
      const plain=await extractPdf(question,'igcse',path.join(cache,'plain'));
      const adapted=await extractPdf(question,'igcse',path.join(cache,'adapted'),old);
      expect(adapted).toEqual(plain);
    }finally{await fs.rm(cache,{recursive:true,force:true});}
  },60000);
  it('reads actual headers and geometry-owned totals from original paired PDFs',async()=>{
    const cache=await fs.mkdtemp(path.join(process.env.TMPDIR??process.cwd(),'whole-paper-pilot-'));
    try {
      const qp=await extractPdf(question,'igcse',cache), scheme=await extractPdf(ms,'igcse',cache);
      const identity=parseIdentity('0620-2023-w-42');
      expect(parseHeader(qp.text[0],identity)).toMatchObject({identityValid:true,durationMinutes:75,maxMarks:80});
      expect(parseHeader(scheme.text[0],identity)).toMatchObject({identityValid:true,maxMarks:80});
      expect(qp.questions.length).toBeGreaterThan(1);
      expect(qp.questions.reduce((sum,q)=>sum+q.maxMarks,0)).toBe(80);
      expect(qp.questions.map(q=>q.number)).toEqual(qp.questions.map((_,i)=>i+1));
      expect(await extractPdf(question,'igcse',cache)).toMatchObject(qp);
      console.log(JSON.stringify({questionPages:qp.pages,markschemePages:scheme.pages,cover:parseHeader(qp.text[0],identity),totals:qp.questions.map(q=>q.maxMarks),questionPagesByNumber:qp.questions.map(q=>q.page)}));
    }finally{await fs.rm(cache,{recursive:true,force:true});}
  },60000);
});
