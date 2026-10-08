import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/SiteFooter";

describe("SiteFooter", () => {
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
    const examStyleLinks = screen.getAllByRole("link").filter((link) => ["IB Math AA SL", "IB Math AA HL", "IGCSE 0580", "IGCSE 0606"].includes(link.textContent ?? ""));
    expect(examStyleLinks.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["IB Math AA SL", "/banks/ib-sl/exam-style"],
      ["IB Math AA HL", "/banks/ib-hl/exam-style"],
      ["IGCSE 0580", "/banks/igcse/exam-style"],
      ["IGCSE 0606", "/banks/igcse-additional/exam-style"],
    ]);
    expect(screen.queryByRole("link", { name: /exam-style practice|trigonometry/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Frequently asked questions" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@pastpaperprep.com" })).toHaveAttribute("href", "mailto:hello@pastpaperprep.com");
  });
});
