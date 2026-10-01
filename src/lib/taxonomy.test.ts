import { describe, expect, it } from "vitest";
import { loadBankQuestions } from "@/lib/question-fixtures";
import rawAdditional from "@/data/raw/igcse-additional.json";
import { filterQuestions } from "@/lib/question-filter";
import { getControlledSubtopics, getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy";
import { getSubtopicGroups as getStudentSubtopicGroups, getTopicOptions as getStudentTopicOptions } from "@/lib/taxonomy-router";

describe("question taxonomy", () => {
  it("shows the official 0580 tree independent of question assignments and preserves hierarchy", () => {
    const questions = loadBankQuestions("igcse");
    const topics = getStudentTopicOptions(questions);
    expect(topics.slice(0, 9)).toEqual(["Number", "Algebra and graphs", "Coordinate geometry", "Geometry", "Mensuration", "Trigonometry", "Transformations and vectors", "Probability", "Statistics"]);
    expect(topics).toHaveLength(9);
    const groups = getStudentSubtopicGroups(questions, topics, []);
    expect(groups.all).toHaveLength(124);
    expect(groups.all).toContain("1.1 Types of number");
    expect(groups.all).toContain("9.3 Averages and measures of spread");
    expect(getStudentTopicOptions([{ ...questions[0], subtopics: [] }])).toEqual(topics);
    expect(getStudentSubtopicGroups([{ ...questions[0], subtopics: [], officialCodeRefs: [] }], ["Number"], []).all).toHaveLength(72);
  });

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

  it("preserves the sealed historical 0606 ownership vocabulary for existing URLs", () => {
    const source = new Map(rawAdditional.questions.map((question) => [question.id, question]));
    const historical = loadBankQuestions("igcse-additional").map((question) => ({
      ...question,
      primaryTopic: source.get(question.id)!.primaryTopic,
      secondaryTopics: source.get(question.id)!.secondaryTopics,
    }));
    expect(getTopicOptions(historical)).toEqual([
      "Sets and functions",
      "Algebra",
      "Coordinate geometry",
      "Geometry and trigonometry",
      "Combinatorics and series",
      "Vectors and matrices",
      "Calculus",
    ]);

    expect(getSubtopicGroups(historical, ["Algebra"], []).relevant).toEqual([
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
      "Differentiation and tangents",
      "Second derivatives, optimization and kinematics",
      "Antidifferentiation, definite integrals and area",
    ]);
    expect(groups.other).not.toContain("Differentiation and tangents");
    expect(groups.other).toContain("Arithmetic, geometric and financial sequences");
  });

  it("uses stable controlled IGCSE ownership for contextual subtopics", () => {
    const questions = loadBankQuestions("igcse");
    const groups = getSubtopicGroups(questions, ["Probability"], []);
    const expected = [...getControlledSubtopics("igcse", "Probability")].sort();

    expect(groups.relevant).toEqual(expected);
    expect(groups.relevant.length).toBeLessThan(groups.all.length);
    expect(groups.other.some((value) => expected.includes(value))).toBe(false);
  });

  it("keeps old 0580 labels searchable but only official sections and review in the picker", () => {
    const source = loadBankQuestions("igcse")[0];
    const question = {
      ...source,
      id: "synthetic-0580-filter-test",
      subtopics: ["Historical-era label"],
      skills: ["internal.skill.code", "Student-facing search skill"],
      searchText: "student-facing search skill",
    };
    const groups = getStudentSubtopicGroups([question], ["Number"], []);

    expect(groups.all).not.toContain("Historical-era label");
    expect(groups.all).not.toContain("Bounds and estimation");
    expect(groups.all).toContain("1.10 Limits of accuracy");
    expect(groups.all).not.toContain("internal.skill.code");
    expect(groups.all).not.toContain("Student-facing search skill");
    expect(groups.relevant).toContain("1.10 Limits of accuracy");
    expect(filterQuestions([question], { subtopics: ["1.10 Limits of accuracy"] })).toEqual([]);
    expect(filterQuestions([question], { subtopics: ["Historical-era label"] })).toHaveLength(1);
    // Historical filter URLs remain valid because the retrieval predicate still
    // accepts the skill token even though the option is no longer advertised.
    expect(filterQuestions([question], { subtopics: ["Student-facing search skill"] })).toHaveLength(1);
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