// Reviewed additions to the 0606 raw bank after the frozen 1,633-row production target.
// Historical receipts (production target, consensus reconciliation, legacy filter seal,
// offline ledger, direct-source v4 bundle) stay pinned to the base bank. Node-only.
import { createHash } from "node:crypto";
import march2026 from "../../docs/igcse-0606-2026-march-addition.json" with { type: "json" };
import { stableSha256 } from "./stable-sha256.mjs";

export const ADDITIONS_0606 = Object.freeze([march2026]);
export const BASE_0606_RAW_SHA256 = march2026.base.rawSha256;
export const ADDED_0606_QUESTION_IDS = Object.freeze(ADDITIONS_0606.flatMap((addition) => addition.addedQuestionIds));
export const ADDED_0606_PAPER_IDS = Object.freeze(ADDITIONS_0606.flatMap((addition) => addition.paperIds));

const serialize = (payload) => `${JSON.stringify(payload, null, 2)}\n`;

/**
 * Split the merged raw bank into the pinned historical base and the reviewed additions.
 * Throws unless the base re-serializes to the pinned base hash and every addition is present
 * verbatim, in receipt order and at its receipt position.
 * Rows are returned as parsed JSON; callers type them.
 * @param {any} payload Parsed src/data/raw/igcse-additional.json
 * @returns {{base: any, added: any[], addedPapers: any[]}}
 */
export function split0606Raw(payload) {
  const addedIds = new Set(ADDED_0606_QUESTION_IDS);
  const addedPaperIds = new Set(ADDED_0606_PAPER_IDS);
  const base = {
    ...payload,
    papers: payload.papers.filter((/** @type {{id: string}} */ paper) => !addedPaperIds.has(paper.id)),
    questions: payload.questions.filter((/** @type {{id: string}} */ question) => !addedIds.has(question.id)),
  };
  const baseSha = createHash("sha256").update(serialize(base)).digest("hex");
  if (baseSha !== BASE_0606_RAW_SHA256) throw new Error(`0606 historical base drift: ${baseSha}`);
  const added = [];
  const addedPapers = [];
  for (const addition of ADDITIONS_0606) {
    const rows = payload.questions.filter((question) => addition.addedQuestionIds.includes(question.id));
    const papers = payload.papers.filter((paper) => addition.paperIds.includes(paper.id));
    if (JSON.stringify(rows.map((row) => row.id)) !== JSON.stringify(addition.addedQuestionIds) ||
      stableSha256(rows) !== addition.addedRowsSha256) throw new Error(`0606 addition rows drift: ${addition.addition}`);
    if (JSON.stringify(papers.map((paper) => paper.id)) !== JSON.stringify(addition.paperIds) ||
      stableSha256(papers) !== addition.addedPapersSha256) throw new Error(`0606 addition papers drift: ${addition.addition}`);
    if (payload.questions.findIndex((question) => question.id === addition.addedQuestionIds[0]) !== addition.insertion.questionStartIndex ||
      payload.papers.findIndex((paper) => paper.id === addition.paperIds[0]) !== addition.insertion.paperStartIndex) {
      throw new Error(`0606 addition position drift: ${addition.addition}`);
    }
    added.push(...rows);
    addedPapers.push(...papers);
  }
  return { base, added, addedPapers };
}
