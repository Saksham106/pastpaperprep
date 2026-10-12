// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('whole-paper build boundary',()=>{
 it('bundles approved compact manifests and verified remote receipt but excludes local originals and source bindings',()=>{
  const config=readFileSync('next.config.ts','utf8');
  expect(config).toContain('"/past-papers/**"');
  expect(config).toContain('./src/data/paper-archives/*.json');
  expect(config).toContain('./private/paper-archives/verified-readback.json');
  expect(config).toContain('outputFileTracingExcludes');
  expect(config).toContain('./private/paper-archives/source-bindings.json');
  expect(config).toContain('./private/paper-archives/checkpoints/**');
 });
});
