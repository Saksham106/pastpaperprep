// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('whole-paper build boundary',()=>{
 it('routes Chemistry through the same manifest and activation gate as the other eighteen banks',()=>{
  for(const file of ['page.tsx','[paperId]/page.tsx','[paperId]/document/route.ts']) expect(existsSync(`src/app/past-papers/igcse-chemistry-0620/${file}`)).toBe(false);
  expect(existsSync('src/app/past-papers/[slug]/[entry]/document/route.ts')).toBe(true);
  expect(existsSync('src/app/past-papers/[bankSlug]')).toBe(false);
 });
 it('bundles approved compact manifests and the committed public readback receipt but excludes local originals and source bindings',()=>{
  const config=readFileSync('next.config.ts','utf8');
  expect(config).toContain('"/past-papers/**"');
  expect(config).toContain('./src/data/paper-archives/*.json');
  expect(config).toContain('./src/data/paper-archive-readback.json');
  expect(config).not.toContain('verified-readback.json');
  expect(config).toContain('outputFileTracingExcludes');
  expect(config).toContain('./private/paper-archives/source-bindings.json');
  expect(config).toContain('./private/paper-archives/checkpoints/**');
 });
});
