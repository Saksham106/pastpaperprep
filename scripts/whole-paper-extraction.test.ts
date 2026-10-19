import { describe, expect, it } from 'vitest';
import { parseIdentity, parseHeader, extractQuestionBlocks, findCover, adaptChemistryCheckpoint, extractPdf, EXTRACTOR_VERSION, extractorVersionFor, markRuleForBank, sha256 } from './whole-paper-extraction.mjs';
import { BANK_CATALOG } from '../src/lib/catalog';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

it.each([
  {name:'leading binary bytes',bytes:Buffer.concat([Buffer.from([13,13,0,0]),Buffer.from('%PDF-1.7 fixture')])},
  {name:'high-bit PDF header',bytes:Buffer.from([0xa5,0x50,0x44,0x46,0x2d])},
])('rejects $name before trusting a matching extraction cache',async({bytes})=>{
  const root=await fs.mkdtemp(path.join(tmpdir(),'whole-paper-header-'));
  try {
    const filename=path.join(root,'source.pdf'),hash=sha256(bytes);
    await fs.writeFile(filename,bytes);
    await fs.writeFile(path.join(root,`${hash}-${EXTRACTOR_VERSION}-ib.json`),JSON.stringify({version:EXTRACTOR_VERSION,sha256:hash,bytes:bytes.length,pages:1,text:['cached cover'],questions:[]}));
    await expect(extractPdf(filename,'ib',root)).rejects.toThrow('Invalid PDF header');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

it('rejects legacy checkpoint reuse unless source hash, bytes, full text and printed totals agree',()=>{
  const old={version:'chemistry-paper-archive-v2',sha256:'a'.repeat(64),bytes:42,pageCount:2,pages:['cover','[Total: 8]'],questions:[{number:1,page:2,text:'[Total: 8]',maxMarks:8}]};
  expect(adaptChemistryCheckpoint(old,old.sha256,42)).toMatchObject({pages:2,text:old.pages,questions:old.questions});
  expect(adaptChemistryCheckpoint(old,'b'.repeat(64),42)).toBeNull();
  expect(adaptChemistryCheckpoint({...old,pages:['cover']},old.sha256,42)).toBeNull();
  expect(adaptChemistryCheckpoint({...old,questions:[{...old.questions[0],maxMarks:9}]},old.sha256,42)).toBeNull();
});
const item = (str: string, x: number, y: number) => ({str,x,y});
it('owns printed totals by geometry, including continuation pages, never equal splits', () => {
  const blocks = extractQuestionBlocks([
    [item('1',45,700),item('Explain this.',80,700),item('[2]',500,670)],
    [item('[Total: 7]',450,710),item('2',45,650),item('Calculate.',80,650),item('[Total: 3]',450,600)],
  ], 'igcse');
  expect(blocks.map(q=>({number:q.number,page:q.page,maxMarks:q.maxMarks}))).toEqual([{number:1,page:2,maxMarks:7},{number:2,page:3,maxMarks:3}]);
});
it('reads Computer Science marks from the right-aligned mark column, not pseudocode array indexes',()=>{
  const at=(str:string,x:number,y:number,width:number)=>({str,x,y,width});
  // 0478-2024-s-21 Q6 shape: a row of index labels, a mark fused to its dot leader, and a last-line mark at y=44.
  const pages=[
    [item('1',45,700),item('Complete the trace table.',80,700),at('[1]',136,692,20),at('[2]',167,692,20),at('Names[Counter]',145,600,80),at('[4]',533,500,13)],
    [at('.............................. [8]',120,300,426),at('[2]',533,44,13),at('[Turn over',492,27,54)],
  ];
  expect(extractQuestionBlocks(pages,'igcse').map(q=>q.maxMarks)).toEqual([15]);
  expect(extractQuestionBlocks(pages,'igcse','right-margin').map(q=>q.maxMarks)).toEqual([14]);
});
it('gates the mark-column rule to Computer Science 0478 so other manifests keep their extractor version',()=>{
  expect(BANK_CATALOG.map(bank=>bank.slug).filter(slug=>markRuleForBank(slug)!=='text')).toEqual(['igcse-computer-science-0478']);
  expect(extractorVersionFor('text')).toBe(EXTRACTOR_VERSION);
  expect(extractorVersionFor('right-margin')).not.toBe(EXTRACTOR_VERSION);
});
it('keeps diagram-only numbered starts when their printed heading font matches',()=>{
  const blocks=extractQuestionBlocks([[{...item('1',45,700),fontName:'Bold'},item('Explain.',80,700),item('[Total: 2]',450,650)],[{...item('2',45,700),fontName:'Bold'},item('[Total: 3]',450,500)]],'igcse');
  expect(blocks.map(q=>q.maxMarks)).toEqual([2,3]);
});
it('recognizes IB whole-question maxima rather than summing subparts twice', () => {
  const blocks=extractQuestionBlocks([[item('1.',40,700),item('[Maximum mark: 12]',80,700),item('Find x. [5]',80,650),item('2.',40,600),item('[Maximum mark: 8]',80,600)]], 'ib');
  expect(blocks.map(q=>q.maxMarks)).toEqual([12,8]);
});
it('keeps source grammar, shared levels and split components distinct',()=>{
  expect(parseIdentity('m26-math-aasl-p1-tza')).toMatchObject({year:2026,sessionCode:'may',level:'sl',paper:'1',variant:'tza'});
  expect(parseIdentity('2017-may-p1-tz1')).toMatchObject({paper:'1',variant:'tz1'});
  expect(parseIdentity('2017-november-p2-tzn')).toMatchObject({paper:'2',variant:'tzn'});
  expect(parseIdentity('0654-2020-summer-42')).toMatchObject({sessionCode:'s',component:'42'});
  expect(parseIdentity('chemistry-2025-november-tz3-hl-p1b-english')).toMatchObject({sessionCode:'nov',paper:'1b',component:'P1B',variant:'tz3'});
  expect(parseIdentity('economics-2025-may-tz3-hlsl-p2-english')).toMatchObject({level:'hlsl'});
});
it('finds an IB exam cover after licensing and keeps component maximum separate from combined time',()=>{
  const identity=parseIdentity('chemistry-2025-may-tz1-hl-p1b-english');
  const text='Chemistry Higher level Paper 1B 16 May 2025 2 hours [Paper 1A and Paper 1B] Instructions to candidates Answer all questions. The maximum mark for paper 1B is [35 marks]. The maximum mark for paper 1A and paper 1B is [75 marks].';
  expect(findCover(['No part of this product may be reproduced',text,'1. Describe.'],identity)).toMatchObject({page:2,header:{identityValid:true,maxMarks:35,durationMinutes:null,sharedDurationMinutes:120}});
  expect(parseHeader('Biology Higher level Paper 3 May 2020 1 hour Section B: answer all of the questions from one of the options. The maximum mark for this examination paper is [45 marks].',parseIdentity('2020-may-tz0-hl-p3'))).toMatchObject({maxMarks:45,optionalChoice:true});
});
it('verifies spaced-font headers and April dates in the coded May examination session',()=>{
  expect(parseHeader('Physics H i gher l evel Paper 1 6 May 2016 1 hour The maximum mark for this examination paper is [40 marks]. 2216 – 6501',parseIdentity('physics-2016-may-tz0-hl-p1-english')).identityValid).toBe(true);
  expect(parseHeader('Physics Higher level Paper 1B 29 April 2025 2 hours [Paper 1A and Paper 1B] The maximum mark for paper 1B is [20 marks]. 2225 – 6708',parseIdentity('physics-2025-may-tz1-hl-p1b-english'))).toMatchObject({identityValid:true,maxMarks:20,durationMinutes:null});
});
it('joins glyph-spaced printed exam codes before matching paired covers and October scheduling',()=>{
  const id=parseIdentity('physics-2020-november-tz0-hl-p1-english');
  const header=parseHeader('Physics Higher level Paper 1 Thursday 29 October 2020 45 minutes 8 8 2 0 – 6501',id);
  expect(header).toMatchObject({identityValid:true,examCode:'8820-6501'});
  expect(parseHeader('Physics Higher level Paper 1 Thursday 29 October 2020 2 2 2 0 – 6501',id).identityValid).toBe(false);
});
it('recognizes source-coded November exams administered in October without accepting the wrong session code',()=>{
  const identity=parseIdentity('physics-2017-november-tz0-hl-p1-english');
  const cover='Physics Higher level Paper 1 Tuesday 31 October 2017 1 hour The maximum mark for this examination paper is [40 marks]. 8817 – 6501';
  expect(findCover(['Licensing text',cover],identity)).toMatchObject({page:2,header:{identityValid:true}});
  expect(parseHeader(cover.replace('8817','2217'),identity).identityValid).toBe(false);
});
it.each(['N23/4/CHEMI/HP2/ENG/TZ1/XX','M22/4/CHEMI/HP2/ENG/TZ1/XX','M23/4/CHEMI/SP2/ENG/TZ1/XX','M23/4/CHEMI/HP1/ENG/TZ1/XX'])('rejects conflicting legacy code %s despite matching cover prose',code=>{
  expect(parseHeader(`${code} Chemistry Higher level Paper 2 May 2023`,parseIdentity('chemistry-2023-may-tz1-hl-p2-english')).identityValid).toBe(false);
});
it('verifies numeric timezones in legacy HPM multiple-choice codes without guessing their component mapping',()=>{
  const identity=parseIdentity('physics-2018-may-tz1-hl-p1-english');
  const text='M18/4/PHYSI/HPM/ENG/TZ2/XX Physics Higher level Paper 1 May 2018';
  expect(parseHeader(text,identity).identityValid).toBe(false);
  expect(parseHeader(text.replace('TZ2','TZ1'),identity)).toMatchObject({identityValid:true,examCode:'M18/4/PHYSI/HPM/ENG/TZ1/XX'});
});
it('normalizes split slash-code glyphs and strips only the markscheme suffix',()=>{
  const identity=parseIdentity('chemistry-2023-may-tz1-hl-p2-english');
  const code='M 2 3 / 4 / C H E M I / H P 2 / E N G / T Z 1 / X X / M';
  expect(parseHeader(`${code} Chemistry Higher level Paper 2 May 2023`,identity)).toMatchObject({identityValid:true,examCode:'M23/4/CHEMI/HP2/ENG/TZ1/XX'});
});
it('does not infer numeric timezones from modern codes, ABC scheduling, tzn or none',()=>{
  const modern='Chemistry Higher level Paper 2 May 2023 Zone A afternoon Zone B morning Zone C afternoon';
  expect(parseHeader(modern,parseIdentity('chemistry-2023-may-tz1-hl-p2-english')).identityValid).toBe(true);
  expect(parseHeader(`${modern} 2223 – 6108`,parseIdentity('chemistry-2023-may-tz2-hl-p2-english')).identityValid).toBe(true);
  expect(parseHeader('M17/5/MATHL/SP2/ENG/TZ0/XX Mathematics Standard level Paper 2 November 2017',parseIdentity('2017-november-p2-tzn')).identityValid).toBe(false); // session conflicts, not a fabricated tzn mapping
  expect(parseHeader('N17/5/MATHL/SP2/ENG/TZ0/XX Mathematics Standard level Paper 2 November 2017',parseIdentity('2017-november-p2-tzn')).identityValid).toBe(true);
  expect(parseHeader('M23/4/CHEMI/HP2/ENG/TZ0/XX '+modern,parseIdentity('chemistry-2023-may-none-hl-p2-english')).identityValid).toBe(true);
});
it('holds optional-choice layouts and verifies IB level, session, paper and year', () => {
  const identity=parseIdentity('2023-may-tz1-hl-p2');
  expect(parseHeader('Chemistry Higher level Paper 2 May 2023 2 hours 15 minutes Maximum marks: 95 Answer two questions from Section B.',identity)).toMatchObject({identityValid:true,durationMinutes:135,maxMarks:95,optionalChoice:true});
  expect(parseHeader('Chemistry Standard level Paper 2 May 2023',identity).identityValid).toBe(false);
});

describe('source identity and cover matrix', () => {
  it('verifies an IGCSE cover without repairing a failed identity token', () => {
    const identity = parseIdentity('0620-2023-w-42');
    expect(parseHeader('CHEMISTRY 0620/42 Paper 4 Theory (Extended) October/November 2023 1 hour 15 minutes The total mark for this paper is 80.', identity)).toMatchObject({ identityValid: true, durationMinutes: 75, maxMarks: 80, optionalChoice: false });
    expect(parseHeader('CHEMISTRY 0620/43 October/November 2023', identity).identityValid).toBe(false);
    expect(() => parseIdentity('0620-2023-w-4x')).toThrow();
  });
});
