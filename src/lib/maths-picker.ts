import syllabus0580 from '@/data/igcse-0580-official-2025.json';
import syllabus0606 from '@/data/igcse-0606-numbered-subtopics.json';
export const EARLIER_MATHS_TOPIC='Earlier syllabus';
export type MathsQuestionSummary={bankSlug:string;subtopics:readonly string[];skills?:readonly string[];primaryTopic?:string;secondaryTopics?:readonly string[]};
export function isCleanMathsBank(bank:string|undefined):boolean{return bank==='igcse'||bank==='igcse-additional';}
type Section={value:string;label:string;topic:string};
const sections0580:Section[]=syllabus0580.topics.flatMap(t=>t.sections.map(s=>({value:`${s.code} ${s.title}`,label:s.code==='1.7'?'Numerical indices':s.code==='2.4'?'Algebraic indices':s.title,topic:t.title})));
const sections0606:Section[]=syllabus0606.sections.map(s=>({value:s.displayTitle,label:s.title,topic:s.topic}));
export function getMathsPickerSections(bank:string):readonly Section[]{return bank==='igcse'?sections0580:bank==='igcse-additional'?sections0606:[];}
const officialValues:Record<string,ReadonlySet<string>>={igcse:new Set(sections0580.map(s=>s.value)),'igcse-additional':new Set(sections0606.map(s=>s.value))};
export function isEarlierMathsQuestion(q:MathsQuestionSummary):boolean{return isCleanMathsBank(q.bankSlug)&&q.subtopics.length>0&&!q.subtopics.some(v=>officialValues[q.bankSlug].has(v));}
export function mathsEarlierToken(bank:string,label:string):string{return `earlier-only:${bank}:${encodeURIComponent(label)}`;}
export function isMathsEarlierToken(value:string):boolean{return value.startsWith('earlier-only:igcse:')||value.startsWith('earlier-only:igcse-additional:');}
function earlierLabel(bank:string,value:string):string|null{
 const prefix=`earlier-only:${bank}:`;if(!isCleanMathsBank(bank)||!value.startsWith(prefix))return null;
 try{return decodeURIComponent(value.slice(prefix.length));}catch{return null;}
}
export function mathsPickerLabel(bank:string,value:string):string{
 if(!isCleanMathsBank(bank))return value;
 return earlierLabel(bank,value)??getMathsPickerSections(bank).find(s=>s.value===value)?.label??value.replace(/^(?:C|E)?\d+\.\d+\s+/,'');
}
export function mathsTopicMatches(q:MathsQuestionSummary,value:string):boolean{
 return value===EARLIER_MATHS_TOPIC?isEarlierMathsQuestion(q):q.primaryTopic===value||Boolean(q.secondaryTopics?.includes(value));
}
export function mathsSubtopicMatches(q:MathsQuestionSummary,value:string):boolean{
 const oldLabel=earlierLabel(q.bankSlug,value);
 if(oldLabel!==null)return isEarlierMathsQuestion(q)&&q.subtopics.includes(oldLabel);
 if(isMathsEarlierToken(value))return false;
 return q.subtopics.includes(value)||Boolean(q.skills?.includes(value));
}
export function getMathsPickerTopics(questions:readonly MathsQuestionSummary[]):string[]{
 const bank=questions[0]?.bankSlug??'';return [...new Set(getMathsPickerSections(bank).map(s=>s.topic)),...(questions.some(isEarlierMathsQuestion)?[EARLIER_MATHS_TOPIC]:[])];
}
export function getMathsPickerGroups(questions:readonly MathsQuestionSummary[],selectedTopics:readonly string[],selectedSubtopics:readonly string[]){
 const bank=questions[0]?.bankSlug??'';const sections=getMathsPickerSections(bank);
 const historical=questions.filter(isEarlierMathsQuestion);
 const labels=[...new Set(historical.flatMap(q=>[...q.subtopics]))].sort((a,b)=>a.localeCompare(b));
 const allEarlier=labels.map(l=>mathsEarlierToken(bank,l));const all=[...sections.map(s=>s.value),...allEarlier];
 const current=selectedTopics.length?sections.filter(s=>selectedTopics.includes(s.topic)).map(s=>s.value):sections.map(s=>s.value);
 const earlierRows=!selectedTopics.length||selectedTopics.includes(EARLIER_MATHS_TOPIC)||selectedTopics.includes('Earlier syllabus topics')?historical:historical.filter(q=>[q.primaryTopic,...(q.secondaryTopics??[])].some(t=>Boolean(t&&selectedTopics.includes(t))));
 const relevantLabels=new Set(earlierRows.flatMap(q=>[...q.subtopics]));const earlier=allEarlier.filter(v=>relevantLabels.has(earlierLabel(bank,v)??''));
 const relevant=[...current,...earlier];const context=new Set(relevant);const availableAliases=new Set(questions.flatMap(q=>[...q.subtopics,...(q.skills??[])]));
 return {all,relevant,earlier,other:all.filter(v=>!context.has(v)),selectedOutsideContext:selectedSubtopics.filter(v=>(availableAliases.has(v)||all.includes(v))&&!context.has(v))};
}
export function displayedMathsSubtopics(q:MathsQuestionSummary):string[]{
 const values=getMathsPickerSections(q.bankSlug).filter(s=>q.subtopics.includes(s.value)).map(s=>s.label);
 return [...new Set(values.length?values:q.subtopics.map(v=>mathsPickerLabel(q.bankSlug,v)))];
}
