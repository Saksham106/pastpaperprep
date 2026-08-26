import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { loadBankQuestions } from "@/lib/questions";

describe("question normalization", () => {
  it("loads every source bank without dropping questions", () => {
    expect(loadBankQuestions("igcse")).toHaveLength(2684);
    expect(loadBankQuestions("igcse-additional")).toHaveLength(1633);
    expect(loadBankQuestions("ib-hl")).toHaveLength(841);
    expect(loadBankQuestions("ib-sl")).toHaveLength(578);
    expect(loadBankQuestions("ib-ai-hl")).toHaveLength(409);
    expect(loadBankQuestions("ib-ai-sl")).toHaveLength(334);
  });

  it("keeps every question's skill labels unique", () => {
    for (const bank of ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"] as const) {
      for (const question of loadBankQuestions(bank)) {
        expect(new Set(question.skills).size, `${bank}/${question.id}`).toBe(question.skills.length);
      }
    }
  });

  it("turns source-relative assets into working public URLs", () => {
    const [question] = loadBankQuestions("igcse");
    expect(question.questionImages[0]).toMatch(
      /^https:\/\/saksham106\.github\.io\/igcse-0580-topic-practice\/questions\//,
    );
  });

  it("preserves bank-specific metadata and official markscheme images", () => {
    const igcse = loadBankQuestions("igcse")[0];
    const ibHl = loadBankQuestions("ib-hl");
    const markedQuestion = ibHl.find((question) => question.markschemeImages.length > 0);

    expect(igcse.component).toBe("22");
    expect(igcse.calculator).toBe(false);
    expect(igcse.subtopics).toContain("Fractions, decimals and percentages");
    expect(ibHl[0].courseEra).toBe("aa-hl");
    expect(ibHl[0].zone).toBe("TZA");
    expect(markedQuestion?.markschemeImages[0]).toMatch(
      /^https:\/\/saksham106\.github\.io\/ib-maths-aa-hl-topic-practice\/markschemes\//,
    );
    expect(igcse.questionAssetPaths[0]).toBe(
      "igcse/questions/0580-2026-march-22-q1.webp",
    );
    expect(markedQuestion?.markschemeAssetPaths[0]).toMatch(
      /^ib-hl\/markschemes\//,
    );
  });

  it("keeps detailed IGCSE audit labels out of the student-facing subtopic filter", () => {
    const questions = loadBankQuestions("igcse");
    const subtopics = new Set(questions.flatMap((question) => question.subtopics));

    expect(subtopics.size).toBe(31);
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

  it("supports multi-select subtopics and bank-specific filters", () => {
    const questions = loadBankQuestions("igcse");
    const results = filterQuestions(questions, {
      topics: ["Number"],
      subtopics: ["Fractions, decimals and percentages"],
      sessions: ["March"],
      components: ["22"],
      calculator: ["non-calculator"],
      sort: "marks-desc",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((question) => question.primaryTopic === "Number")).toBe(true);
    expect(results.every((question) => question.component === "22")).toBe(true);
    expect(results.every((question) => question.calculator === false)).toBe(true);
    expect(results.every((question) => question.subtopics.includes("Fractions, decimals and percentages"))).toBe(true);
    expect(results[0].marks).toBeGreaterThanOrEqual(results.at(-1)?.marks ?? 0);
  });
});
