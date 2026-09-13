import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingHome } from "@/components/MarketingHome";
import { metadata } from "@/app/page";
import { BANKS, getAvailableBanks } from "@/lib/banks";

const liveBankEnvironment = {
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
  PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true",
  PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true",
};

describe("home page corpus summary", () => {
  it("derives the twelve-bank corpus totals from the bank catalog", () => {
    const markup = renderToStaticMarkup(<MarketingHome />);

    expect(BANKS.reduce((total, bank) => total + bank.questionCount, 0)).toBe(12332);
    expect(markup).toContain("12,332");
    expect(markup).toContain("853");
    expect(markup).toContain("Practise the questions that move your grade.");
    expect(markup).toContain("Choose your course");
    expect(markup).toContain("Start practising");
    expect(markup).toContain("IGCSE Additional Math 0606");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Mathematics");
    expect(markup).toContain("IB Chemistry");
    expect(markup).toContain("IB Physics");
    expect(markup).toContain("IGCSE + IB Maths + Chemistry + Physics + Biology");
    expect(markup).toContain("Spend your revision time practising.");
    expect(markup).not.toContain("pastpaperprep-workspace.webp");
    expect(markup).toContain("class=\"exam-index-visual");
    expect(markup).toContain("class=\"exam-index-formula");
    expect(markup).toContain("<sup>2</sup>");
    expect(markup).toContain("<sub>2</sub>");
    expect(markup).not.toContain("x² · H₂O");
    expect(markup.match(/data-course-icon=/g)).toHaveLength(18);
    expect(markup).toContain("class=\"course-launcher");
    expect(markup).toContain("class=\"corpus-ledger");
    expect(markup).toContain("class=\"study-method");
    expect(markup).not.toContain("class=\"proof-strip");
    expect(markup).not.toContain("class=\"value-sequence");
    expect(markup).not.toContain("—");
    expect(markup).not.toContain("–");
  });

  it("shows every production-enabled Economics and IGCSE release bank", () => {
    const enabledBanks = getAvailableBanks(liveBankEnvironment);
    const markup = renderToStaticMarkup(<MarketingHome environment={liveBankEnvironment} />);

    expect(enabledBanks).toHaveLength(16);
    expect(markup).toContain("IB Economics HL");
    expect(markup).toContain("IB Economics SL");
    expect(markup).toContain("IGCSE Biology 0610");
    expect(markup).toContain("IGCSE Economics 0455");
    expect(markup).toContain("href=\"/banks/ib-economics-hl?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-biology-0610?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-economics-0455?free=1\"");
    expect(markup).toContain("16</strong><span>focused question banks");
  });

  it("describes Economics in homepage search metadata", () => {
    expect(JSON.stringify(metadata)).toContain("Economics");
  });

  it("does not advertise gated banks before their release flags are enabled", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={{}} />);

    expect(markup).not.toContain("IB Economics HL");
    expect(markup).not.toContain("IGCSE Biology 0610");
    expect(markup).not.toContain("IGCSE Economics 0455");
    expect(markup).not.toContain("0610");
    expect(markup).not.toContain("0455");
  });
});