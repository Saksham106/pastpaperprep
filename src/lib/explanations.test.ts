import { describe, expect, it } from "vitest";
import { assetPathsForKind, isAssetKind } from "@/lib/asset-kinds";
import { parseExplanation } from "@/lib/explanation-format";
import { explanationObjectPath, isExplanationObjectPath } from "@/lib/explanations";
import { formatPartLabel, renderInlineMath } from "@/components/ExplanationPanel";

const doc = {
  schemaVersion: 1,
  bank: "ib-hl",
  questionId: "2025-may-tz1-p1-q1",
  totalMarks: 2,
  parts: [{ label: "a", marks: 2, approach: "Set $y = 0$.", steps: [{ text: "So $x = 4$.", marks: ["M1", "A1"] }], answer: "$x = 4$" }],
};

describe("explanation paths", () => {
  it("builds R2 keys under the explanations prefix only", () => {
    expect(explanationObjectPath("ib-hl", "2025-may-tz1-p1-q1")).toBe("explanations/ib-hl/2025-may-tz1-p1-q1.json");
    expect(() => explanationObjectPath("ib-hl", "../secrets")).toThrow();
    expect(isExplanationObjectPath("explanations/ib-hl/q1.json")).toBe(true);
    for (const path of ["ib-hl/markschemes/q1.json", "explanations/ib-hl/../q1.json", "/explanations/ib-hl/q1.json", "explanations/ib-hl/q1.webp", "explanations/IB/q1.json"]) {
      expect(isExplanationObjectPath(path)).toBe(false);
    }
  });

  it("maps each asset kind to its own paths", () => {
    const entry = { questionAssetPaths: ["q.webp"], markschemeAssetPaths: ["m.webp"], explanationAssetPaths: ["explanations/b/e.json"] };
    expect(assetPathsForKind(entry, "question")).toEqual(["q.webp"]);
    expect(assetPathsForKind(entry, "answer")).toEqual(["m.webp"]);
    expect(assetPathsForKind(entry, "explanation")).toEqual(["explanations/b/e.json"]);
    expect(assetPathsForKind({ questionAssetPaths: [], markschemeAssetPaths: [] }, "explanation")).toEqual([]);
    expect(isAssetKind("explanation")).toBe(true);
    expect(isAssetKind("pdf")).toBe(false);
  });
});

describe("parseExplanation", () => {
  it("accepts the published format for the requested question only", () => {
    expect(parseExplanation(doc, "ib-hl", "2025-may-tz1-p1-q1")).toEqual(doc);
    expect(parseExplanation(doc, "ib-hl", "another-question")).toBeNull();
    expect(parseExplanation(doc, "ib-sl", "2025-may-tz1-p1-q1")).toBeNull();
  });

  it("rejects malformed documents", () => {
    expect(parseExplanation(null, "ib-hl", doc.questionId)).toBeNull();
    expect(parseExplanation({ ...doc, schemaVersion: 2 }, "ib-hl", doc.questionId)).toBeNull();
    expect(parseExplanation({ ...doc, parts: [{ ...doc.parts[0], steps: [{ text: 1, marks: [] }] }] }, "ib-hl", doc.questionId)).toBeNull();
    expect(parseExplanation({ ...doc, parts: [{ ...doc.parts[0], marks: "2" }] }, "ib-hl", doc.questionId)).toBeNull();
  });
});

describe("explanation rendering", () => {
  it("escapes text and renders maths with KaTeX", () => {
    const html = renderInlineMath("If <b>x</b> & $\\frac{1}{2}$");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; ");
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("<b>");
  });

  it("falls back to escaped text when dollars are unbalanced", () => {
    expect(renderInlineMath("costs $5 <now>")).toBe("costs $5 &lt;now&gt;");
  });

  it("formats part labels like the paper", () => {
    expect(formatPartLabel("a")).toBe("(a)");
    expect(formatPartLabel("b(iii)")).toBe("(b)(iii)");
    expect(formatPartLabel("")).toBe("");
  });
});
