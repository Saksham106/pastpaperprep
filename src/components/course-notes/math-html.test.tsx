import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInlineHtml, renderTex } from "@/lib/course-notes/render";
import { MathHtml } from "./MathHtml";

const TEX = "\\int_0^1 x^2\\,dx = \\frac{1}{3}";
const TEXT = "The area is $\\frac{1}{3}$; see {{lesson:5.1}} and [[tangent|the tangent]].";

let container: HTMLDivElement;
afterEach(() => container?.remove());
const mount = (html = "") => {
  container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
};

describe("MathHtml", () => {
  it("server-renders the same markup as before, in the same wrapper element", () => {
    expect(renderToStaticMarkup(<MathHtml tex={TEX} />)).toBe(`<span>${renderTex(TEX, false)}</span>`);
    expect(renderToStaticMarkup(<MathHtml as="div" tex={TEX} display />)).toBe(`<div>${renderTex(TEX, true)}</div>`);
    expect(renderToStaticMarkup(<MathHtml as="dd" text={TEXT} />)).toBe(`<dd>${renderInlineHtml(TEXT)}</dd>`);
    const links = { "5.1": "/revision-notes/ib-math-aa/calculus/5-1-limits" };
    expect(renderToStaticMarkup(<MathHtml text={TEXT} links={links} />)).toBe(`<span>${renderInlineHtml(TEXT, { lessonHref: (item) => links[item as "5.1"] })}</span>`);
  });

  it("hydrates without KaTeX: the server's markup stays, untouched", async () => {
    const serverHtml = renderToStaticMarkup(<MathHtml tex={TEX} />);
    // A fresh copy of the module, as in a browser that hasn't loaded KaTeX yet.
    vi.resetModules();
    const fresh = await import("./MathHtml");
    const root = mount(serverHtml);
    const katexNode = root.querySelector(".katex");
    await act(async () => {
      hydrateRoot(root, <fresh.MathHtml tex={TEX} />);
    });
    await act(() => fresh.loadTexRenderer());
    expect(root.innerHTML).toBe(serverHtml);
    expect(root.querySelector(".katex")).toBe(katexNode);
  });

  it("renders in the browser when mounted fresh, before and after KaTeX has loaded", async () => {
    vi.resetModules();
    const fresh = await import("./MathHtml");
    const early = mount();
    await act(async () => {
      createRoot(early).render(<fresh.MathHtml tex={TEX} />);
    });
    await act(() => fresh.loadTexRenderer());
    expect(early.innerHTML).toBe(`<span>${renderTex(TEX, false)}</span>`);
    early.remove();

    const late = mount();
    act(() => createRoot(late).render(<fresh.MathHtml text={TEXT} />));
    expect(late.innerHTML).toBe(`<span>${renderInlineHtml(TEXT)}</span>`);
  });

  describe("when KaTeX can't be loaded", () => {
    // The lazy chunk fails (a 503, offline) while `blocked`; Vitest calls the mock factory again on each attempt.
    let blocked = true;
    let attempts = 0;
    beforeEach(() => {
      blocked = true;
      attempts = 0;
      vi.resetModules();
      vi.doMock("@/lib/course-notes/tex-render", async (importOriginal) => {
        attempts += 1;
        if (blocked) throw new Error("Failed to load chunk (503)");
        return importOriginal();
      });
      vi.useFakeTimers({ toFake: ["setTimeout"] });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.doUnmock("@/lib/course-notes/tex-render");
    });
    // Runs out every retry of one load.
    const exhaustRetries = () => act(() => vi.advanceTimersByTimeAsync(10_000));

    it("shows the TeX source instead of a blank, then the maths once a retry loads, for mounted and new components", async () => {
      const fresh = await import("./MathHtml");
      const mounted = mount();
      await act(async () => {
        createRoot(mounted).render(
          <>
            <fresh.MathHtml tex={TEX} />
            <fresh.MathHtml text={TEXT} links={{ "5.1": "/l/5-1" }} />
          </>,
        );
      });
      await exhaustRetries();
      expect(attempts).toBe(fresh.RETRY_DELAYS_MS.length + 1);
      const [math, inline] = [...mounted.children] as HTMLElement[];
      expect(math.querySelector("code")?.textContent).toBe(TEX);
      expect(math.title).toMatch(/didn't load/);
      expect(inline.textContent).toBe("The area is \\frac{1}{3}; see 5.1 and the tangent.");
      expect(inline.querySelector("a")?.getAttribute("href")).toBe("/l/5-1");
      expect(mounted.querySelector(".katex")).toBeNull();

      // Delivery recovers. A new mount starts another load; the components already showing TeX render too.
      blocked = false;
      const later = mount();
      await act(async () => {
        createRoot(later).render(<fresh.MathHtml tex={TEX} display />);
      });
      await act(() => fresh.loadTexRenderer());
      expect(math.outerHTML).toBe(`<span>${renderTex(TEX, false)}</span>`);
      expect(inline.outerHTML).toBe(`<span>${renderInlineHtml(TEXT, { lessonHref: () => "/l/5-1" })}</span>`);
      expect(later.innerHTML).toBe(`<span>${renderTex(TEX, true)}</span>`);
    });

    it("a component mounted after a failed load shows TeX at once, and renders when the browser comes back online", async () => {
      const fresh = await import("./MathHtml");
      await expect(Promise.all([fresh.loadTexRenderer(), vi.advanceTimersByTimeAsync(10_000)])).rejects.toThrow();
      const root = mount();
      await act(async () => {
        createRoot(root).render(<fresh.MathHtml tex={TEX} />);
      });
      expect(root.querySelector("[data-tex-fallback] code")?.textContent).toBe(TEX);

      blocked = false;
      await act(async () => {
        window.dispatchEvent(new Event("online"));
        await fresh.loadTexRenderer();
      });
      expect(root.innerHTML).toBe(`<span>${renderTex(TEX, false)}</span>`);
    });

    it("never touches hydrated server markup, even when loading fails", async () => {
      const fresh = await import("./MathHtml");
      const root = mount(`<span>${renderTex(TEX, false)}</span>`);
      const katexNode = root.querySelector(".katex");
      await act(async () => {
        hydrateRoot(root, <fresh.MathHtml tex={TEX} />);
      });
      await expect(Promise.all([fresh.loadTexRenderer(), act(() => vi.advanceTimersByTimeAsync(10_000))])).rejects.toThrow();
      expect(root.querySelector(".katex")).toBe(katexNode);
      expect(root.querySelector("[data-tex-fallback]")).toBeNull();
    });
  });
});

