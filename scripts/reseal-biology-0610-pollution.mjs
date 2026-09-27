#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const BANK='igcse-biology-0610', ID='0610-2022-w-43-q5';
const BASE='10ed3bfbb290d07b3d7a46d5010b464f58030b25';
const OLD_RUNTIME='61697c59efa36fc7fd2e04f2d0826a77ef6e5035f4598239b86b22e82c68f533';
const OLD_MANIFEST='4984902a3db4fc7e0599d1c646aabcfb023d958370d529861283c5d37189e3d9';
const OLD_MANIFEST_BYTES='3bbccab9604d600e6dd2ad2db4c29cba8239a86263a9b5546ea7a1ce6689ca14';
const OLD_RECEIPT='2def116660b15df52777805496d024d4799826da0cdee59eabddadab29e622a2';
const hash=x=>createHash('sha256').update(x).digest('hex');
const runtimeHash=x=>{const c=structuredClone(x);c.runtimeArtifact.runtimeSha256=null;return hash(JSON.stringify(c));};
const assert=(ok,msg)=>{if(!ok)throw Error(`0610 Pollution reseal: ${msg}`)};
export function reseal({baseline,manifestText,receiptText}) {
 assert(runtimeHash(baseline)===OLD_RUNTIME&&baseline.runtimeArtifact.runtimeSha256===OLD_RUNTIME,'baseline seal mismatch');
 assert(baseline.questions.length===4913&&baseline.questionCount===4913,'baseline count mismatch');
 assert(hash(manifestText)===OLD_MANIFEST_BYTES&&hash(receiptText)===OLD_RECEIPT,'immutable manifest/receipt bytes changed');
 const manifest=JSON.parse(manifestText),receipt=JSON.parse(receiptText);
 assert(hash(JSON.stringify(manifest))===OLD_MANIFEST,'manifest canonical seal mismatch');
 assert(manifest.bank===BANK&&manifest.storageState==='pending_upload'&&manifest.originalCandidateRuntimeSha256==='9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961','manifest identity mismatch');
 assert(receipt.bank===BANK&&receipt.storageState==='verified_readback'&&receipt.assetManifestSha256===OLD_MANIFEST&&receipt.failed.length===0,'receipt identity mismatch');
 assert(baseline.runtimeArtifact.assetManifestSha256===OLD_MANIFEST&&baseline.runtimeArtifact.storageReceiptSha256===OLD_RECEIPT,'baseline asset seal mismatch');
 const targets=baseline.questions.filter(q=>q.id===ID);assert(targets.length===1,'target ID missing/duplicate');
 const out=structuredClone(baseline),q=out.questions.find(q=>q.id===ID);
 assert(q.primaryTopic==='Genetic modification'&&q.primaryTopicId===null&&q.secondaryTopics.length===0&&q.subtopics.length===0,'target classification baseline mismatch');
 q.primaryTopic='Human influences on ecosystems';q.primaryTopicId='topic_20_human_influences_on_ecosystems.21.3';q.subtopics=['Pollution'];q.detailedSubtopics=['Pollution'];
 // The earlier classification provenance is historical evidence, not proof of this correction.
 // Preserve it byte-for-byte and attach the source-reviewed decision separately.
 assert(q.classificationProvenance?.sourceEvidence?.questionPaper?.sha256==='956b8decf8f9b9fce5ef61f22f546da85bf1503d9779116b27bd88227aa11c09','question paper evidence mismatch');
 assert(q.classificationProvenance?.sourceEvidence?.markScheme?.sha256==='5de6113ce0c70c60637d9ea74045704f4738fae3235215fab4aac1822e910c75','mark scheme evidence mismatch');
 out.runtimeArtifact.taxonomyRepair={baselineRuntimeSha256:OLD_RUNTIME,baselineGitCommit:BASE,targetId:ID,targetIdSha256:hash(ID),changedCount:1,classification:'Pollution',questionPaperSha256:q.classificationProvenance.sourceEvidence.questionPaper.sha256,markSchemeSha256:q.classificationProvenance.sourceEvidence.markScheme.sha256,examYearSyllabusSha256:'cbad4f7771aa7af6edeb19c7190c8b4e23d2fe2c52585ac3ae6e59a5fa8945c6'};
 out.runtimeArtifact.finalizedContentSha256=hash(JSON.stringify(out.questions));out.runtimeArtifact.runtimeSha256=null;out.runtimeArtifact.runtimeSha256=runtimeHash(out);
 assert(out.questions.filter(x=>x.id!==ID).every((x,i)=>JSON.stringify(x)===JSON.stringify(baseline.questions.filter(y=>y.id!==ID)[i])),'unrelated row mutation');
 assert(out.questions.filter(x=>x.id===ID).length===1,'target filter');
 return out;
}
async function main(){assert(process.argv[2]==='--write','explicit --write required');const root=path.resolve(import.meta.dirname,'..');const get=f=>execFileSync('git',['show',`${BASE}:${f}`],{cwd:root,maxBuffer:100_000_000});const baseline=JSON.parse(get(`src/data/production/${BANK}.json`));const [manifestText,receiptText]=await Promise.all([readFile(path.join(root,`data/storage/${BANK}.manifest.json`),'utf8'),readFile(path.join(root,`data/storage/${BANK}.receipt.json`),'utf8')]);const output=reseal({baseline,manifestText,receiptText});const privateIndex=JSON.parse(get(`src/data/private-index/${BANK}.json`));assert(privateIndex.questions.length===4913,'index count mismatch');const indexTarget=privateIndex.questions.filter(q=>q.id===ID);assert(indexTarget.length===1&&indexTarget[0].primaryTopic==='Genetic modification'&&JSON.stringify(indexTarget[0].subtopics)===JSON.stringify(['Genetic modification']),'index target baseline mismatch');indexTarget[0].primaryTopic='Human influences on ecosystems';indexTarget[0].subtopics=['Pollution'];await writeFile(path.join(root,`src/data/production/${BANK}.json`),JSON.stringify(output,null,2)+'\n');await writeFile(path.join(root,`src/data/private-index/${BANK}.json`),JSON.stringify(privateIndex)+'\n');console.log(JSON.stringify({changed:1,rows:output.questions.length,assetManifestSha256:OLD_MANIFEST,storageReceiptSha256:OLD_RECEIPT,runtimeSha256:output.runtimeArtifact.runtimeSha256,contentSha256:output.runtimeArtifact.finalizedContentSha256}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e.message);process.exitCode=1});
