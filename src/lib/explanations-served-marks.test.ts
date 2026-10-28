import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import type { BankSlug } from "@/lib/banks";
import { normalizeBankQuestions } from "@/lib/questions";
import { servedMarks } from "../../scripts/explanations/served-marks.mjs";
import { BANKS } from "../../scripts/explanations/prepare-batch.mjs";

describe("explanation tooling uses the served marks", () => {
  test("Biology 0610 printed totals reach the writer and the publisher", () => {
    expect(servedMarks("igcse-biology-0610", "0610-2019-s-31-q3", 4)).toBe(10);
    expect(servedMarks("igcse-biology-0610", "0610-2019-s-61-q1", 20)).toBe(19);
    expect(servedMarks("igcse-biology-0610", "0610-2019-s-61-q2", 20)).toBe(21);
    expect(() => servedMarks("igcse-biology-0610", "0610-2019-s-61-q1", 19)).toThrow(/disagrees/);
    expect(servedMarks("igcse-chemistry-0620", "0610-2019-s-61-q1", 20)).toBe(20);
  });

  test("matches the runtime loader's marks for every question of every explanation bank", () => {
    let checked = 0;
    for (const [bank, config] of Object.entries(BANKS) as [BankSlug, { data: string }][]) {
      const data = JSON.parse(readFileSync(config.data, "utf8"));
      const questions = (data.questions ?? data) as { id: string; marks?: number | null; maxMarks?: number; maximumMarks?: number }[];
      const loaded = normalizeBankQuestions(bank, questions as never, { economicsAssetMode: "private" });
      const byId = new Map(questions.map((q) => [q.id, q]));
      loaded.forEach((q) => {
        const raw = byId.get(q.id)!;
        expect([bank, q.id, servedMarks(bank, raw.id, raw.marks ?? raw.maxMarks ?? raw.maximumMarks)]).toEqual([bank, q.id, q.marks]);
        checked += 1;
      });
    }
    expect(checked).toBeGreaterThan(40000);
  });
});
