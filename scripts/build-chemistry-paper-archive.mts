import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { project0620Sections, CHEMISTRY_0620_TOPICS, CHEMISTRY_0620_PRACTICAL_TOPIC } from '../src/lib/igcse-0620-official.mjs';

export const SOURCE_ROOT = '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-chemistry-0620-topic-practice/data';
export async function inventorySources() {
  const pairs = new Map<string, {id:string;question:string;markscheme:string}>();
  for (const root of ['raw','raw-extension']) for (const entry of await fs.readdir(path.join(SOURCE_ROOT,root), {withFileTypes:true})) {
    if (!entry.name.endsWith('.pdf')) continue;
    const match = /^(0620-\d{4}-[msw]-[1-6][1-3])-(question|markscheme)\.pdf$/.exec(entry.name);
    if (!match || !entry.isFile() || entry.isSymbolicLink()) throw new Error(`Unsupported source ${entry.name}`);
    const [,id,kind] = match;
    const pair = pairs.get(id) ?? {id,question:'',markscheme:''};
    if(pair[kind as 'question'|'markscheme']) throw new Error(`Duplicate source ${entry.name}`);
    pair[kind as 'question'|'markscheme'] = `${root}/${entry.name}`;
    pairs.set(id,pair);
  }
  for (const pair of pairs.values()) if(!pair.question || !pair.markscheme) throw new Error(`Incomplete pair ${pair.id}`);
  return [...pairs.values()].sort((a,b)=>a.id.localeCompare(b.id));
}

export function reconcileQuestions(rows: {id:string;number:number;maxMarks:number|null}[], totals: number[], maximum:number, paper:number) {
  const expected = paper <= 2 ? Array.from({length:maximum}, () => 1) : totals;
  const corrections: {id:string;from:number|null;to:number}[] = [];
  const inventoryValid = rows.length === expected.length && rows.every((q,i)=>q.number===i+1);
  const marks = rows.map((q,i) => {
    if(inventoryValid && q.maxMarks !== expected[i] && expected[i] > 0) {corrections.push({id:q.id,from:q.maxMarks,to:expected[i]});return expected[i];}
    return q.maxMarks;
  });
  const available = rows.length > 0 && rows.length === expected.length && new Set(rows.map(q=>q.id)).size === rows.length && rows.every((q,i)=>q.number === i+1 && marks[i] === expected[i]) && marks.reduce<number>((s,n)=>s+(n||0),0) === maximum;
  return { available, marks, corrections, reason: available ? undefined : 'Question inventory or maxima do not reconcile with the original paper.' };
}

export function sourceQuestionMarks(text:string) {
  const total = /\[\s*Total\s*:\s*(\d+)\s*\]/i.exec(text);
  return total ? Number(total[1]) : [...text.matchAll(/\[\s*(\d+)\s*\]/g)].reduce((s,m)=>s+Number(m[1]),0);
}
export function parseCover(text: string, id: string, kind: 'question' | 'markscheme') {
  // A known embedded font in one June 2026 PDF lacks a Unicode map. Decode only
  // when its literal CHEMISTRY signature is present; leave ordinary PDFs intact.
  if(text.includes('&+(0,675<')) text = [...text].map(char=>char === ' ' ? char : char.charCodeAt(0)>=3 && char.charCodeAt(0)<=97 ? String.fromCharCode(char.charCodeAt(0)+29) : char).join('');
  const match = /^0620-(\d{4})-([msw])-(\d{2})$/.exec(id);
  if (!match) throw new Error('Invalid paper identity');
  const [, year, session, component] = match;
  const sessionPattern = session === 'm' ? /(?:February\s*\/\s*March|March)/i : session === 's' ? /May\s*\/\s*June/i : /October\s*\/\s*November/i;
  const identityValid = new RegExp(`0620\\s*/\\s*${component.split('').join('\\s*')}\\b`).test(text) && new RegExp(`\\b${year.split('').join('\\s*')}\\b`).test(text) && sessionPattern.test(text);
  const duration = /(\d+)\s*hours?(?:\s*(\d+)\s*minutes?)?|(\d+)\s*minutes?/i.exec(text);
  const maximum = /(?:total mark for this paper is|Maximum Mark\s*:)\s*(\d+)/i.exec(text);
  const paperName = new RegExp(`Paper\\s+${component[0]}\\s+((?:Multiple\\s+Choice|Theory)(?:\\s*\\(?\\s*(?:Core|Extended)\\s*\\)?)?|Practical\\s+Test|Alternative\\s+to\\s+Practical)`, 'i').exec(text)?.[1]?.trim().replace(/\s+/g,' ');
  return { identityValid, durationMinutes: kind === 'question' && duration ? (Number(duration[1] || 0) * 60 + Number(duration[2] || duration[3] || 0)) : null, maxMarks: maximum ? Number(maximum[1]) : null, paperName };
}

type RawQuestion = { id:string; number:number; year:number; component:string; maxMarks:number|null; primaryTopicId:string; primaryTopic:string; secondaryTopics:string[]; accessibleText:string; subtopics:string[]; classificationProvenance?:{officialCode?:string;primaryDetailId?:string} };
type Extracted = {sha256:string;bytes:number;pageCount:number;pages:string[];questions:{number:number;page:number;text:string;maxMarks:number}[]};
const GENERATOR_VERSION = 'chemistry-paper-archive-v2';
const OUT = path.resolve('private/chemistry-paper-archive');
async function atomicJson(destination:string, value:unknown) {
  await fs.writeFile(`${destination}.tmp`, JSON.stringify(value,null,2)+'\n');
  await fs.rename(`${destination}.tmp`,destination);
}
async function extract(relative:string, id:string, kind:'question'|'markscheme'):Promise<Extracted> {
  const bytes = await fs.readFile(path.join(SOURCE_ROOT,relative));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const cache = path.join(OUT,'checkpoints',`${id}-${kind}.json`);
  try { const existing = JSON.parse(await fs.readFile(cache,'utf8')); if(existing.sha256 === sha256 && existing.version === GENERATOR_VERSION) return existing; } catch {}
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
  const pages:string[] = [];
  const blocks:{number:number;page:number;text:string}[]=[];
  try {
    for(let p=1;p<=(kind === 'question'?document.numPages:1);p++) {
      const page = await document.getPage(p);
      const content = await page.getTextContent();
      pages.push(content.items.map(item=>'str' in item?item.str:'').join(' '));
      if(kind==='question' && p>1 && Number(id.slice(-2,-1))>=3) {
        const items = content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item);
        for(const item of items) {
          const x=item.transform[4], y=item.transform[5];
          const number=Number(item.str);
          const questionStart=/^\d{1,2}$/.test(item.str) && x>=40 && x<=60 && y>80 && y<790 && number===blocks.length+1 && items.some(next=>Math.abs(next.transform[5]-y)<2 && next.transform[4]>70 && /^[A-Za-z(]/.test(next.str));
          if(questionStart) blocks.push({number,page:p,text:''});
          if(blocks.length && y<790 && y>45) blocks[blocks.length-1].text+=' '+item.str;
        }
      }
      page.cleanup();
    }
    const result = {sha256,bytes:bytes.length,pageCount:document.numPages,pages,questions:blocks.map(block=>({...block,maxMarks:sourceQuestionMarks(block.text)}))};
    await atomicJson(cache,{version:GENERATOR_VERSION,...result});
    return result;
  } finally { await document.destroy(); }
}

export async function buildArchive() {
  await fs.mkdir(path.join(OUT,'checkpoints'),{recursive:true});
  const sources = await inventorySources();
  const runtimeBytes = await fs.readFile('src/data/production/igcse-chemistry-0620.json');
  const runtime = JSON.parse(runtimeBytes.toString());
  const rows:RawQuestion[] = runtime.questions;
  const byPaper = new Map<string,RawQuestion[]>();
  for(const q of rows) {
    const id = q.id.replace(/-q\d+$/,'');
    if(!sources.some(source=>source.id===id)) throw new Error(`Runtime paper lacks original pair ${id}`);
    byPaper.set(id,[...(byPaper.get(id)||[]),q]);
  }
  // Search the exact extension cohort, including review/queues, before recording an absent classification.
  const metadataSearch:{file:string;ids:string[]}[]=[];
  const absent = sources.filter(source=>!byPaper.has(source.id)).map(source=>source.id);
  async function searchMetadata(directory:string) {
    for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
      const target=path.join(directory,entry.name);
      if(entry.isDirectory()) await searchMetadata(target);
      else if(entry.isFile()&&entry.name.endsWith('.json')) {
        const text=await fs.readFile(target,'utf8');
        const ids=absent.filter(id=>text.includes(id));
        if(ids.length) metadataSearch.push({file:path.relative(SOURCE_ROOT,target),ids});
      }
    }
  }
  await searchMetadata(path.join(SOURCE_ROOT,'classification-extension'));
  const papers=[];
  const corrections=[];
  const discrepancies=[];
  const identityFailures=[];
  for(const [index,source] of sources.entries()) {
    const qp=await extract(source.question,source.id,'question');
    const ms=await extract(source.markscheme,source.id,'markscheme');
    const qCover=parseCover(qp.pages[0],source.id,'question');
    const mCover=parseCover(ms.pages[0],source.id,'markscheme');
    const [,year,sessionCode,component]=/^0620-(\d{4})-([msw])-(\d{2})$/.exec(source.id)!;
    const paper=Number(component[0]);
    const totals=qp.questions.map(q=>q.maxMarks);
    const maxMarks = qCover.maxMarks ?? mCover.maxMarks ?? totals.reduce((s,n)=>s+n,0);
    const questionRows=(byPaper.get(source.id)||[]).sort((a,b)=>a.number-b.number);
    const reconciliation=reconcileQuestions(questionRows,totals,maxMarks,paper);
    const identityValid=qCover.identityValid&&mCover.identityValid;
    if(!identityValid) identityFailures.push(source.id);
    if(!qCover.durationMinutes || !maxMarks || !qCover.paperName) throw new Error(`Cover metadata needs source review ${source.id}`);
    const maximumValid = (!qCover.maxMarks||!mCover.maxMarks||qCover.maxMarks===mCover.maxMarks) && (paper<=2||totals.reduce((s,n)=>s+n,0)===maxMarks);
    let reportReason = !questionRows.length ? 'Reviewed question classifications are unavailable.' : !identityValid ? 'Source document identities need review.' : !maximumValid ? 'Source question totals need review.' : !reconciliation.available ? 'Some question classifications are missing.' : undefined;
    const questions=questionRows.map((q,i)=>{
      const projected=project0620Sections(q);
      const topics=[...new Set([projected.primaryTopic,...projected.secondaryTopics])].filter(topic=>CHEMISTRY_0620_TOPICS.includes(topic)||topic===CHEMISTRY_0620_PRACTICAL_TOPIC);
      if(paper>=5 && !topics.includes(CHEMISTRY_0620_PRACTICAL_TOPIC)) topics.unshift(CHEMISTRY_0620_PRACTICAL_TOPIC);
      if(!topics.length) reportReason='One or more question classifications do not have a supported official topic.';
      return {id:q.id,number:q.number,maxMarks:reconciliation.marks[i],topics,...(qp.questions[i]?{questionPage:qp.questions[i].page}:{})};
    });
    const reportAvailable=!reportReason;
    const session=sessionCode==='m'?'February/March':sessionCode==='s'?'May/June':'October/November';
    const summary={id:source.id,bankSlug:'igcse-chemistry-0620',title:`Chemistry 0620 · ${session} ${year} · Paper ${component}`,subject:'Chemistry',syllabusCode:'0620',year:Number(year),session,sessionCode,component,paper,variant:component[1],paperName:qCover.paperName,route:paper===1||paper===3?'Core':paper===2||paper===4?'Extended':'Shared',durationMinutes:qCover.durationMinutes,maxMarks,questionCount:paper<=2?maxMarks:totals.length,questionPages:qp.pageCount,markschemePages:ms.pageCount,reportAvailable,...(reportReason?{reportReason}:{})};
    const documentBase=`/past-papers/igcse-chemistry-0620/${source.id}/document`;
    const version=createHash('sha256').update(JSON.stringify([GENERATOR_VERSION,qp.sha256,ms.sha256,questions])).digest('hex').slice(0,20);
    papers.push({summary,detail:{...summary,version,sources:{question:`${documentBase}?kind=question`,markscheme:`${documentBase}?kind=markscheme`},questions:reportAvailable?questions:[]},source,evidence:{question:{sha256:qp.sha256,bytes:qp.bytes,pageCount:qp.pageCount,cover:qCover,totals},markscheme:{sha256:ms.sha256,bytes:ms.bytes,pageCount:ms.pageCount,cover:mCover}},reconciliation:{...reconciliation,runtimeQuestionCount:questionRows.length,sourceQuestionCount:summary.questionCount}});
    corrections.push(...reconciliation.corrections.map(c=>({...c,paperId:source.id,questionSha256:qp.sha256,questionPage:qp.questions.find(q=>q.number===Number(c.id.split('-q')[1]))?.page,evidence:'Geometry-owned printed question Total or standalone bracket marks from original PDF'})));
    const sourceNumbers=paper<=2?Array.from({length:maxMarks},(_,i)=>i+1):qp.questions.map(q=>q.number);
    const missingQuestionIds=sourceNumbers.filter(n=>!questionRows.some(q=>q.number===n)).map(n=>`${source.id}-q${n}`);
    if(!reportAvailable) discrepancies.push({id:source.id,reason:reportReason,missingQuestionIds,runtimeQuestionCount:questionRows.length,sourceTotals:totals,runtimeMarks:questionRows.map(q=>q.maxMarks),sourceMaximum:maxMarks});
    if((index+1)%10===0||index+1===sources.length) {
      await atomicJson(path.join(OUT,'progress.json'),{completed:index+1,total:sources.length,lastPaper:source.id});
      console.log(`Verified ${index+1}/${sources.length}: ${source.id}`);
    }
  }
  const missingIds=discrepancies.flatMap(d=>d.missingQuestionIds);
  const missingClassificationSearch:{file:string;ids:string[]}[]=[];
  for(const directory of ['results','review','queues']) for(const name of await fs.readdir(path.join(SOURCE_ROOT,'classification-extension',directory))) {
    if(!name.endsWith('.json')) continue;
    const text=await fs.readFile(path.join(SOURCE_ROOT,'classification-extension',directory,name),'utf8');
    const ids=missingIds.filter(id=>text.includes(JSON.stringify(id)));
    if(ids.length)missingClassificationSearch.push({file:`classification-extension/${directory}/${name}`,ids});
  }
  if(identityFailures.length) throw new Error(`Source identities require review: ${identityFailures.join(', ')}`);
  const receipt={version:GENERATOR_VERSION,sourceCount:sources.length*2,paperCount:papers.length,sourceQuestionCount:papers.reduce((s,p)=>s+p.summary.questionCount,0),missingQuestionCount:missingIds.length,missingClassificationSearch,runtimeQuestionCount:rows.length,runtimePaperCount:byPaper.size,runtimeSha256:createHash('sha256').update(runtimeBytes).digest('hex'),reportAvailableCount:papers.filter(p=>p.summary.reportAvailable).length,identityFailures,corrections,discrepancies,metadataSearch};
  await atomicJson(path.join(OUT,'archive.json'),{version:GENERATOR_VERSION,papers,receipt});
  await atomicJson(path.join(OUT,'receipt.json'),receipt);
  console.log(JSON.stringify({paperCount:receipt.paperCount,sourceCount:receipt.sourceCount,reportAvailableCount:receipt.reportAvailableCount,identityFailures:receipt.identityFailures,correctionCount:receipt.corrections.length,held:receipt.discrepancies.map(d=>({id:d.id,reason:d.reason}))},null,2));
  return receipt;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await buildArchive();
