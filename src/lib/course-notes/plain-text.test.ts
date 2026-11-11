import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fitMetaDescription, inlineToPlainText, texToText } from "./plain-text";

describe("texToText", () => {
  it.each([
    ["3.06 \\times 10^{-5}", "3.06 × 10⁻⁵"],
    ["\\Delta G = \\Delta H - T\\Delta S", "ΔG = ΔH − TΔS"],
    ["\\mathrm{pH} = -\\log_{10}[\\ce{H^+}]", "pH = −log₁₀[H⁺]"],
    ["\\tau = Fr\\sin\\theta", "τ = Frsin θ"],
    ["L = \\frac{L_0}{\\gamma}", "L = L₀/γ"],
    ["\\frac{4x + 10}{(x - 5)(x + 1)}", "(4x + 10)/((x − 5)(x + 1))"],
    ["\\ce{CO2}", "CO₂"],
    ["\\lvert r \\rvert < 1", "|r| < 1"],
    ["\\log_{a}x", "logₐx"],
    ["8^{\\frac{2}{3}}", "8^(2/3)"],
    ["\\sqrt{x^2 + y^2}", "√(x² + y²)"],
    ["(f \\circ g)(x) = f(g(x))", "(f ∘ g)(x) = f(g(x))"],
    ["90^{\\circ}", "90°"],
    ["45^\\circ", "45°"],
  ])("%s → %s", (tex, text) => expect(texToText(tex)).toBe(text));
});

describe("lesson summaries with a circle", () => {
  const summary = (file: string) => JSON.parse(readFileSync(path.join(process.cwd(), "src/content/notes", file), "utf8")).summary as string;
  it.each(["ib-math-aa/lessons/2-5.json", "ib-math-ai/lessons/2-7.json"])("%s keeps composition as ∘, not a degree sign", (file) => {
    const text = inlineToPlainText(summary(file));
    expect(text).toContain("(f ∘ g)(x)");
    expect(text).not.toContain("°");
  });
});

describe("inlineToPlainText", () => {
  it("keeps glossary labels and turns maths into text", () => {
    expect(inlineToPlainText("[[standard-form|Standard form]] writes $3.06 \\times 10^{-5}$ short.")).toBe("Standard form writes 3.06 × 10⁻⁵ short.");
  });
});

describe("fitMetaDescription", () => {
  it("keeps whole sentences that fit and doesn't split decimals", () => {
    const text = "Chemists count atoms in moles of particles, because atoms are far too small to count one at a time. One mole is 6.02 × 10²³ particles. A second long sentence follows here and pushes the total length well past the limit.";
    expect(fitMetaDescription(text)).toBe("Chemists count atoms in moles of particles, because atoms are far too small to count one at a time. One mole is 6.02 × 10²³ particles.");
  });
  it("cuts at a word with an ellipsis when the first sentence is too long", () => {
    const fitted = fitMetaDescription(`${"word ".repeat(60)}end.`);
    expect(fitted.length).toBeLessThanOrEqual(160);
    expect(fitted.endsWith("word…")).toBe(true);
  });
});

describe("every published lesson summary", () => {
  const root = path.join(process.cwd(), "src/content/notes");
  const summaries = readdirSync(root).flatMap((course) => {
    const dir = path.join(root, course, "lessons");
    return existsSync(dir) ? readdirSync(dir).map((file) => [`${course}/${file}`, JSON.parse(readFileSync(path.join(dir, file), "utf8")).summary as string] as const) : [];
  });

  it("becomes a markup-free meta description of 110–160 characters", () => {
    expect(summaries.length).toBeGreaterThan(300);
    for (const [file, summary] of summaries) {
      const meta = fitMetaDescription(inlineToPlainText(summary));
      expect(meta, file).not.toMatch(/[\\{}$]|\[\[/);
      expect(meta.length, file).toBeLessThanOrEqual(160);
      expect(meta.length, file).toBeGreaterThanOrEqual(110);
    }
  });
});
