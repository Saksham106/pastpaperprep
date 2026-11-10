import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
