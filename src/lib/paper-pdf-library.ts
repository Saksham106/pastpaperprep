/** Load the upstream ESM unchanged: re-bundling its internal Webpack runtime breaks exports.
 * public/pdfjs holds the legacy build, which polyfills Promise.try and friends for Safari < 18.2. */
export async function loadPaperPdfLibrary(): Promise<typeof import('pdfjs-dist')> {
  const url = '/pdfjs/pdf.min.mjs';
  return import(/* webpackIgnore: true */ url);
}
