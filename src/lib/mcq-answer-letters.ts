import reviewedLetters from "@/data/reviewed-mcq-answer-letters.json";
import { bankRuntimeCacheKey } from "@/lib/bank-runtime-key";
import type { BankSlug } from "@/lib/banks";
import { isMcqAnswer, MCQ_ANSWER_LETTERS, type McqAnswer, type McqLetter } from "@/lib/mcq-answer";
import { loadBankRawQuestions } from "@/lib/question-loader";

// Server-only. Letters reach a reader only on an authorized answer asset: the asset manifest
// (sign and free routes, static free index) and the PDF signer. Never copy them onto
// UnifiedQuestion or the public bank index.

type RawQuestion = Record<string, unknown>;

/**
 * Banks with multiple-choice papers, and the components that hold them. A row is MCQ only when
 * its own data says so: a one-mark question on one of these components (IGCSE sciences papers
 * 1–2, 0455 Paper 1, IB sciences Paper 1/1A). IB Paper 1B, IB Paper 3 one-markers, 0606 and
 * every maths or IB Economics paper never qualify.
 */
const MCQ_COMPONENTS: Partial<Record<BankSlug, (component: string) => boolean>> = {
  "igcse-biology-0610": (component) => /^[12]\d$/.test(component),
  "igcse-chemistry-0620": (component) => /^[12]\d$/.test(component),
  "igcse-physics-0625": (component) => /^[12]\d$/.test(component),
  "igcse-coordinated-sciences-0654": (component) => /^[12]\d$/.test(component),
  "igcse-economics-0455": (component) => component === "P1",
  "ib-biology-hl": (component) => component === "P1" || component === "P1A",
  "ib-biology-sl": (component) => component === "P1" || component === "P1A",
  "ib-chemistry-hl": (component) => component === "P1" || component === "P1A",
  "ib-chemistry-sl": (component) => component === "P1" || component === "P1A",
  "ib-physics-hl": (component) => component === "P1" || component === "P1A",
  "ib-physics-sl": (component) => component === "P1" || component === "P1A",
};

export const MCQ_ANSWER_BANKS = Object.keys(MCQ_COMPONENTS) as BankSlug[];

export function isMcqAnswerBank(bank: string): bank is BankSlug {
  return Object.hasOwn(MCQ_COMPONENTS, bank);
}

export function isMcqRow(bank: BankSlug, raw: RawQuestion): boolean {
  const component = MCQ_COMPONENTS[bank];
  return Boolean(component) && raw.marks === 1 && typeof raw.component === "string" && component!(raw.component);
}

/** The source's own letter, trusted only with official provenance for that same question. */
export function productionMcqAnswer(raw: RawQuestion): McqAnswer | null {
  const provenance = raw.answerProvenance as Record<string, unknown> | null | undefined;
  if (typeof raw.answer !== "string" || !(MCQ_ANSWER_LETTERS as readonly string[]).includes(raw.answer)) return null;
  if (!provenance || typeof provenance !== "object" || provenance.status !== "official" || provenance.questionId !== raw.id) return null;
  return { answers: [raw.answer as McqLetter], note: null };
}

export type ReviewedMcqAnswerLetters = {
  version: 1;
  banks: Partial<Record<BankSlug, Readonly<Record<string, McqAnswer>>>>;
};

/** Strict: a malformed file throws, so a build never ships letters it could not check. */
export function parseReviewedMcqAnswerLetters(value: unknown): ReviewedMcqAnswerLetters {
  const fail = (reason: string): never => { throw new Error(`Reviewed MCQ answer letters are invalid: ${reason}`); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("not an object");
  const file = value as Record<string, unknown>;
  if (Object.keys(file).some((key) => key !== "version" && key !== "banks")) fail("unexpected top-level key");
  if (file.version !== 1) fail("unsupported version");
  if (!file.banks || typeof file.banks !== "object" || Array.isArray(file.banks)) fail("banks must be an object");
  const banks: ReviewedMcqAnswerLetters["banks"] = {};
  for (const [bank, entries] of Object.entries(file.banks as Record<string, unknown>)) {
    if (!isMcqAnswerBank(bank)) fail(`${bank} is not a multiple-choice bank`);
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) fail(`${bank} must map question IDs to answers`);
    const checked: Record<string, McqAnswer> = {};
    for (const [questionId, entry] of Object.entries(entries as Record<string, unknown>)) {
      if (!questionId.trim() || questionId !== questionId.trim()) fail(`${bank} has a blank question ID`);
      if (!isMcqAnswer(entry)) fail(`${bank}:${questionId} needs 1–4 unique letters A–D and a short note or null`);
      checked[questionId] = { answers: [...(entry as McqAnswer).answers], note: (entry as McqAnswer).note };
    }
    banks[bank as BankSlug] = checked;
  }
  return { version: 1, banks };
}

export const REVIEWED_MCQ_ANSWER_LETTERS = parseReviewedMcqAnswerLetters(reviewedLetters);

/**
 * Letters for one bank, keyed by question ID. The reviewed file overrides the source letter. Every
 * reviewed entry must name an existing question that its data marks as MCQ, or this throws.
 */
export function buildMcqAnswerMap(
  bank: BankSlug,
  rows: readonly RawQuestion[],
  reviewed: ReviewedMcqAnswerLetters = REVIEWED_MCQ_ANSWER_LETTERS,
): Map<string, McqAnswer> {
  const answers = new Map<string, McqAnswer>();
  const overrides = reviewed.banks[bank] ?? {};
  if (!isMcqAnswerBank(bank)) {
    if (Object.keys(overrides).length) throw new Error(`Reviewed MCQ answer letters name a non-MCQ bank: ${bank}`);
    return answers;
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const questionId of Object.keys(overrides)) {
    const row = byId.get(questionId);
    if (!row) throw new Error(`Reviewed MCQ answer letter names an unknown question: ${bank}:${questionId}`);
    if (!isMcqRow(bank, row)) throw new Error(`Reviewed MCQ answer letter names a question that is not multiple choice: ${bank}:${questionId}`);
  }
  for (const row of rows) {
    if (typeof row.id !== "string" || !isMcqRow(bank, row)) continue;
    const answer = overrides[row.id] ?? productionMcqAnswer(row);
    if (answer) answers.set(row.id, answer);
  }
  return answers;
}

const cache = new Map<string, Promise<ReadonlyMap<string, McqAnswer>>>();

/** Server runtime: the bank's verified letters (empty for banks without MCQ papers). */
export function loadBankMcqAnswers(bank: BankSlug): Promise<ReadonlyMap<string, McqAnswer>> {
  const key = bankRuntimeCacheKey(bank);
  const cached = cache.get(key);
  if (cached) return cached;
  const loaded = isMcqAnswerBank(bank)
    ? loadBankRawQuestions(bank).then((rows) => buildMcqAnswerMap(bank, rows))
    : Promise.resolve(buildMcqAnswerMap(bank, []));
  cache.set(key, loaded);
  void loaded.catch(() => { if (cache.get(key) === loaded) cache.delete(key); });
  return loaded;
}

export type McqAnswerLetterImport = {
  letters: ReviewedMcqAnswerLetters;
  /** Entries for rows not in this checkout yet; re-run the import once they land. */
  unknown: string[];
  /** Questions the board removed (`answers: []`): the app never serves them. */
  removed: string[];
};

/**
 * Narrows a full reviewed-letters file to the rows this checkout has. Only two kinds of entry are
 * dropped (rows not landed yet, removed questions); everything kept must pass the strict checks.
 */
export function importReviewedMcqAnswerLetters(
  source: unknown,
  rowsByBank: (bank: BankSlug) => readonly RawQuestion[],
): McqAnswerLetterImport {
  const file = source as { version?: unknown; banks?: Record<string, Record<string, { answers?: unknown }>> };
  if (!file || typeof file !== "object" || !file.banks || typeof file.banks !== "object") {
    throw new Error("Reviewed MCQ answer letters are invalid: not an object");
  }
  const unknown: string[] = [];
  const removed: string[] = [];
  const banks: Record<string, Record<string, unknown>> = {};
  for (const [bank, entries] of Object.entries(file.banks)) {
    if (!isMcqAnswerBank(bank)) throw new Error(`Reviewed MCQ answer letters are invalid: ${bank} is not a multiple-choice bank`);
    const ids = new Set(rowsByBank(bank).map((row) => row.id));
    const kept: Record<string, unknown> = {};
    for (const [questionId, entry] of Object.entries(entries ?? {})) {
      if (Array.isArray(entry?.answers) && entry.answers.length === 0) removed.push(`${bank}:${questionId}`);
      else if (!ids.has(questionId)) unknown.push(`${bank}:${questionId}`);
      else kept[questionId] = entry;
    }
    if (Object.keys(kept).length) banks[bank] = kept;
  }
  const letters = parseReviewedMcqAnswerLetters({ version: file.version, banks });
  for (const bank of Object.keys(letters.banks) as BankSlug[]) buildMcqAnswerMap(bank, rowsByBank(bank), letters);
  return { letters, unknown, removed };
}

/** Stable, one entry per line, so a re-import diffs by question. */
export function formatReviewedMcqAnswerLetters(letters: ReviewedMcqAnswerLetters): string {
  const banks = Object.entries(letters.banks).map(([bank, entries]) => {
    const rows = Object.entries(entries ?? {}).map(([id, entry]) => `      ${JSON.stringify(id)}: ${JSON.stringify({ answers: entry.answers, note: entry.note })}`);
    return `    ${JSON.stringify(bank)}: {\n${rows.join(",\n")}\n    }`;
  });
  return `{\n  "version": 1,\n  "banks": {${banks.length ? `\n${banks.join(",\n")}\n  ` : ""}}\n}\n`;
}
