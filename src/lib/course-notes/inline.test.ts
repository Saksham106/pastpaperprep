import { describe, expect, it } from "vitest";
import { parseInline } from "./inline";

describe("parseInline", () => {
  it("splits text, math, term and lesson tokens", () => {
    expect(parseInline("Let $x^2$ be a [[root|zero]]; see {{lesson:5.15}}.")).toEqual([
      { kind: "text", value: "Let " },
      { kind: "math", tex: "x^2" },
      { kind: "text", value: " be a " },
      { kind: "term", id: "root", label: "zero" },
      { kind: "text", value: "; see " },
      { kind: "lesson", item: "5.15" },
      { kind: "text", value: "." },
    ]);
  });
  it("keeps an escaped dollar as text", () => {
    expect(parseInline("Costs \\$5 and $y$")).toEqual([{ kind: "text", value: "Costs $5 and " }, { kind: "math", tex: "y" }]);
  });
  it("leaves a dollar inside math escaped for KaTeX", () => {
    expect(parseInline("$\\$5$")).toEqual([{ kind: "math", tex: "\\$5" }]);
  });
  it("throws on an unclosed dollar", () => {
    expect(() => parseInline("price $5")).toThrow(/Unclosed/);
  });
  it("passes plain brackets through", () => {
    expect(parseInline("[a] {b}")).toEqual([{ kind: "text", value: "[a] {b}" }]);
  });
  it("throws on empty math", () => {
    expect(() => parseInline("a $$ b")).toThrow(/Empty math/);
  });
  it.each(["[[Discriminant|x]]", "[[id]]", "{{lesson:5}}"])("throws on malformed markup %s", (text) => {
    expect(() => parseInline(`see ${text}`)).toThrow(/Malformed markup/);
  });
});
