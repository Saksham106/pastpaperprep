import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExplanation } from "@/lib/explanation-client";
import { assetPathsForKind, isAssetKind } from "@/lib/asset-kinds";
import { parseExplanation } from "@/lib/explanation-format";
import { explanationObjectPath, hasExplanation, isExplanationObjectPath } from "@/lib/explanations";
import { formatPartLabel, renderInlineMath } from "@/components/ExplanationPanel";
import available from "@/data/explanations/available.json";

const doc = {
  schemaVersion: 1,
  bank: "ib-hl",
  questionId: "2025-may-tz1-p1-q1",
  totalMarks: 2,
  parts: [{ label: "a", marks: 2, approach: "Set $y = 0$.", steps: [{ text: "So $x = 4$.", marks: ["M1", "A1"] }], answer: "$x = 4$" }],
};

describe("explanation paths", () => {
  it("answers per bank, so a question ID published in one bank never lights up another", () => {
    // AI SL and AI HL share hundreds of question IDs; pick one AI SL publishes and AI HL does not.
    const onlyInSl = available["ib-ai-sl"].find((id) => !available["ib-ai-hl"].includes(id));
    expect(onlyInSl).toBeDefined();
    expect(hasExplanation("ib-ai-sl", onlyInSl!)).toBe(true);
    expect(hasExplanation("ib-ai-hl", onlyInSl!)).toBe(false);
  });

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

  it.each([
    { ...doc, totalMarks: undefined },
    { ...doc, totalMarks: -1 },
    { ...doc, totalMarks: 3 },
    { ...doc, parts: [] },
    { ...doc, parts: [{ ...doc.parts[0], steps: Array.from({ length: 11 }, () => doc.parts[0].steps[0]) }] },
    { ...doc, parts: [{ ...doc.parts[0], unexpected: true }] },
    { ...doc, parts: [{ ...doc.parts[0], steps: [{ ...doc.parts[0].steps[0], unexpected: true }] }] },
    { ...doc, status: "needs_review", reviewNote: "Cannot read the question" },
    { ...doc, parts: [{ ...doc.parts[0], marks: -2 }] },
    { ...doc, parts: [{ ...doc.parts[0], approach: " " }] },
    { ...doc, parts: [{ ...doc.parts[0], answer: "" }] },
    { ...doc, parts: [{ ...doc.parts[0], steps: [] }] },
    { ...doc, parts: [{ ...doc.parts[0], label: "invalid" }] },
    { ...doc, totalMarks: 4, parts: [doc.parts[0], doc.parts[0]] },
    { ...doc, parts: [{ ...doc.parts[0], steps: [{ text: " ", marks: [] }] }] },
    { ...doc, parts: [{ ...doc.parts[0], steps: [{ text: "Work", marks: ["NOT-A-MARK"] }] }] },
    { ...doc, parts: [{ ...doc.parts[0], mistake: "" }] },
    { ...doc, parts: [{ ...doc.parts[0], steps: [{ text: "Work", math: "", marks: [] }] }] },
  ])("rejects incomplete or inconsistent published documents %#", (invalid) => {
    expect(parseExplanation(invalid, doc.bank, doc.questionId)).toBeNull();
  });

  it("accepts empty whole-question labels and the published tick/dependent mark codes", () => {
    const whole = { ...doc, parts: [{ ...doc.parts[0], label: "", steps: [{ text: "Work", marks: ["✓", "M1dep", "(A1)", "SC1", "AG"] }] }] };
    expect(parseExplanation(whole, doc.bank, doc.questionId)).toEqual(whole);
  });

  it("rejects malformed documents", () => {
    expect(parseExplanation(null, "ib-hl", doc.questionId)).toBeNull();
    expect(parseExplanation({ ...doc, schemaVersion: 2 }, "ib-hl", doc.questionId)).toBeNull();
    expect(parseExplanation({ ...doc, parts: [{ ...doc.parts[0], steps: [{ text: 1, marks: [] }] }] }, "ib-hl", doc.questionId)).toBeNull();
    expect(parseExplanation({ ...doc, parts: [{ ...doc.parts[0], marks: "2" }] }, "ib-hl", doc.questionId)).toBeNull();
  });
});

describe("explanation client", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([true, false])("loads through the correct free=%s route without prefetching paid content", async (free) => {
    vi.stubEnv("NEXT_PUBLIC_EXPLANATIONS_DEV", "0");
    const url = "https://assets.example/explanation.json";
    const asset = { questionId: doc.questionId, kind: "explanation", urls: [url] };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(free
      ? { expiresIn: 86400, maxAge: 72000, asset }
      : { expiresIn: 600, assets: [asset] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(doc)));
    expect(await fetchExplanation("ib-hl", doc.questionId, { free, fetcher })).toEqual(doc);
    const [route, init] = fetcher.mock.calls[0];
    if (free) {
      expect(route).toBe(`/api/assets/free?bank=ib-hl&id=${doc.questionId}&kind=explanation`);
      expect(init).toBeUndefined();
    } else {
      expect(route).toBe("/api/assets/sign");
      expect(JSON.parse(init.body)).toEqual({ bank: "ib-hl", requests: [{ questionId: doc.questionId, kind: "explanation" }] });
    }
    expect(fetcher.mock.calls[1]).toEqual([url, { mode: "cors", cache: "no-store" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never uses the public development path in production even with its flag enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_EXPLANATIONS_DEV", "1");
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(fetchExplanation("ib-hl", doc.questionId, { free: false, fetcher })).rejects.toThrow();
    expect(fetcher.mock.calls[0][0]).toBe("/api/assets/sign");
  });

  it.each([
    () => new Response("expired", { status: 403 }),
    () => new Response("not JSON"),
    () => new Response(JSON.stringify({ ...doc, bank: "ib-sl" })),
    () => new Response(JSON.stringify({ ...doc, questionId: "other" })),
    () => new Response(JSON.stringify({ ...doc, parts: [] })),
  ])("rejects unavailable or invalid storage content without automatically spending quota again %#", async (response) => {
    vi.stubEnv("NEXT_PUBLIC_EXPLANATIONS_DEV", "0");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ expiresIn: 600,
      assets: [{ questionId: doc.questionId, kind: "explanation", urls: ["https://assets.example/explanation.json"] }] })))
      .mockResolvedValueOnce(response());
    await expect(fetchExplanation("ib-hl", doc.questionId, { free: false, fetcher })).rejects.toThrow("Explanation unavailable");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("explanation rendering", () => {
  it("exposes inline maths as MathML instead of hiding it from assistive technology", () => {
    const html = renderInlineMath("Answer: $\\frac{1}{2}$");
    expect(html).toContain('class="katex-mathml"');
    expect(html).toContain('<math');
    expect(html).toContain('aria-hidden="true"');
  });
  it("escapes text and renders maths with KaTeX", () => {
    const html = renderInlineMath("If <b>x</b> & $\\frac{1}{2}$");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; ");
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("<b>");
  });

  it("shows an escaped dollar as a plain dollar sign", () => {
    expect(renderInlineMath("It costs \\$5 and $x = 2$")).toMatch(/^It costs \$5 and <span class="katex">/);
  });

  it("falls back to escaped text when dollars are unbalanced", () => {
    expect(renderInlineMath("costs $5 <now>")).toBe("costs $5 &lt;now&gt;");
  });

  it("does not enable trusted TeX HTML or URL commands", () => {
    const html = renderInlineMath('$\\href{javascript:alert(1)}{click} \\htmlClass{owned}{x} \\includegraphics{https://evil.example/pixel}$');
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector("a, img, script, .owned")).toBeNull();
  });

  it("escapes malicious text even when the maths cannot parse", () => {
    const html = renderInlineMath('<img src=x onerror="alert(1)"> $\\notACommand{<script>}$');
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("formats part labels like the paper", () => {
    expect(formatPartLabel("a")).toBe("(a)");
    expect(formatPartLabel("b(iii)")).toBe("(b)(iii)");
    expect(formatPartLabel("")).toBe("");
  });
});
