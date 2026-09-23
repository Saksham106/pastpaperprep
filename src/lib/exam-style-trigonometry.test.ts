import { describe, expect, it } from "vitest";
import { EXAM_STYLE_TRIGONOMETRY_SETS, getExamStyleTrigonometrySet } from "./exam-style-trigonometry";

describe("IB SL trigonometry exam-style asset allowlist", () => {
  it("contains exactly the five published sets and their private object keys", () => {
    expect(EXAM_STYLE_TRIGONOMETRY_SETS).toHaveLength(5);
    expect(EXAM_STYLE_TRIGONOMETRY_SETS.map((set) => set.slug)).toEqual([
      "trigonometric-graphs",
      "modeling-trigonometric-functions",
      "trigonometric-relations-and-values",
      "trigonometric-equations-and-identities",
      "trigonometric-transformations",
    ]);
    expect(EXAM_STYLE_TRIGONOMETRY_SETS.map((set) => [set.slug, set.count])).toEqual([
      ["trigonometric-graphs", 21],
      ["modeling-trigonometric-functions", 17],
      ["trigonometric-relations-and-values", 13],
      ["trigonometric-equations-and-identities", 9],
      ["trigonometric-transformations", 7],
    ]);
    expect(EXAM_STYLE_TRIGONOMETRY_SETS.every((set) =>
      set.objectKey.startsWith("resources/ib-math-aa-sl/trigonometry/") && set.objectKey.endsWith(".pdf")
    )).toBe(true);
  });

  it("rejects unknown, traversal, and empty slugs", () => {
    expect(getExamStyleTrigonometrySet("not-a-set")).toBeUndefined();
    expect(getExamStyleTrigonometrySet("../trigonometric-graphs")).toBeUndefined();
    expect(getExamStyleTrigonometrySet("")).toBeUndefined();
  });
});
