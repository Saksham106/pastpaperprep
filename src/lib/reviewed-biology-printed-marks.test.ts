import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import biology from "@/data/production/igcse-biology-0610.json";
import overlay from "@/data/reviewed-biology-printed-marks.json";
import archive from "@/data/paper-archives/igcse-biology-0610.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { printedMarks } from "@/lib/reviewed-biology-printed-marks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";

const BANK = "igcse-biology-0610";
const runtime = biology as unknown as { questions: Array<{ id: string; marks: number | null }> };
const byId = new Map(runtime.questions.map((q) => [q.id, q]));

describe("Biology 0610 printed marks (reviewed overlay)", () => {
  it("replays from the printed-marks census and corrects only 0610-2019-s-61 q1/q2", () => {
    execFileSync("node", ["scripts/build-0610-printed-marks.mjs", "--check"]);
    expect(Object.entries(overlay.entries).map(([id, e]) => [id, e.old, e.new])).toEqual([
      ["0610-2019-s-61-q1", 20, 19],
      ["0610-2019-s-61-q2", 20, 21],
    ]);
  });

  it("leaves the finalized runtime untouched and serves the printed totals", () => {
    expect(byId.get("0610-2019-s-61-q1")!.marks).toBe(20);
    expect(byId.get("0610-2019-s-61-q2")!.marks).toBe(20);
    const paper = normalizeBankQuestions(BANK, runtime.questions, { economicsAssetMode: "private", applyReviewedBlankPages: true })
      .filter((q) => q.id.startsWith("0610-2019-s-61-"));
    expect(paper.map((q) => q.marks)).toEqual([19, 21]);
    expect(metadataFromRaw(byId.get("0610-2019-s-61-q1"), { bank: BANK, normalizedProduction: true }).marks).toBe(19);
    const archived = (archive as unknown as { papers: Array<{ questions: Array<{ id: string; maxMarks: number }> }> }).papers
      .flatMap((p) => p.questions).filter((q) => q.id.startsWith("0610-2019-s-61-"));
    expect(archived.map((q) => q.maxMarks)).toEqual([19, 21]); // the free paper archive already agreed
  });

  it("fails closed on drift and leaves other banks and questions alone", () => {
    expect(() => printedMarks(BANK, "0610-2019-s-61-q1", 19)).toThrow(/disagrees/);
    expect(printedMarks(BANK, "0610-2019-s-61-q3", 7)).toBe(7);
    expect(printedMarks("igcse-chemistry-0620", "0610-2019-s-61-q1", 20)).toBe(20);
  });

  it("the public bank index serves the printed totals", () => {
    const index = JSON.parse(readFileSync(`public/bank-index/${PUBLIC_BANK_INDEX_FILES[BANK]}`, "utf8")) as { questions: Array<{ id: string; marks: number | null }> };
    const marks = new Map(index.questions.map((q) => [q.id, q.marks]));
    expect([marks.get("0610-2019-s-61-q1"), marks.get("0610-2019-s-61-q2")]).toEqual([19, 21]);
  });
});
