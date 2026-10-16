import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BankWorkedExample } from "@/components/BankWorkedExample";
import { hasPublishedExplanations } from "@/lib/explanations";

// Public examples are original illustrations: they never fetch an asset or spend quota.
describe("public worked examples", () => {
  it.each([
    ["ib-hl", "y = 7x − 4"],
    ["igcse-additional", "y = 7x − 4"],
    ["igcse", "x = −5 or x = 2"],
    ["ib-physics-hl", "24 m"],
    ["igcse-physics-0625", "area under the speed–time graph"],
  ])("renders the %s example only while the bank has published explanations", (bankSlug, expected) => {
    const { container } = render(<BankWorkedExample bankSlug={bankSlug} />);
    const sample = container.querySelector("#worked-example");
    if (!hasPublishedExplanations(bankSlug)) return expect(sample).toBeNull();
    expect(sample).toHaveTextContent("not an exam question");
    expect(sample).toHaveTextContent(expected);
    expect(container.querySelector("img,iframe,script")).toBeNull();
  });

  it.each(["ib-biology-hl", "igcse-economics-0455", "unknown-bank"])("renders nothing for %s, which has no fitting example", (bankSlug) => {
    const { container } = render(<BankWorkedExample bankSlug={bankSlug} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("only repeats the example on the matching topic page", () => {
    expect(render(<BankWorkedExample bankSlug="ib-hl" topic="Statistics and probability" />).container).toBeEmptyDOMElement();
    expect(render(<BankWorkedExample bankSlug="ib-hl" topic="Calculus" />).container.querySelector("#worked-example")).not.toBeNull();
  });
});
