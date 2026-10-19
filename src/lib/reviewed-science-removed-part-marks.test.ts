import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import repairs from "@/data/reviewed-science-removed-part-marks.json";
import { removedPartMarks } from "@/lib/reviewed-science-removed-part-marks";
import { loadBankQuestions } from "@/lib/question-loader";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const BANK = "igcse-chemistry-0620";
const QID = "0620-2026-m-32-q3";
const raw = JSON.parse(readFileSync(`src/data/production/${BANK}.json`, "utf8")).questions;

describe("reviewed removed-part question totals", () => {
  test("exact cohort: one 0620 question, sealed row still null", () => {
    expect(Object.keys(repairs.entries)).toEqual([BANK]);
    expect(Object.keys(repairs.entries[BANK])).toEqual([QID]);
    const row = raw.find((q: { id: string }) => q.id === QID);
    expect([row.marks, row.maxMarks]).toEqual([null, null]);
    // The parts the scheme still assesses carry 13; the printed total keeps the removed 3(d)(iv).
    expect(row.parts.filter((p: { marks: number | null }) => p.marks !== null).reduce((n: number, p: { marks: number }) => n + p.marks, 0))
      .toBe(repairs.entries[BANK][QID].assessableMarks);
  });

  test("the loader and the public index serve the printed 14, and the paper totals 80", async () => {
    process.env.PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS = "true";
    process.env.PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED = "true";
    try {
      const questions = await loadBankQuestions(BANK);
      const paper = questions.filter((q) => q.id.startsWith("0620-2026-m-32-"));
      expect(paper.find((q) => q.id === QID)?.marks).toBe(14);
      expect(paper.reduce((n, q) => n + (q.marks ?? 0), 0)).toBe(80);
      expect(questions.every((q) => Number.isInteger(q.marks) && (q.marks as number) > 0)).toBe(true);
    } finally {
      delete process.env.PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS;
      delete process.env.PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED;
    }
    const row = raw.find((q: { id: string }) => q.id === QID);
    expect(metadataFromRaw(row, { bank: BANK, normalizedProduction: true }).marks).toBe(14);
  });

  test("stale input fails closed; other questions pass through", () => {
    expect(() => removedPartMarks(BANK, QID, 13)).toThrow(/disagree/);
    expect(removedPartMarks(BANK, "0620-2026-m-32-q2", 14)).toBe(14);
  });
});
