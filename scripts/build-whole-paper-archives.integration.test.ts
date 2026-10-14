// @vitest-environment node
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { it, expect } from 'vitest';
import {buildWholePaperArchives,GENERATOR_VERSION} from './build-whole-paper-archives.mjs';
const root=process.cwd();
const source=process.env.WHOLE_PAPER_CHEMISTRY_SOURCE_ROOT??path.resolve('../../..','igcse-chemistry-0620-topic-practice/data/raw');
const id='0620-2023-w-42',slug='igcse-chemistry-0620';
const questionPath=path.join(source,id+'-question.pdf'),markschemePath=path.join(source,id+'-markscheme.pdf');
it.skipIf(!existsSync(questionPath)||!existsSync(markschemePath))('builds real pilot from exact deployed runtime IDs with deterministic public bytes',async()=>{
  const outputRoot=await fs.mkdtemp(path.join(process.env.TMPDIR??root,'whole-paper-real-generator-'));
  try {
    const runtimeFile=path.join(root,'src/data/production',slug+'.json');
    const runtime=JSON.parse(await fs.readFile(runtimeFile,'utf8'));
    const runtimeQuestionIds=runtime.questions.filter((q:{id:string})=>q.id.startsWith(id+'-q')).map((q:{id:string})=>q.id);
    const inventoryFile=path.join(outputRoot,'inventory.json');
    const runtimeWithoutPair=[...new Set(runtime.questions.map((q:{id:string})=>q.id.replace(/-q\d+$/,'')))].filter(p=>p!==id);
    await fs.writeFile(inventoryFile,JSON.stringify({banks:[{slug,runtimeFile,pairs:[{id,runtimePaperId:id,questionPath,markschemePath,runtimeQuestionIds}],unpaired:[],runtimeWithoutPair,notes:[]}]}));
    const options={root,outputRoot,inventoryFiles:[inventoryFile]};
    await fs.mkdir(path.join(outputRoot,'private/paper-archives'),{recursive:true});
    await fs.writeFile(path.join(outputRoot,'private/paper-archives/receipt.json'),JSON.stringify({version:'older-generator',extractorVersion:'older-extractor',banks:[]}));
    const [manifest]=await buildWholePaperArchives(options);
    expect(JSON.parse(await fs.readFile(path.join(outputRoot,'private/paper-archives/receipt.json'),'utf8')).version).toBe(GENERATOR_VERSION);
    expect(manifest.coverage).toMatchObject({paired:1,reports:1,held:0});
    expect(manifest.papers[0].summary).toMatchObject({durationMinutes:75,maxMarks:80,questionCount:6,metadataVerified:true});
    expect(manifest.papers[0].questions.map(q=>q.maxMarks)).toEqual([8,14,17,14,16,11]);
    expect(manifest.papers[0].questions.map(q=>q.id)).toEqual(runtimeQuestionIds);
    const publicFile=path.join(outputRoot,'src/data/paper-archives',slug+'.json');
    const publicBytes=await fs.readFile(publicFile,'utf8');
    expect(publicBytes).not.toMatch(/Users\/|https?:|accessibleText|sourceIdentity|markschemeTranscript|provenance/);
    const bindingsFile=path.join(outputRoot,'private/paper-archives/source-bindings.json'),receiptFile=path.join(outputRoot,'private/paper-archives/receipt.json');
    const bindingsBytes=await fs.readFile(bindingsFile,'utf8'),receiptBytes=await fs.readFile(receiptFile,'utf8');
    const bindings=JSON.parse(bindingsBytes);expect(bindings.documents).toHaveLength(2);
    for(const document of bindings.documents){const sourceRoot=bindings.roots.find((r:{id:string})=>r.id===document.rootId);expect(existsSync(path.join(sourceRoot.path,document.relativePath))).toBe(true);}
    await buildWholePaperArchives(options);
    expect(await fs.readFile(publicFile,'utf8')).toBe(publicBytes);
    expect(await fs.readFile(bindingsFile,'utf8')).toBe(bindingsBytes);
    expect(await fs.readFile(receiptFile,'utf8')).toBe(receiptBytes);
    expect((await fs.readFile(path.join(outputRoot,'private/paper-archives/progress.jsonl'),'utf8')).trim().split('\n')).toHaveLength(2);
    console.log(JSON.stringify({pilot:manifest.papers[0].summary,topics:manifest.papers[0].questions.map(q=>q.topics),runtimeSha256:manifest.runtimeSha256}));
  }finally{await fs.rm(outputRoot,{recursive:true,force:true});}
},60000);
