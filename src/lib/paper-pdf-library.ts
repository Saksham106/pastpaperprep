/** Load the upstream ESM unchanged: re-bundling its internal Webpack runtime breaks exports. */
export async function loadPaperPdfLibrary(): Promise<typeof import('pdfjs-dist')> {
  const url = '/pdfjs/pdf.min.mjs';
  return import(/* webpackIgnore: true */ url);
}
