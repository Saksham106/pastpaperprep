import { describe, expect, it } from "vitest";
import { filterQuestions, loadBankQuestions } from "@/lib/questions";

describe("question normalization", () => {
  it("loads every source bank without dropping questions", () => {
    expect(loadBankQuestions("igcse")).toHaveLength(2684);
    expect(loadBankQuestions("ib-hl")).toHaveLength(841);
    expect(loadBankQuestions("ib-sl")).toHaveLength(578);
  });

  it("turns source-relative assets into working public URLs", () => {
    const [question] = loadBankQuestions("igcse");
    expect(question.questionImages[0]).toMatch(
      /^https:\/\/swati1977\.github\.io\/igcse-0580-topic-practice\/questions\//,
    );
  });
});

describe("question filtering", () => {
  it("filters by topic, year, paper, and search text", () => {
    const questions = loadBankQuestions("ib-sl");
    const results = filterQuestions(questions, {
      topic: "Calculus",
      year: "2026",
      paper: "1",
      search: "tangent",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((question) => question.primaryTopic === "Calculus")).toBe(true);
    expect(results.every((question) => question.year === 2026)).toBe(true);
    expect(results.every((question) => question.paper === 1)).toBe(true);
    expect(results.some((question) => question.searchText.includes("tangent"))).toBe(true);
  });
});
