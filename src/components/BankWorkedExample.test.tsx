import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BankWorkedExample } from "@/components/BankWorkedExample";
import { hasPublishedExplanations } from "@/lib/explanations";
import available from "@/data/explanations/available.json";

// Additional regression coverage of the public-example boundary implemented through
// BankSeoContent's RED/GREEN contract. These examples never fetch an asset or spend quota.
describe("public worked examples", () => {
  it.each(["ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "ib-physics-hl"])("uses published bank-scoped coverage for %s", (bankSlug) => {
    expect(hasPublishedExplanations(bankSlug)).toBe(available[bankSlug as keyof typeof available].length > 0);
    const { container } = render(<BankWorkedExample bankSlug={bankSlug} />);
    const sample = container.querySelector("#worked-example");
    expect(sample).toHaveTextContent("not an official exam question");
    expect(sample).toHaveTextContent("Availability is per question");
    expect(sample).toHaveTextContent(bankSlug === "ib-physics-hl" ? "24 m" : "y = 7x − 4");
    expect(container.querySelector("img,iframe,script")).toBeNull();
  });

  it.each(["ib-physics-sl", "ib-biology-hl", "igcse", "unknown-bank"])("does not imply coverage in %s", (bankSlug) => {
    expect(hasPublishedExplanations(bankSlug)).toBe(false);
    const { container } = render(<BankWorkedExample bankSlug={bankSlug} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the bank example instead of cloning a calculus lesson onto a different topic", () => {
    const { container } = render(<BankWorkedExample bankSlug="ib-hl" topic="Statistics and probability" />);
    expect(container.querySelector("#worked-example")).toBeNull();
    expect(screen.getByRole("link", { name: "see a public worked example" })).toHaveAttribute("href", "/banks/ib-hl#worked-example");
    expect(container).not.toHaveTextContent("y = 7x");
  });
});
