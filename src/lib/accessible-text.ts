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
// The closing copyright notice is fixed boilerplate, but extraction order can put question text
// before, between or after its sentences, so each sentence is removed on its own.
const COPYRIGHT_SENTENCES = [
  "Permission to reproduce items where third-party owned material protected by copyright is included has been sought and cleared where possible.",
  "Every reasonable effort has been made by the publisher (@PUBLISHER) to trace copyright holders, but if any items requiring clearance have unwittingly been included, the publisher will be pleased to make amends at the earliest possible opportunity.",
  "To avoid the issue of disclosure of answer-related information to candidates, all copyright acknowledgements are reproduced online in @BOOKLET Copyright Acknowledgements Booklet.",
  "This is produced for each series of examinations and is freely available to download at www.cambridgeinternational.org after the live examination series.",
  "Cambridge Assessment International Education is part of @GROUP.",
  "Cambridge Assessment is the brand name of the University of Cambridge Local Examinations Syndicate (UCLES), which @ITSELF is a department of the University of Cambridge.",
  "Cambridge International Education is the name of our awarding body and a part of Cambridge University Press & Assessment, which is a department of the University of Cambridge.",
].map((sentence) => new RegExp(sentence
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replace(/ /g, "\\s+")
  .replace(/-/g, "[-\u2010\u2011]")
  .replace(/ff/g, "(?:ff|\uFB00)")
  .replace("@PUBLISHER", "(?:UCLES|Cambridge\\s+University\\s+Press\\s+&\\s+Assessment)")
  .replace("@BOOKLET", "(?:the\\s+Cambridge\\s+Assessment\\s+International\\s+Education|our)")
  .replace("@GROUP", "(?:the\\s+)?Cambridge\\s+Assessment(?:\\s+Group)?")
  .replace("\\s+@ITSELF", "(?:\\s+itself)?"), "g"));
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
  let text = value.replace(CONTROL, " ");
  for (const pattern of COPYRIGHT_SENTENCES) text = text.replace(pattern, " ");
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
