// Reviewed additions to the 0580 raw bank after the 3,967-row (217-paper) historical bank.
// Historical receipts (section overlay v3/v4 inputs, legacy filter seal, public baseline,
// calibrated model overlay, classification-v2 release, print geometry) stay pinned to that
// base. Node-only.
//
// The raw file is written by Python (`json.dumps(indent=2, ensure_ascii=False)`), which keeps
// float spellings such as `1.0` that JSON.stringify cannot reproduce. So the byte-exact base
// proof works on the text (reconstruct0580BaseText), and the parsed split (split0580Raw) is
// pinned by a key-order-independent hash of the base.
import { createHash } from "node:crypto";
import core2026 from "../../docs/igcse-0580-2026-core-addition.json" with { type: "json" };
import { stableSha256 } from "./stable-sha256.mjs";

export const ADDITIONS_0580 = Object.freeze([core2026]);
export const BASE_0580_RAW_SHA256 = core2026.base.rawSha256;
export const ADDED_0580_QUESTION_IDS = Object.freeze(ADDITIONS_0580.flatMap((addition) => addition.addedQuestionIds));
export const ADDED_0580_PAPER_IDS = Object.freeze(ADDITIONS_0580.flatMap((addition) => addition.paperIds));
const ADDED_HEADER_KEYS = Object.freeze(ADDITIONS_0580.flatMap((addition) => addition.headerAddition ? [addition.headerAddition.key] : []));

/** Remove a contiguous block of array elements. Added rows and papers start with "id"; historical
 * Extended rows may not, so the block ends at the next element after the last added "id", which
 * must be the receipt's "before" row. */
function cutRows(text, firstId, lastId, nextId, label) {
  const begin = text.indexOf(`\n    {\n      "id": "${firstId}",\n`);
  const last = begin < 0 ? -1 : text.indexOf(`\n      "id": "${lastId}",\n`, begin);
  const end = last < 0 ? -1 : text.indexOf("\n    {\n", last);
  if (end < 0 || !text.slice(end, text.indexOf("\n    }", end + 1)).includes(`\n      "id": "${nextId}",\n`)) {
    throw new Error(`0580 addition text block not found: ${label}`);
  }
  return text.slice(0, begin) + text.slice(end);
}

/**
 * Byte-level proof: remove each addition's contiguous question block, paper block and header key
 * from the merged raw text and require the result to hash to the pinned 3,967-row base.
 * @param {string} text Merged src/data/raw/igcse.json as UTF-8 text
 * @returns {string} The historical base text
 */
export function reconstruct0580BaseText(text) {
  let base = text;
  for (const addition of ADDITIONS_0580) {
    base = cutRows(base, addition.addedQuestionIds[0], addition.addedQuestionIds.at(-1), addition.insertion.questionsBefore, `${addition.addition} questions`);
    base = cutRows(base, addition.paperIds[0], addition.paperIds.at(-1), addition.insertion.papersBefore, `${addition.addition} papers`);
    if (addition.headerAddition) {
      const begin = base.indexOf(`\n  "${addition.headerAddition.key}": `);
      const end = begin < 0 ? -1 : base.indexOf(`\n  "${addition.headerAddition.before}": `, begin);
      if (end < 0) throw new Error(`0580 addition text block not found: ${addition.addition} header`);
      base = base.slice(0, begin) + base.slice(end);
    }
  }
  const sha = createHash("sha256").update(base).digest("hex");
  if (sha !== BASE_0580_RAW_SHA256) throw new Error(`0580 historical base drift: ${sha}`);
  return base;
}

/**
 * Split the parsed merged raw bank into the pinned historical base and the reviewed additions.
 * Throws unless the base matches its pinned semantic hash and every addition is present verbatim,
 * contiguous, in receipt order and at its receipt position.
 * Rows are returned as parsed JSON; callers type them.
 * @param {any} payload Parsed src/data/raw/igcse.json
 * @returns {{base: any, added: any[], addedPapers: any[]}}
 */
export function split0580Raw(payload) {
  const addedIds = new Set(ADDED_0580_QUESTION_IDS);
  const addedPaperIds = new Set(ADDED_0580_PAPER_IDS);
  const base = Object.fromEntries(Object.entries(payload).filter(([key]) => !ADDED_HEADER_KEYS.includes(key)).map(([key, value]) => [key,
    key === "papers" ? value.filter((/** @type {{id: string}} */ paper) => !addedPaperIds.has(paper.id))
      : key === "questions" ? value.filter((/** @type {{id: string}} */ question) => !addedIds.has(question.id))
        : value]));
  const baseSha = stableSha256(base);
  if (baseSha !== core2026.base.stableSha256 || base.questions.length !== core2026.base.questionCount || base.papers.length !== core2026.base.paperCount) {
    throw new Error(`0580 historical base drift: ${baseSha}`);
  }
  const added = [];
  const addedPapers = [];
  for (const addition of ADDITIONS_0580) {
    const start = payload.questions.findIndex((/** @type {{id: string}} */ question) => question.id === addition.addedQuestionIds[0]);
    const paperStart = payload.papers.findIndex((/** @type {{id: string}} */ paper) => paper.id === addition.paperIds[0]);
    if (start !== addition.insertion.questionStartIndex || paperStart !== addition.insertion.paperStartIndex) {
      throw new Error(`0580 addition position drift: ${addition.addition}`);
    }
    const rows = payload.questions.slice(start, start + addition.addedQuestionIds.length);
    const papers = payload.papers.slice(paperStart, paperStart + addition.paperIds.length);
    if (JSON.stringify(rows.map((row) => row.id)) !== JSON.stringify(addition.addedQuestionIds) ||
      stableSha256(rows) !== addition.addedRowsSha256) throw new Error(`0580 addition rows drift: ${addition.addition}`);
    if (JSON.stringify(papers.map((paper) => paper.id)) !== JSON.stringify(addition.paperIds) ||
      stableSha256(papers) !== addition.addedPapersSha256) throw new Error(`0580 addition papers drift: ${addition.addition}`);
    if (payload.questions[start + rows.length]?.id !== addition.insertion.questionsBefore ||
      payload.papers[paperStart + papers.length]?.id !== addition.insertion.papersBefore) {
      throw new Error(`0580 addition position drift: ${addition.addition}`);
    }
    if (addition.headerAddition && stableSha256(payload[addition.headerAddition.key]) !== addition.headerAddition.valueSha256) {
      throw new Error(`0580 addition header drift: ${addition.addition}`);
    }
    added.push(...rows);
    addedPapers.push(...papers);
  }
  return { base, added, addedPapers };
}
