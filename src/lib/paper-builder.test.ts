import { describe, expect, it } from "vitest";
import { generatePaper, type PaperCandidate } from "@/lib/paper-builder";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import type { PublicBankIndex } from "@/lib/question-index";

const questions: PaperCandidate[] = [
  { id: "p1-a", paper: 1, year: 2024, marks: 1, primaryTopic: "Atoms", secondaryTopics: [] },
  { id: "p1-b", paper: 1, year: 2024, marks: 1, primaryTopic: "Energy", secondaryTopics: ["Atoms"] },
  { id: "p1-c", paper: 1, year: 2023, marks: 1, primaryTopic: "Atoms", secondaryTopics: [] },
  { id: "p2-a", paper: 2, year: 2024, marks: 3, primaryTopic: "Atoms", secondaryTopics: [] },
  { id: "p2-b", paper: 2, year: 2024, marks: 5, primaryTopic: "Atoms", secondaryTopics: [] },
  { id: "p2-c", paper: 2, year: 2024, marks: 7, primaryTopic: "Energy", secondaryTopics: [] },
];

describe("generatePaper", () => {
  it("samples exact per-paper question quotas from the selected year and secondary topics", () => {
    const result = generatePaper(questions, { mode: "questions", targets: [{ paper: 1, amount: 2 }, { paper: 2, amount: 1 }], yearFrom: 2024, yearTo: 2024, topics: ["Atoms"], seed: 42 });
    expect(result.questions.map((question) => question.paper)).toEqual([1, 1, 2]);
    expect(result.questions.map((question) => question.id)).toHaveLength(3);
    expect(new Set(result.questions.map((question) => question.id)).size).toBe(3);
    expect(result.questions.every((question) => question.year === 2024)).toBe(true);
    expect(result.totalMarks).toBe(5);
    expect(generatePaper(questions, { mode: "questions", targets: [{ paper: 1, amount: 2 }, { paper: 2, amount: 1 }], yearFrom: 2024, yearTo: 2024, topics: ["Atoms"], seed: 42 })).toEqual(result);
  });

  it("finds an exact mark target per paper without using unknown marks", () => {
    const result = generatePaper([...questions, { id: "unknown", paper: 2, year: 2024, marks: null, primaryTopic: "Atoms", secondaryTopics: [] }], { mode: "marks", targets: [{ paper: 1, amount: 2 }, { paper: 2, amount: 8 }], seed: 10 });
    expect(result.questions.filter((question) => question.paper === 1).map((question) => question.marks)).toEqual([1, 1]);
    expect(result.questions.filter((question) => question.paper === 2).map((question) => question.marks).sort()).toEqual([3, 5]);
    expect(result.totalMarks).toBe(10);
    expect(result.questions.map((question) => question.id)).not.toContain("unknown");
  });

  it("fails clearly rather than silently underfilling or returning an impossible marks mix", () => {
    expect(() => generatePaper(questions, { mode: "questions", targets: [{ paper: 1, amount: 4 }], seed: 1 })).toThrow(/Paper 1.*3 available/i);
    expect(() => generatePaper(questions, { mode: "marks", targets: [{ paper: 2, amount: 4 }], seed: 1 })).toThrow(/Paper 2.*exactly 4 marks/i);
    expect(() => generatePaper(questions, { mode: "questions", targets: [{ paper: 1, amount: 51 }], seed: 1 })).toThrow(/50/);
    expect(() => generatePaper(questions, { mode: "questions", targets: [{ paper: 1, amount: 0 }], seed: 1 })).toThrow(/choose/i);
    expect(() => generatePaper(questions, { mode: "questions", targets: [{ paper: 1, amount: 1 }, { paper: 1, amount: 1 }], seed: 1 })).toThrow(/duplicate/i);
  });

  it("finds a short exact-marks combination even after many smaller subsets reach the same sum", () => {
    const manyOnes: PaperCandidate[] = Array.from({ length: 50 }, (_, index) => ({ id: `one-${index}`, paper: 2, year: 2024, marks: 1, primaryTopic: "Atoms", secondaryTopics: [] }));
    const pool = [...manyOnes, { ...manyOnes[0], id: "fifty", marks: 50 }, { ...manyOnes[0], id: "ten", marks: 10 }];
    for (let seed = 0; seed < 350; seed++) {
      const result = generatePaper(pool, { mode: "marks", targets: [{ paper: 2, amount: 60 }], seed });
      expect(result.totalMarks).toBe(60);
      expect(result.questions.length).toBeLessThanOrEqual(50);
    }
  });

  it("builds a five-per-paper Chemistry set from the real generated index", () => {
    const source = join(process.cwd(), "public", "bank-index", PUBLIC_BANK_INDEX_FILES["igcse-chemistry-0620"]);
    const index = JSON.parse(readFileSync(source, "utf8")) as PublicBankIndex;
    const result = generatePaper(index.questions, { mode: "questions", targets: [{ paper: 1, amount: 5 }, { paper: 2, amount: 5 }], yearFrom: 2023, yearTo: 2025, seed: 126 });
    expect(result.questions.map((question) => question.paper)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    expect(new Set(result.questions.map((question) => question.id)).size).toBe(10);
    expect(result.questions.every((question) => question.year >= 2023 && question.year <= 2025)).toBe(true);
    expect(result.totalMarks).toBeGreaterThan(0);
  });
});
