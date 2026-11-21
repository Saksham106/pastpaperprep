import { describe, expect, it } from "vitest";
import { ARTICLES } from "@/lib/articles";
import { FAQS } from "@/components/FaqContent";
import { UPDATES } from "@/lib/updates";
import { getCatalogBank } from "@/lib/catalog";
import { hubCopy, subjectCopy } from "@/lib/past-paper-seo";
import type { WholePaperSummary } from "@/lib/whole-paper-types";

/**
 * Self-marking is switched off on papers that failed the marking checks (e.g. 125 of 911 A Level papers on
 * 2026-11-20), so copy about our paper pages may only promise it with a qualifier (owner review of PR #502).
 * Study advice ("mark it against the scheme") is fine: only sentences about our papers' features are checked.
 */
const SELF_MARKING = /self-mark|mark (?:your|their) own|mark themselves|mark them\b/i;
const ABOUT_OUR_PAPERS = /timer|we hold|paper page|opens? free|free to read|free, no sign-up|past papers with mark schemes/i;
const QUALIFIED = /supported|\bmost\b|isn['’]t available|where available/i;

function unqualified(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((sentence) => SELF_MARKING.test(sentence) && ABOUT_OUR_PAPERS.test(sentence) && !QUALIFIED.test(sentence));
}

describe("self-marking claims are qualified", () => {
  it("never promises self-marking on every paper in guides, the FAQ or the changelog", () => {
    const texts = [
      ...ARTICLES.map((article) => [article.answer, ...article.sections.flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])]), ...article.faqs.map((faq) => faq.answer)].join(" ")),
      ...FAQS.map((faq) => faq.answer),
      ...UPDATES.map((update) => update.body),
    ];
    expect(texts.flatMap(unqualified)).toEqual([]);
  });

  it("qualifies hub and subject copy when some papers can't be self-marked", () => {
    const hub = hubCopy(911, "a-level");
    expect(unqualified(`${hub.description} ${hub.answer}`)).toEqual([]);
    expect(hub.description).toMatch(/mark supported papers/);
    const bank = getCatalogBank("igcse")!;
    const paper = { reportAvailable: true, year: 2024 } as WholePaperSummary;
    expect(subjectCopy(bank, [paper, { ...paper, reportAvailable: false }]).description).toMatch(/mark supported papers/);
    expect(subjectCopy(bank, [paper]).description).toMatch(/Time it, mark it/);
  });

  it("catches an unqualified promise", () => {
    expect(unqualified("Each paper page has a timer and lets you mark your own answers.")).toHaveLength(1);
    expect(unqualified("Each paper page has a timer, and supported papers let you mark your own answers.")).toHaveLength(0);
  });
});
