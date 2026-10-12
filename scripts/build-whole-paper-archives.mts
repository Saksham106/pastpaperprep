import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCatalogBank, type BankSlug } from '../src/lib/catalog';
import { normalizeBankQuestions, type UnifiedQuestion } from '../src/lib/questions';
import type { WholePaperEntry, WholePaperManifest, WholePaperLocalBindings } from '../src/lib/whole-paper-types';
import { EXTRACTOR_VERSION, sha256, parseIdentity, findCover, extractPdf, atomicJson, type ExtractedDocument } from './whole-paper-extraction.mjs';

export type BuildOptions={inventoryFiles:string[];bank?:string;root?:string;outputRoot?:string};
export function parseCli(args:string[]):BuildOptions {
  const options:BuildOptions={inventoryFiles:[]};
  for(let i=0;i<args.length;i++) {
    const arg=args[i],value=args[++i];
    if(!value||value.startsWith('--'))throw new Error(`Missing value for ${arg}`);
    if(arg==='--inventory')options.inventoryFiles.push(value);
    else if(arg==='--bank'){if(options.bank)throw new Error('Only one --bank is supported');options.bank=value;}
    else throw new Error(`Unknown argument ${arg}`);
  }
  if(!options.inventoryFiles.length)throw new Error('Usage: tsx scripts/build-whole-paper-archives.mts --inventory <path> [--inventory <path>] [--bank <slug>]');
  return options;
}
async function readOptionalJson<T>(filename:string,fallback:T):Promise<T> {
  try{return JSON.parse(await fs.readFile(filename,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw error;}
}
async function appendCheckpoint(filename:string,value:unknown) {
  await fs.mkdir(path.dirname(filename),{recursive:true});
  const handle=await fs.open(filename,'a');try{await handle.write(JSON.stringify(value)+'\n');await handle.sync();}finally{await handle.close();}
}
export async function buildWholePaperArchives(options:BuildOptions) {
  const root=path.resolve(options.root??process.cwd()),outputRoot=path.resolve(options.outputRoot??root);
  const inventory:Inventory={banks:[]};
  for(const filename of options.inventoryFiles) {
    const parsed:unknown=JSON.parse(await fs.readFile(path.resolve(root,filename),'utf8'));validateInventory(parsed);inventory.banks.push(...parsed.banks);
  }
  validateInventory(inventory);
  const selected=inventory.banks.filter(bank=>!options.bank||options.bank===bank.slug).sort((a,b)=>a.slug.localeCompare(b.slug));
  if(options.bank&&!selected.length)throw new Error(`Bank not in inventory: ${options.bank}`);
  const privateRoot=path.join(outputRoot,'private/paper-archives');
  const bindings=await readOptionalJson<WholePaperLocalBindings>(path.join(privateRoot,'source-bindings.json'),{roots:[],documents:[]});
  type ReceiptBank={slug:string;[key:string]:unknown};
  const receipt=await readOptionalJson<{version:string;extractorVersion:string;banks:ReceiptBank[]}>(path.join(privateRoot,'receipt.json'),{version:GENERATOR_VERSION,extractorVersion:EXTRACTOR_VERSION,banks:[]});
  receipt.version=GENERATOR_VERSION;receipt.extractorVersion=EXTRACTOR_VERSION;
  const manifests:WholePaperManifest[]=[];
  for(const bank of selected) {
    const relativeRuntime=runtimeRelativeFile(bank.slug),expectedRuntime=path.join(root,relativeRuntime);
    if(await fs.realpath(bank.runtimeFile)!==await fs.realpath(expectedRuntime))throw new Error(`Inventory runtimeFile does not match question-loader cohort: ${bank.slug} expected ${relativeRuntime}`);
    const loaderFile=bank.slug.startsWith('ib-economics-')?'src/lib/economics-runtime.ts':'src/lib/question-loader.ts';
    const loaderBytes=await fs.readFile(path.join(root,loaderFile));
    if(!loaderBytes.toString().includes(`@/data/${relativeRuntime.slice('src/data/'.length)}`))throw new Error(`Loader trace no longer contains ${relativeRuntime}; review runtime mapping`);
    const runtimeBytes=await fs.readFile(expectedRuntime),runtime=JSON.parse(runtimeBytes.toString());
    if(!Array.isArray(runtime.questions))throw new Error(`Missing runtime questions: ${bank.slug}`);
    const rawIds=runtime.questions.map((q:{id:string})=>q.id);
    if(rawIds.some((id:unknown)=>typeof id!=='string'||!id)||new Set(rawIds).size!==rawIds.length)throw new Error(`Invalid or duplicate runtime qids: ${bank.slug}`);
    const normalized=normalizeBankQuestions(bank.slug,runtime.questions,{economicsAssetMode:'private',applyReviewedBlankPages:bank.slug.startsWith('igcse')});
    const byId=new Map(normalized.map(q=>[q.id,q]));
    const papers:WholePaperEntry[]=[],details:unknown[]=[],sourceDocuments:unknown[]=[],failures:{id:string;error:string}[]=[];
    let attempted=0;
    const bankBindings:WholePaperLocalBindings['documents']=[];
    const roots=new Map(bindings.roots.map(root=>[root.id,root]));
    for(const pair of [...bank.pairs].sort((a,b)=>a.id.localeCompare(b.id))) {
      attempted++;
      try {
      const family=bank.slug.startsWith('igcse')?'igcse':'ib';
      const qp=await extractPdf(pair.questionPath,family,path.join(privateRoot,'text-cache'),path.join(root,'private/chemistry-paper-archive/checkpoints'));
      const ms=await extractPdf(pair.markschemePath,family,path.join(privateRoot,'text-cache'));
      sourceDocuments.push({id:pair.id,question:{path:pair.questionPath,sha256:qp.sha256,bytes:qp.bytes,pages:qp.pages},markscheme:{path:pair.markschemePath,sha256:ms.sha256,bytes:ms.bytes,pages:ms.pages}});
      const actualIds=normalized.filter(q=>q.id.replace(/-q\d+$/,'')===pair.runtimePaperId).map(q=>q.id).sort();
      if(JSON.stringify(actualIds)!==JSON.stringify([...pair.runtimeQuestionIds].sort()))throw new Error(`Inventory qids differ from exact runtime paper ${pair.runtimePaperId}`);
      const rows=pair.runtimeQuestionIds.map(id=>{const q=byId.get(id);if(!q)throw new Error(`Missing exact runtime qid ${id}`);return q;});
      const assembled=assemblePaper(bank.slug,pair,rows,qp,ms);
      details.push({id:pair.id,runtimePaperId:pair.runtimePaperId,sourceMetadata:pair.metadata??null,inventoryRecord:pair,questionPath:pair.questionPath,markschemePath:pair.markschemePath,documents:assembled.entry.documents,reportReason:assembled.entry.summary.reportReason??null,corrections:assembled.corrections,evidence:assembled.evidence});
      if(!assembled.evidence.identityValid)throw new Error(`${assembled.entry.summary.reportReason} Not promoted to public manifest.`);
      papers.push(assembled.entry);
      for(const kind of ['question','markscheme'] as const) {
        const filename=kind==='question'?pair.questionPath:pair.markschemePath,doc=kind==='question'?qp:ms;
        const sourceRoot=path.dirname(filename),rootId=`source-${sha256(sourceRoot).slice(0,20)}`;
        roots.set(rootId,{id:rootId,path:sourceRoot});
        bankBindings.push({bankSlug:bank.slug,paperId:pair.id,kind,rootId,relativePath:path.basename(filename),sha256:doc.sha256,bytes:doc.bytes});
      }
      await appendCheckpoint(path.join(privateRoot,'progress.jsonl'),{version:GENERATOR_VERSION,bankSlug:bank.slug,paperId:pair.id,runtimeSha256:sha256(runtimeBytes),questionSha256:qp.sha256,markschemeSha256:ms.sha256,reportAvailable:assembled.entry.summary.reportAvailable,completed:papers.length,total:bank.pairs.length});
      console.log(`${bank.slug}: ${attempted}/${bank.pairs.length} ${pair.id} ${assembled.entry.summary.reportAvailable?'report':'held'}`);
      } catch(error) {
        const failure={id:pair.id,error:error instanceof Error?error.message:String(error)};failures.push(failure);
        await appendCheckpoint(path.join(privateRoot,'progress.jsonl'),{version:GENERATOR_VERSION,bankSlug:bank.slug,paperId:pair.id,status:'rejected',...failure,completed:attempted,total:bank.pairs.length});
        console.error(`${bank.slug}: ${attempted}/${bank.pairs.length} ${pair.id} rejected: ${failure.error}`);
      }
    }
    if(papers.length+failures.length!==bank.pairs.length||bankBindings.length!==papers.length*2)throw new Error(`Paired count mismatch: ${bank.slug}`);
    const reports=papers.filter(p=>p.summary.reportAvailable).length;
    const manifest:WholePaperManifest={version:GENERATOR_VERSION,bankSlug:bank.slug,runtimeSha256:sha256(runtimeBytes),papers,coverage:{paired:papers.length,reports,held:papers.length-reports,unpaired:bank.unpaired.length,runtimeWithoutPair:bank.runtimeWithoutPair.length}};
    bindings.documents=[...bindings.documents.filter(doc=>doc.bankSlug!==bank.slug),...bankBindings].sort((a,b)=>`${a.bankSlug}/${a.paperId}/${a.kind}`.localeCompare(`${b.bankSlug}/${b.paperId}/${b.kind}`));
    const usedRoots=new Set(bindings.documents.map(doc=>doc.rootId));bindings.roots=[...roots.values()].filter(root=>usedRoots.has(root.id)).sort((a,b)=>a.id.localeCompare(b.id));
    receipt.banks=[...receipt.banks.filter(entry=>entry.slug!==bank.slug),{slug:bank.slug,runtimeFile:expectedRuntime,runtimeSha256:manifest.runtimeSha256,loaderTrace:{file:loaderFile,sha256:sha256(loaderBytes),selected:relativeRuntime},coverage:manifest.coverage,sourceCount:sourceDocuments.length*2,sourceDocuments,promotedSourceCount:bankBindings.length,unpaired:bank.unpaired,runtimeWithoutPair:bank.runtimeWithoutPair,notes:bank.notes,inventoryPaired:bank.pairs.length,publicPaired:papers.length,rejected:failures.length,failures,papers:details}].sort((a,b)=>a.slug.localeCompare(b.slug));
    await atomicJson(path.join(privateRoot,'source-bindings.json'),bindings);
    await atomicJson(path.join(privateRoot,'receipt.json'),receipt);
    await atomicJson(path.join(outputRoot,'src/data/paper-archives',`${bank.slug}.json`),manifest);
    manifests.push(manifest);
  }
  return manifests;
}
export const GENERATOR_VERSION='whole-paper-manifest-v3';
export type InventoryPair={id:string;runtimePaperId:string|null;questionPath:string;markschemePath:string;runtimeQuestionIds:string[];metadata?:{sourceIdentity?:string;[key:string]:unknown}};
export type InventoryBank={slug:BankSlug;runtimeFile:string;pairs:InventoryPair[];unpaired:unknown[];runtimeWithoutPair:unknown[];notes:unknown[]};
export type Inventory={banks:InventoryBank[]};
export function validateInventory(input:unknown): asserts input is Inventory {
  const inventory=input as Inventory;
  if(!inventory||!Array.isArray(inventory.banks))throw new Error('Inventory requires banks array');
  const banks=new Set<string>();
  for(const bank of inventory.banks) {
    if(!getCatalogBank(bank.slug))throw new Error(`Unknown bank ${bank.slug}`);
    if(banks.has(bank.slug))throw new Error(`Duplicate bank ${bank.slug}`);banks.add(bank.slug);
    if(typeof bank.runtimeFile!=='string'||!path.isAbsolute(bank.runtimeFile))throw new Error('runtimeFile must be absolute');
    for(const field of ['pairs','unpaired','runtimeWithoutPair','notes'] as const)if(!Array.isArray(bank[field]))throw new Error(`Inventory ${bank.slug} requires ${field} array`);
    const ids=new Set<string>(),qids=new Set<string>(),sources=new Set<string>(),runtimePapers=new Set<string>();
    for(const pair of bank.pairs) {
      if(typeof pair.id!=='string'||! /^[a-z0-9][a-z0-9-]{0,159}$/.test(pair.id)||(pair.runtimePaperId!==null&&(typeof pair.runtimePaperId!=='string'||!pair.runtimePaperId)))throw new Error('Valid pair identity and nullable runtimePaperId are required');
      if(ids.has(pair.id)||(pair.runtimePaperId!==null&&runtimePapers.has(pair.runtimePaperId)))throw new Error(`Duplicate paper ${pair.id}`);ids.add(pair.id);if(pair.runtimePaperId!==null)runtimePapers.add(pair.runtimePaperId);
      for(const name of ['questionPath','markschemePath'] as const){if(typeof pair[name]!=='string'||!path.isAbsolute(pair[name]))throw new Error('Original paths must be absolute');if(/[\\:%?#]/.test(path.basename(pair[name])))throw new Error('Original filename is not safe for local bindings');if(sources.has(pair[name]))throw new Error(`Duplicate source ${pair[name]}`);sources.add(pair[name]);}
      if(!Array.isArray(pair.runtimeQuestionIds))throw new Error('runtimeQuestionIds array required');
      for(const id of pair.runtimeQuestionIds){if(typeof id!=='string'||!id)throw new Error('Persisted qid must be a nonempty string');if(qids.has(id))throw new Error(`Duplicate qid ${id}`);qids.add(id);}
    }
  }
}
/** Mirrors the production choice in question-loader, not candidate inventories. */
export function runtimeRelativeFile(slug:string) {
  if(!getCatalogBank(slug))throw new Error(`Unknown bank ${slug}`);
  const cohort=slug.startsWith('igcse-')&&slug!=='igcse-additional'||slug.startsWith('ib-economics-')?'production':'raw';
  return `src/data/${cohort}/${slug}.json`;
}
export function assemblePaper(slug:string,pair:InventoryPair,rows:UnifiedQuestion[],qp:ExtractedDocument,ms:ExtractedDocument) {
  const bank=getCatalogBank(slug);if(!bank)throw new Error(`Unknown bank ${slug}`);
  const identity=parseIdentity(pair.metadata?.sourceIdentity??pair.id);
  if(identity.family==='ib')identity.level??=bank.level.toLowerCase();
  const qFound=findCover(qp.text,identity),mFound=findCover(ms.text,identity);
  const qCover=qFound.header,mCover=mFound.header;
  const subjectPattern=bank.subject.startsWith('Mathematics')?/\bMathematics\b/i:bank.subject==='Co-ordinated Sciences'?/\bCo\s*(?:[-‐‑]\s*)?ordinated\s+Sciences?\b/i:new RegExp(`\\b${bank.subject.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');
  const legacyOptions:Record<string,{code:string;title:string}>={calculus:{code:'SE',title:'calculus'},'sets-relations-and-groups':{code:'SG',title:'setsrelationsandgroups'},'statistics-and-probability':{code:'SP',title:'statisticsandprobability'},'discrete-mathematics':{code:'DM',title:'discretemathematics'}};
  const legacyOption=slug==='ib-hl'&&identity.year<2021 ? legacyOptions[pair.id.split('-p3-')[1]] : undefined;
  const legacyToken=legacyOption ? `${identity.sessionCode==='may'?'M':'N'}${String(identity.year).slice(-2)}/5/MATHL/HP3/ENG/${identity.variant}/${legacyOption.code}` : null;
  const legacyCode=legacyToken ? new RegExp(`\\b${legacyToken.split('').join('\\s*')}\\b`,'i') : null;
  const legacyOptionValid=!legacyOption || Boolean(legacyCode?.test(qFound.text)&&legacyCode.test(mFound.text)&&mFound.text.replace(/[\s,]/g,'').toLowerCase().includes(legacyOption.title));
  const subjectValid=subjectPattern.test(qFound.text)&&(subjectPattern.test(mFound.text)||Boolean(legacyOption&&legacyOptionValid));
  const examCodesAgree=!qCover.examCode||!mCover.examCode||qCover.examCode===mCover.examCode;
  const coursePattern=bank.subject==='Mathematics AA'?/analysis\s+and\s+approaches/i:bank.subject==='Mathematics AI'?/applications\s+and\s+interpretation/i:null;
  const legacyMathematics=coursePattern!==null&&identity.year<2021;
  const courseValid=!coursePattern||legacyMathematics||(coursePattern.test(qFound.text)&&coursePattern.test(mFound.text));
  const bankLevelValid=identity.family!=='ib'||identity.level===bank.level.toLowerCase()||identity.level==='hlsl';
  const identityValid=qCover.identityValid&&mCover.identityValid&&subjectValid&&examCodesAgree&&courseValid&&bankLevelValid&&legacyOptionValid&&(identity.family!=='igcse'||identity.syllabusCode===bank.syllabusCode);
  const maxMarks=qCover.identityValid?qCover.maxMarks??(mCover.identityValid?mCover.maxMarks:null):null;
  const sorted=[...rows].sort((a,b)=>a.number-b.number||a.id.localeCompare(b.id));
  const mcqLayout=/Multiple\s+Choice|For each question,?\s*choose the answer/i.test(qFound.text);
  const answerNumbers=new Set([...ms.text.join(' ').matchAll(/\b(\d{1,2})\.?\s+([A-D])\b/g)].map(match=>Number(match[1])));
  const keyedMcq=qp.questions.length>0&&qp.questions.length===maxMarks&&qp.questions.every(q=>answerNumbers.has(q.number))&&sorted.every(q=>q.marks===1);
  const explicitOneMark=/Each correct answer will score (?:one|1) mark/i.test(qFound.text);
  const mcqVerified=mcqLayout&&(explicitOneMark||keyedMcq);
  const printed=qp.questions.map(q=>mcqVerified?{...q,maxMarks:1}:q);
  const corrections:{id:string;from:number|null;to:number;questionPage:number}[]=[];
  const inventoryValid=sorted.length>0&&sorted.length===printed.length&&new Set(sorted.map(q=>q.id)).size===sorted.length&&sorted.every((q,i)=>q.number===i+1&&q.number===printed[i].number)&&sorted.length===pair.runtimeQuestionIds.length&&sorted.every(q=>pair.runtimeQuestionIds.includes(q.id));
  const totalsValid=maxMarks!==null&&printed.every(q=>Number.isInteger(q.maxMarks)&&q.maxMarks>0)&&printed.reduce((sum,q)=>sum+q.maxMarks,0)===maxMarks;
  const maximaAgree=qCover.maxMarks===null||mCover.maxMarks===null||qCover.maxMarks===mCover.maxMarks;
  const simpleMs=ms.questions.filter(q=>/\[\s*(?:Maximum\s+marks?|Total)\s*:\s*\d+\s*\]/i.test(q.text));
  const msQuestionMaximaAgree=simpleMs.every(q=>printed.some(source=>source.number===q.number&&source.maxMarks===q.maxMarks));
  const topics=sorted.map(q=>[...new Set([q.primaryTopic,...q.secondaryTopics])].filter(topic=>Boolean(topic)&&topic!=='Questions needing section review'));
  const topicsValid=topics.every(t=>t.length>0&&!t.some(topic=>/^(?:other|unclassified|unknown)$/i.test(topic)));
  const reportReason=!mFound.text.trim()?'Original markscheme cover text is unavailable for identity verification.':!qFound.text.trim()?'Original question cover text is unavailable for identity verification.':!identityValid?'Source document identities need review.':qCover.optionalChoice||mCover.optionalChoice?'Optional question choices need review.':!maximaAgree||!msQuestionMaximaAgree?'Question and markscheme maxima disagree.':!inventoryValid?'Printed and runtime question inventories do not reconcile.':!totalsValid?'Printed question maxima do not reconcile.':!topicsValid?'Reviewed question topics are unavailable.':undefined;
  const questions=!reportReason?sorted.map((q,i)=>{const source=printed[i];if(q.marks!==source.maxMarks)corrections.push({id:q.id,from:q.marks,to:source.maxMarks,questionPage:source.page});return {id:q.id,number:q.number,maxMarks:source.maxMarks,topics:topics[i],questionPage:source.page};}):[];
  const route:WholePaperEntry['summary']['route']=identity.family==='ib'?(bank.level==='HL'?'HL':bank.level==='SL'?'SL':null):/\bExtended\b/i.test(qFound.text)?'Extended':/\bCore\b/i.test(qFound.text)?'Core':/Alternative\s+to\s+Practical|Practical\s+Test/i.test(qFound.text)?'Shared':null;
  const document=(source:ExtractedDocument)=>({sha256:source.sha256,bytes:source.bytes,pages:source.pages});
  const summary:WholePaperEntry['summary']={id:pair.id,bankSlug:bank.slug,title:`${bank.title} · ${identity.session} ${identity.year} · Paper ${identity.component}`,qualification:bank.qualification,subject:bank.subject,syllabusCode:bank.syllabusCode,year:identity.year,session:identity.session,sessionCode:identity.sessionCode,component:identity.component,paper:identity.paper,variant:identity.variant,route,durationMinutes:qCover.identityValid?qCover.durationMinutes:null,maxMarks,questionCount:printed.length,reportAvailable:!reportReason,...(reportReason?{reportReason}:{}),metadataVerified:identityValid&&maximaAgree&&maxMarks!==null};
  const entry:WholePaperEntry={summary,version:sha256(JSON.stringify([GENERATOR_VERSION,EXTRACTOR_VERSION,qp.sha256,ms.sha256,summary,questions])).slice(0,20),documents:{question:document(qp),markscheme:document(ms)},questions};
  return {entry,corrections,evidence:{identity,identityValid,subjectValid,courseValid,legacyMathematics,legacyOptionValid,bankLevelValid,examCodesAgree,mcqVerified,questionCoverPage:qFound.page,markschemeCoverPage:mFound.page,qCover,mCover,sourceQuestionCount:printed.length,msQuestionMaximaAgree,sourceTotals:printed.map(q=>q.maxMarks),sourceQuestionPages:printed.map(q=>q.page),runtimeQuestionIds:sorted.map(q=>q.id),runtimeMarks:sorted.map(q=>q.marks),inventoryValid,totalsValid,topicsValid}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const manifests=await buildWholePaperArchives(parseCli(process.argv.slice(2)));
  console.log(JSON.stringify(manifests.map(({bankSlug,coverage})=>({bankSlug,...coverage}))));
}
