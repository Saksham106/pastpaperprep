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
    expect(markup).toContain("Practise the questions that move your grade.");
    expect(markup).toContain("Choose your course");
    expect(markup).toContain("Start practising");
    expect(markup).toContain("IGCSE Additional Math 0606");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Mathematics");
    expect(markup).not.toContain("pastpaperprep-workspace.webp");
    expect(markup).toContain("class=\"exam-index-visual");
    expect(markup).toContain("class=\"course-launcher");
    expect(markup).toContain("class=\"corpus-ledger");
    expect(markup).toContain("class=\"study-method");
    expect(markup).not.toContain("class=\"proof-strip");
    expect(markup).not.toContain("class=\"value-sequence");
    expect(markup).not.toContain("—");
    expect(markup).not.toContain("–");
  });
});