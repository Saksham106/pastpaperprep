// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { expect, it } from 'vitest';
import path from 'node:path';
import { assemblePaper, validateInventory, runtimeRelativeFile, parseCli, buildWholePaperArchives, loadReportHolds, REPORT_HOLDS_FILE } from './build-whole-paper-archives.mjs';
import type { ExtractedDocument } from './whole-paper-extraction.mjs';
it('accepts repeatable inventories and rejects unknown or missing CLI arguments',()=>{
  expect(parseCli(['--inventory','one.json','--inventory','two.json','--bank',bank.slug])).toEqual({inventoryFiles:['one.json','two.json'],bank:bank.slug});
  expect(()=>parseCli(['--inventory'])).toThrow();
  expect(()=>parseCli(['--inventry','one.json'])).toThrow();
  expect(()=>parseCli([])).toThrow();
});
it('requires both hash-bound review images and rejects duplicate identity adjudications through the real build entry point',async()=>{
  const dir=await fs.mkdtemp(path.join(process.env.TMPDIR??process.cwd(),'whole-paper-review-fixture-'));
  try {
    const inventoryFile=path.join(dir,'inventory.json'),reviewFile=path.join(dir,'review.json');
    await fs.writeFile(inventoryFile,JSON.stringify({banks:[]}));
    const review={bankSlug:'igcse-chemistry-0620',paperId:'0620-2023-w-42',questionSha256:'a'.repeat(64),markschemeSha256:'b'.repeat(64),verdict:'valid-pair',visualEvidence:[] as unknown[]};
    const options={root:dir,inventoryFiles:[inventoryFile],identityReviewFiles:[reviewFile]};
    await fs.writeFile(reviewFile,JSON.stringify({cases:[review]}));
    await expect(buildWholePaperArchives(options)).rejects.toThrow('needs both source images');
    const imagePath=path.join(dir,'cover.png');await fs.writeFile(imagePath,'fixture image bytes');
    const {createHash}=await import('node:crypto');const imageSha256=createHash('sha256').update('fixture image bytes').digest('hex');
    review.visualEvidence=['question','markscheme'].map(document=>({document,sourcePdfSha256:document==='question'?review.questionSha256:review.markschemeSha256,page:1,imagePath,imageSha256}));
    await fs.writeFile(reviewFile,JSON.stringify({cases:[review]}));
    await expect(buildWholePaperArchives(options)).resolves.toEqual([]);
    await fs.writeFile(imagePath,'changed image');
    await expect(buildWholePaperArchives(options)).rejects.toThrow('image binding mismatch');
    await fs.writeFile(imagePath,'fixture image bytes');await fs.writeFile(reviewFile,JSON.stringify({cases:[review,review]}));
    await expect(buildWholePaperArchives(options)).rejects.toThrow('Duplicate identity review');
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
it('runs an empty portable cohort deterministically with private-only bindings and receipt',async()=>{
  const dir=await fs.mkdtemp(path.join(process.env.TMPDIR??process.cwd(),'whole-paper-fixture-'));
  try {
    const runtime=path.join(dir,runtimeRelativeFile(bank.slug));await fs.mkdir(path.dirname(runtime),{recursive:true});await fs.writeFile(runtime,JSON.stringify({questions:[]}));
    await fs.mkdir(path.join(dir,'src/lib'),{recursive:true});await fs.writeFile(path.join(dir,'src/lib/question-loader.ts'),`import('@/data/production/${bank.slug}.json')`);
    const inventoryFile=path.join(dir,'inventory.json');await fs.writeFile(inventoryFile,JSON.stringify({banks:[{...bank,runtimeFile:runtime,pairs:[]}]}));
    const cli=execFileSync(path.resolve('node_modules/.bin/tsx'),['--tsconfig',path.resolve('tsconfig.json'),path.resolve('scripts/build-whole-paper-archives.mts'),'--inventory',inventoryFile],{cwd:dir,encoding:'utf8'});
    expect(JSON.parse(cli.trim())).toMatchObject([{bankSlug:bank.slug,paired:0}]);
    await buildWholePaperArchives({root:dir,inventoryFiles:[inventoryFile]});
    const manifestPath=path.join(dir,'src/data/paper-archives',bank.slug+'.json');const first=await fs.readFile(manifestPath,'utf8');
    expect(JSON.parse(first)).toMatchObject({bankSlug:bank.slug,papers:[],coverage:{paired:0,reports:0,held:0,unpaired:0,runtimeWithoutPair:0}});
    await buildWholePaperArchives({root:dir,inventoryFiles:[inventoryFile]});expect(await fs.readFile(manifestPath,'utf8')).toBe(first);
    expect(JSON.parse(await fs.readFile(path.join(dir,'private/paper-archives/source-bindings.json'),'utf8'))).toEqual({roots:[],documents:[]});
    expect(JSON.parse(await fs.readFile(path.join(dir,'private/paper-archives/receipt.json'),'utf8')).banks).toHaveLength(1);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
const pair={id:'0620-2023-w-42',runtimePaperId:'0620-2023-w-42',questionPath:'/original/question.pdf',markschemePath:'/original/markscheme.pdf',runtimeQuestionIds:['0620-2023-w-42-q1','0620-2023-w-42-q2']};
const bank={slug:'igcse-chemistry-0620',runtimeFile:path.resolve('src/data/production/igcse-chemistry-0620.json'),pairs:[pair],unpaired:[],runtimeWithoutPair:[],notes:[]};
const doc=(text:string,totals:number[]=[]):ExtractedDocument=>({sha256:'a'.repeat(64),bytes:123,pages:2,text:[text],questions:totals.map((maxMarks,i)=>({number:i+1,page:2,text:`[Total: ${maxMarks}]`,maxMarks}))});
const qp=doc('CHEMISTRY 0620/42 Paper 4 Theory Extended October/November 2023 1 hour 15 minutes The total mark for this paper is 80.',[30,50]);
const ms=doc('CHEMISTRY 0620/42 October/November 2023 Maximum Mark: 80');
const rows=pair.runtimeQuestionIds.map((id,i)=>({id,number:i+1,marks:1,primaryTopic:'Chemical reactions',secondaryTopics:[]}));
it('publishes only contract metadata and source-corrected exact runtime IDs',()=>{
  const result=assemblePaper(bank.slug,pair,rows as never,qp,ms);
  expect(result.entry.summary).toMatchObject({paper:'4',variant:'2',durationMinutes:75,maxMarks:80,reportAvailable:true,metadataVerified:true});
  expect(result.entry.questions.map(q=>q.maxMarks)).toEqual([30,50]);
  expect(result.entry.questions.map(q=>q.id)).toEqual(pair.runtimeQuestionIds);
  expect(result.corrections).toHaveLength(2);
  expect(JSON.stringify(result.entry)).not.toMatch(/original|Total:|questionPath|provenance|https?:/);
  expect(assemblePaper(bank.slug,pair,rows as never,qp,ms).entry).toEqual(result.entry);
});
it('never recommends an operational section-review bucket as an assessed topic',()=>{
  const input=rows.map(q=>({...q,secondaryTopics:['Questions needing section review']}));
  const result=assemblePaper(bank.slug,pair,input as never,qp,ms);
  expect(result.entry.summary.reportAvailable).toBe(true);
  expect(result.entry.questions.flatMap(q=>q.topics)).not.toContain('Questions needing section review');
  const unclassified=input.map(q=>({...q,primaryTopic:'Questions needing section review',secondaryTopics:[]}));
  expect(assemblePaper(bank.slug,pair,unclassified as never,qp,ms).entry.summary.reportAvailable).toBe(false);
});
it('uses the actual thirty-question MCQ inventory and explicit one-mark rule, not a science default',()=>{
  const mcPair={...pair,id:'0455-2019-m-12',runtimeQuestionIds:Array.from({length:30},(_,i)=>`0455-2019-m-12-q${i+1}`)};
  const mcRows=mcPair.runtimeQuestionIds.map((id,i)=>({...rows[0],id,number:i+1,marks:1,primaryTopic:'The basic economic problem'}));
  const question=doc('ECONOMICS 0455/12 February/March 2019 Paper 1 Multiple Choice 45 minutes There are thirty questions. Each correct answer will score one mark.',Array(30).fill(0));
  const scheme=doc('ECONOMICS 0455/12 March 2019 Maximum Mark: 30');
  expect(assemblePaper('igcse-economics-0455',mcPair,mcRows as never,question,scheme).entry).toMatchObject({summary:{maxMarks:30,questionCount:30,reportAvailable:true}});
});
it('rejects cross-level and current AA/AI course mismatches while allowing pre-AA legacy Mathematics',()=>{
  const ibPair={...pair,id:'chemistry-2023-may-tz1-hl-p2-english'};
  const q=doc('Chemistry Higher level Paper 2 May 2023 2 hours Maximum marks: 80',[30,50]),m=doc('Chemistry Higher level Paper 2 May 2023');
  expect(assemblePaper('ib-chemistry-sl',ibPair,rows as never,q,m).evidence.identityValid).toBe(false);
  const mathPair={...pair,id:'2023-may-tz1-p1'};
  const mq=doc('Mathematics: applications and interpretation Higher level Paper 1 May 2023 2 hours Maximum marks: 80',[30,50]),mm=doc('Mathematics: applications and interpretation Higher level Paper 1 May 2023');
  expect(assemblePaper('ib-hl',mathPair,rows as never,mq,mm).evidence.identityValid).toBe(false);
  const legacyPair={...pair,id:'2017-may-tz1-p1'};
  expect(assemblePaper('ib-hl',legacyPair,rows as never,doc('Mathematics Higher level Paper 1 May 2017 2 hours Maximum marks: 80',[30,50]),doc('Mathematics Higher level Paper 1 May 2017')).evidence.identityValid).toBe(true);
});
it('rejects the actual chemistry TZ1 pair whose slash codes print TZ2 and TZ0',()=>{
  const p={...pair,id:'chemistry-2023-may-tz1-hl-p2-english'};
  const q=doc('M23/4/CHEMI/HP2/ENG/TZ2/XX Chemistry Higher level Paper 2 May 2023 2 hours Maximum marks: 80',[30,50]);
  const m=doc('M23/4/CHEMI/HP2/ENG/TZ0/XX/M Chemistry Higher level Paper 2 May 2023');
  const result=assemblePaper('ib-chemistry-hl',p,rows as never,q,m);
  expect(result.evidence.identityValid).toBe(false);
  expect(result.evidence.examCodesAgree).toBe(false);
  expect(result.evidence.qCover.examCode).toBe('M23/4/CHEMI/HP2/ENG/TZ2/XX');
  expect(result.evidence.mCover.examCode).toBe('M23/4/CHEMI/HP2/ENG/TZ0/XX');
  expect(result.entry.summary.metadataVerified).toBe(false);
});
it('does not let a later prose-only cover erase a printed timezone contradiction',()=>{
  const p={...pair,id:'chemistry-2023-may-tz1-hl-p2-english'};
  const q=doc('M23/4/CHEMI/HP2/ENG/TZ1/XX Chemistry Higher level Paper 2 May 2023 2 hours Maximum marks: 80',[30,50]);
  const m={...doc('M23/4/CHEMI/HP2/ENG/TZ2/XX/M Markscheme'),text:['M23/4/CHEMI/HP2/ENG/TZ2/XX/M Markscheme','Chemistry Higher level Paper 2 May 2023 Maximum marks: 80']};
  const result=assemblePaper('ib-chemistry-hl',p,rows as never,q,m);
  expect(result.evidence.identityValid).toBe(false);
  expect(result.entry.summary.metadataVerified).toBe(false);
  expect(result.entry.summary.reportAvailable).toBe(false);
});
it('keeps a complete verified cover authoritative over later running-header codes',()=>{
  const p={...pair,id:'chemistry-2017-may-tz2-hl-p1-english'};
  const q=doc('M17/4/CHEMI/HPM/ENG/TZ2/XX Chemistry Higher level Paper 1 May 2017 1 hour Maximum marks: 80',[30,50]);
  const m={...doc('M17/4/CHEMI/HPM/ENG/TZ2/XX/M Markscheme Chemistry Higher level Paper 1 May 2017'),text:['M17/4/CHEMI/HPM/ENG/TZ2/XX/M Markscheme Chemistry Higher level Paper 1 May 2017','M17/4/CHEMI/HPM/ENG/TZ0/XX/M']};
  expect(assemblePaper('ib-chemistry-hl',p,rows as never,q,m).evidence.identityValid).toBe(true);
});
it('rejects matching but wrong numeric timezones without rewriting the expected TZ1 identity',()=>{
  const p={...pair,id:'chemistry-2023-may-tz1-hl-p2-english'};
  const text='M23/4/CHEMI/HP2/ENG/TZ2/XX Chemistry Higher level Paper 2 May 2023';
  const result=assemblePaper('ib-chemistry-hl',p,rows as never,doc(text),doc(text.replace('/XX','/XX/M')));
  expect(result.evidence.examCodesAgree).toBe(true);
  expect(result.evidence.identityValid).toBe(false);
  expect(result.evidence.identity.variant).toBe('tz1');
});
it('compares full normalized slash codes even when the timezone is not mappable',()=>{
  const p={...pair,id:'chemistry-2023-may-none-hl-p2-english'};
  const text='M23/4/CHEMI/HP2/ENG/TZ0/XX Chemistry Higher level Paper 2 May 2023';
  const q=doc(text.replace('M23/4/CHEMI/HP2/ENG/TZ0/XX','M 2 3 / 4 / C H E M I / H P 2 / E N G / T Z 0 / X X'));
  const m=doc(text.replace('/XX','/XX/M'));
  expect(assemblePaper('ib-chemistry-hl',p,rows as never,q,m).evidence).toMatchObject({identityValid:true,examCodesAgree:true});
  expect(assemblePaper('ib-chemistry-hl',p,rows as never,q,doc(m.text[0].replace('CHEMI/','PHYSI/'))).evidence).toMatchObject({identityValid:false,examCodesAgree:false});
});
it('preserves IB identity exceptions only for both unchanged source hashes',()=>{
  const p={...pair,id:'chemistry-2023-may-tz1-hl-p2-english'};
  const text='M23/4/CHEMI/HP2/ENG/TZ2/XX Chemistry Higher level Paper 2 May 2023';
  const q=doc(text),m=doc(text.replace('/XX','/XX/M'));
  const review={bankSlug:'ib-chemistry-hl',paperId:p.id,questionSha256:q.sha256,markschemeSha256:m.sha256,verdict:'valid-pair',visualEvidence:[]};
  expect(assemblePaper('ib-chemistry-hl',p,rows as never,q,m,review as never).evidence.identityValid).toBe(true);
  expect(()=>assemblePaper('ib-chemistry-hl',p,rows as never,{...q,sha256:'b'.repeat(64)},m,review as never)).toThrow('Identity review source binding mismatch');
});
it('retains numeric modern QP and legacy slash MS without inventing a cross-format mapping',()=>{
  const p={...pair,id:'chemistry-2023-may-tz1-hl-p2-english'};
  const q=doc('2223 – 6108 Chemistry Higher level Paper 2 May 2023 2 hours Maximum marks: 80',[30,50]);
  const m=doc('M23/4/CHEMI/HP2/ENG/TZ1/XX/M Chemistry Higher level Paper 2 May 2023');
  expect(assemblePaper('ib-chemistry-hl',p,rows as never,q,m).evidence.identityValid).toBe(true);
});
it('verifies legacy HL option markschemes by the exact printed option code instead of requiring a missing Mathematics title',()=>{
  const p={...pair,id:'2017-may-tz0-p3-calculus'};
  const q=doc('M17/5/MATHL/HP3/ENG/TZ0/SE Mathematics Higher level Paper 3 calculus May 2017 1 hour Maximum Mark: 50',[25,25]);
  const m=doc('M17/5/MATHL/HP3/ENG/TZ0/SE/M Markscheme May 2017 Calculus Higher level Paper 3');
  const result=assemblePaper('ib-hl',p,rows as never,q,m);
  expect(result.evidence.identityValid,JSON.stringify(result.evidence)).toBe(true);
  const spaced={...q,text:[q.text[0].replace('M17/5/MATHL/HP3/ENG/TZ0/SE','M 17 / 5 / MATHL/ H P 3 / E N G /TZ 0 /SE')]};
  expect(assemblePaper('ib-hl',p,rows as never,spaced,m).evidence.identityValid).toBe(true);
  const wrong={...m,text:[m.text[0].replace('/SE/M','/SG/M')]};
  expect(assemblePaper('ib-hl',p,rows as never,q,wrong).evidence.identityValid).toBe(false);
});
it('matches source-confirmed split glyph headers and the singular official 0654 markscheme title',()=>{
  const spaced={...qp,text:[qp.text[0].replace('CHEMISTRY','C h e m i s t r y')]};
  expect(assemblePaper(bank.slug,pair,rows as never,spaced,ms).evidence.identityValid).toBe(true);
  const sciencePair={...pair,id:'0654-2020-winter-41'};
  const q=doc('CO-ORDINATED SCIENCES 0654/41 Paper 4 Theory Extended October/November 2020 2 hours The total mark for this paper is 120.',[60,60]);
  const m=doc('CO - ORDINATED SCIENCE 0654/41 October/November 2020 Maximum Mark: 120');
  expect(assemblePaper('igcse-coordinated-sciences-0654',sciencePair,rows as never,q,m).evidence.identityValid).toBe(true);
});
it('accepts an independently reviewed identity only for the exact bank, paper and both source hashes without rewriting source literals',()=>{
  const typo={...ms,text:[ms.text[0].replace('CHEMISTRY','CHEMSITRY')]};
  const review={bankSlug:bank.slug,paperId:pair.id,questionSha256:qp.sha256,markschemeSha256:ms.sha256,verdict:'valid-pair',visualEvidence:[],evidence:'source-bound published typo'};
  const result=assemblePaper(bank.slug,pair,rows as never,qp,typo,review as never);
  expect(result.evidence.identityValid).toBe(true);
  expect(result.entry.summary.reportAvailable).toBe(true);
  expect(JSON.stringify(result.entry)).not.toMatch(/identityReview|source-bound published typo/);
  expect(()=>assemblePaper(bank.slug,pair,rows as never,qp,typo,{...review,questionSha256:'c'.repeat(64)} as never)).toThrow('Identity review source binding mismatch');
});
it('applies a reviewed report hold only for the exact bank, paper and both source hashes, and versions it',()=>{
  const hold={bankSlug:bank.slug,paperId:pair.id,questionSha256:qp.sha256,markschemeSha256:ms.sha256,reason:'The mark scheme withdrew Q1(a); held until a scoring policy for withdrawn parts is agreed.',review:{date:'2026-10-14',evidence:'fixture'}};
  const open=assemblePaper(bank.slug,pair,rows as never,qp,ms);
  const held=assemblePaper(bank.slug,pair,rows as never,qp,ms,undefined,hold);
  expect(held.entry).toMatchObject({summary:{reportAvailable:false,reportReason:hold.reason,maxMarks:80,metadataVerified:true},questions:[],documents:open.entry.documents});
  expect(held.entry.version).not.toBe(open.entry.version);
  expect(JSON.stringify(held.entry)).not.toMatch(/fixture|review/);
  expect(()=>assemblePaper(bank.slug,pair,rows as never,qp,ms,undefined,{...hold,markschemeSha256:'c'.repeat(64)})).toThrow('Report hold source binding mismatch');
  expect(()=>assemblePaper(bank.slug,{...pair,id:'0620-2023-w-41'},rows as never,qp,ms,undefined,hold)).toThrow('Report hold source binding mismatch');
});
it('lets a reviewed hold name the reason when a withheld question also leaves the runtime inventory short',()=>{
  const hold={bankSlug:bank.slug,paperId:pair.id,questionSha256:qp.sha256,markschemeSha256:ms.sha256,reason:'The graph is missing from the official question paper; held until a complete source is agreed.',review:{date:'2026-10-15',evidence:'fixture'}};
  const short=rows.slice(0,-1);
  expect(assemblePaper(bank.slug,{...pair,runtimeQuestionIds:short.map((row:{id:string})=>row.id)},short as never,qp,ms).entry.summary.reportReason).toBe('Printed and runtime question inventories do not reconcile.');
  const held=assemblePaper(bank.slug,{...pair,runtimeQuestionIds:short.map((row:{id:string})=>row.id)},short as never,qp,ms,undefined,hold);
  expect(held.entry).toMatchObject({summary:{reportAvailable:false,reportReason:hold.reason},questions:[]});
});
it('reads report holds on every build and rejects malformed, duplicate or unused holds',async()=>{
  const dir=await fs.mkdtemp(path.join(process.env.TMPDIR??process.cwd(),'whole-paper-holds-fixture-'));
  try {
    const hold={bankSlug:bank.slug,paperId:pair.id,questionSha256:'a'.repeat(64),markschemeSha256:'b'.repeat(64),reason:'The mark scheme withdrew Q1(a); held until a scoring policy for withdrawn parts is agreed.',review:{date:'2026-10-14',evidence:'fixture'}};
    const write=(holds:unknown[])=>fs.mkdir(path.join(dir,path.dirname(REPORT_HOLDS_FILE)),{recursive:true}).then(()=>fs.writeFile(path.join(dir,REPORT_HOLDS_FILE),JSON.stringify({schema:'whole-paper-report-holds-v1',holds})));
    expect((await loadReportHolds(dir)).size).toBe(0);
    await write([hold]);
    expect([...(await loadReportHolds(dir)).values()]).toEqual([hold]);
    await write([hold,hold]);await expect(loadReportHolds(dir)).rejects.toThrow('Duplicate report hold');
    await write([{...hold,reason:''}]);await expect(loadReportHolds(dir)).rejects.toThrow('needs a reason');
    await write([{...hold,review:undefined}]);await expect(loadReportHolds(dir)).rejects.toThrow('needs a reason');
    await write([{...hold,markschemeSha256:'nope'}]);await expect(loadReportHolds(dir)).rejects.toThrow('Invalid report hold binding');
    // A hold for a bank being built must match one of its papers, so a stale hold can't linger silently.
    await write([hold]);
    const runtime=path.join(dir,runtimeRelativeFile(bank.slug));await fs.mkdir(path.dirname(runtime),{recursive:true});await fs.writeFile(runtime,JSON.stringify({questions:[]}));
    await fs.mkdir(path.join(dir,'src/lib'),{recursive:true});await fs.writeFile(path.join(dir,'src/lib/question-loader.ts'),`import('@/data/production/${bank.slug}.json')`);
    const inventoryFile=path.join(dir,'inventory.json');await fs.writeFile(inventoryFile,JSON.stringify({banks:[{...bank,runtimeFile:runtime,pairs:[]}]}));
    await expect(buildWholePaperArchives({root:dir,inventoryFiles:[inventoryFile]})).rejects.toThrow(`Report holds match no built paper: ${pair.id}`);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
it('holds mismatched subjects even when code, year and component agree',()=>{
  expect(assemblePaper(bank.slug,pair,rows as never,{...qp,text:[qp.text[0].replace('CHEMISTRY','PHYSICS')]},ms).entry.summary.metadataVerified).toBe(false);
});
it('compares simple printed MS question maxima in addition to the cover maximum',()=>{
  const scheme={...ms,questions:[{number:1,page:2,text:'[Maximum mark: 29]',maxMarks:29},{number:2,page:3,text:'[Maximum mark: 51]',maxMarks:51}]};
  expect(assemblePaper(bank.slug,pair,rows as never,qp,scheme).entry.summary.reportAvailable).toBe(false);
});
it('holds incomplete inventory, optional choice and markscheme maximum disagreements',()=>{
  expect(assemblePaper(bank.slug,pair,rows.slice(0,1) as never,qp,ms).entry.summary.reportAvailable).toBe(false);
  const choice={...qp,text:[qp.text[0]+' Answer two questions from Section B.']};
  expect(assemblePaper(bank.slug,pair,rows as never,choice,ms).entry).toMatchObject({summary:{reportAvailable:false,durationMinutes:75},questions:[]});
  expect(assemblePaper(bank.slug,pair,rows as never,qp,doc(ms.text[0].replace('80','90'))).entry.summary.reportAvailable).toBe(false);
});
it('retains paired sources without runtime membership and enforces source-safe IDs',()=>{
  expect(()=>validateInventory({banks:[{...bank,pairs:[{...pair,runtimePaperId:null,runtimeQuestionIds:[]}]}]})).not.toThrow();
  expect(()=>validateInventory({banks:[{...bank,pairs:[{...pair,id:'bad%identity'}]}]})).toThrow(/identity/);
});
it('rejects duplicate pair IDs, duplicate persisted qids and nonabsolute originals',()=>{
  expect(()=>validateInventory({banks:[bank]})).not.toThrow();
  expect(()=>validateInventory({banks:[{...bank,pairs:[pair,pair]}]})).toThrow(/Duplicate/);
  expect(()=>validateInventory({banks:[{...bank,pairs:[{...pair,runtimeQuestionIds:[rows[0].id,rows[0].id]}]}]})).toThrow(/Duplicate/);
  expect(()=>validateInventory({banks:[{...bank,pairs:[{...pair,questionPath:'relative.pdf'}]}]})).toThrow(/absolute/);
});
it('traces the deployed loader cohort rather than candidate or production IB science artifacts',()=>{
  expect(runtimeRelativeFile('ib-chemistry-hl')).toBe('src/data/raw/ib-chemistry-hl.json');
  expect(runtimeRelativeFile('igcse-chemistry-0620')).toBe('src/data/production/igcse-chemistry-0620.json');
  expect(runtimeRelativeFile('ib-economics-hl')).toBe('src/data/production/ib-economics-hl.json');
});
