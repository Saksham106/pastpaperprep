import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { SiteFooter } from "@/components/SiteFooter";

describe("SiteFooter", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("links the free past-paper library only when it is switched on", () => {
    const view = render(<SiteFooter />);
    expect(screen.queryByRole("link", { name: "Free past papers" })).not.toBeInTheDocument();
    view.unmount();
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("LOCAL_PAPER_PREVIEW", "true");
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Free past papers" })).toHaveAttribute("href", "/past-papers");
  });

  it("links the AA notes only while the course is visible", () => {
    const restore = setCoursePublishedForTests(false);
    try {
      vi.stubEnv("NOTES_PREVIEW", "");
      const view = render(<SiteFooter />);
      expect(screen.queryByRole("link", { name: "IB Maths AA notes" })).not.toBeInTheDocument();
      view.unmount();
      vi.stubEnv("NOTES_PREVIEW", "1");
      render(<SiteFooter />);
      expect(screen.getByRole("link", { name: "IB Maths AA notes" })).toHaveAttribute("href", "/revision-notes/ib-math-aa");
    } finally {
      restore();
    }
  });

  it("links the AA notes for the real, published course without a preview flag", () => {
    vi.stubEnv("NOTES_PREVIEW", "");
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "IB Maths AA notes" })).toHaveAttribute("href", "/revision-notes/ib-math-aa");
  });

  it("links the 0580 notes only while that course is visible", () => {
    vi.stubEnv("NOTES_PREVIEW", "");
    const restore = setCoursePublishedForTests(false, "igcse-maths-0580");
    try {
      const view = render(<SiteFooter />);
      expect(screen.queryByRole("link", { name: "IGCSE Maths notes" })).not.toBeInTheDocument();
      view.unmount();
    } finally {
      restore();
    }
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "IGCSE Maths notes" })).toHaveAttribute("href", "/revision-notes/igcse-maths-0580");
  });

  it("reopens the consent banner via the cookie settings control", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    render(<SiteFooter />);
    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ppp:open-analytics-consent" }));
  });

  it("links every available question bank", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /igcse mathematics 0580/i })).toHaveAttribute("href", "/banks/igcse");
    expect(screen.getByRole("link", { name: /igcse additional mathematics 0606/i })).toHaveAttribute("href", "/banks/igcse-additional");
    expect(screen.getByRole("link", { name: /^IB Mathematics AA HL$/ })).toHaveAttribute("href", "/banks/ib-hl");
    expect(screen.getByRole("link", { name: /^IB Mathematics AA SL$/ })).toHaveAttribute("href", "/banks/ib-sl");
    expect(screen.getByRole("link", { name: /ib mathematics ai hl/i })).toHaveAttribute("href", "/banks/ib-ai-hl");
    expect(screen.getByRole("link", { name: /ib mathematics ai sl/i })).toHaveAttribute("href", "/banks/ib-ai-sl");
    expect(screen.getByRole("heading", { name: "Cambridge" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "IB Mathematics" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /IB IB/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revision guides" })).toHaveAttribute("href", "/articles");
    expect(screen.getByRole("heading", { name: "Exam-style practice" })).toBeInTheDocument();
    const examStyleLinks = screen.getAllByRole("link").filter((link) => ["IB Math AA SL", "IB Math AA HL", "IGCSE 0580", "IGCSE 0606", "IB Economics"].includes(link.textContent ?? ""));
    expect(examStyleLinks.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["IB Math AA SL", "/banks/ib-sl/exam-style"],
      ["IB Math AA HL", "/banks/ib-hl/exam-style"],
      ["IGCSE 0580", "/banks/igcse/exam-style"],
      ["IGCSE 0606", "/banks/igcse-additional/exam-style"],
      ["IB Economics", "/banks/ib-economics/exam-style"],
    ]);
    expect(screen.queryByRole("link", { name: /exam-style practice|trigonometry/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Frequently asked questions" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@pastpaperprep.com" })).toHaveAttribute("href", "mailto:hello@pastpaperprep.com");
  });

  it("keeps every link in a few columns with a decorative skyline and wordmark", () => {
    const { container } = render(<SiteFooter />);
    const headings = [...container.querySelectorAll(".footer-group h2")].map((heading) => heading.textContent);
    expect(headings.length).toBeLessThanOrEqual(5);
    expect(headings).toContain("IB Sciences & Economics");
    expect(screen.getByRole("link", { name: /ib chemistry hl/i })).toHaveAttribute("href", "/banks/ib-chemistry-hl");
    const skyline = container.querySelector("svg.footer-skyline");
    expect(skyline).toHaveAttribute("aria-hidden", "true");
    expect(skyline?.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    expect(container.querySelector(".footer-wordmark")).toHaveAttribute("aria-hidden", "true");
    const mark = container.querySelector(".footer-mark");
    expect(mark).toContainElement(skyline as HTMLElement);
    expect(mark).toContainElement(container.querySelector(".footer-wordmark") as HTMLElement);
    expect(container.querySelector(".site-footer")?.firstElementChild).not.toBe(skyline);
  });

  it("stands the wordmark on the skyline's ground line", () => {
    // The skyline path's ground is at y=118 of a 140-unit viewBox; the wordmark's baseline sits .128em below its box.
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = css.match(/\.footer-mark \.footer-skyline \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/bottom: calc\(-\.128em - max\(var\(--sky-h\) \* 22 \/ 140, 100vw \* 22 \/ 1440\)\)/);
    expect(rule).toMatch(/height: var\(--sky-h\)/);
  });

  it("draws the skyline as a soft solid silhouette behind solid letters", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.footer-mark \.footer-skyline-line \{[^}]*display: none/);
    expect(css).toMatch(/\.footer-mark \.footer-skyline-fill \{[^}]*fill: color-mix\(in srgb, var\(--ink\) 5%, transparent\)/);
    const wordmark = css.match(/\.footer-mark \.footer-wordmark \{([^}]*)\}/)?.[1] ?? "";
    expect(wordmark).toMatch(/color: color-mix\(in srgb, var\(--ink\) 17%, var\(--paper-warm\)\)/);
    expect(wordmark).not.toMatch(/background-clip/);
  });
});
