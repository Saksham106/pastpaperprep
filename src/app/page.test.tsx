import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingHome } from "@/components/MarketingHome";
import { BANKS } from "@/lib/banks";

describe("home page corpus summary", () => {
  it("derives the eight-bank corpus totals from the bank catalog", () => {
    const markup = renderToStaticMarkup(<MarketingHome />);

    expect(BANKS.reduce((total, bank) => total + bank.questionCount, 0)).toBe(8372);
    expect(markup).toContain("8,372");
    expect(markup).toContain("646");
    expect(markup).toContain("Practise the questions that move your grade.");
    expect(markup).toContain("Choose your course");
    expect(markup).toContain("Start practising");
    expect(markup).toContain("IGCSE Additional Math 0606");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Mathematics");
    expect(markup).toContain("IB Chemistry");
    expect(markup).toContain("IGCSE + IB Maths + Chemistry");
    expect(markup).toContain("Spend your revision time practising.");
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