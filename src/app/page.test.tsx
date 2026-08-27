import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingHome } from "@/components/MarketingHome";

describe("home page corpus summary", () => {
  it("derives the six-bank corpus totals from the bank catalog", () => {
    const markup = renderToStaticMarkup(<MarketingHome />);

    expect(markup).toContain("6,479");
    expect(markup).toContain("544");
    expect(markup).toContain(">6</strong><span>focused question banks");
    expect(markup).toContain("Six serious question banks");
    expect(markup).toContain("IGCSE Additional Math 0606");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Mathematics");
    expect(markup).not.toContain("bank-featured");
  });
});