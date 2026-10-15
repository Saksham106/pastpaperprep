import { describe, expect, it } from "vitest";
import { examOrder, lowerTarget, reconcileDraft, swapCandidate } from "@/lib/paper-draft";
import type { PaperCandidate } from "@/lib/paper-builder";

const q = (id: string, paper: number, number: number, marks: number, primaryTopic = "Atoms", year = 2024): PaperCandidate =>
  ({ id, paper, number, marks, year, primaryTopic, secondaryTopics: [] });
const pool = [q("a", 2, 1, 2), q("b", 2, 2, 3), q("c", 2, 3, 4, "Energy"), q("d", 4, 1, 5), q("e", 4, 2, 6, "Energy"), q("f", 4, 3, 7)];

describe("reconcileDraft", () => {
  it("tops up to the question target, deterministically by seed, in exam order", () => {
    const first = reconcileDraft([], pool, { kind: "questions", amount: 3 }, 7, false);
    expect(first.ids).toHaveLength(3);
    expect(reconcileDraft([], pool, { kind: "questions", amount: 3 }, 7, false)).toEqual(first);
    const ordered = examOrder(first.ids.map((id) => pool.find((item) => item.id === id)!)).map((item) => item.id);
    expect(first.ids).toEqual(ordered);
    expect(first.exact).toBe(true);
  });
  it("keeps questions that still match and only replaces the rest", () => {
    const result = reconcileDraft(["f", "zz", "a"], pool, { kind: "questions", amount: 3 }, 1, false);
    expect(result.ids).toContain("f");
    expect(result.ids).toContain("a");
    expect(result.ids).not.toContain("zz");
    expect(result.ids).toHaveLength(3);
  });
  it("trims from the end when the target drops", () => {
    expect(reconcileDraft(["a", "b", "c", "d"], pool, { kind: "questions", amount: 2 }, 1, true).ids).toEqual(["a", "b"]);
  });
  it("uses every question and reports the shortfall when too few match", () => {
    const result = reconcileDraft([], pool.slice(0, 2), { kind: "questions", amount: 10 }, 3, false);
    expect(result.ids).toHaveLength(2);
    expect(result).toMatchObject({ exact: false, shortBy: 8 });
  });
  it("hits an exact marks total when one exists", () => {
    const result = reconcileDraft([], pool, { kind: "marks", amount: 9 }, 5, false);
    expect(result.totalMarks).toBe(9);
    expect(result.exact).toBe(true);
  });
  it("falls back to the closest total below an impossible marks target", () => {
    const threes = [q("x", 2, 1, 3), q("y", 2, 2, 3), q("z", 2, 3, 3)];
    const result = reconcileDraft([], threes, { kind: "marks", amount: 10 }, 5, false);
    expect(result).toMatchObject({ totalMarks: 9, exact: false, shortBy: 1 });
  });
  it("finds the truly closest total, not just a greedy one", () => {
    const local = [q("x", 2, 1, 8), q("y", 2, 2, 5), q("z", 2, 3, 5)];
    expect(reconcileDraft([], local, { kind: "marks", amount: 11 }, 3, false)).toMatchObject({ totalMarks: 10, exact: false, shortBy: 1 });
  });
  it("trims kept questions when the marks target falls", () => {
    const result = reconcileDraft(["d", "e", "f"], pool, { kind: "marks", amount: 11 }, 5, true);
    expect(result.totalMarks).toBeLessThanOrEqual(11);
    expect(result.ids.slice(0, 1)).toEqual(["d"]);
  });
  it("fills each paper target separately", () => {
    const result = reconcileDraft([], pool, { kind: "papers", targets: [{ paper: 4, mode: "questions", amount: 2 }, { paper: 2, mode: "marks", amount: 5 }] }, 9, false);
    const papers = result.ids.map((id) => pool.find((item) => item.id === id)!);
    expect(papers.filter((item) => item.paper === 4)).toHaveLength(2);
    expect(papers.filter((item) => item.paper === 2).reduce((sum, item) => sum + item.marks!, 0)).toBe(5);
    expect(result.exact).toBe(true);
  });
  it("keeps a reordered paper's order and appends top-ups", () => {
    const result = reconcileDraft(["f", "a"], pool, { kind: "questions", amount: 3 }, 2, true);
    expect(result.ids.slice(0, 2)).toEqual(["f", "a"]);
  });
  it("never exceeds 50 questions", () => {
    const big = Array.from({ length: 80 }, (_, index) => q(`q${index}`, 2, index, 1));
    expect(reconcileDraft([], big, { kind: "marks", amount: 70 }, 1, false).ids).toHaveLength(50);
  });
});

describe("swapCandidate", () => {
  it("prefers the same marks for a marks target, then the same topic", () => {
    const local = [q("a", 2, 1, 3, "Atoms"), q("b", 2, 2, 3, "Energy"), q("c", 2, 3, 5, "Atoms")];
    expect(swapCandidate(["a"], "a", local, { kind: "marks", amount: 3 }, 1)).toBe("b");
    expect(swapCandidate(["a"], "a", local, { kind: "questions", amount: 1 }, 1)).toBe("c");
  });
  it("stays on the same paper for paper targets and returns null when nothing is left", () => {
    expect(swapCandidate(["a"], "a", pool, { kind: "papers", targets: [{ paper: 2, mode: "questions", amount: 1 }] }, 4)).toMatch(/^[bc]$/);
    expect(swapCandidate(["a", "b"], "a", pool.slice(0, 2), { kind: "questions", amount: 2 }, 4)).toBeNull();
  });
});

describe("lowerTarget", () => {
  it("shrinks the target by what was removed, never below zero", () => {
    expect(lowerTarget({ kind: "questions", amount: 3 }, pool[0])).toEqual({ kind: "questions", amount: 2 });
    expect(lowerTarget({ kind: "marks", amount: 4 }, pool[3])).toEqual({ kind: "marks", amount: 0 });
    expect(lowerTarget({ kind: "papers", targets: [{ paper: 4, mode: "marks", amount: 10 }, { paper: 2, mode: "questions", amount: 1 }] }, pool[0]))
      .toEqual({ kind: "papers", targets: [{ paper: 4, mode: "marks", amount: 10 }] });
  });
});
