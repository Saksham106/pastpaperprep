// Explanation twins: a question printed identically in two papers (IB Computer Science HL and SL, or two time zones)
// is written and checked once. The publisher serves the canonical explanation for each twin, with only the bank and
// question ID changed. Twin groups come from research/ib-cs-twins/build_twins.py: same session, question text and
// mark-scheme text (read from the source PDFs, ignoring the question number), printed marks and mark points.
//
// <research>/<bank>/_twins.json:
//   { schema: "explanation-twins-v1", bank, twins: { <questionId>: { sourceBank, sourceId, marks, ... } } }
//
// Everything here fails closed: a twin is published only when its canonical is publishable in its own bank's ledger,
// and both runtime questions still carry the same normalized text and marks. A twin with its own ledger row publishes
// from that row instead.

/**
 * Case-sensitive tokens, matching build_twins.py's norm: each run of letters/digits and every other non-space character
 * (operators, quotes, brackets, punctuation) is a token. Only spacing, dot leaders and the leading question number are
 * ignored, so `6 + 2` vs `6 - 2`, `<` vs `<=` and `"a"` vs `"A"` differ. Symbol-font glyphs (U+F020-F07E) read as the
 * character they print.
 */
export function normalizedQuestionText(text) {
  const stripped = String(text ?? "")
    .replace(/[\uf020-\uf07e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xf000))
    .replace(/\.{3,}|…+/g, " ")
    .replace(/^\s*\(?\d{1,2}[.)]\s*/, "");
  return (stripped.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) ?? []).join(" ");
}

/**
 * @param {object} input
 * @param {string} input.bank                    the bank being published
 * @param {object|null} input.twins              parsed _twins.json for that bank, or null
 * @param {Set<string>} input.ownRows            question IDs that have a ledger row in this bank
 * @param {(bank: string, id: string) => {status: string, doc: object}|null} input.source   canonical lookup: its
 *                                               publishable ledger status and validated document, or null
 * @param {(bank: string, id: string) => {text: string, marks: number}|null} input.runtime  runtime question lookup
 * @returns {{ resolved: Array<{id: string, doc: object, status: string}>, skipped: string[] }}
 */
export function resolveTwins({ bank, twins, ownRows, source, runtime }) {
  const resolved = [], skipped = [];
  if (!twins) return { resolved, skipped };
  if (twins.schema !== "explanation-twins-v1" || twins.bank !== bank || !twins.twins || typeof twins.twins !== "object") {
    throw new Error(`Invalid twins file for ${bank}`);
  }
  for (const [id, entry] of Object.entries(twins.twins)) {
    // A twin checked in its own right publishes from its own ledger row; the twin entry is then redundant, not held.
    if (ownRows.has(id)) continue;
    if (!entry || typeof entry.sourceBank !== "string" || typeof entry.sourceId !== "string" || (entry.sourceBank === bank && entry.sourceId === id)) {
      skipped.push(`${id}: malformed twin entry`); continue;
    }
    const mine = runtime(bank, id), theirs = runtime(entry.sourceBank, entry.sourceId);
    if (!mine || !theirs) { skipped.push(`${id}: twin or canonical is not a runtime question`); continue; }
    if (mine.marks !== theirs.marks || mine.marks !== entry.marks) { skipped.push(`${id}: marks differ from canonical`); continue; }
    if (!normalizedQuestionText(mine.text) || normalizedQuestionText(mine.text) !== normalizedQuestionText(theirs.text)) {
      skipped.push(`${id}: question text differs from canonical`); continue;
    }
    const canonical = source(entry.sourceBank, entry.sourceId);
    if (!canonical) { skipped.push(`${id}: canonical ${entry.sourceBank}:${entry.sourceId} not publishable`); continue; }
    if (canonical.doc.totalMarks !== mine.marks) { skipped.push(`${id}: canonical explanation marks differ`); continue; }
    resolved.push({ id, doc: { ...canonical.doc, bank, questionId: id }, status: `twin:${canonical.status}` });
  }
  return { resolved, skipped };
}
