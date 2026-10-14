/**
 * Removes exam-paper furniture from extracted question text before it is read aloud or searched:
 * control characters, barcode glyph runs, page footers and margin labels, the closing copyright
 * notice, and long dotted answer lines. Question wording, symbols and numbers are left as printed.
 */
// A run of control characters, with the commas the extractor puts on either side of barcode text.
const CONTROL = /,?(?:[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F][^\S\n]*)+,?/g;
// Barcode fonts extract as unbroken runs of Latin-1/Latin Extended letters, e.g. "ĬÍĊ¾Ġ´íÈõÏĪÅ".
const BARCODE_RUN = /[\u00A1-\u024F]{6,}/g; // no ASCII, no spaces: a run never reaches into real words
const LATIN_EXTENDED = /[\u0100-\u024F]/g;
const COPYRIGHT_NOTICE = /Permission to reproduce items where third-party owned material[\s\S]*$/;
const FURNITURE = [
  /©\s*UCLES\s*\d{4}/g,
  /©\s*Cambridge University Press\s*&\s*Assessment\s*\d{4}/g,
  /\b\d{4}\/\d{2}\/[A-Z](?:\/[A-Z])?\/\d{2}\b/g, // footer paper code, e.g. 0610/12/F/M/25
  /\[\s*Turn over\s*\]?/g,
  /DO NOT WRITE IN THIS MARGIN/g,
  /BLANK PAGE/g,
];
const DOTTED_LINE = /\.{4,}/g;

export function cleanAccessibleText(value: string): string {
  let text = value.replace(CONTROL, " ").replace(COPYRIGHT_NOTICE, " ");
  text = text.replace(BARCODE_RUN, (run) => ((run.match(LATIN_EXTENDED)?.length ?? 0) >= 3 ? " " : run));
  for (const pattern of FURNITURE) text = text.replace(pattern, " ");
  text = text.replace(DOTTED_LINE, " … ");
  // Keep line and paragraph breaks; tidy spaces within each line.
  return text.split("\n").map((line) => {
    const indent = /^[^\S\n]*/.exec(line)![0];
    const body = line.replace(/[^\S\n]+/g, " ").replace(/(?:\s*…)+\s*(?=…)/g, "").trim();
    return body ? indent + body : "";
  })
    .join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
}
