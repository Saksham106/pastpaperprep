import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import repairs from "@/data/reviewed-science-removed-part-marks.json";
import { assertRemovedPartEntry, removedPartMarks, type RemovedPartEntry } from "@/lib/reviewed-science-removed-part-marks";
import { loadBankQuestions } from "@/lib/question-loader";
import { withAssessableMarks } from "@/lib/whole-paper-archive";
import type { WholePaperManifest } from "@/lib/whole-paper-types";
import type { BankSlug } from "@/lib/banks";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { servedMarks } from "../../scripts/explanations/served-marks.mjs";

const entries = repairs.entries as unknown as Record<string, Record<string, RemovedPartEntry>>;
const runtimeRows = (bank: string) => JSON.parse(readFileSync(`src/data/production/${bank}.json`, "utf8")).questions as Array<{ id: string; marks: number | null; maxMarks?: number | null; parts?: Array<{ marks: number | null }> }>;
const archive = (bank: string) => JSON.parse(readFileSync(`src/data/paper-archives/${bank}.json`, "utf8")) as WholePaperManifest;

/** Every question with a removed part, in any bank: printed total -> marks students can score (owner decision 2026-11-19). */
const COHORT = {
  "a-level-chemistry-9701": { "9701-2025-w-21-q1": [20, 18, "1(c)(iii)"], "9701-2025-w-22-q1": [10, 8, "1(c)(iii)"] },
  "igcse-biology-0610": { "0610-2026-s-43-q5": [15, 12, "5(a)"] },
  "igcse-chemistry-0620": { "0620-2026-m-32-q3": [14, 13, "3(d)(iv)"] },
  "igcse-coordinated-sciences-0654": { "0654-2022-summer-43-q11": [11, 7, "11(b)(ii)"] },
} as const;
/** The served questions of each affected paper sum to the printed paper maximum minus the removed marks. */
const PAPERS: Array<[BankSlug, string, number, number]> = [
  ["igcse-biology-0610", "0610-2026-s-43-", 80, 3],
  ["igcse-chemistry-0620", "0620-2026-m-32-", 80, 1],
  ["igcse-coordinated-sciences-0654", "0654-2022-summer-43-", 120, 4],
  ["a-level-chemistry-9701", "9701-2025-w-21-", 60, 2],
  ["a-level-chemistry-9701", "9701-2025-w-22-", 60, 2],
];

describe("questions with a removed part serve the marks students can score", () => {
  beforeEach(() => {
    process.env.PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS = "true";
    process.env.PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED = "true";
  });
  afterEach(() => {
    delete process.env.PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS;
    delete process.env.PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED;
  });

  test("exact cohort, each entry reconciles: printed total minus the removed parts is the assessable marks", () => {
    expect(repairs.schema).toBe("reviewed-science-removed-part-marks-v2");
    expect(Object.fromEntries(Object.entries(entries).map(([bank, rows]) => [bank, Object.fromEntries(Object.entries(rows).map(([id, entry]) => [id, [entry.printedTotal, entry.assessableMarks, entry.removedParts.map((part) => part.part).join()]]))]))).toEqual(COHORT);
    for (const [bank, rows] of Object.entries(entries)) for (const [id, entry] of Object.entries(rows)) {
      expect(() => assertRemovedPartEntry(bank, id, entry)).not.toThrow();
      expect(entry.questionPdfSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.markSchemePdfSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.markSchemePages.length).toBeGreaterThan(0);
      expect(entry.evidence).toMatch(/removed from the question paper/);
    }
  });

  test("sealed runtime rows keep their printed totals as provenance", () => {
    for (const [bank, rows] of Object.entries(entries)) {
      const raw = runtimeRows(bank);
      for (const [id, entry] of Object.entries(rows)) expect(raw.find((row) => row.id === id)?.marks ?? null, id).toBe(entry.old);
    }
    // 0620's sealed row still has no total; the parts the scheme assesses carry 13.
    const row = runtimeRows("igcse-chemistry-0620").find((q) => q.id === "0620-2026-m-32-q3")!;
    expect(row.parts!.filter((part) => part.marks !== null).reduce((sum, part) => sum + part.marks!, 0)).toBe(13);
  });

  test("the loader, the public index and the explanation tools serve the assessable marks", async () => {
    for (const [bank, rows] of Object.entries(COHORT)) {
      const questions = await loadBankQuestions(bank as BankSlug);
      const raw = runtimeRows(bank);
      for (const [id, [, assessable]] of Object.entries(rows)) {
        expect(questions.find((question) => question.id === id)?.marks, id).toBe(assessable);
        expect(metadataFromRaw(raw.find((row) => row.id === id), { bank, normalizedProduction: true }).marks, id).toBe(assessable);
        expect(servedMarks(bank, id, raw.find((row) => row.id === id)!.marks), id).toBe(assessable);
      }
    }
  });

  test("each affected paper sums to its printed maximum minus the removed marks", async () => {
    for (const [bank, prefix, printed, removed] of PAPERS) {
      const paper = (await loadBankQuestions(bank)).filter((question) => question.id.startsWith(prefix));
      expect(paper.length, prefix).toBeGreaterThan(0);
      expect(paper.reduce((sum, question) => sum + question.marks!, 0) + removed, prefix).toBe(printed);
    }
  });

  test("stale input fails closed; other questions pass through", () => {
    expect(() => removedPartMarks("igcse-chemistry-0620", "0620-2026-m-32-q3", 14)).toThrow(/disagree/);
    expect(() => removedPartMarks("igcse-biology-0610", "0610-2026-s-43-q5", 12)).toThrow(/disagree/);
    expect(removedPartMarks("igcse-chemistry-0620", "0620-2026-m-32-q2", 14)).toBe(14);
    expect(() => assertRemovedPartEntry("x", "y", { old: 10, printedTotal: 10, assessableMarks: 9, removedParts: [{ part: "1(a)", marks: 2 }] })).toThrow(/inconsistent/);
  });

  test("the free whole-paper archive lists assessable question and paper marks", () => {
    for (const [bank, paperId, questionId, printedPaper, assessable, removed] of [
      ["igcse-chemistry-0620", "0620-2026-m-32", "0620-2026-m-32-q3", 80, 13, 1],
      ["igcse-coordinated-sciences-0654", "0654-2022-summer-43", "0654-2022-summer-43-q11", 120, 7, 4],
    ] as const) {
      const raw = archive(bank);
      const before = raw.papers.find((paper) => paper.summary.id === paperId)!;
      expect(before.summary.maxMarks).toBe(printedPaper);
      const after = withAssessableMarks(raw, bank).papers.find((paper) => paper.summary.id === paperId)!;
      expect(after.questions.find((question) => question.id === questionId)?.maxMarks).toBe(assessable);
      expect(after.summary.maxMarks).toBe(printedPaper - removed);
      expect(after.questions.reduce((sum, question) => sum + question.maxMarks, 0)).toBe(after.summary.maxMarks);
    }
    // 0610 May/June 2026 Paper 43 lists no questions (its report is held), so only its printed metadata shows.
    const held = withAssessableMarks(archive("igcse-biology-0610"), "igcse-biology-0610").papers.find((paper) => paper.summary.id === "0610-2026-s-43")!;
    expect([held.questions.length, held.summary.reportAvailable, held.summary.maxMarks]).toEqual([0, false, 80]);
  });
});
