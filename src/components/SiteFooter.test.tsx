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
    expect(screen.getByRole("link", { name: "IB Math AA SL" })).toHaveAttribute("href", "/banks/ib-sl");
    expect(screen.getByRole("link", { name: "IB Math AA HL" })).toHaveAttribute("href", "/banks/ib-hl");
    expect(screen.getByRole("link", { name: "IGCSE 0580" })).toHaveAttribute("href", "/banks/igcse");
    expect(screen.getByRole("link", { name: "IGCSE 0606" })).toHaveAttribute("href", "/banks/igcse-additional");
    expect(screen.queryByRole("link", { name: /exam-style practice|trigonometry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /IB Mathematics AA SL · Trigonometry|IB Mathematics AA HL · Exam-style practice/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Frequently asked questions" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@pastpaperprep.com" })).toHaveAttribute("href", "mailto:hello@pastpaperprep.com");
  });
});
