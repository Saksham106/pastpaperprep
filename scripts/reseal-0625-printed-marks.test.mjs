import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { censusTargets, resealMarks } from "./reseal-0625-printed-marks.mjs";
import { assert0625McqRetrievalRepair, assert0625PracticalRoleRepair, assert0625PrintedMarksRepair } from "../src/lib/igcse-runtime.ts";

const BASE = "197ac22550d5bcb7559eafdbc0ae5cf391924bd5";
const readBase = (file) => JSON.parse(execFileSync("git", ["show", `${BASE}:${file}`], { maxBuffer: 50_000_000 }));
const baseline = readBase("src/data/production/igcse-physics-0625.json");
const census = JSON.parse(readFileSync("scripts/data/0625-printed-marks-census.json", "utf8"));
const inputs = {
  baseline, census,
  manifestText: readFileSync("data/storage/igcse-physics-0625.manifest.json", "utf8"),
  receiptText: readFileSync("data/storage/igcse-physics-0625.receipt.json", "utf8"),
};
const runtime = JSON.parse(readFileSync("src/data/production/igcse-physics-0625.json", "utf8"));

describe("0625 printed marks reseal", () => {
  it("replays the published runtime and changes only marks/maxMarks on 1,143 written-paper rows", () => {
    const result = resealMarks(inputs);
    expect(result).toEqual(runtime);
    const changed = result.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baseline.questions[i]));
    expect(changed).toHaveLength(1143);
    for (const q of changed) {
      const before = baseline.questions.find((row) => row.id === q.id);
      expect(Object.keys(q).filter((key) => JSON.stringify(q[key]) !== JSON.stringify(before[key])).sort()).toEqual(["marks", "maxMarks"]);
      expect(/^[3-6]/.test(q.component)).toBe(true);
    }
    // MCQ papers carry no printed per-question total and stay one mark each.
    expect(result.questions.filter((q) => /^[12]/.test(q.component)).every((q) => q.marks === 1)).toBe(true);
  }, 60000);

  it("reconciles every written paper to its printed maximum", () => {
    const sums = new Map();
    for (const q of runtime.questions.filter((row) => /^[3-6]/.test(row.component))) {
      const paper = q.id.replace(/-q\d+$/, "");
      sums.set(paper, (sums.get(paper) ?? 0) + q.marks);
    }
    expect(sums.size).toBe(211);
    for (const [paper, sum] of sums) expect(sum, paper).toBe({ 3: 80, 4: 80, 5: 40, 6: 40 }[paper.split("-").at(-1)[0]]);
    expect(runtime.questions.every((q) => q.maxMarks === q.marks && q.marks > 0)).toBe(true);
  });

  it("fixes the checked examples, including the corrupted and overstated totals", () => {
    const marks = new Map(runtime.questions.map((q) => [q.id, q.marks]));
    expect(marks.get("0625-2026-m-32-q1")).toBe(11);
    expect(marks.get("0625-2026-m-32-q3")).toBe(7);
    expect(marks.get("0625-2026-m-42-q1")).toBe(6);
    expect(marks.get("0625-2026-s-31-q4")).toBe(12);
    expect(marks.get("0625-2021-s-61-q1")).toBe(11);
    expect(marks.get("0625-2026-s-32-q8")).toBe(10);
  });

  it("keeps the private index marks in step with the runtime", () => {
    const index = JSON.parse(readFileSync("src/data/private-index/igcse-physics-0625.json", "utf8"));
    const marks = new Map(runtime.questions.map((q) => [q.id, q.marks]));
    expect(index.questions).toHaveLength(5789);
    expect(index.questions.every((q) => q.marks === marks.get(q.id))).toBe(true);
  });

  it("seals the chain at load time and rejects drift", () => {
    expect(() => assert0625PracticalRoleRepair(runtime)).not.toThrow();
    expect(() => assert0625McqRetrievalRepair(runtime)).not.toThrow();
    expect(() => assert0625PrintedMarksRepair(runtime)).not.toThrow();
    const tampered = structuredClone(runtime);
    tampered.questions.find((q) => q.id === "0625-2026-m-32-q1").marks = 10;
    expect(() => assert0625PrintedMarksRepair(tampered)).toThrow(/finalized content mismatch/);
  });

  it("refuses a census that does not reconcile or has drifted from the stored marks", () => {
    const broken = structuredClone(census);
    broken.papers["0625-2026-m-32"].questions[0][2] += 1;
    expect(() => censusTargets(baseline, broken)).toThrow(/do not sum/);
    const drifted = structuredClone(inputs);
    drifted.census = structuredClone(census);
    drifted.census.papers["0625-2026-m-32"].questions[0][1] = 99;
    expect(() => resealMarks(drifted)).toThrow(/drifted/);
  });
});
