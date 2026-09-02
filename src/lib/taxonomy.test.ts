import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy";

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

  it("groups Additional Mathematics syllabus sections into a useful two-level hierarchy", () => {
    expect(getTopicOptions(loadBankQuestions("igcse-additional"))).toEqual([
      "Sets and functions",
      "Algebra",
      "Coordinate geometry",
      "Geometry and trigonometry",
      "Combinatorics and series",
      "Vectors and matrices",
      "Calculus",
    ]);

    expect(getSubtopicGroups(loadBankQuestions("igcse-additional"), ["Algebra"], []).relevant).toEqual([
      "Equations, inequalities and graphs",
      "Factors of polynomials",
      "Indices and surds",
      "Logarithmic and exponential functions",
      "Quadratic functions",
      "Simultaneous equations",
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

  it("uses stable controlled IGCSE ownership for contextual subtopics", () => {
    const questions = loadBankQuestions("igcse");
    const groups = getSubtopicGroups(questions, ["Probability"], []);
    const expected = [...getControlledSubtopics("igcse", "Probability")].sort();

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