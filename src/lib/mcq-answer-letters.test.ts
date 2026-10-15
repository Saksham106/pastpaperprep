import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import shipped from "@/data/reviewed-mcq-answer-letters.json";
import chemistryHl from "@/data/raw/ib-chemistry-hl.json";
import economics0455 from "@/data/production/igcse-economics-0455.json";
import economicsHl from "@/data/local-preview/ib-economics-hl.json";
import additional from "@/data/raw/igcse-additional.json";
import chemistry0620 from "@/data/production/igcse-chemistry-0620.json";
import type { BankSlug } from "@/lib/banks";
import { formatMcqAnswer } from "@/lib/mcq-answer";
import {
  buildMcqAnswerMap,
  formatReviewedMcqAnswerLetters,
  importReviewedMcqAnswerLetters,
  isMcqRow,
  loadBankMcqAnswers,
  MCQ_ANSWER_BANKS,
  parseReviewedMcqAnswerLetters,
  productionMcqAnswer,
  REVIEWED_MCQ_ANSWER_LETTERS,
} from "@/lib/mcq-answer-letters";
import { loadBankRawQuestions } from "@/lib/question-loader";

type Row = Record<string, unknown>;
const rows = (bank: { questions: unknown[] }) => bank.questions as Row[];
const row = (bank: { questions: unknown[] }, id: string) => {
  const found = rows(bank).find((question) => question.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};
const overlay = (banks: Record<string, unknown>) => parseReviewedMcqAnswerLetters({ version: 1, banks });

afterEach(() => vi.unstubAllEnvs());

describe("MCQ detection", () => {
  it("is decided by each row's component and marks, not by paper number", () => {
    // IB sciences: Paper 1 and 1A are MCQ; Paper 1B (data-based) and one-mark Paper 3 parts are not.
    expect(isMcqRow("ib-chemistry-hl", row(chemistryHl, "2016-may-tz0-hl-p1-q1"))).toBe(true);
    expect(isMcqRow("ib-chemistry-hl", row(chemistryHl, "2025-may-tz1-hl-p1a-q1"))).toBe(true);
    expect(isMcqRow("ib-chemistry-hl", row(chemistryHl, "2025-may-tz1-hl-p1b-q1"))).toBe(false);
    expect(isMcqRow("ib-chemistry-hl", row(chemistryHl, "2017-may-tz1-hl-p3-q3"))).toBe(false);
    // 0455: Paper 1 is MCQ, Paper 2 is written.
    expect(isMcqRow("igcse-economics-0455", row(economics0455, "0455-2021-m-12-q1"))).toBe(true);
    expect(isMcqRow("igcse-economics-0455", row(economics0455, "0455-2021-m-22-q4"))).toBe(false);
    // IGCSE sciences: papers 1–2 are MCQ, 3–6 written.
    expect(isMcqRow("igcse-chemistry-0620", row(chemistry0620, "0620-2021-m-12-q1"))).toBe(true);
    expect(isMcqRow("igcse-chemistry-0620", row(chemistry0620, "0620-2021-m-42-q1"))).toBe(false);
  });

  it("never treats maths or IB Economics Paper 1 as MCQ", () => {
    for (const question of rows(additional)) expect(isMcqRow("igcse-additional", question)).toBe(false);
    const economicsP1 = rows(economicsHl).filter((question) => question.paper === 1);
    expect(economicsP1.length).toBeGreaterThan(0);
    for (const question of economicsP1) expect(isMcqRow("ib-economics-hl", question)).toBe(false);
    for (const bank of ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "ib-economics-hl", "ib-economics-sl"] as BankSlug[]) {
      expect(MCQ_ANSWER_BANKS).not.toContain(bank);
    }
  });

  it("trusts a source letter only with official provenance for the same question", () => {
    const base = { id: "q1", marks: 1, component: "12", answer: "B", answerProvenance: { status: "official", questionId: "q1" } };
    expect(productionMcqAnswer(base)).toEqual({ answers: ["B"], note: null });
    expect(productionMcqAnswer({ ...base, answerProvenance: { status: "inferred", questionId: "q1" } })).toBeNull();
    expect(productionMcqAnswer({ ...base, answerProvenance: { status: "official", questionId: "q2" } })).toBeNull();
    expect(productionMcqAnswer({ ...base, answerProvenance: null })).toBeNull();
    expect(productionMcqAnswer({ ...base, answer: "E" })).toBeNull();
    expect(productionMcqAnswer({ ...base, answer: null })).toBeNull();
  });
});

const OVERLAY_PATH = join(process.cwd(), "src", "data", "reviewed-mcq-answer-letters.json");
// Imported 2026-10-13 from ../research/mcq-answer-letters-2026-10 (receipt: docs/reviewed-mcq-answer-letters.md).
const OVERLAY_SHA256 = "76c456527f053db418d61b2e66f4afdfc06bc0e52df7e184820efd997e06e53d";
// May 2026 IB Biology and IB Chemistry keys (210 each), read independently from the official mark schemes; merged over the research file.
const MAY_2026_ADDITIONS = [
  { path: join(process.cwd(), "docs", "ib-biology-may-2026", "mcq-answer-letters-2026.json"), sha256: "6ea073620eca9521ee2d07642e7a40296c0bb29feec3f2bb3bdb57156c99ded7" },
  { path: join(process.cwd(), "docs", "ib-chemistry-may-2026", "mcq-answer-letters-2026.json"), sha256: "c513c55fa201414c39367fa69e87de8548c729d6915f471d26148f08533e34a8" },
];
// The research folder sits beside the repository; from a worktree under .worktrees/ it is three levels up.
const SOURCE_PATH = [["..", "research"], ["..", "..", "..", "research"]]
  .map((up) => join(process.cwd(), ...up, "mcq-answer-letters-2026-10", "reviewed-mcq-answer-letters.json"))
  .find((path) => existsSync(path)) ?? "";
const SOURCE_SHA256 = "15d10333310abe4420463ffa924912234ff7d9e98509d90be27c57775cd2170e";
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

describe("reviewed MCQ answer letters file", () => {
  it("ships in the agreed format and passes strict validation", () => {
    expect(shipped).toEqual({ version: 1, banks: expect.any(Object) });
    expect(parseReviewedMcqAnswerLetters(shipped)).toEqual(REVIEWED_MCQ_ANSWER_LETTERS);
  });

  it("is the reviewed import recorded in its receipt", () => {
    const bytes = readFileSync(OVERLAY_PATH);
    expect(sha256(bytes)).toBe(OVERLAY_SHA256);
    expect(formatReviewedMcqAnswerLetters(REVIEWED_MCQ_ANSWER_LETTERS)).toBe(bytes.toString("utf8"));
    const receipt = readFileSync(join(process.cwd(), "docs", "reviewed-mcq-answer-letters.md"), "utf8");
    expect(receipt).toContain(OVERLAY_SHA256);
    expect(receipt).toContain(SOURCE_SHA256);
    for (const addition of MAY_2026_ADDITIONS) expect(receipt).toContain(addition.sha256);
    const counts = Object.fromEntries(Object.entries(REVIEWED_MCQ_ANSWER_LETTERS.banks).map(([bank, entries]) => [bank, Object.keys(entries ?? {}).length]));
    expect(counts).toEqual({
      // 0455 includes its 119 2026 Paper 1 letters; 0610 is only the 240 May/June 2026 MCQs.
      "igcse-economics-0455": 1584, "igcse-biology-0610": 240,
      "ib-biology-hl": 1320, "ib-biology-sl": 1020,
      "ib-chemistry-hl": 1320, "ib-chemistry-sl": 990,
      "ib-physics-hl": 1200, "ib-physics-sl": 872,
    });
  });

  it("keeps the official exceptions: two accepted letters, and contradicted Physics SL keys left out", () => {
    const chemistry = [
      ["ib-chemistry-hl", "2023-november-tz1-hl-p1-q19"], ["ib-chemistry-hl", "2023-november-tz2-hl-p1-q19"],
      ["ib-chemistry-sl", "2023-november-tz1-sl-p1-q17"], ["ib-chemistry-sl", "2023-november-tz2-sl-p1-q17"],
    ] as const;
    for (const [bank, id] of chemistry) {
      const entry = REVIEWED_MCQ_ANSWER_LETTERS.banks[bank]![id];
      // The source note "A or C accepted" only restates the chip, so the import drops it.
      expect(entry).toEqual({ answers: ["A", "C"], note: null });
      expect(formatMcqAnswer(entry.answers)).toBe("A or C");
    }
    const physicsSl = REVIEWED_MCQ_ANSWER_LETTERS.banks["ib-physics-sl"]!;
    for (const id of ["2019-november-tz0-sl-p1-q4", "2023-may-tz2-sl-p1-q7", "2024-may-tz1-sl-p1-q29"]) expect(physicsSl[id]).toBeUndefined();
    // The stamped key prints C over a text layer that says B.
    expect(REVIEWED_MCQ_ANSWER_LETTERS.banks["ib-biology-hl"]!["2022-may-tz1-hl-p1-q28"]).toEqual({ answers: ["C"], note: null });
  });

  it.skipIf(!SOURCE_PATH)("re-imports byte for byte from the full reviewed file", async () => {
    const source = readFileSync(SOURCE_PATH);
    expect(sha256(source)).toBe(SOURCE_SHA256);
    const rows = new Map<BankSlug, readonly Row[]>();
    for (const bank of MCQ_ANSWER_BANKS) rows.set(bank, await loadBankRawQuestions(bank));
    const merged = JSON.parse(source.toString("utf8"));
    for (const addition of MAY_2026_ADDITIONS) {
      const bytes = readFileSync(addition.path);
      expect(sha256(bytes)).toBe(addition.sha256);
      for (const [bank, entries] of Object.entries(JSON.parse(bytes.toString("utf8")).banks)) Object.assign(merged.banks[bank], entries);
    }
    const result = importReviewedMcqAnswerLetters(merged, (bank) => rows.get(bank) ?? []);
    expect(formatReviewedMcqAnswerLetters(result.letters)).toBe(readFileSync(OVERLAY_PATH, "utf8"));
    expect(result.removed).toEqual(["igcse-economics-0455:0455-2026-s-11-q26"]);
    // Every reviewed row has landed: the 359 2026 rows held back at first import are in the bank now.
    expect(result.unknown).toEqual([]);
  });

  it("names only existing multiple-choice questions", async () => {
    for (const [bank, entries] of Object.entries(REVIEWED_MCQ_ANSWER_LETTERS.banks) as Array<[BankSlug, Record<string, unknown>]>) {
      const questions = await loadBankRawQuestions(bank);
      expect(() => buildMcqAnswerMap(bank, questions)).not.toThrow();
      expect(Object.keys(entries).every((id) => questions.some((question) => question.id === id))).toBe(true);
    }
  });

  it.each([
    ["an unknown version", { version: 2, banks: {} }],
    ["an extra top-level key", { version: 1, banks: {}, extra: true }],
    ["banks as a list", { version: 1, banks: [] }],
    ["an unknown bank", { version: 1, banks: { "igcse-geography": {} } }],
    ["a maths bank", { version: 1, banks: { "igcse-additional": { "0606-2016-june-13-q1": { answers: ["A"], note: null } } } }],
    ["IB Economics", { version: 1, banks: { "ib-economics-hl": {} } }],
    ["a letter outside A–D", { version: 1, banks: { "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q1": { answers: ["E"], note: null } } } }],
    ["a repeated letter", { version: 1, banks: { "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q1": { answers: ["B", "B"], note: null } } } }],
    ["no letters", { version: 1, banks: { "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q1": { answers: [], note: null } } } }],
    ["a bare letter", { version: 1, banks: { "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q1": "B" } } }],
    ["a missing note", { version: 1, banks: { "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q1": { answers: ["B"] } } } }],
    ["a blank question ID", { version: 1, banks: { "ib-chemistry-hl": { " ": { answers: ["B"], note: null } } } }],
  ])("fails closed on %s", (_label, value) => {
    expect(() => parseReviewedMcqAnswerLetters(value)).toThrow(/Reviewed MCQ answer letters are invalid/);
  });

  it("rejects a reviewed letter for a question that does not exist", () => {
    const reviewed = overlay({ "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q999": { answers: ["B"], note: null } } });
    expect(() => buildMcqAnswerMap("ib-chemistry-hl", rows(chemistryHl), reviewed)).toThrow(/unknown question/);
  });

  it("rejects a reviewed letter for a written question", () => {
    for (const id of ["2025-may-tz1-hl-p1b-q1", "2017-may-tz1-hl-p3-q3"]) {
      const reviewed = overlay({ "ib-chemistry-hl": { [id]: { answers: ["B"], note: null } } });
      expect(() => buildMcqAnswerMap("ib-chemistry-hl", rows(chemistryHl), reviewed)).toThrow(/not multiple choice/);
    }
  });
});

describe("reviewed letters import", () => {
  const source = (entries: Record<string, unknown>) => ({ version: 1, banks: { "ib-chemistry-hl": entries } });
  const chemistryRows = () => rows(chemistryHl);

  it("drops rows not in this checkout and removed questions, and keeps the rest", () => {
    const result = importReviewedMcqAnswerLetters(source({
      "2016-may-tz0-hl-p1-q1": { answers: ["C"], note: null },
      "2099-may-tz1-hl-p1-q1": { answers: ["A"], note: null },
      "2025-may-tz1-hl-p1a-q1": { answers: [], note: "Question removed" },
    }), chemistryRows);
    expect(result.letters).toEqual({ version: 1, banks: { "ib-chemistry-hl": { "2016-may-tz0-hl-p1-q1": { answers: ["C"], note: null } } } });
    expect(result.unknown).toEqual(["ib-chemistry-hl:2099-may-tz1-hl-p1-q1"]);
    expect(result.removed).toEqual(["ib-chemistry-hl:2025-may-tz1-hl-p1a-q1"]);
  });

  it("drops a note that only restates a multi-letter answer, and keeps real notes", () => {
    const result = importReviewedMcqAnswerLetters(source({
      "2016-may-tz0-hl-p1-q1": { answers: ["A", "C"], note: "A or C accepted" },
      "2016-may-tz0-hl-p1-q2": { answers: ["B", "D"], note: "B or D." },
      "2016-may-tz0-hl-p1-q3": { answers: ["A", "B"], note: "Question removed; all candidates credited" },
      "2016-may-tz0-hl-p1-q4": { answers: ["C"], note: "C accepted" },
    }), chemistryRows);
    expect(result.letters.banks["ib-chemistry-hl"]).toEqual({
      "2016-may-tz0-hl-p1-q1": { answers: ["A", "C"], note: null },
      "2016-may-tz0-hl-p1-q2": { answers: ["B", "D"], note: null },
      "2016-may-tz0-hl-p1-q3": { answers: ["A", "B"], note: "Question removed; all candidates credited" },
      "2016-may-tz0-hl-p1-q4": { answers: ["C"], note: "C accepted" },
    });
  });

  it("stops on anything else instead of dropping it", () => {
    expect(() => importReviewedMcqAnswerLetters(source({ "2016-may-tz0-hl-p1-q1": { answers: ["E"], note: null } }), chemistryRows)).toThrow(/invalid/);
    expect(() => importReviewedMcqAnswerLetters(source({ "2025-may-tz1-hl-p1b-q1": { answers: ["B"], note: null } }), chemistryRows)).toThrow(/not multiple choice/);
    expect(() => importReviewedMcqAnswerLetters({ version: 1, banks: { "ib-hl": {} } }, () => [])).toThrow(/not a multiple-choice bank/);
  });

  it("writes one entry per line and an empty file as empty banks", () => {
    expect(formatReviewedMcqAnswerLetters({ version: 1, banks: {} })).toBe('{\n  "version": 1,\n  "banks": {}\n}\n');
    expect(formatReviewedMcqAnswerLetters({ version: 1, banks: { "ib-chemistry-hl": { a: { answers: ["A", "C"], note: "A or C accepted" } } } }))
      .toBe('{\n  "version": 1,\n  "banks": {\n    "ib-chemistry-hl": {\n      "a": {"answers":["A","C"],"note":"A or C accepted"}\n    }\n  }\n}\n');
  });
});

describe("MCQ letter map", () => {
  it("adds reviewed letters to a bank without source letters, including several accepted answers and notes", () => {
    const reviewed = overlay({ "ib-chemistry-hl": {
      "2016-may-tz0-hl-p1-q1": { answers: ["C"], note: null },
      "2025-may-tz1-hl-p1a-q1": { answers: ["A", "B"], note: "Question removed; all candidates credited" },
    } });
    const map = buildMcqAnswerMap("ib-chemistry-hl", rows(chemistryHl), reviewed);
    expect([...map]).toEqual([
      ["2016-may-tz0-hl-p1-q1", { answers: ["C"], note: null }],
      ["2025-may-tz1-hl-p1a-q1", { answers: ["A", "B"], note: "Question removed; all candidates credited" }],
    ]);
    expect(buildMcqAnswerMap("ib-chemistry-hl", rows(chemistryHl), overlay({})).size).toBe(0);
  });

  it("lets a reviewed letter override the source letter", () => {
    const source = row(chemistry0620, "0620-2025-m-12-q1");
    expect(source.answer).toBe("A");
    const reviewed = overlay({ "igcse-chemistry-0620": { "0620-2025-m-12-q1": { answers: ["C"], note: null } } });
    const map = buildMcqAnswerMap("igcse-chemistry-0620", rows(chemistry0620), reviewed);
    expect(map.get("0620-2025-m-12-q1")).toEqual({ answers: ["C"], note: null });
    expect(buildMcqAnswerMap("igcse-chemistry-0620", rows(chemistry0620), overlay({})).get("0620-2025-m-12-q1")).toEqual({ answers: ["A"], note: null });
  });

  it("carries every source letter of the four IGCSE science banks and nothing else", async () => {
    let total = 0;
    for (const bank of ["igcse-biology-0610", "igcse-chemistry-0620", "igcse-physics-0625", "igcse-coordinated-sciences-0654"] as BankSlug[]) {
      const questions = await loadBankRawQuestions(bank);
      const map = await loadBankMcqAnswers(bank);
      const lettered = questions.filter((question) => typeof question.answer === "string");
      expect(map.size).toBe(lettered.length);
      for (const question of lettered) expect(map.get(question.id as string)).toEqual({ answers: [question.answer], note: null });
      total += map.size;
    }
    // 15,556 before the 240 Biology 0610 May/June 2026 MCQs landed.
    expect(total).toBe(15_796);
  });

  it("is empty for banks without MCQ papers", async () => {
    for (const bank of ["igcse", "igcse-additional", "ib-hl", "ib-ai-sl", "ib-economics-hl"] as BankSlug[]) {
      expect((await loadBankMcqAnswers(bank)).size).toBe(0);
    }
  });
});
