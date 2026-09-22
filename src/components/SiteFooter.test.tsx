import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/SiteFooter";

describe("SiteFooter", () => {
  it("links every available question bank", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /igcse mathematics 0580/i })).toHaveAttribute("href", "/banks/igcse");
    expect(screen.getByRole("link", { name: /igcse additional mathematics 0606/i })).toHaveAttribute("href", "/banks/igcse-additional");
    expect(screen.getByRole("link", { name: /ib mathematics aa hl/i })).toHaveAttribute("href", "/banks/ib-hl");
    expect(screen.getByRole("link", { name: /ib mathematics aa sl/i })).toHaveAttribute("href", "/banks/ib-sl");
    expect(screen.getByRole("link", { name: /ib mathematics ai hl/i })).toHaveAttribute("href", "/banks/ib-ai-hl");
    expect(screen.getByRole("link", { name: /ib mathematics ai sl/i })).toHaveAttribute("href", "/banks/ib-ai-sl");
    expect(screen.getByRole("heading", { name: "Cambridge" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "IB Mathematics" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /IB IB/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revision guides" })).toHaveAttribute("href", "/articles");
    expect(screen.getByRole("link", { name: "Frequently asked questions" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "hello@pastpaperprep.com" })).toHaveAttribute("href", "mailto:hello@pastpaperprep.com");
  });
});
