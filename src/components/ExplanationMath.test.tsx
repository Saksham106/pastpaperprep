import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExplanationPanel from "@/components/ExplanationPanel";
import type { Explanation } from "@/lib/explanation-format";
import { renderDisplayMath, renderInlineMath } from "@/lib/explanation-math";
import { plainInlineHtml } from "@/lib/explanation-text";

const EXPLANATION: Explanation = {
  schemaVersion: 1,
  bank: "ib-hl",
  questionId: "q",
  totalMarks: 3,
  parts: [
    {
      label: "a",
      marks: 2,
      approach: "Differentiate $f(x) = x^2 \\sin x$ with the product rule.",
      steps: [
        { text: "Write $u = x^2$ and $v = \\sin x$.", math: "f'(x) = 2x\\sin x + x^2\\cos x", marks: ["M1", "A1"] },
        { text: "It costs \\$5 & <nothing> else.", marks: [] },
      ],
      answer: "$2x\\sin x + x^2\\cos x$",
      mistake: "Dropping a term.",
    },
    { label: "b", marks: 1, approach: "Substitute.", steps: [{ text: "Use $x = 0$.", marks: ["B1"] }], answer: "0" },
  ],
};

let container: HTMLDivElement;
afterEach(() => container?.remove());
const mount = (html = "") => {
  container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
};

describe("plainInlineHtml", () => {
  it("matches renderInlineMath for text without maths, and defers text with maths to KaTeX", () => {
    for (const text of ["Plain <b>text</b> & 'quotes'", "It costs \\$5", "costs $5 <now>", "one $ two $ three $", ""]) {
      expect(plainInlineHtml(text)).toBe(renderInlineMath(text));
    }
    expect(plainInlineHtml("Use $x = 0$.")).toBeNull();
  });
});

describe("ExplanationPanel with a TeX payload", () => {
  it("renders the same markup as the KaTeX-in-payload panel", async () => {
    vi.resetModules();
    const fresh = await import("@/components/ExplanationPanel");
    const math = await import("@/components/ExplanationMath");
    const root = mount();
    await act(async () => {
      createRoot(root).render(<fresh.default explanation={EXPLANATION} texPayload />);
    });
    await act(() => math.loadRenderer());
    // Parsed the same way, so only the markup counts, not how each serializer escapes quotes.
    const expected = document.createElement("div");
    expected.innerHTML = renderToStaticMarkup(<ExplanationPanel explanation={EXPLANATION} />);
    expect(root.innerHTML).toBe(expected.innerHTML);
  });

  it("hydrates the server's markup untouched, without loading KaTeX", async () => {
    vi.resetModules();
    const imported = vi.fn();
    vi.doMock("@/lib/explanation-math", async (importOriginal) => {
      imported();
      return importOriginal();
    });
    try {
      // ExplanationPanel's own KaTeX path imports the renderer statically, so hydrate the leaves the server page uses.
      const { ExplanationMath } = await import("@/components/ExplanationMath");
      const root = mount(`<span>${renderInlineMath("Use $x = 0$.")}</span><div class="d">${renderDisplayMath("x^2")}</div>`);
      const before = root.innerHTML;
      const katexNode = root.querySelector(".katex");
      await act(async () => {
        hydrateRoot(root, <><ExplanationMath text="Use $x = 0$." /><ExplanationMath className="d" tex="x^2" /></>);
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(root.innerHTML).toBe(before);
      expect(root.querySelector(".katex")).toBe(katexNode);
      expect(imported).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@/lib/explanation-math");
    }
  });
});

describe("ExplanationMath when KaTeX can't be loaded", () => {
  let blocked = true;
  beforeEach(() => {
    blocked = true;
    vi.resetModules();
    vi.doMock("@/lib/explanation-math", async (importOriginal) => {
      if (blocked) throw new Error("Failed to load chunk (503)");
      return importOriginal();
    });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("@/lib/explanation-math");
  });

  it("shows the source instead of a blank, keeps plain text, and renders once a later load succeeds", async () => {
    const fresh = await import("@/components/ExplanationMath");
    const root = mount();
    await act(async () => {
      createRoot(root).render(<><fresh.ExplanationMath text="Use $x = 0$." /><fresh.ExplanationMath tex="x^2" /><fresh.ExplanationMath text="No maths & more" /></>);
    });
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    const [inline, display, plain] = [...root.children] as HTMLElement[];
    expect(inline.textContent).toBe("Use $x = 0$.");
    expect(inline.title).toMatch(/didn't load/);
    expect(display.tagName).toBe("DIV");
    expect(display.textContent).toBe("x^2");
    expect(plain.outerHTML).toBe("<span>No maths &amp; more</span>");

    blocked = false;
    const later = mount();
    await act(async () => {
      createRoot(later).render(<fresh.ExplanationMath tex="y" />);
    });
    await act(() => fresh.loadRenderer());
    expect(inline.outerHTML).toBe(`<span>${renderInlineMath("Use $x = 0$.")}</span>`);
    expect(display.outerHTML).toBe(`<div>${renderDisplayMath("x^2")}</div>`);
  });
});
