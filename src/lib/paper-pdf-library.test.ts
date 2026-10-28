// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
it('serves the installed PDF.js legacy build (polyfilled for Safari < 18.2) and matching worker outside the application bundler',()=>{
  for(const [asset,source] of [['public/pdfjs/pdf.min.mjs','node_modules/pdfjs-dist/legacy/build/pdf.min.mjs'],['public/pdfjs/pdf.worker.min.mjs','node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs']]){
    expect(existsSync(asset)).toBe(true);
    const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
    expect(hash(asset)).toBe(hash(source));
  }
  const loader=existsSync('src/lib/paper-pdf-library.ts')?readFileSync('src/lib/paper-pdf-library.ts','utf8'):'';
  expect(loader).toContain('webpackIgnore: true');
  expect(loader).toContain('/pdfjs/pdf.min.mjs');
  expect(readFileSync('src/components/PastPaperReader.tsx','utf8')).toContain('await loadPaperPdfLibrary()');
  expect(readFileSync('src/components/ExamStylePdfViewer.tsx','utf8')).toContain('await loadPaperPdfLibrary()');
});
