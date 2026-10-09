import{test,expect,vi}from'vitest';
import fs from'node:fs';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';
// Resolve tmpdir symlinks (macOS /var -> /private/var) so only fixture links trip the ancestor check.
const SCRATCH=fs.realpathSync(os.tmpdir());
const hash=b=>createHash('sha256').update(b).digest('hex');
async function preflight(file,root){
 const source=fs.readFileSync('scripts/upload-reviewed-economics-written-repairs.mjs','utf8');
 const block=source.slice(source.indexOf('for(const o of m.objects)'),source.indexOf('const receiptFile='));
 const helper=await import(/* @vite-ignore */ path.resolve('scripts/reviewed-crop-source-path.mjs')).catch(()=>({readApprovedCandidate:undefined}));
 const bytes=fs.readFileSync(file);const digest=hash(bytes);const o={localPath:file,sha256:digest,bytes:bytes.length,objectKey:`igcse-economics-0455/releases/test-v1/repairs/economics-written-v1-16ff7ea69e83d075/${digest}.webp`};
 new Function('m','fs','hash','readApprovedCandidate','cropRoot',block)({objects:[o]},fs,hash,helper.readApprovedCandidate,root);
}
test('real uploader preflight rejects a hash-matching file outside its approved crop root',async()=>{
 const dir=fs.mkdtempSync(path.join(SCRATCH,'crop-root-regression-'));try{
  const root=path.join(dir,'candidates');fs.mkdirSync(root);const unrelated=path.join(dir,'not-approved.webp');fs.writeFileSync(unrelated,'Nonsecret regression fixture');
  await expect(preflight(unrelated,root)).rejects.toThrow(/approved|root|outside/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('source reader rejects an ancestor replaced between verification and open before reading bytes',async()=>{
 const helper=await import(/* @vite-ignore */ path.resolve('scripts/reviewed-crop-source-path.mjs'));
 const dir=fs.mkdtempSync(path.join(SCRATCH,'crop-root-race-'));
 try{
  const root=path.join(dir,'candidates');const bank=path.join(root,'bank');const outside=path.join(dir,'outside');fs.mkdirSync(bank,{recursive:true});fs.mkdirSync(outside);const file=path.join(bank,'sample.webp');fs.writeFileSync(file,'Approved crop fixture');fs.writeFileSync(path.join(outside,'sample.webp'),'Unapproved nonsecret fixture');
  const nativeOpen=fs.openSync;const spy=vi.spyOn(fs,'openSync').mockImplementationOnce((file,flags)=>{fs.renameSync(bank,bank+'-old');fs.symlinkSync(outside,bank);return nativeOpen(file,flags);});
  try{expect(()=>helper.readApprovedCandidate(file,root)).toThrow(/identity|changed|symlink/);}finally{spy.mockRestore();}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('real uploader preflight accepts a regular reviewed crop inside the root',async()=>{
 const dir=fs.mkdtempSync(path.join(SCRATCH,'crop-root-good-'));try{const file=path.join(dir,'sample.webp');fs.writeFileSync(file,'Nonsecret crop fixture');await expect(preflight(file,dir)).resolves.toBeUndefined();}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('real uploader preflight rejects direct and ancestor symlinks',async()=>{
 const dir=fs.mkdtempSync(path.join(SCRATCH,'crop-root-link-'));try{const root=path.join(dir,'candidates');fs.mkdirSync(root);const target=path.join(root,'sample.webp');fs.writeFileSync(target,'Nonsecret crop fixture');const link=path.join(root,'alias.webp');fs.symlinkSync(target,link);await expect(preflight(link,root)).rejects.toThrow(/symlink/);const alias=path.join(root,'alias-dir');fs.symlinkSync(root,alias);await expect(preflight(path.join(alias,'sample.webp'),root)).rejects.toThrow(/symlink/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('real uploader preflight rejects literal traversal even when it resolves into the root',async()=>{
 const dir=fs.mkdtempSync(path.join(SCRATCH,'crop-root-traversal-'));try{const child=path.join(dir,'child');fs.mkdirSync(child);const target=path.join(dir,'sample.webp');fs.writeFileSync(target,'Nonsecret crop fixture');await expect(preflight(child+'/../sample.webp',dir)).rejects.toThrow(/approved|root|outside/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
