import { describe, expect, it } from "vitest";
import { mergeGlossary } from "./glossary";

const term = (id: string, definition: string, lesson = "5.5") => ({ id, term: id, definition, lesson });

describe("mergeGlossary", () => {
  it("collapses identical duplicates and sorts by id", () => {
    const merged = mergeGlossary({ "5-5": [term("integrand", "The function.")], "5-16": [term("integrand", "The function."), term("by-parts", "A rule.", "5.16")] });
    expect(merged.map((entry) => entry.id)).toEqual(["by-parts", "integrand"]);
  });

  it("throws on a duplicate id whose entries conflict, naming both files", () => {
    expect(() => mergeGlossary({ "5-5": [term("integrand", "The function.")], "5-16": [term("integrand", "Something else.")] })).toThrow(/integrand.*5-5.*5-16|integrand.*5-16.*5-5/);
    expect(() => mergeGlossary({ "5-5": [term("integrand", "Same.", "5.5")], "5-16": [term("integrand", "Same.", "5.10")] })).toThrow(/integrand/);
  });
});
