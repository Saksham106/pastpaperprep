import { afterEach, describe, expect, it, vi } from "vitest";
import { generateStaticParams } from "@/app/banks/[slug]/page";
import { getAvailableBanks } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/question-loader";

const productionFlags = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
};

afterEach(() => vi.unstubAllEnvs());

describe("IB Economics production route activation", () => {
  it("fails closed when either production release flag is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "false");

    expect(getAvailableBanks()).toHaveLength(12);
    expect(generateStaticParams()).not.toContainEqual({ slug: "ib-economics-hl" });
    expect(generateStaticParams()).not.toContainEqual({ slug: "ib-economics-sl" });
  });

  it("includes both Economics routes only with both production flags and real sealed content", async () => {
    for (const [key, value] of Object.entries(productionFlags)) vi.stubEnv(key, value);

    expect(getAvailableBanks().map(({ slug }) => slug).slice(-2)).toEqual([
      "ib-economics-hl",
      "ib-economics-sl",
    ]);
    expect(generateStaticParams().slice(-2)).toEqual([
      { slug: "ib-economics-hl" },
      { slug: "ib-economics-sl" },
    ]);

    const [hl, sl] = await Promise.all([
      loadBankQuestions("ib-economics-hl"),
      loadBankQuestions("ib-economics-sl"),
    ]);
    expect(hl).toHaveLength(111);
    expect(sl).toHaveLength(89);
    expect(hl[0].questionImages.length).toBeGreaterThan(0);
    expect(hl[0].markschemeImages.length).toBeGreaterThan(0);
    expect(sl[0].questionImages.length).toBeGreaterThan(0);
    expect(sl[0].markschemeImages.length).toBeGreaterThan(0);
  });
});
