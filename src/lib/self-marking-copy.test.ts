import { describe, expect, it } from "vitest";
import { getCatalogBank } from "@/lib/catalog";
import { hubCopy, subjectCopy } from "@/lib/past-paper-seo";
import type { WholePaperSummary } from "@/lib/whole-paper-types";

/**
 * Self-marking is switched off on papers that failed the marking checks (e.g. 125 of 911 A Level papers on
 * 2026-11-20). The live hub and subject pages compute that from paper data, so they still qualify the claim.
 *
 * Owner decision, 2026-11-21 (confirmed in the A Level articles session, PR #505): marketing copy in guides, the
 * FAQ and the changelog may present self-marking as a site-wide feature, because most papers have it: "the claims
 * we can make can be liberal... If most have the self-marking feature, we can just say we have self-marking feature
 * across the board". So guide copy is no longer checked for a qualifier. The line that stays: don't claim a feature
 * that is broadly untrue (for example, worked explanations on every A Level question; see
 * articles-explanation-coverage.test.ts).
 */
const SELF_MARKING = /self-mark|mark (?:your|their) own|mark themselves|mark them\b/i;
const ABOUT_OUR_PAPERS = /timer|we hold|paper page|opens? free|free to read|free, no sign-up|past papers with mark schemes/i;
const QUALIFIED = /supported|\bmost\b|isn['’]t available|where available/i;

function unqualified(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((sentence) => SELF_MARKING.test(sentence) && ABOUT_OUR_PAPERS.test(sentence) && !QUALIFIED.test(sentence));
}

describe("self-marking claims on computed paper pages", () => {
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
