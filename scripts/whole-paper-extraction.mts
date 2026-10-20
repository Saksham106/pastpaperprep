import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sourceQuestionMarks } from './build-chemistry-paper-archive.mjs';

export const EXTRACTOR_VERSION = 'whole-paper-pdfjs-5.4.624-geometry-v2';
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export type Identity = { family: 'igcse' | 'ib'; year: number; session: string; sessionCode: string; component: string; paper: string; variant: string; syllabusCode?: string; level?: string };
export function parseIdentity(id: string): Identity {
  const cambridge = /^(\d{4})-(\d{4})-(m|s|w|march|june|november|summer|winter)-(\d{2})$/.exec(id);
  if (cambridge) {
    const [, syllabusCode, year, token, component] = cambridge;
    const sessionCode = ({march:'m',june:'s',summer:'s',november:'w',winter:'w'} as Record<string,string>)[token] ?? token;
    return {family:'igcse',syllabusCode,year:Number(year),sessionCode,session:sessionCode==='m'?'February/March':sessionCode==='s'?'May/June':'October/November',component,paper:component[0],variant:component[1]};
  }
  const ib = /^(?:(?:chemistry|physics|biology|economics|computer-science)-)?(\d{4})-(may|nov|november)-(tz[0123abc]|none)(?:-(hl|sl|hlsl))?-p([123](?:[ab])?)(?:-(english|calculus|discrete-mathematics|sets-relations-and-groups|statistics-and-probability))?$/.exec(id);
  if (ib) return {family:'ib',year:Number(ib[1]),sessionCode:ib[2]==='may'?'may':'nov',session:ib[2]==='may'?'May':'November',variant:ib[3],level:ib[4],paper:ib[5],component:`P${ib[5].toUpperCase()}`};
  const sl = /^(\d{4})-(may|november)-p([123])-(tz[0123abcn])$/.exec(id);
  if(sl)return {family:'ib',year:Number(sl[1]),sessionCode:sl[2]==='may'?'may':'nov',session:sl[2]==='may'?'May':'November',variant:sl[4],paper:sl[3],component:`P${sl[3]}`};
  const compact=/^([mn])(\d{2})-math-(?:aa|ai)(hl|sl)-p([123])-(tz[0123abc]|[abc])$/.exec(id);
  if(compact)return {family:'ib',year:2000+Number(compact[2]),sessionCode:compact[1]==='m'?'may':'nov',session:compact[1]==='m'?'May':'November',level:compact[3],variant:compact[5],paper:compact[4],component:`P${compact[4]}`};
  throw new Error(`Unsupported paper identity: ${id}`);
}
export type GeometryItem = {str: string; x: number; y: number; width?: number; fontName?:string};
export type PrintedQuestion = {number: number; page: number; text: string; maxMarks: number};
/**
 * How a question's marks are read. 'text' sums every "[n]" in the block's text. 'right-margin' reads only text runs
 * ending at x >= MARK_COLUMN_MIN_RIGHT: Cambridge portrait papers right-align printed marks to ~546pt (some fused
 * with the dot leader before them), while pseudocode array indexes such as Names[1] end by ~496pt. A last-line mark
 * can sit at y=44, under the text cut-off; the footer ("[Turn over") is at y<=35. Gated per bank
 * (RIGHT_MARGIN_MARK_BANKS) so other banks' manifests stay byte-identical.
 */
export type MarkRule = 'text' | 'right-margin';
export const MARK_COLUMN_MIN_RIGHT = 520, MARK_COLUMN_MIN_Y = 40;
export const RIGHT_MARGIN_MARK_BANKS: ReadonlySet<string> = new Set(['igcse-computer-science-0478']);
export const markRuleForBank = (slug: string): MarkRule => RIGHT_MARGIN_MARK_BANKS.has(slug) ? 'right-margin' : 'text';
export const extractorVersionFor = (rule: MarkRule) => rule==='text' ? EXTRACTOR_VERSION : `${EXTRACTOR_VERSION}+right-margin-marks`;
export function extractQuestionBlocks(pages: GeometryItem[][], family: Identity['family'], markRule: MarkRule = 'text'): PrintedQuestion[] {
  const blocks: (Omit<PrintedQuestion,'maxMarks'>&{margin:string})[] = [];
  let headingFont:string|undefined;
  for (const [index,items] of pages.entries()) for (const item of items) {
    const number=Number(item.str.replace(/\.$/,''));
    const start=/^\d{1,2}\.?$/.test(item.str) && item.x>=(family==='igcse'?40:25) && item.x<=(family==='igcse'?60:75) && item.y>80 && item.y<790 && number===blocks.length+1 && (items.some(next=>Math.abs(next.y-item.y)<2 && next.x>70 && /^[A-Za-z(\[]/.test(next.str)) || (headingFont!==undefined&&item.fontName===headingFont));
    if(start) {headingFont??=item.fontName;blocks.push({number,page:index+2,text:'',margin:''});}
    if(blocks.length && item.y<790 && item.y>45) blocks[blocks.length-1].text+=' '+item.str;
    if(blocks.length && item.y<790 && item.y>MARK_COLUMN_MIN_Y && item.x+(item.width??0)>=MARK_COLUMN_MIN_RIGHT) blocks[blocks.length-1].margin+=' '+item.str;
  }
  return blocks.map(({margin,...block})=>{const maximum=/\[\s*Maximum\s+marks?\s*:\s*(\d+)\s*\]/i.exec(block.text);return {...block,maxMarks:maximum?Number(maximum[1]):sourceQuestionMarks(markRule==='right-margin'?margin:block.text)};});
}
export type ExtractedDocument = {sha256: string; bytes: number; pages: number; text: string[]; questions: PrintedQuestion[]};
export async function atomicJson(destination: string, value: unknown) {
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(`${destination}.tmp`,JSON.stringify(value)+'\n');
  await fs.rename(`${destination}.tmp`,destination);
}
export function adaptChemistryCheckpoint(input:unknown,hash:string,byteCount:number):ExtractedDocument|null {
  const old=input as {version:string;sha256:string;bytes:number;pageCount:number;pages:string[];questions:PrintedQuestion[]};
  if(!old||old.version!=='chemistry-paper-archive-v2'||old.sha256!==hash||old.bytes!==byteCount||!Number.isSafeInteger(old.pageCount)||old.pageCount<1||!Array.isArray(old.pages)||old.pages.length!==old.pageCount||!old.pages.every(page=>typeof page==='string')||!Array.isArray(old.questions))return null;
  if(!old.questions.every((q,i)=>q.number===i+1&&Number.isSafeInteger(q.page)&&q.page>=2&&q.page<=old.pageCount&&typeof q.text==='string'&&q.maxMarks===sourceQuestionMarks(q.text)))return null;
  return {sha256:hash,bytes:byteCount,pages:old.pageCount,text:old.pages,questions:old.questions};
}
export async function extractPdf(filename: string, family: Identity['family'], cacheDirectory: string,legacyChemistryCache?:string,markRule:MarkRule='text'): Promise<ExtractedDocument> {
  const bytes=await fs.readFile(filename), hash=sha256(bytes), version=extractorVersionFor(markRule);
  if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error(`Invalid PDF header: ${filename} sha256=${hash}`);
  const cache=path.join(cacheDirectory,`${hash}-${EXTRACTOR_VERSION}-${family}${markRule==='text'?'':`-${markRule}`}.json`);
  try {const cached=JSON.parse(await fs.readFile(cache,'utf8'));if(cached.sha256===hash&&cached.version===version&&cached.bytes===bytes.length)return cached;} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT' && !(error instanceof SyntaxError))throw error;}
  if(legacyChemistryCache&&markRule==='text'&&family==='igcse'&&/^0620-\d{4}-[msw]-[3-6]\d-question\.pdf$/.test(path.basename(filename))) {
    try {
      const legacy=JSON.parse(await fs.readFile(path.join(legacyChemistryCache,path.basename(filename).replace(/\.pdf$/,'.json')),'utf8'));
      const adapted=adaptChemistryCheckpoint(legacy,hash,bytes.length);
      if(adapted){await atomicJson(cache,{version:EXTRACTOR_VERSION,...adapted});return adapted;}
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
  }
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
  const text:string[]=[], geometry:GeometryItem[][]=[];
  try {
    for(let p=1;p<=document.numPages;p++) {
      const page=await document.getPage(p), content=await page.getTextContent();
      const items=content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item);
      const decoded=items.map(item=>({fontName:item.fontName,str:item.str,x:item.transform[4],y:item.transform[5],width:item.width}));
      text.push(decodeSourceText(items.map(item=>item.str).join(' ')));
      if(p>1)geometry.push(decoded);
      page.cleanup();
    }
    const result={sha256:hash,bytes:bytes.length,pages:document.numPages,text,questions:extractQuestionBlocks(geometry,family,markRule)};
    await atomicJson(cache,{version,...result});
    return result;
  } finally {await document.destroy();}
}
export function decodeSourceText(text: string) {
  // Proven chemistry embedded-font anomaly: never apply this to normal text.
  return text.includes('&+(0,675<') ? [...text].map(c=>c===' '?c:c.charCodeAt(0)>=3&&c.charCodeAt(0)<=97?String.fromCharCode(c.charCodeAt(0)+29):c).join('') : text;
}
export function normalizeHeaderText(source: string) {
  let text=decodeSourceText(source).replace(/\s+/g,' ');
  // Join known header vocabulary split into PDF glyph runs; never rewrite IDs.
  for(const word of ['Higher','Standard','level','Paper','May','November','October','April','Chemistry','Physics','Biology','Economics','Additional','Mathematics','applications','interpretation','analysis','approaches','and']) text=text.replace(new RegExp(`\\b${word.split('').join('\\s*')}\\b`,'gi'),word);
  return text;
}
export function parseHeader(source: string, identity: Identity) {
  const text=normalizeHeaderText(source);
  const duration = /(?:(\d+(?:\.\d+)?)\s*hours?(?:\s*(\d+)\s*minutes?)?|(\d+)\s*minutes?)/i.exec(text);
  const componentMaximum=identity.family==='ib'?new RegExp(`maximum mark for paper\\s+${identity.paper[0]}\\s*${identity.paper.slice(1)}\\s+is\\s*\\[?\\s*(\\d+)`,'i').exec(text):null;
  const maximum = componentMaximum??/(?:total mark for this paper is|maximum marks?\s*(?:for this examination paper\s+is|:)|Maximum total\s*=|maximum number of marks (?:is|:)?)\s*\[?\s*(\d+)/i.exec(text);
  const sessionPattern = identity.sessionCode==='m'?/(?:February\s*\/\s*March|March)/i:identity.sessionCode==='s'?/May\s*\/\s*June/i:identity.sessionCode==='w'?/October\s*\/\s*November/i:identity.sessionCode==='may'?/\bMay\b/i:/\bNovember\b/i;
  const yearValid = new RegExp(`\\b${String(identity.year).split('').join('\\s*')}\\b`).test(text);
  const componentValid = identity.family==='igcse'
    ? new RegExp(`${identity.syllabusCode}\\s*/\\s*${identity.component.split('').join('\\s*')}\\b`).test(text)
    : new RegExp(`\\bPaper\\s+${identity.paper[0]}${identity.paper.slice(1)?`\\s*${identity.paper.slice(1)}`:''}\\b`,'i').test(text);
  const levelValid = !identity.level || (identity.level==='hlsl'?/higher level and standard level/i.test(text):new RegExp(identity.level==='hl'?'higher level':'standard level','i').test(text));
  const durationMinutes=duration?Number(duration[1]??0)*60+Number(duration[2]??duration[3]??0):null;
  const sharedDuration=identity.paper.length>1&&/\[\s*Paper\s+1A\s+and\s+Paper\s+1B\s*\]/i.test(text);
  // Legacy IB slash codes encode numeric timezones directly; modern numeric
  // codes do not. Normalize only the matched printed code, never source IDs.
  const slashCode=identity.family==='ib' ? /\b[MN]\s*\d\s*\d\s*\/\s*\d\s*\/\s*(?:[A-Z]\s*){3,8}\/\s*[HS]\s*P\s*(?:[123](?:\s*[AB])?|M)\s*\/\s*E\s*N\s*G\s*\/\s*T\s*Z\s*[0123ABC]\s*\/\s*(?:[A-Z]\s*){2}(?:\/\s*M)?\b/i.exec(text)?.[0].replace(/\s/g,'').toUpperCase().replace(/\/M$/,'') : undefined;
  const slashFields=slashCode?.split('/');
  const slashIdentityValid=!slashFields || (
    slashFields[0]===`${identity.sessionCode==='may'?'M':'N'}${String(identity.year).slice(-2)}` &&
    // HPM/SPM print no numeric component; retain the cover-prose check.
    (slashFields[3].endsWith('M')||slashFields[3].slice(1)===identity.component) &&
    (!identity.level||identity.level==='hlsl'||slashFields[3][0]===(identity.level==='sl'?'S':'H')) &&
    (!/^tz[0123]$/.test(identity.variant)||slashFields[5]===identity.variant.toUpperCase())
  );
  const printedExamCode=/(\b\d\s*\d\s*\d\s*\d)\s*[–−-]\s*(\d\s*\d\s*\d\s*\d)(?:M)?\b/.exec(text);
  const examCode=printedExamCode ? [printedExamCode[0],printedExamCode[1].replace(/\s/g,''),printedExamCode[2].replace(/\s/g,'')] : null;
  return {printedIdentityValid:slashIdentityValid,identityValid:yearValid&&(sessionPattern.test(text)||(identity.family==='ib'&&identity.sessionCode==='may'&&/\bApril\b/i.test(text)&&examCode?.[1]===`22${String(identity.year).slice(-2)}`)||(identity.family==='ib'&&identity.sessionCode==='nov'&&/\bOctober\b/i.test(text)&&examCode?.[1]===`88${String(identity.year).slice(-2)}`))&&componentValid&&levelValid&&slashIdentityValid,durationMinutes:sharedDuration?null:durationMinutes,sharedDurationMinutes:sharedDuration?durationMinutes:null,maxMarks:maximum?Number(maximum[1]):null,examCode:slashCode??(examCode?`${examCode[1]}-${examCode[2]}`:null),optionalChoice:/answer\s+(?:any\s+)?(?:one|two|three|four|\d+)\s+(?:of\s+(?:the\s+)?)?questions?|choose\s+(?:one|two|three)|option\s+[A-D]\b|questions\s+from\s+one\s+of\s+the\s+options/i.test(text)};
}
export function findCover(pages:string[],identity:Identity) {
  const candidates=pages.slice(0,3).map((raw,i)=>{const text=normalizeHeaderText(raw);return {text,page:i+1,header:parseHeader(text,identity)};});
  // The first complete cover (or printed contradiction) owns identity. Later
  // running headers cannot override a verified cover or erase a rejected one.
  const exact=candidates.find(candidate=>candidate.header.identityValid||!candidate.header.printedIdentityValid);
  if(exact&&!exact.header.printedIdentityValid)return exact;
  // A few split-component schemes label the cover only Paper 1 and clarify
  // 1A/1B in Subject Details on page three; require the aggregate identity.
  if(!exact&&identity.family==='ib'&&/Markscheme/i.test(pages[0]??'')) {
    const text=normalizeHeaderText(pages.slice(0,3).join(' ')),header=parseHeader(text,identity);
    if(header.identityValid)return {text,page:1,header};
  }
  return exact??candidates[0]??{text:'',page:1,header:parseHeader('',identity)};
}
