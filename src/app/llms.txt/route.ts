import { hasFreeTier } from "@/lib/access";
import { ARTICLES } from "@/lib/articles";
import { getCatalogBanksForDisplay, type CatalogBank } from "@/lib/catalog";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { hubBanks } from "@/lib/past-paper-pages";
import { formatPrice, maximumAnnualSavingPercent, priceForBankCount, PRICING_MODEL } from "@/lib/pricing-model";
import { freeTierScope } from "@/lib/free-tier-scope";
import { lastUpdated } from "@/lib/updates";

// Built once at deploy from the same catalogue, prices and articles the pages render.
export const dynamic = "force-static";

const SITE_URL = "https://pastpaperprep.com";

const bankLine = (bank: CatalogBank) =>
  `- [${bank.qualification === "Cambridge IGCSE" ? `IGCSE ${bank.title}` : bank.title}](${SITE_URL}${bank.route}): ${bank.questionCount.toLocaleString("en-US")} questions from ${bank.paperCount} papers, ${bank.years}${hasFreeTier(bank.slug) ? "; free exam years included" : ""}`;

export async function GET() {
  const banks = getCatalogBanksForDisplay();
  const papers = await hubBanks();
  const questions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const updated = lastUpdated();
  const monthly = (count: number) => formatPrice(priceForBankCount("monthly", count));
  const annual = (count: number) => formatPrice(priceForBankCount("annual", count));
  const igcse = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ib = banks.filter((bank) => bank.qualification === "IB Diploma");

  const body = `# PastPaperPrep

> PastPaperPrep is a past-paper practice site for Cambridge IGCSE and IB Diploma students, tutors and teachers. It sorts real exam questions by topic, shows the mark scheme for each question, and turns any selection into a printable PDF worksheet. Whole past papers and mark schemes are free to read without an account.

Key facts${updated ? `, as of ${updated}` : ""}:

- ${questions.toLocaleString("en-US")} past-paper questions across ${banks.length} question banks (${igcse.length} Cambridge IGCSE, ${ib.length} IB Diploma).
${papers.length ? `- ${papers.reduce((total, bank) => total + bank.paperCount, 0).toLocaleString("en-US")} whole past papers with mark schemes, free and without sign-up, at ${SITE_URL}/past-papers.\n` : ""}- Questions come from official past papers, not newly written look-alikes. Worked explanations cover many recent questions.
- Free plan: free exam years in ${freeTierScope(banks)}, no card needed.
- Paid plans (US dollars): one bank ${monthly(1)}/month or ${annual(1)}/year; ${PRICING_MODEL.builder.minBanks} to ${PRICING_MODEL.builder.maxBanks} banks from ${monthly(PRICING_MODEL.builder.minBanks)}/month or ${annual(PRICING_MODEL.builder.minBanks)}/year; All Access to every bank ${monthly(PRICING_MODEL.allAccess.minBanks)}/month or ${annual(PRICING_MODEL.allAccess.minBanks)}/year (annual saves up to ${maximumAnnualSavingPercent()}%); Lifetime All Access ${formatPrice(LIFETIME_OFFER.amountCents)} once. Cancel any time.
- Independent: not affiliated with Cambridge International or the International Baccalaureate.

## Cambridge IGCSE question banks

${igcse.map(bankLine).join("\n")}

## IB Diploma question banks

${ib.map(bankLine).join("\n")}

${papers.length ? `## Free past papers

- [All free past papers](${SITE_URL}/past-papers)
${papers.map((bank) => `- [${bank.name} past papers](${SITE_URL}/past-papers/${bank.subjectSlug}): ${bank.paperCount} papers, ${bank.years}`).join("\n")}

` : ""}## Guides

${ARTICLES.map((article) => `- [${article.title}](${SITE_URL}/articles/${article.slug}): ${article.description}`).join("\n")}

## About

- [Pricing](${SITE_URL}/pricing)
- [Frequently asked questions](${SITE_URL}/faq)
- [About PastPaperPrep](${SITE_URL}/about)
- [What's new](${SITE_URL}/updates)
- Contact: hello@pastpaperprep.com
`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
