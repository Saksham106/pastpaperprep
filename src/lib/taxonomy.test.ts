import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy";

describe("question taxonomy", () => {
  it("orders IB topics by the official syllabus sequence", () => {
    expect(getTopicOptions(loadBankQuestions("ib-hl"))).toEqual([
      "Number and algebra",
      "Functions",
      "Geometry and trigonometry",
      "Statistics and probability",
      "Calculus",
    ]);
  });

  it("orders IGCSE topics by the syllabus sequence", () => {
    expect(getTopicOptions(loadBankQuestions("igcse"))).toEqual([
      "Number",
      "Algebra and graphs",
      "Coordinate geometry",
      "Geometry",
      "Mensuration",
      "Trigonometry",
      "Transformations and vectors",
      "Probability",
      "Statistics",
    ]);
  });

  it("orders Additional Mathematics topics across the historical syllabus range", () => {
    expect(getTopicOptions(loadBankQuestions("igcse-additional"))).toEqual([
      "Set language and notation",
      "Functions",
      "Quadratic functions",
      "Indices and surds",
      "Factors of polynomials",
      "Equations, inequalities and graphs",
      "Simultaneous equations",
      "Logarithmic and exponential functions",
      "Straight-line graphs",
      "Coordinate geometry of the circle",
      "Circular measure",
      "Trigonometry",
      "Permutations and combinations",
      "Series",
      "Vectors in two dimensions",
      "Matrices",
      "Calculus",
    ]);
  });

  it("shows only the selected IB topic taxonomy before other subtopics", () => {
    const questions = loadBankQuestions("ib-sl");
    const groups = getSubtopicGroups(questions, ["Calculus"], []);

    expect(groups.relevant).toEqual([
      "Differentiation",
      "Integration",
      "Differential equations",
      "Kinematics",
    ]);
    expect(groups.other).not.toContain("Differentiation");
    expect(groups.other).toContain("Sequences and series");
  });

  it("uses only primary-topic IGCSE questions for contextual subtopics", () => {
    const questions = loadBankQuestions("igcse");
    const groups = getSubtopicGroups(questions, ["Probability"], []);
    const expected = [...new Set(
      questions
        .filter((question) => question.primaryTopic === "Probability")
        .flatMap((question) => question.subtopics),
    )].sort();

    expect(groups.relevant).toEqual(expected);
    expect(groups.relevant.length).toBeLessThan(groups.all.length);
    expect(groups.other.some((value) => expected.includes(value))).toBe(false);
  });

  it("keeps selected subtopics visible when their parent topic changes", () => {
    const groups = getSubtopicGroups(
      loadBankQuestions("ib-sl"),
      ["Calculus"],
      ["Sequences and series"],
    );

    expect(groups.selectedOutsideContext).toEqual(["Sequences and series"]);
  });
});