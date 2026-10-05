import { test, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { canonical, parseSitemap, diffSitemaps, fingerprint, run, SITE } from './indexnow.mjs';
const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc></url><url><loc>${SITE}/articles/test</loc><lastmod>2026-10-05</lastmod></url></urlset>`;
test('canonical policy excludes private, queries, foreign hosts and drafts', () => {
 for (const p of ['/api/test','/account','/articles/draft-test','/articles/test?x=1','/articles/test/','/banks/ib-hl?free=1']) expect(canonical(SITE+p)).toBeNull();
 expect(canonical('https://evil.com/')).toBeNull(); expect(canonical(SITE+'/banks/ib-hl/topics/calculus')).toBeTruthy();
});
test('XML parser validates namespaces, structure and canonical homepage', () => {
 expect(Object.keys(parseSitemap(xml))).toHaveLength(2);
 expect(()=>parseSitemap('<urlset>bad')).toThrow();
 expect(()=>parseSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>')).toThrow();
});
test('diff includes additions, content changes and removed public URLs only', () => {
 expect(diffSitemaps({[SITE+'/']: 'old',[SITE+'/articles/old']: ''}, {[SITE+'/']: 'new'})).toEqual({changed:[SITE+'/'],deleted:[SITE+'/articles/old']});
 expect(fingerprint('<title>A</title><main>Hello<script>build1</script></main>')).toBe(fingerprint('<title>A</title><main>Hello<script>build2</script></main>'));
 expect(fingerprint('<main>New</main>')).not.toBe(fingerprint('<main>Old</main>'));
});
for (const status of [200,202,403]) test(`submission ${status}, baseline/no-change and retry semantics`, async()=>{
 const dir=await mkdtemp(join(process.env.TMPDIR || '.', 'indexnow-test-')); const state=join(dir,'state.json'),log=join(dir,'log.jsonl'),keyPath=join(dir,'key.txt');
 await writeFile(keyPath,'12345678abcdef'); let posts=0,changed=false;
 const fetcher=async(url,opts)=>{
  if(opts?.method==='POST'){posts++;return new Response('',{status});}
  return new Response(url.endsWith('sitemap.xml')?xml:url.endsWith('key.txt')?'12345678abcdef':`<title>Test</title><main>${changed?'New':'Old'}</main>`,{status:200});
 };
 try {
  await run({state,log,keyPath,fetcher,submit:true}); expect(posts).toBe(0);
  await run({state,log,keyPath,fetcher,submit:true}); expect(posts).toBe(0);
  const before=await readFile(state,'utf8');changed=true;
  if(status===403){await expect(run({state,log,keyPath,fetcher,submit:true})).rejects.toThrow('baseline preserved');expect(await readFile(state,'utf8')).toBe(before);}
  else {expect((await run({state,log,keyPath,fetcher,submit:true})).status).toBe(status);expect(await readFile(state,'utf8')).not.toBe(before);}
  expect(posts).toBe(1);
  await expect(run({state,log,keyPath,fetcher,explicit:[SITE+'/articles/not-live']})).rejects.toThrow('absent');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('a mismatched deployed key prevents POST', async()=>{
 const dir=await mkdtemp(join(process.env.TMPDIR||'.','indexnow-key-'));const keyPath=join(dir,'key.txt');await writeFile(keyPath,'12345678abcdef');let posts=0;
 const fetcher=async(url,o)=>{if(o?.method==='POST')posts++;return new Response(url.endsWith('sitemap.xml')?xml:url.endsWith('key.txt')?'wrong-key':'<main>Test</main>');};
 try{await expect(run({state:join(dir,'state'),log:join(dir,'log'),keyPath,fetcher,submit:true,explicit:[SITE+'/']})).rejects.toThrow('verification');expect(posts).toBe(0);}finally{await rm(dir,{recursive:true,force:true});}
});
