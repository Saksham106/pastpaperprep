import { describe, expect, it } from "vitest";
import { GET } from "@/app/llms.txt/route";
import { ARTICLES } from "@/lib/articles";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { formatPrice, priceForBankCount } from "@/lib/pricing-model";
import { lastUpdated } from "@/lib/updates";

describe("/llms.txt", () => {
  it("describes the product from live catalogue, price and article data", async () => {
    const response = await GET();
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(text).toMatch(/^# PastPaperPrep\n\n> PastPaperPrep is a past-paper practice site for Cambridge IGCSE and IB Diploma/);
    expect(text).toContain(`Key facts, as of ${lastUpdated()}:`);
    expect(text).toContain(`one bank ${formatPrice(priceForBankCount("monthly", 1))}/month`);
    for (const bank of getCatalogBanksForDisplay()) expect(text).toContain(`(https://pastpaperprep.com${bank.route})`);
    for (const article of ARTICLES) expect(text).toContain(`(https://pastpaperprep.com/articles/${article.slug})`);
    expect(text).not.toMatch(/undefined|NaN/);
  });
});
