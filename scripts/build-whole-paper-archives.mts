import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCatalogBank, type BankSlug } from '../src/lib/catalog';
import { normalizeBankQuestions, type UnifiedQuestion } from '../src/lib/questions';
import type { WholePaperEntry, WholePaperManifest, WholePaperLocalBindings } from '../src/lib/whole-paper-types';
import { EXTRACTOR_VERSION, sha256, parseIdentity, findCover, extractPdf, atomicJson, markRuleForBank, extractorVersionFor, type ExtractedDocument } from './whole-paper-extraction.mjs';

export type BuildOptions={inventoryFiles:string[];identityReviewFiles?:string[];bank?:string;root?:string;outputRoot?:string};
type IdentityReview={bankSlug:string;paperId:string;questionSha256:string;markschemeSha256:string;verdict:'valid-pair';visualEvidence:{document:'question'|'markscheme';sourcePdfSha256:string;page:number;imagePath:string;imageSha256:string}[];[key:string]:unknown};
async function loadIdentityReviews(files:string[],root:string) {
  const reviews=new Map<string,IdentityReview>();
  for(const filename of files) {
    const bytes=await fs.readFile(path.resolve(root,filename));
    if(bytes.length>32*1024*1024)throw new Error('Identity review exceeds size limit');
    const payload=JSON.parse(bytes.toString());
    if(!Array.isArray(payload.cases))throw new Error('Invalid identity review cases');
    for(const review of payload.cases as IdentityReview[]) {
      if(!getCatalogBank(review.bankSlug)||!/^[a-z0-9][a-z0-9-]{0,159}$/.test(review.paperId)||review.verdict!=='valid-pair'||![review.questionSha256,review.markschemeSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))throw new Error('Invalid identity review binding');
      if(!Array.isArray(review.visualEvidence)||!['question','markscheme'].every(kind=>review.visualEvidence.some(image=>image.document===kind)))throw new Error('Identity review needs both source images');
      for(const image of review.visualEvidence) {
        const expected=image.document==='question'?review.questionSha256:image.document==='markscheme'?review.markschemeSha256:null;
        if(!expected||image.sourcePdfSha256!==expected||!Number.isSafeInteger(image.page)||image.page<1||!path.isAbsolute(image.imagePath)||!/^[a-f0-9]{64}$/.test(image.imageSha256)||sha256(await fs.readFile(image.imagePath))!==image.imageSha256)throw new Error('Identity review image binding mismatch');
      }
      const key=JSON.stringify([review.bankSlug,review.paperId]);
      if(reviews.has(key))throw new Error('Duplicate identity review');
      reviews.set(key,review);
    }
  }
  return reviews;
}
/**
 * Reviewed report holds (data/paper-archives/report-holds.json): a paper whose sources reconcile but whose
 * official mark scheme amends the printed paper (e.g. a withdrawn part), or whose original omits material a
 * question needs (a graph removed for copyright), keeps its PDFs and stays report-held with the reviewed reason. Read on every build, bound to both source hashes, so a rebuild
 * can't drop it; a hold that no longer matches its paper fails the build.
 */
export const REPORT_HOLDS_FILE='data/paper-archives/report-holds.json';
export type ReportHold={bankSlug:string;paperId:string;questionSha256:string;markschemeSha256:string;reason:string;review:{date:string;evidence:string}};
export async function loadReportHolds(root:string) {
  const payload=await readOptionalJson<{schema?:string;holds?:ReportHold[]}>(path.join(root,REPORT_HOLDS_FILE),{schema:'whole-paper-report-holds-v1',holds:[]});
  if(payload.schema!=='whole-paper-report-holds-v1'||!Array.isArray(payload.holds))throw new Error('Invalid report holds file');
  const holds=new Map<string,ReportHold>();
  for(const hold of payload.holds) {
    if(!getCatalogBank(hold.bankSlug)||!/^[a-z0-9][a-z0-9-]{0,159}$/.test(hold.paperId)||![hold.questionSha256,hold.markschemeSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))throw new Error('Invalid report hold binding');
    if(typeof hold.reason!=='string'||!/^\S.{10,300}\.$/.test(hold.reason)||!hold.review||!/^\d{4}-\d{2}-\d{2}$/.test(hold.review.date)||typeof hold.review.evidence!=='string'||!hold.review.evidence.trim())throw new Error(`Report hold needs a reason and review evidence: ${hold.paperId}`);
    const key=JSON.stringify([hold.bankSlug,hold.paperId]);
    if(holds.has(key))throw new Error('Duplicate report hold');
    holds.set(key,hold);
  }
  return holds;
}
/**
 * Reviewed MCQ key exceptions (data/paper-archives/mcq-key-reviews.json): a Paper 1A mark scheme whose key letter is
 * printed in its row but sits out of order in the PDF text stream, so the text-order match misses it. A review only
 * adds its question numbers to that paper's matched key numbers. It is bound to both PDF hashes, must name an
 * existing paper, and its letters must equal the reviewed runtime letters; anything else fails the build.
 */
export const MCQ_KEY_REVIEWS_FILE='data/paper-archives/mcq-key-reviews.json';
export type McqKeyReview={bankSlug:string;paperId:string;questionSha256:string;markschemeSha256:string;keys:Record<string,string>;review:{date:string;evidence:string}};
export async function loadMcqKeyReviews(root:string) {
  const payload=await readOptionalJson<{schema?:string;reviews?:McqKeyReview[]}>(path.join(root,MCQ_KEY_REVIEWS_FILE),{schema:'whole-paper-mcq-key-reviews-v1',reviews:[]});
  if(payload.schema!=='whole-paper-mcq-key-reviews-v1'||!Array.isArray(payload.reviews))throw new Error('Invalid MCQ key reviews file');
  const reviews=new Map<string,McqKeyReview>();
  for(const review of payload.reviews) {
    if(!getCatalogBank(review.bankSlug)||!/^[a-z0-9][a-z0-9-]{0,159}$/.test(review.paperId)||![review.questionSha256,review.markschemeSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))throw new Error('Invalid MCQ key review binding');
    const entries=review.keys&&typeof review.keys==='object'?Object.entries(review.keys):[];
    if(!entries.length||!entries.every(([number,letter])=>/^[1-9]\d?$/.test(number)&&/^[A-D]$/.test(letter)))throw new Error(`MCQ key review needs question numbers and letters A-D: ${review.paperId}`);
    if(!review.review||!/^\d{4}-\d{2}-\d{2}$/.test(review.review.date)||typeof review.review.evidence!=='string'||!review.review.evidence.trim())throw new Error(`MCQ key review needs a date and evidence: ${review.paperId}`);
    const key=JSON.stringify([review.bankSlug,review.paperId]);
    if(reviews.has(key))throw new Error('Duplicate MCQ key review');
    reviews.set(key,review);
  }
  return reviews;
}
/** Reviewed runtime answer letters for one paper, by question number (src/data/reviewed-mcq-answer-letters.json). */
export async function loadReviewedRuntimeLetters(root:string,bankSlug:string,runtimePaperId:string|null) {
  const payload=JSON.parse(await fs.readFile(path.join(root,'src/data/reviewed-mcq-answer-letters.json'),'utf8')) as {banks:Record<string,Record<string,{answers:string[]}>>};
  const letters:Record<number,string>={};
  if(runtimePaperId)for(const [id,value] of Object.entries(payload.banks[bankSlug]??{})) {
    const match=id.match(/^(.*)-q(\d+)$/);
    if(match&&match[1]===runtimePaperId&&value.answers.length===1)letters[Number(match[2])]=value.answers[0];
  }
  return letters;
}
export function parseCli(args:string[]):BuildOptions {
  const options:BuildOptions={inventoryFiles:[]};
  for(let i=0;i<args.length;i++) {
    const arg=args[i],value=args[++i];
    if(!value||value.startsWith('--'))throw new Error(`Missing value for ${arg}`);
    if(arg==='--inventory')options.inventoryFiles.push(value);
    else if(arg==='--identity-review')(options.identityReviewFiles??=[]).push(value);
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
  const identityReviews=await loadIdentityReviews(options.identityReviewFiles??[],root);
  const reportHolds=await loadReportHolds(root);
  const mcqKeyReviews=await loadMcqKeyReviews(root);
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
      const qp=await extractPdf(pair.questionPath,family,path.join(privateRoot,'text-cache'),path.join(root,'private/chemistry-paper-archive/checkpoints'),markRuleForBank(bank.slug));
      const ms=await extractPdf(pair.markschemePath,family,path.join(privateRoot,'text-cache'));
      sourceDocuments.push({id:pair.id,question:{path:pair.questionPath,sha256:qp.sha256,bytes:qp.bytes,pages:qp.pages},markscheme:{path:pair.markschemePath,sha256:ms.sha256,bytes:ms.bytes,pages:ms.pages}});
      const actualIds=normalized.filter(q=>q.id.replace(/-q\d+$/,'')===pair.runtimePaperId).map(q=>q.id).sort();
      if(JSON.stringify(actualIds)!==JSON.stringify([...pair.runtimeQuestionIds].sort()))throw new Error(`Inventory qids differ from exact runtime paper ${pair.runtimePaperId}`);
      const rows=pair.runtimeQuestionIds.map(id=>{const q=byId.get(id);if(!q)throw new Error(`Missing exact runtime qid ${id}`);return q;});
      const assembled=assemblePaper(bank.slug,pair,rows,qp,ms,identityReviews.get(JSON.stringify([bank.slug,pair.id])),reportHolds.get(JSON.stringify([bank.slug,pair.id])),mcqKeyReviews.get(JSON.stringify([bank.slug,pair.id])),mcqKeyReviews.has(JSON.stringify([bank.slug,pair.id]))?await loadReviewedRuntimeLetters(root,bank.slug,pair.runtimePaperId):undefined);
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
    const unusedHolds=[...reportHolds.values()].filter(hold=>hold.bankSlug===bank.slug&&!papers.some(p=>p.summary.id===hold.paperId));
    if(unusedHolds.length)throw new Error(`Report holds match no built paper: ${unusedHolds.map(h=>h.paperId).join(', ')}`);
    const unusedKeyReviews=[...mcqKeyReviews.values()].filter(review=>review.bankSlug===bank.slug&&!papers.some(p=>p.summary.id===review.paperId));
    if(unusedKeyReviews.length)throw new Error(`MCQ key reviews match no built paper: ${unusedKeyReviews.map(r=>r.paperId).join(', ')}`);
    const reports=papers.filter(p=>p.summary.reportAvailable).length;
    const manifest:WholePaperManifest={version:GENERATOR_VERSION,bankSlug:bank.slug,runtimeSha256:sha256(runtimeBytes),papers,coverage:{paired:papers.length,reports,held:papers.length-reports,unpaired:bank.unpaired.length,runtimeWithoutPair:bank.runtimeWithoutPair.length}};
    bindings.documents=[...bindings.documents.filter(doc=>doc.bankSlug!==bank.slug),...bankBindings].sort((a,b)=>`${a.bankSlug}/${a.paperId}/${a.kind}`.localeCompare(`${b.bankSlug}/${b.paperId}/${b.kind}`));
    const usedRoots=new Set(bindings.documents.map(doc=>doc.rootId));bindings.roots=[...roots.values()].filter(root=>usedRoots.has(root.id)).sort((a,b)=>a.id.localeCompare(b.id));
    receipt.banks=[...receipt.banks.filter(entry=>entry.slug!==bank.slug),{slug:bank.slug,questionMarkRule:markRuleForBank(bank.slug),runtimeFile:expectedRuntime,runtimeSha256:manifest.runtimeSha256,loaderTrace:{file:loaderFile,sha256:sha256(loaderBytes),selected:relativeRuntime},coverage:manifest.coverage,sourceCount:sourceDocuments.length*2,sourceDocuments,promotedSourceCount:bankBindings.length,unpaired:bank.unpaired,runtimeWithoutPair:bank.runtimeWithoutPair,notes:bank.notes,inventoryPaired:bank.pairs.length,publicPaired:papers.length,rejected:failures.length,failures,papers:details}].sort((a,b)=>a.slug.localeCompare(b.slug));
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
  const cohort=slug.startsWith('igcse-')&&slug!=='igcse-additional'||slug.startsWith('ib-economics-')||slug.startsWith('ib-computer-science-')?'production':'raw';
  return `src/data/${cohort}/${slug}.json`;
}
/**
 * IB Economics optional-choice papers (P2: "answer one question") print each question as lettered parts, so the
 * extractor's segment count (e.g. 7) is not the number of questions. Their runtime rows are the whole optional
 * questions (e.g. 2), and that is what the summary reports. Other banks keep the extractor count.
 */
export function optionalChoiceQuestionCount(slug:string,optionalChoice:boolean,runtimeRows:number,printedSegments:number) {
  return slug.startsWith('ib-economics-')&&optionalChoice&&runtimeRows>0?runtimeRows:printedSegments;
}
export function assemblePaper(slug:string,pair:InventoryPair,rows:UnifiedQuestion[],qp:ExtractedDocument,ms:ExtractedDocument,identityReview?:IdentityReview,reportHold?:ReportHold,mcqKeyReview?:McqKeyReview,runtimeLetters?:Record<number,string>) {
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
  // Compare like printed formats only: there is no evidenced translation
  // between modern numeric codes and legacy slash codes (or ABC zones).
  const comparableCodes=Boolean(qCover.examCode&&mCover.examCode&&qCover.examCode.includes('/')===mCover.examCode.includes('/'));
  const examCodesAgree=!comparableCodes||qCover.examCode===mCover.examCode;
  const coursePattern=bank.subject==='Mathematics AA'?/analysis\s+and\s+approaches/i:bank.subject==='Mathematics AI'?/applications\s+and\s+interpretation/i:null;
  const legacyMathematics=coursePattern!==null&&identity.year<2021;
  const courseValid=!coursePattern||legacyMathematics||(coursePattern.test(qFound.text)&&coursePattern.test(mFound.text));
  const bankLevelValid=identity.family!=='ib'||identity.level===bank.level.toLowerCase()||identity.level==='hlsl';
  const reviewMatches=Boolean(identityReview&&identityReview.bankSlug===slug&&identityReview.paperId===pair.id&&identityReview.questionSha256===qp.sha256&&identityReview.markschemeSha256===ms.sha256&&identityReview.verdict==='valid-pair');
  if(identityReview&&!reviewMatches)throw new Error('Identity review source binding mismatch');
  if(reportHold&&!(reportHold.bankSlug===slug&&reportHold.paperId===pair.id&&reportHold.questionSha256===qp.sha256&&reportHold.markschemeSha256===ms.sha256))throw new Error('Report hold source binding mismatch');
  if(mcqKeyReview&&!(mcqKeyReview.bankSlug===slug&&mcqKeyReview.paperId===pair.id&&mcqKeyReview.questionSha256===qp.sha256&&mcqKeyReview.markschemeSha256===ms.sha256))throw new Error('MCQ key review source binding mismatch');
  const reviewedKeyNumbers=Object.entries(mcqKeyReview?.keys??{}).map(([number,letter])=>{
    if(runtimeLetters?.[Number(number)]!==letter)throw new Error(`MCQ key review letter disagrees with the reviewed runtime letter: ${pair.id} Q${number}`);
    return Number(number);
  });
  const identityValid=reviewMatches||(qCover.identityValid&&mCover.identityValid&&subjectValid&&examCodesAgree&&courseValid&&bankLevelValid&&legacyOptionValid&&(identity.family!=='igcse'||identity.syllabusCode===bank.syllabusCode));
  const maxMarks=qCover.identityValid?qCover.maxMarks??(mCover.identityValid?mCover.maxMarks:null):null;
  const sorted=[...rows].sort((a,b)=>a.number-b.number||a.id.localeCompare(b.id));
  const mcqLayout=/Multiple\s+Choice|For each question,?\s*choose the answer/i.test(qFound.text);
  const textOrderNumbers=[...ms.text.join(' ').matchAll(/\b(\d{1,2})\.?\s+([A-D])\b/g)].map(match=>Number(match[1]));
  const answerNumbers=new Set([...textOrderNumbers,...reviewedKeyNumbers]);
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
  // A reviewed hold is bound to both PDF hashes (checked above) and names the actual reason, so it wins over the derived
  // ones; a withheld question would otherwise only read as an inventory mismatch.
  const reportReason=reportHold?.reason??(!mFound.text.trim()?'Original markscheme cover text is unavailable for identity verification.':!qFound.text.trim()?'Original question cover text is unavailable for identity verification.':!identityValid?'Source document identities need review.':qCover.optionalChoice||mCover.optionalChoice?'Optional question choices need review.':!maximaAgree||!msQuestionMaximaAgree?'Question and markscheme maxima disagree.':!inventoryValid?'Printed and runtime question inventories do not reconcile.':!totalsValid?'Printed question maxima do not reconcile.':!topicsValid?'Reviewed question topics are unavailable.':undefined);
  const questions=!reportReason?sorted.map((q,i)=>{const source=printed[i];if(q.marks!==source.maxMarks)corrections.push({id:q.id,from:q.marks,to:source.maxMarks,questionPage:source.page});return {id:q.id,number:q.number,maxMarks:source.maxMarks,topics:topics[i],questionPage:source.page};}):[];
  const route:WholePaperEntry['summary']['route']=identity.family==='ib'?(bank.level==='HL'?'HL':bank.level==='SL'?'SL':null):/\bExtended\b/i.test(qFound.text)?'Extended':/\bCore\b/i.test(qFound.text)?'Core':/Alternative\s+to\s+Practical|Practical\s+Test/i.test(qFound.text)?'Shared':null;
  const document=(source:ExtractedDocument)=>({sha256:source.sha256,bytes:source.bytes,pages:source.pages});
  const summary:WholePaperEntry['summary']={id:pair.id,bankSlug:bank.slug,title:`${bank.title} · ${identity.session} ${identity.year} · Paper ${identity.component}`,qualification:bank.qualification,subject:bank.subject,syllabusCode:bank.syllabusCode,year:identity.year,session:identity.session,sessionCode:identity.sessionCode,component:identity.component,paper:identity.paper,variant:identity.variant,route,durationMinutes:qCover.identityValid?qCover.durationMinutes:null,maxMarks,questionCount:optionalChoiceQuestionCount(bank.slug,Boolean(qCover.optionalChoice||mCover.optionalChoice),sorted.length,printed.length),reportAvailable:!reportReason,...(reportReason?{reportReason}:{}),metadataVerified:identityValid&&maximaAgree&&maxMarks!==null};
  const entry:WholePaperEntry={summary,version:sha256(JSON.stringify([GENERATOR_VERSION,extractorVersionFor(markRuleForBank(slug)),qp.sha256,ms.sha256,summary,questions])).slice(0,20),documents:{question:document(qp),markscheme:document(ms)},questions};
  return {entry,corrections,evidence:{identity,identityValid,identityReview:identityReview??null,reportHold:reportHold??null,mcqKeyReview:mcqKeyReview??null,textOrderMissingKeys:reviewedKeyNumbers.filter(n=>!textOrderNumbers.includes(n)),subjectValid,courseValid,legacyMathematics,legacyOptionValid,bankLevelValid,examCodesAgree,mcqVerified,questionCoverPage:qFound.page,markschemeCoverPage:mFound.page,qCover,mCover,sourceQuestionCount:printed.length,msQuestionMaximaAgree,sourceTotals:printed.map(q=>q.maxMarks),sourceQuestionPages:printed.map(q=>q.page),runtimeQuestionIds:sorted.map(q=>q.id),runtimeMarks:sorted.map(q=>q.marks),inventoryValid,totalsValid,topicsValid}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const manifests=await buildWholePaperArchives(parseCli(process.argv.slice(2)));
  console.log(JSON.stringify(manifests.map(({bankSlug,coverage})=>({bankSlug,...coverage}))));
}
