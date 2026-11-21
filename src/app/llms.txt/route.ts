import { hasFreeTier } from "@/lib/access";
import { ARTICLES } from "@/lib/articles";
import { getCatalogBanksForDisplay, type CatalogBank } from "@/lib/catalog";
import { qualifiedBankTitle } from "@/lib/qualifications";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { hubBanks } from "@/lib/past-paper-pages";
import { formatPrice, maximumAnnualSavingPercent, priceForBankCount, PRICING_MODEL } from "@/lib/pricing-model";
import { freeTierScope } from "@/lib/free-tier-scope";
import { lastUpdated } from "@/lib/updates";
import available from "@/data/explanations/available.json";
import { COURSES, coursePath, isCourseVisible } from "@/lib/course-notes/course";
import { NOTES_SUBJECTS } from "@/lib/revision-notes";
import { GRADE_THRESHOLDS } from "@/lib/grade-thresholds";
import { bankForSubjectSlug } from "@/lib/past-paper-catalog";
import { getCatalogBank } from "@/lib/catalog";
import { subjectSearchName } from "@/lib/past-paper-seo";

// Built once at deploy from the same catalogue, prices and articles the pages render.
export const dynamic = "force-static";

const SITE_URL = "https://pastpaperprep.com";

const bankLine = (bank: CatalogBank) =>
  `- [${qualifiedBankTitle(bank)}](${SITE_URL}${bank.route}): ${bank.questionCount.toLocaleString("en-US")} questions from ${bank.paperCount} papers, ${bank.years}${hasFreeTier(bank.slug) ? "; free exam years included" : ""}`;

export async function GET() {
  const banks = getCatalogBanksForDisplay();
  const papers = await hubBanks();
  const questions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const updated = lastUpdated();
  const monthly = (count: number) => formatPrice(priceForBankCount("monthly", count));
  const annual = (count: number) => formatPrice(priceForBankCount("annual", count));
  const igcse = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ib = banks.filter((bank) => bank.qualification === "IB Diploma");
  const aLevel = banks.filter((bank) => bank.qualification === "Cambridge A Level");
  // Explanation coverage straight from the published list, so this line can't drift from the banks.
  const explained = (bank: CatalogBank) => (available as Record<string, string[]>)[bank.slug]?.length ?? 0;
  const partial = banks.filter((bank) => explained(bank) < bank.questionCount);
  const coverage = partial.length === 0
    ? "Every question in every bank has a worked explanation."
    : (() => {
      const some = partial.filter((bank) => explained(bank) > 0).map((bank) => `${qualifiedBankTitle(bank)} (${explained(bank).toLocaleString("en-US")} of ${bank.questionCount.toLocaleString("en-US")})`);
      const none = partial.filter((bank) => explained(bank) === 0).map((bank) => qualifiedBankTitle(bank));
      return `Every question has a worked explanation, except in ${[...some, ...(none.length ? [`${none.join(", ")} (none yet)`] : [])].join("; ")}.`;
    })();
  const notes = [
    ...COURSES.filter(isCourseVisible).map((course) => `- [${course.name} course notes](${SITE_URL}${coursePath(course)}): ${course.lessons.length} lessons with worked examples and links to practice questions`),
    ...NOTES_SUBJECTS.map((subject) => `- [${subject.name} revision notes](${SITE_URL}/revision-notes/${subject.subjectSlug}): ${subject.topics.length} topic summaries`),
  ];
  const thresholds = GRADE_THRESHOLDS.flatMap((subject) => {
    const bankSlug = bankForSubjectSlug(subject.subjectSlug);
    const bank = bankSlug ? getCatalogBank(bankSlug) : undefined;
    return bank ? [`- [${subjectSearchName(bank)} grade thresholds](${SITE_URL}/grade-thresholds/${subject.subjectSlug}): ${subject.tables.length} series, latest ${subject.tables[0].series}`] : [];
  });

  const body = `# PastPaperPrep

> PastPaperPrep is a past-paper practice site for Cambridge IGCSE${aLevel.length ? ", Cambridge A Level" : ""} and IB Diploma students, tutors and teachers. It sorts real exam questions by topic, shows the mark scheme for each question, and turns any selection into a printable PDF worksheet. Whole past papers and mark schemes are free to read without an account.

Key facts${updated ? `, as of ${updated}` : ""}:

- ${questions.toLocaleString("en-US")} past-paper questions across ${banks.length} question banks (${igcse.length} Cambridge IGCSE, ${aLevel.length ? `${aLevel.length} Cambridge A Level, ` : ""}${ib.length} IB Diploma).
${papers.length ? `- ${papers.reduce((total, bank) => total + bank.paperCount, 0).toLocaleString("en-US")} whole past papers with mark schemes, free and without sign-up, at ${SITE_URL}/past-papers.\n` : ""}- Questions come from official past papers, not newly written look-alikes. ${coverage}
- Free plan: free exam years in ${freeTierScope(banks)}, no card needed.
- Paid plans (US dollars): one bank ${monthly(1)}/month or ${annual(1)}/year; ${PRICING_MODEL.builder.minBanks} to ${PRICING_MODEL.builder.maxBanks} banks from ${monthly(PRICING_MODEL.builder.minBanks)}/month or ${annual(PRICING_MODEL.builder.minBanks)}/year; All Access to every bank ${monthly(PRICING_MODEL.allAccess.minBanks)}/month or ${annual(PRICING_MODEL.allAccess.minBanks)}/year (annual saves up to ${maximumAnnualSavingPercent()}%); Lifetime All Access ${formatPrice(LIFETIME_OFFER.amountCents)} once. Cancel any time.
- Independent: not affiliated with Cambridge International or the International Baccalaureate.

## Cambridge IGCSE question banks

${igcse.map(bankLine).join("\n")}

## IB Diploma question banks

${ib.map(bankLine).join("\n")}

${aLevel.length ? `## Cambridge A Level question banks\n\n${aLevel.map(bankLine).join("\n")}\n\n` : ""}${papers.length ? `## Free past papers

- [All free past papers](${SITE_URL}/past-papers)
${papers.map((bank) => `- [${bank.name} past papers](${SITE_URL}/past-papers/${bank.subjectSlug}): ${bank.paperCount} papers, ${bank.years}`).join("\n")}

` : ""}${notes.length ? `## Free revision notes\n\n${notes.join("\n")}\n\n` : ""}${thresholds.length ? `## Grade thresholds\n\n${thresholds.join("\n")}\n\n` : ""}## Guides

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
