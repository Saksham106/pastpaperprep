// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('publishSet never replaces conflicts and requires exact readback before availability', async () => {
 const { publishSet } = await import('./publish-set.mjs');
 const objects=new Map([['explanations/ib-hl/q.json','old']]);
 let writes=0;const receipts=[];
 const store={putIfAbsent:async(key,body)=>{if(objects.has(key)){const e=new Error('exists');e.name='PreconditionFailed';throw e;}writes++;objects.set(key,body);},get:async key=>objects.get(key)};
 const expected=[{key:'explanations/ib-hl/q.json',body:'new'}];
 await assert.rejects(publishSet(expected,store,{apply:true,receipt:r=>receipts.push(structuredClone(r))}),/read-back|conflict/i);
 assert.equal(objects.get(expected[0].key),'old');assert.equal(writes,0);
 assert.equal(receipts.at(-1).complete,false);
 const good=[{key:'explanations/ib-hl/new.json',body:'new'}];
 const result=await publishSet(good,store,{apply:true,receipt:r=>receipts.push(structuredClone(r))});
 assert.deepEqual(result,good.map(x=>x.key));assert.equal(receipts.at(-1).complete,true);
 assert.equal(receipts.at(-1).expected.length,1);assert.equal(receipts.at(-1).expected[0].sha256.length,64);
});
test('read-back failure holds a successful subset and persists incomplete evidence', async () => {
 const { publishSet } = await import('./publish-set.mjs');
 const receipts=[];let puts=0;
 const store={putIfAbsent:async()=>{puts++;},get:async key=>{if(key.endsWith('bad.json'))throw new Error('missing');return 'ok';}};
 await assert.rejects(publishSet([{key:'good.json',body:'ok'},{key:'bad.json',body:'ok'}],store,{apply:true,receipt:r=>receipts.push(structuredClone(r))}),/availability unchanged/);
 assert.equal(puts,2);assert.deepEqual(receipts.at(-1).verified,['good.json']);assert.equal(receipts.at(-1).failed[0].key,'bad.json');assert.equal(receipts.at(-1).complete,false);
});

test('local reader rejects traversal and a symlinked explanation file', async () => {
 const { loadLocalPath } = await import('./local-files.mjs');
 const dir=mkdtempSync(join(realpathSync(tmpdir()),'explanation-path-'));
 mkdirSync(join(dir,'root'));writeFileSync(join(dir,'outside.json'),'{}');
 symlinkSync(join(dir,'outside.json'),join(dir,'root/link.json'));
 assert.throws(()=>loadLocalPath(join(dir,'root'),join(dir,'outside.json')),/Unsafe/);
 assert.throws(()=>loadLocalPath(join(dir,'root'),join(dir,'root/link.json')),/symlink/);
});

const script = join(import.meta.dirname, 'publish.mjs');

function replayFixture(entries, previous, { singleBank = false, expectStatus = 0 } = {}) {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-provenance-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1';
 writeFileSync(join(dir,id+'.json'),'{}');
 if(previous) writeFileSync(join(dir,'_ledger.json'),JSON.stringify(previous));
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-hl',tasks:[{bank:'ib-hl',questionId:id}]}));
 const journal=join(projects,'journal.jsonl');writeFileSync(journal,entries.map(JSON.stringify).join('\n'));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-hl','--manifest',manifest,...(singleBank?['--single-bank-journal']:[]),journal],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,expectStatus,run.stderr);
 if(expectStatus!==0) return {run};
 return {projects,dir,id,ledger:JSON.parse(readFileSync(join(dir,'_ledger.json')))};
}
function outcome(label, bank) {
 return [{type:'started',agentId:'a',label},{type:'result',agentId:'a',result:{results:[{questionId:'2025-may-tz1-p1-q1',...(bank===undefined?{}:{bank}),verdict:'pass',issues:[]}]}}];
}
test('ambiguous or conflicting bank evidence cannot settle a row', () => {
 for(const [label,bank] of [['verify-q',undefined],['verify unknown v0',undefined],['verify ib-ai-sl v0','ib-hl'],['verify ib-hl v0','ib-ai-sl'],['verify-q','unknown']]) {
  const {ledger}=replayFixture(outcome(label,bank));
  assert.equal(ledger.rows[0].status,'needs-verify',`${label}/${bank}`);
 }
});
test('legacy passes are not inherited without scoped rematerialization', () => {
 const id='2025-may-tz1-p1-q1';
 const {ledger}=replayFixture([], {bank:'ib-hl',rows:[{questionId:id,status:'pass'}]});
 assert.equal(ledger.rows[0].status,'needs-verify');
});
test('publisher refuses legacy passes and header-only upgrades before reading content', () => {
 const {projects,dir,id}=replayFixture([]);
 const doc={schemaVersion:1,bank:'ib-hl',questionId:id,totalMarks:5,parts:[{label:'',marks:5,approach:'Test',answer:'Test',steps:[{text:'Test',marks:[]}]}]};
 writeFileSync(join(dir,id+'.json'),JSON.stringify(doc));
 for(const header of [{},{bankEvidenceVersion:1}]) {
  writeFileSync(join(dir,'_ledger.json'),JSON.stringify({bank:'ib-hl',...header,rows:[{questionId:id,status:'pass'}]}));
  const run=spawnSync(process.execPath,[script,'--bank','ib-hl'],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/0 publishable, 1 held back/);
  assert.match(run.stdout,/bank-scoped replay required/);
 }
});

test('scoped replay explicitly rematerializes legacy rows and remains publishable', () => {
 const id='2025-may-tz1-p1-q1';
 const {projects,dir,ledger}=replayFixture(outcome('verify ib-hl v0'),{bank:'ib-hl',rows:[{questionId:id,status:'pass'}]});
 assert.equal(ledger.bankEvidenceVersion,1);assert.equal(ledger.rows[0].bankEvidenceVersion,1);assert.equal(ledger.rows[0].bank,'ib-hl');
 assert.equal(replayFixture([],ledger).ledger.rows[0].status,'pass');
 writeFileSync(join(dir,id+'.json'),JSON.stringify({schemaVersion:1,bank:'ib-hl',questionId:id,totalMarks:5,parts:[{label:'',marks:5,approach:'Test',answer:'Test',steps:[{text:'Test',marks:[]}]}]}));
 const run=spawnSync(process.execPath,[script,'--bank','ib-hl'],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/1 publishable, 0 held back/);
});
test('subset replay never upgrades unproven rows outside its manifest', () => {
 const other='2025-may-tz1-p1-q2';
 for(const header of [{},{bankEvidenceVersion:1}]) {
  const {ledger}=replayFixture(outcome('verify ib-hl v0'),{bank:'ib-hl',...header,rows:[{questionId:other,status:'pass',...(header.bankEvidenceVersion?{}:{bank:'ib-hl',bankEvidenceVersion:1})}]});
  assert.equal(ledger.rows.find(r=>r.questionId===other).bankEvidenceVersion,undefined);
 }
});
test('unbanked repair and recheck cannot replace a scoped failure', () => {
 const id='2025-may-tz1-p1-q1';
 const entries=[{type:'started',agentId:'v',label:'verify ib-hl v0'},{type:'result',agentId:'v',result:{results:[{questionId:id,verdict:'fail',issues:[]}]}}];
 for(const label of ['fix-q','re-verify-q']) {
  const result={questionId:id,verdict:'pass',issues:[],fixed:true,validatorPassed:true};
  const {ledger}=replayFixture([...entries,{type:'started',agentId:'x',label},{type:'result',agentId:'x',result:{results:[result]}}]);
  assert.equal(ledger.rows[0].status,'needs-fix');
 }
});

test('explicit row bank or matching label bank remains legitimate evidence', () => {
 for(const [label,bank] of [['verify-q','ib-hl'],['verify ib-hl v0',undefined],['verify ib-hl v0','ib-hl']]) {
  assert.equal(replayFixture(outcome(label,bank)).ledger.rows[0].status,'pass');
 }
});

test('latest failed review supersedes previous ledger pass', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-ledger-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1';
 writeFileSync(join(dir,'_ledger.json'),JSON.stringify({bank:'ib-hl',rows:[{questionId:id,status:'pass'}]}));
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-hl',tasks:[{bank:'ib-hl',questionId:id}]}));
 const journal=join(projects,'journal.jsonl');
 writeFileSync(journal,[{type:'started',agentId:'a',label:'verify ib-hl v0'},{type:'result',agentId:'a',result:{results:[{questionId:id,verdict:'fail',issues:[{severity:'critical',part:'a',problem:'wrong'}]}]}}].map(JSON.stringify).join('\n'));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-hl','--manifest',manifest,journal],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(readFileSync(join(dir,'_ledger.json'))).rows[0].status,'needs-fix');
});
test('later failed verification cannot be hidden by an older passing recheck', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-ledger-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1';
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-hl',tasks:[{bank:'ib-hl',questionId:id}]}));
 const journal=join(projects,'journal.jsonl');
 writeFileSync(journal,[{type:'started',agentId:'old',label:'re-verify ib-hl v0'},{type:'result',agentId:'old',result:{results:[{questionId:id,verdict:'pass',issues:[]}]}},{type:'started',agentId:'new',label:'verify ib-hl v0'},{type:'result',agentId:'new',result:{results:[{questionId:id,verdict:'fail',issues:[{severity:'critical',part:'a',problem:'wrong'}]}]}}].map(JSON.stringify).join('\n'));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-hl','--manifest',manifest,journal],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(readFileSync(join(dir,'_ledger.json'))).rows[0].status,'needs-fix');
});

test('journal outcomes from another bank cannot settle a shared question ID', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-ledger-'));
 const dir=join(projects,'research/explanations/ib-ai-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1';
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-ai-hl',tasks:[{bank:'ib-ai-hl',questionId:id}]}));
 const journal=join(projects,'journal.jsonl');
 writeFileSync(journal,[{type:'started',agentId:'hl',label:'verify ib-ai-hl v0'},{type:'result',agentId:'hl',result:{results:[{questionId:id,verdict:'fail',issues:[{severity:'critical',part:'a',problem:'wrong'}]}]}},{type:'started',agentId:'sl',label:'verify ib-ai-sl v0'},{type:'result',agentId:'sl',result:{results:[{questionId:id,verdict:'pass',issues:[]}]}}].map(JSON.stringify).join('\n'));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-ai-hl','--manifest',manifest,journal],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(readFileSync(join(dir,'_ledger.json'))).rows[0].status,'needs-fix');
});

test('a claimed minor repair whose validator failed is held for review', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-ledger-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1';
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-hl',tasks:[{bank:'ib-hl',questionId:id}]}));
 const journal=join(projects,'journal.jsonl');
 writeFileSync(journal,[{type:'started',agentId:'v',label:'verify ib-hl v0'},{type:'result',agentId:'v',result:{results:[{questionId:id,verdict:'fix',issues:[{severity:'minor',part:'a',problem:'typo'}]}]}},{type:'started',agentId:'f',label:'fix ib-hl f0'},{type:'result',agentId:'f',result:{results:[{questionId:id,fixed:true,validatorPassed:false}]}}].map(JSON.stringify).join('\n'));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-hl','--manifest',manifest,journal],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(readFileSync(join(dir,'_ledger.json'))).rows[0].status,'review');
});

test('a subset manifest does not discard previously verified bank rows', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-ledger-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1',other='2025-may-tz1-p1-q2';
 writeFileSync(join(dir,'_ledger.json'),JSON.stringify({bank:'ib-hl',bankEvidenceVersion:1,rows:[{questionId:other,status:'pass',bank:'ib-hl',bankEvidenceVersion:1}]}));
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-hl',tasks:[{bank:'ib-hl',questionId:id}]}));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-hl','--manifest',manifest],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(readFileSync(join(dir,'_ledger.json'))).rows.find(r=>r.questionId===other)?.status,'pass');
});

test('ledger refuses a foreign-bank manifest before writing', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-ledger-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const manifest=join(projects,'manifest.json');writeFileSync(manifest,JSON.stringify({bank:'ib-ai-sl',tasks:[{bank:'ib-ai-sl',questionId:'2025-may-tz1-p1-q1'}]}));
 const run=spawnSync(process.execPath,[join(import.meta.dirname,'ledger-from-journal.mjs'),'--bank','ib-hl','--manifest',manifest],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.notEqual(run.status,0);assert.match(run.stderr,/bank|manifest/i);
 assert.equal(existsSync(join(dir,'_ledger.json')),false);
});

test('publisher holds structurally valid files with wrong runtime marks', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-marks-'));
 const dir=join(projects,'research/explanations/ib-hl');mkdirSync(dir,{recursive:true});
 const id='2025-may-tz1-p1-q1';
 writeFileSync(join(dir,'_ledger.json'),JSON.stringify({bank:'ib-hl',bankEvidenceVersion:1,rows:[{questionId:id,status:'pass',bank:'ib-hl',bankEvidenceVersion:1}]}));
 writeFileSync(join(dir,id+'.json'),JSON.stringify({schemaVersion:1,bank:'ib-hl',questionId:id,totalMarks:999,parts:[{label:'',marks:999,approach:'Test',answer:'Test',steps:[{text:'Test',marks:[]}]}]}));
 const run=spawnSync(process.execPath,[script,'--bank','ib-hl'],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/0 publishable, 1 held back/);
});

test('publisher rejects a symlinked bank directory before reading private content', () => {
 const projects=mkdtempSync(join(realpathSync(tmpdir()),'explanation-test-'));
 mkdirSync(join(projects,'research/explanations'),{recursive:true});
 const outside=join(projects,'outside');mkdirSync(outside);
 writeFileSync(join(outside,'_ledger.json'),JSON.stringify({bank:'ib-hl',rows:[]}));
 symlinkSync(outside,join(projects,'research/explanations/ib-hl'));
 const run=spawnSync(process.execPath,[script,'--bank','ib-hl'],{encoding:'utf8',env:{...process.env,PPP_PROJECTS_ROOT:projects}});
 assert.notEqual(run.status,0,'must not trust a symlinked ancestor');
 assert.match(run.stderr,/symlink|canonical|Unsafe/i);
});

test('a declared single-bank journal settles its unlabelled results for that bank only', () => {
 const {ledger}=replayFixture(outcome('verify g3',undefined), undefined, {singleBank:true});
 assert.equal(ledger.rows[0].status,'pass');
 assert.equal(ledger.rows[0].bankEvidenceVersion,1);
 // The same unlabelled journal without the declaration is still not evidence.
 assert.equal(replayFixture(outcome('verify g3',undefined)).ledger.rows[0].status,'needs-verify');
});
test('a single-bank declaration is refused when the journal names another bank or its questions', () => {
 const {run}=replayFixture(outcome('verify ib-ai-sl v0',undefined), undefined, {singleBank:true,expectStatus:1});
 assert.match(run.stderr,/not single-bank/);
 const foreign=[{type:'started',agentId:'a',label:'verify g1'},{type:'result',agentId:'a',result:{results:[{questionId:'other-bank-q9',verdict:'pass',issues:[]}]}}];
 assert.match(replayFixture(foreign, undefined, {singleBank:true,expectStatus:1}).run.stderr,/not in ib-hl/);
});
test('--replace only accepts named IDs that are publishable now', () => {
 const {projects,dir,id}=replayFixture([]);
 const doc={schemaVersion:1,bank:'ib-hl',questionId:id,totalMarks:5,parts:[{label:'',marks:5,approach:'Test',answer:'Test',steps:[{text:'Test',marks:[]}]}]};
 writeFileSync(join(dir,id+'.json'),JSON.stringify(doc));
 const publish=(status, args)=>{
  writeFileSync(join(dir,'_ledger.json'),JSON.stringify({bank:'ib-hl',bankEvidenceVersion:1,rows:[{questionId:id,status,bank:'ib-hl',bankEvidenceVersion:1}]}));
  const env={...process.env,PPP_PROJECTS_ROOT:projects};
  for(const key of ['R2_ACCOUNT_ID','R2_SYNC_ACCESS_KEY_ID','R2_SYNC_SECRET_ACCESS_KEY']) delete env[key];
  return spawnSync(process.execPath,[script,'--bank','ib-hl',...args],{encoding:'utf8',env});
 };
 assert.match(publish('review',['--apply','--replace',id]).stderr,/not publishable/);
 assert.match(publish('pass-after-fix',['--replace',id]).stderr,/--replace needs --apply/);
 assert.match(publish('pass-after-fix',['--apply','--replace','unknown-id']).stderr,/not publishable/);
 // A correction passes the guard and only then needs storage credentials.
 const allowed=publish('pass-after-minor-fix',['--apply','--replace',id]);
 assert.doesNotMatch(allowed.stderr,/not publishable/);
 assert.match(allowed.stderr,/R2_ACCOUNT_ID/);
});
test('validate.mjs infers the expected bank and question from a file\'s location', () => {
 const root=mkdtempSync(join(realpathSync(tmpdir()),'explanation-validate-'));
 const dir=join(root,'ib-physics-hl');mkdirSync(dir);
 const id='2025-may-tz1-hl-p1a-q1';
 const doc={schemaVersion:1,bank:'ib-hl',questionId:id,totalMarks:1,parts:[{label:'',marks:1,approach:'Test',answer:'Test',steps:[{text:'Test',marks:['A1']}]}]};
 writeFileSync(join(dir,id+'.json'),JSON.stringify(doc));
 const run=()=>spawnSync(process.execPath,[join(import.meta.dirname,'validate.mjs'),join(dir,id+'.json')],{encoding:'utf8'});
 assert.match(run().stdout,/bank ib-hl != ib-physics-hl/);
 writeFileSync(join(dir,id+'.json'),JSON.stringify({...doc,bank:'ib-physics-hl'}));
 assert.match(run().stdout,/"failed":0/);
});
test('next.mjs plans near-shippable work first and stays within the agent budget', async () => {
 const { planJobs } = await import('./next.mjs');
 const plans=[{bank:'a',plan:{generate:[[1],[2],[3]],verify:[[4]],fix:[[5]]}},{bank:'b',plan:{generate:[[6]],verify:[[7],[8]],fix:[]}}];
 const all=planJobs(plans,100);
 assert.deepEqual(Object.fromEntries(all.counts),{a:{generate:3,verify:1,fix:1},b:{generate:1,verify:2,fix:0}});
 const tight=planJobs(plans,7);
 assert.deepEqual(Object.fromEntries(tight.counts),{a:{generate:0,verify:1,fix:1},b:{generate:0,verify:2,fix:0}});
 assert.ok(tight.spent<=7);
});
