// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
it('serves the exact installed PDF.js ESM API and matching worker outside the application bundler',()=>{
  for(const [asset,source] of [['public/pdfjs/pdf.min.mjs','node_modules/pdfjs-dist/build/pdf.min.mjs'],['public/pdfjs/pdf.worker.min.mjs','node_modules/pdfjs-dist/build/pdf.worker.min.mjs']]){
    expect(existsSync(asset)).toBe(true);
    const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
    expect(hash(asset)).toBe(hash(source));
  }
  const loader=existsSync('src/lib/paper-pdf-library.ts')?readFileSync('src/lib/paper-pdf-library.ts','utf8'):'';
  expect(loader).toContain('webpackIgnore: true');
  expect(loader).toContain('/pdfjs/pdf.min.mjs');
  expect(readFileSync('src/components/PastPaperReader.tsx','utf8')).toContain('await loadPaperPdfLibrary()');
});
