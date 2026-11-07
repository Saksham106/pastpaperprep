import { describe, expect, it } from "vitest";
import { calculatorErrors, snippetFileErrors } from "./calculators";
import { renderInlineHtml, renderTex } from "./render";

describe("chemistry notation (mhchem) in lesson maths", () => {
  const cases = ["\\ce{2H2(g) + O2(g) -> 2H2O(l)}", "\\ce{N2 + 3H2 <=> 2NH3}", "\\ce{SO4^2-}", "\\pu{8.31 J K-1 mol-1}"];

  it("renders \\ce and \\pu through renderTex, inline and display", () => {
    for (const tex of cases) {
      for (const display of [false, true]) {
        const html = renderTex(tex, display);
        expect(html, tex).toContain("katex");
        expect(html, tex).not.toContain("katex-error");
      }
    }
  });

  it("renders them inside lesson inline text", () => {
    const html = renderInlineHtml("Water forms: $\\ce{2H2(g) + O2(g) -> 2H2O(l)}$, with $R = \\pu{8.31 J K-1 mol-1}$.");
    expect(html.match(/class="katex"/g)).toHaveLength(2);
    // Upright element symbols and a real reaction arrow, not italic letters and a literal "->".
    expect(html).toContain("<mi mathvariant=\"normal\">H</mi>");
    expect(html).toMatch(/<mo stretchy="true"[^>]*>→<\/mo>/);
    expect(renderTex("\\ce{N2 + 3H2 <=> 2NH3}", false)).toMatch(/<mo[^>]*>⇌<\/mo>/);
  });

  it("still throws on invalid TeX, so a bad lesson fails the build", () => {
    expect(() => renderTex("\\ce{H2O", false)).toThrow();
    expect(() => renderTex("\\notacommand", false)).toThrow();
  });
});

describe("a course with no calculators", () => {
  it("is valid, and rejects every calculator block", () => {
    expect(snippetFileErrors({}, [])).toEqual([]);
    expect(calculatorErrors({ type: "calculator", steps: {} }, [])).toHaveLength(1);
    expect(calculatorErrors({ type: "calculator", steps: { casio: ["Press ="] } }, [])).toHaveLength(1);
    expect(calculatorErrors({ type: "calculator", snippet: "hcf" }, [], { hcf: { title: "HCF", steps: {} } })).toHaveLength(1);
  });
});
