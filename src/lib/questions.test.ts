import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy";
import { normalizeBankQuestions } from "@/lib/questions";

describe("question normalization", () => {
  it("produces canonical ordering from shuffled input, including duplicate sort keys", () => {
    const raw = [
      { id: "same-key-b", number: 1, paper: 1, year: 2025 },
      { id: "older", number: 9, paper: 2, year: 2024 },
      { id: "later-number", number: 2, paper: 1, year: 2025 },
      { id: "same-key-a", number: 1, paper: 1, year: 2025 },
      { id: "later-paper", number: 1, paper: 2, year: 2025 },
      { id: "newer", number: 1, paper: 1, year: 2026 },
    ] as Parameters<typeof normalizeBankQuestions>[1];
    const expected = ["newer", "same-key-a", "same-key-b", "later-number", "later-paper", "older"];
    const shuffled = [raw[4], raw[0], raw[5], raw[2], raw[1], raw[3]];

    expect(normalizeBankQuestions("ib-chemistry-hl", raw).map(({ id }) => id)).toEqual(expected);
    expect(normalizeBankQuestions("ib-chemistry-hl", shuffled).map(({ id }) => id)).toEqual(expected);
  });

  it("loads every source bank without dropping questions", () => {
    expect(loadBankQuestions("igcse")).toHaveLength(3967);
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
    const igcse = loadBankQuestions("igcse").find(
      (question) => question.id === "0580-2026-march-22-q1",
    )!;
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

  it("exposes the complete refined IGCSE vocabulary to the student-facing subtopic filter", () => {
    const questions = loadBankQuestions("igcse");
    const subtopics = new Set(questions.flatMap((question) => question.subtopics));

    expect(subtopics.size).toBe(51);
  });

  it("promotes reconciled detailed IGCSE labels into filterable skills", () => {
    const question = loadBankQuestions("igcse").find(
      (candidate) => candidate.id === "0580-2026-march-22-q18",
    );

    expect(question?.subtopics).toEqual([
      "Algebraic manipulation",
      "Area and perimeter",
      "Equations and inequalities",
      "Quadratic equations and functions",
      "Volume and surface area",
    ]);
    expect(question?.skills).toEqual([
      "Algebraic manipulation",
      "Area and perimeter",
      "Equations and inequalities",
      "Quadratic equations and functions",
      "Volume and surface area",
    ]);
    expect(
      filterQuestions(loadBankQuestions("igcse"), { subtopics: ["Quadratic equations and functions"] })
        .some((candidate) => candidate.id === question?.id),
    ).toBe(true);
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

  it("finds questions through material secondary topics and skills", () => {
    const questions = loadBankQuestions("igcse");
    const crossTopic = questions.find((question) => question.secondaryTopics.length > 0);
    expect(crossTopic).toBeDefined();

    const secondaryTopic = crossTopic!.secondaryTopics[0];
    const topicResults = filterQuestions(questions, { topics: [secondaryTopic] });
    expect(topicResults.some((question) => question.id === crossTopic!.id)).toBe(true);

    const skill =
      crossTopic!.skills.find((candidate) => !crossTopic!.subtopics.includes(candidate))
      ?? crossTopic!.skills[0];
    expect(skill).toBeDefined();
    const skillResults = filterQuestions(questions, { subtopics: [skill!] });
    expect(skillResults.some((question) => question.id === crossTopic!.id)).toBe(true);
  });

  it("treats the singular topic filter as the plural secondary-aware filter", () => {
    const questions = loadBankQuestions("igcse");
    const crossTopic = questions.find((question) => question.secondaryTopics.length > 0)!;
    const secondaryTopic = crossTopic.secondaryTopics[0];

    const singular = filterQuestions(questions, { topic: secondaryTopic });
    const plural = filterQuestions(questions, { topics: [secondaryTopic] });

    expect(singular.map((question) => question.id)).toEqual(plural.map((question) => question.id));
    expect(singular.some((question) => question.id === crossTopic.id)).toBe(true);
  });

  it("uses stable 0580 subtopic ownership instead of observed topic leakage", () => {
    const questions = loadBankQuestions("igcse");
    const groups = getSubtopicGroups(questions, ["Mensuration"], []);

    expect(groups.relevant).toEqual([
      "Area and perimeter",
      "Circular measure: arcs, sectors and segments",
      "Compound shapes",
      "Density, mass and volume",
      "Volume and surface area",
    ]);
    expect(groups.relevant).not.toContain("Algebraic manipulation");
    expect(getControlledSubtopics("igcse", "Mensuration")).toEqual([
      "Area and perimeter",
      "Volume and surface area",
      "Circular measure: arcs, sectors and segments",
      "Compound shapes",
      "Density, mass and volume",
    ]);
  });

  it("offers topics that appear only as secondary classifications", () => {
    const questions = loadBankQuestions("igcse");
    const synthetic = questions.map((question) => ({ ...question, primaryTopic: "Number" }));
    synthetic[0] = { ...synthetic[0], secondaryTopics: ["Statistics"] };

    expect(getTopicOptions(synthetic)).toContain("Statistics");
  });
});
