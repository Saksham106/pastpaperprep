import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingHome } from "@/components/MarketingHome";
import { BANKS } from "@/lib/banks";

describe("home page corpus summary", () => {
  it("derives the six-bank corpus totals from the bank catalog", () => {
    const originalQuestionCount = BANKS[0].questionCount;
    BANKS[0].questionCount = originalQuestionCount + 1;
    let markup = "";
    try {
      markup = renderToStaticMarkup(<MarketingHome />);
    } finally {
      BANKS[0].questionCount = originalQuestionCount;
    }

    expect(markup).toContain("6,480");
    expect(markup).toContain("544");
    expect(markup).toContain("Six banks. One study system.");
    expect(markup).toContain("Find questions.");
    expect(markup).toContain("Start practising.");
    expect(markup).toContain("IGCSE Additional Math 0606");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Mathematics");
    expect(markup).toContain("pastpaperprep-workspace.webp");
    expect(markup).not.toContain("hero-preview");
    expect(markup).not.toContain("—");
    expect(markup).not.toContain("–");
  });
});