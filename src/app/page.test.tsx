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
  it("presents the base catalog without the old subject-list hero or duplicate bank icons", () => {
    const markup = renderToStaticMarkup(<MarketingHome environment={{}} />);

    expect(BANKS.reduce((total, bank) => total + bank.questionCount, 0)).toBe(12332);
    expect(markup).toContain("12,332 questions");
    expect(markup).toContain("853 papers");
    expect(markup).toContain("Past papers, sorted by topic.");
    expect(markup).toContain("Question banks");
    expect(markup).toContain("Cambridge IGCSE");
    expect(markup).toContain("IB Diploma");
    expect(markup).toContain("Simple on purpose.");
    expect(markup).toContain("Topic-first exam practice");
    expect(markup).not.toMatch(/^<main/);
    expect(markup).toContain("data-qualification-icon=\"igcse\"");
    expect(markup).toContain("data-qualification-icon=\"ib\"");
    expect(markup).not.toContain("IGCSE + IB Maths + Chemistry + Physics + Biology");
    expect(markup).not.toContain("exam-index-visual");
    expect(markup).not.toContain("More subjects are on the way.");
    expect(markup.match(/data-course-icon=/g)).toHaveLength(5);
  });

  it("shows every enabled release bank, grouped by subject with a real economics icon", () => {
    const enabledBanks = getAvailableBanks(liveBankEnvironment);
    const markup = renderToStaticMarkup(<MarketingHome environment={liveBankEnvironment} />);

    expect(enabledBanks).toHaveLength(18);
    expect(markup).toContain("IB Economics HL");
    expect(markup).toContain("IB Economics SL");
    expect(markup).toContain("IGCSE Biology 0610");
    expect(markup).toContain("IGCSE Economics 0455");
    expect(markup).toContain("IGCSE Chemistry 0620");
    expect(markup).toContain("IGCSE Physics 0625");
    expect(markup).toContain("href=\"/banks/ib-economics-hl?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-biology-0610?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-economics-0455?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-chemistry-0620?free=1\"");
    expect(markup).toContain("href=\"/banks/igcse-physics-0625?free=1\"");
    expect(markup).toContain("data-course-icon=\"economics\"");
    expect(markup).toContain("18 banks");
    expect(markup).toContain("Cambridge IGCSE Mathematics 0580");
    expect(markup).not.toContain("ArrowUpRight");
    expect(markup.match(/data-course-icon=/g)).toHaveLength(10);
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
