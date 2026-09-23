import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage from "@/app/about/page";

describe("About page", () => {
  it("does not expose a founder name in visible copy or schema", () => {
    const { container } = render(<AboutPage />);
    const markup = container.innerHTML;
    expect(markup).not.toMatch(/Saksham|Goel/i);
    expect(markup).not.toContain('"founder"');
  });

  it("answers the core brand questions in crawlable semantic sections", () => {
    const { container } = render(<AboutPage />);

    expect(screen.getByRole("heading", { name: "What PastPaperPrep does" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What makes PastPaperPrep different" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who uses PastPaperPrep" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How PastPaperPrep works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key facts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frequently asked questions" })).toBeInTheDocument();

    const facts = screen.getByTestId("about-key-facts");
    expect(facts.tagName).toBe("DL");
    expect(within(facts).getByText("Company name")).toBeInTheDocument();
    expect(within(facts).getByText("Core offering")).toBeInTheDocument();
    expect(within(facts).getByText("Pricing")).toBeInTheDocument();
    expect(within(facts).getByRole("link", { name: /view current plans/i })).toHaveAttribute("href", "/pricing");
    expect(screen.getByText(/supported banks include complete older exam years/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/each bank provides a free preview/i);

    const schemas = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.textContent ?? "{}"))
      .flat();
    expect(schemas.some((schema) => schema["@type"] === "FAQPage")).toBe(true);
  });

  it("keeps unsupported identity and traction claims off the page", () => {
    const { container } = render(<AboutPage />);
    const markup = container.textContent ?? "";

    expect(markup).not.toMatch(/founded in|headquartered in|customers served|projects delivered|notable clients/i);
    expect(markup).not.toMatch(/is an official partner|is endorsed by cambridge|is endorsed by (the )?ib/i);
  });
});
