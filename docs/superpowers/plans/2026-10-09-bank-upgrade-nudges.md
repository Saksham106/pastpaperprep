# Bank Upgrade Nudges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead people without a plan for a bank toward a plan, using the fact that the newest exam years are paid, and track every prompt by where it appears.

**Architecture:**
- A pure helper (`src/lib/upgrade-copy.ts`) derives year facts, the price label and the upgrade link from the catalog and the free-year config.
- A small client module (`src/components/UpgradeNudges.tsx` + `upgrade-nudges.css`) holds the in-feed cards, the milestone line and the impression/click tracking hook.
- `QuestionExplorer` decides when nudges are active and where they go. `FreeQuestionSignupGate` gains a plans line and link.

**Tech Stack:** React 19, TypeScript, plain CSS, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-bank-upgrade-nudges-design.md`

## Global Constraints

- **Nudges are active only when all of these hold:** `!bootstrapPending && !resolvedAccess.bankAccess && hasFreeTier(bank) && !savedWorksheetView && !sharedSetView && !worksheetId`.
- **Upgrade link:** `/pricing?product=<productId>` for everyone.
- **Price label:** `$6/mo`, derived from `PRICING_MODEL.oneBank.monthlyCents`.
- **Events:** `upgrade_prompt_view`, `upgrade_prompt_click` and `upgrade_prompt_dismiss`, each with `{ bank, placement }`. `placement` is one of `top_note`, `feed_teaser`, `feed_timeline`, `locked_card`, `practice_milestone`, `signup_gate`, `pdf_dialog`.
- **The teaser never requests a paid asset.**
- **Storage:** `ppp:feed-nudge-dismissed` in sessionStorage; `ppp:reveals:<bank>` and `ppp:milestone-shown:<bank>` in localStorage. All storage access is wrapped in try/catch.
- Copy is short. Use existing tokens only, and dark mode must work.

## Review Focus

1. **Bank access arrives after first render** (bootstrap resolves to paid). Nudges must not be visible to a payer at any point. (Task 3 test: paid access renders no nudge.)
2. **Filters leave fewer than 3 shown questions.** Then no in-feed card is shown, and there are no trailing cards. (Task 3 test.)
3. **IB science bank (free year 2020 is in the middle of its range).** Copy says "2021–2025". (Task 1 test.)
4. **Teaser pool is empty** (no paid question matches the filters). The slot falls back to the timeline card. (Task 3 test.)
5. **Storage throws** (private mode). Nothing crashes; the cards still render, and Not now hides them until reload. (Task 2 test.)

---

### Task 1: `upgrade-copy` helper

**Files:** Create `src/lib/upgrade-copy.ts` and `src/lib/upgrade-copy.test.ts`.

**Produces:**

```ts
export type UpgradePlacement = "top_note" | "feed_teaser" | "feed_timeline" | "locked_card" | "practice_milestone" | "signup_gate" | "pdf_dialog";
export type BankYearFacts = { freeLabel: string; newerPaidLabel: string; latestYear: number; coverage: number[]; freeYears: number[]; newerPaidYears: number[] };
export function bankYearFacts(bankSlug: string): BankYearFacts | null;
export function upgradeHref(bankSlug: string): string;     // "/pricing?product=bank_igcse"; "/pricing" if no productId
export const UPGRADE_PRICE_LABEL: string;                  // "$6/mo"
export function yearRangeLabel(years: readonly number[]): string; // [2016,2017,2018] → "2016–2018"; [2017] → "2017"; [2016,2017,2019] → "2016–2017, 2019"
```

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it } from "vitest";
import { bankYearFacts, upgradeHref, UPGRADE_PRICE_LABEL, yearRangeLabel } from "@/lib/upgrade-copy";

describe("upgrade copy", () => {
  it("labels year runs with an en dash", () => {
    expect(yearRangeLabel([2016, 2017, 2018])).toBe("2016–2018");
    expect(yearRangeLabel([2017])).toBe("2017");
    expect(yearRangeLabel([2016, 2017, 2019])).toBe("2016–2017, 2019");
  });
  it("describes 0580 as old free years and newer paid years", () => {
    expect(bankYearFacts("igcse")).toMatchObject({ freeLabel: "2016–2018", newerPaidLabel: "2019–2026", latestYear: 2026 });
  });
  it("handles a single free year", () => {
    expect(bankYearFacts("ib-sl")).toMatchObject({ freeLabel: "2017", newerPaidLabel: "2018–2026" });
  });
  it("only counts paid years after the free year for IB sciences", () => {
    expect(bankYearFacts("ib-chemistry-hl")?.newerPaidLabel).toBe("2021–2025");
  });
  it("returns null for an unknown bank", () => {
    expect(bankYearFacts("nope")).toBeNull();
  });
  it("links to pricing with the bank preselected", () => {
    expect(upgradeHref("igcse")).toBe("/pricing?product=bank_igcse");
    expect(UPGRADE_PRICE_LABEL).toBe("$6/mo");
  });
});
```

(Confirm the IB chemistry slug from `BANK_CATALOG` while writing the test. If it differs, use the real slug and record a Ruling.)

- [ ] **Step 2:** Run `npx vitest run src/lib/upgrade-copy.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement**

```ts
import { freeQuestionYears, type BankSlug } from "@/lib/access";
import { BANK_CATALOG } from "@/lib/catalog";
import { formatPrice, PRICING_MODEL } from "@/lib/pricing-model";

export type UpgradePlacement = "top_note" | "feed_teaser" | "feed_timeline" | "locked_card" | "practice_milestone" | "signup_gate" | "pdf_dialog";
export type BankYearFacts = { freeLabel: string; newerPaidLabel: string; latestYear: number; coverage: number[]; freeYears: number[]; newerPaidYears: number[] };

export const UPGRADE_PRICE_LABEL = `${formatPrice(PRICING_MODEL.oneBank.monthlyCents)}/mo`;

export function yearRangeLabel(years: readonly number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    runs.push(end === index ? String(sorted[index]) : `${sorted[index]}–${sorted[end]}`);
    index = end + 1;
  }
  return runs.join(", ");
}

const catalogEntry = (bankSlug: string) => BANK_CATALOG.find((entry) => entry.slug === bankSlug);

export function bankYearFacts(bankSlug: string): BankYearFacts | null {
  const entry = catalogEntry(bankSlug);
  const match = entry?.years.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  const freeYears = [...(freeQuestionYears(bankSlug as BankSlug) ?? [])];
  if (!entry || !match || !freeYears.length) return null;
  const [start, end] = [Number(match[1]), Number(match[2])];
  const coverage = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const newestFree = Math.max(...freeYears);
  const newerPaidYears = coverage.filter((year) => year > newestFree && !freeYears.includes(year));
  if (!newerPaidYears.length) return null;
  return { freeLabel: yearRangeLabel(freeYears), newerPaidLabel: yearRangeLabel(newerPaidYears), latestYear: end, coverage, freeYears, newerPaidYears };
}

export function upgradeHref(bankSlug: string): string {
  const productId = catalogEntry(bankSlug)?.productId;
  return productId ? `/pricing?product=${encodeURIComponent(productId)}` : "/pricing";
}
```

- [ ] **Step 4:** Run `npx vitest run src/lib/upgrade-copy.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(upgrade): year facts and upgrade link helper`.

---

### Task 2: Nudge components and tracking hook

**Files:**
- Create: `src/components/UpgradeNudges.tsx`, `src/components/upgrade-nudges.css` and `src/components/UpgradeNudges.test.tsx`.

**Produces:**

```tsx
export function trackUpgrade(kind: "view" | "click" | "dismiss", bank: string, placement: UpgradePlacement): void;
export function useUpgradeView(bank: string, placement: UpgradePlacement, key?: string): (node: Element | null) => void; // ref callback; fires view once per key when ≥50% visible (or immediately if IntersectionObserver is missing)
export function readFeedNudgeDismissed(): boolean;
export function writeFeedNudgeDismissed(): void;
export function FeedTimelineCard(props: { bank: string; shortName: string; facts: BankYearFacts; href: string; slot: number; onDismiss: () => void }): JSX.Element;
export type TeaserQuestion = { year: number; session: string; paper: string | number; number: string | number; marks: number | null; primaryTopic: string };
export function FeedTeaserCard(props: { bank: string; question: TeaserQuestion; topicLabel: string; href: string; slot: number; onDismiss: () => void }): JSX.Element;
export function PracticeMilestone(props: { bank: string; facts: BankYearFacts | null; href: string; onDismiss: () => void }): JSX.Element;
```

- [ ] **Step 1: Tests** (`UpgradeNudges.test.tsx`, with `trackProductEvent` mocked via `vi.mock("@/lib/product-analytics")`):
  - **FeedTimelineCard:**
    - renders "Exams change. Practise the newest papers.", "2019–2026 papers, with every mark scheme, are on any plan."
    - renders 11 year chips, where 2019–2026 have class `is-paid`
    - the link reads "Unlock Mathematics 0580 · $6/mo" with href `/pricing?product=bank_igcse`
    - clicking it sends `upgrade_prompt_click` `{ bank: "igcse", placement: "feed_timeline" }`
    - Not now calls `onDismiss` and sends `upgrade_prompt_dismiss`
  - **FeedTeaserCard:**
    - renders "2026 May/June · Paper 42 · Question 7 · 6 marks" and "This is from the 2026 paper"
    - renders "Practise the newest questions on Ratio, with mark schemes."
    - contains no `img` element
    - the link reads "Unlock from $6/mo"
  - **useUpgradeView:** with no IntersectionObserver (jsdom), it sends `upgrade_prompt_view` once even across re-renders.
  - **Dismissal storage:** with `sessionStorage.setItem` throwing, `writeFeedNudgeDismissed()` doesn't throw and `readFeedNudgeDismissed()` returns false.
  - **PracticeMilestone:** renders "10 practised. Nice." and "Keep going with 2019–2026 papers."; the dismiss button sends dismiss.
- [ ] **Step 2:** Run `npx vitest run src/components/UpgradeNudges.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - Use `Link` from next/link and `trackProductEvent`.
  - Each card is an `<aside className="upgrade-card …" aria-label="Upgrade">`, and the skeleton is `aria-hidden`.
  - **Timeline card markup:** `.upgrade-card.is-timeline` containing `p.upgrade-eyebrow` "Missing the latest papers", `h3`, `p`, `ol.upgrade-years > li` (with `is-paid` on paid years), and `.upgrade-actions` (Link `.button.primary` plus `button.upgrade-dismiss` "Not now").
  - **Teaser card markup:** `.question-card.upgrade-card.is-teaser` containing the same header/meta/topic structure as a question card (`.question-card-header > .question-meta > span…`, `.question-topic`), a `.upgrade-skeleton` with 5 `i` bars, and an `.upgrade-overlay` with strong text, p and actions.
  - **Milestone:** `.upgrade-milestone` containing strong text, span, Link "Unlock →" and an `×` dismiss button labelled "Dismiss".
  - **CSS:** cards use `--cobalt-faint` gradients and tokens. In the teaser, the overlay sits over the skeleton with a `--surface-raised` gradient. The milestone uses `color-mix(in srgb, var(--success) 10%, var(--surface))`. Include dark mode automatically via tokens, and a mobile padding tweak at ≤640px.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(upgrade): in-feed upgrade cards, milestone and tracking hook`.

---

### Task 3: Wire nudges into the explorer

**Files:**
- Modify: `src/components/QuestionExplorer.tsx`, `src/components/FreeQuestionSignupGate.tsx`.
- Tests: `src/components/QuestionExplorer.test.tsx`, `src/components/FreeQuestionSignupGate.test.tsx`.

**Consumes:** Tasks 1 and 2.

- [ ] **Step 1: Tests** (explorer). Use anonymous access `{ authenticated: false, bankAccess: false, canExportPdf: false }`, `initialState.freeOnly: true`, `bankSlug="igcse"`, and `prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 400), [])`.
  1. The top note reads "You're practising 2016–2018 papers." and contains "2019–2026 papers, including 2026, need a plan". Its link "Unlock from $6/mo" points to `/pricing?product=bank_igcse`.
  2. In-feed: the list has `aside[aria-label="Upgrade"]` after the 3rd and 8th question cards. The first is `.is-teaser`, the second `.is-timeline` (check sibling order in `.question-list`).
  3. The teaser's meta line year equals the max year among the paid questions in the input, and no `/api/assets/sign` request body contains its id.
  4. Not now on any card removes all `aside[aria-label="Upgrade"]`, and `sessionStorage["ppp:feed-nudge-dismissed"] === "1"`.
  5. `fullAccess` renders no top-note upgrade link, no aside and no milestone (Review Focus 1).
  6. With a search that matches 2 questions, no aside is shown (Review Focus 2).
  7. When every paid question is filtered out (input only free questions), both slots render the timeline card (Review Focus 4).
  8. **Full preview** (`freeOnly: false`): the top note reads "Locked questions are from 2019–2026 papers."; a locked card shows "{year} paper · on any plan" and "Unlock from $6/mo"; there is no in-feed aside.
  9. **Milestone:** reveal answers on 10 free questions (stub sign fetch); after the 10th, "10 practised. Nice." appears; after reload (re-render), it does not.
  10. Update existing assertions on "Free exam years are open", the locked-card copy, "Paid plan required" and `/login?next=/pricing` links that the spec changes. The PDF upgrade dialog's "View plans" link now points to `/pricing?product=…`.

  Gate test: "Keep practising for free", "Want 2019–2026 too? Plans start at $6/month.", and a "See plans" link to the given `plansHref` that sends click `signup_gate`.
- [ ] **Step 2:** Run `npx vitest run src/components/QuestionExplorer.test.tsx src/components/FreeQuestionSignupGate.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - **Derived values:**
    - `const yearFacts = useMemo(() => bank ? bankYearFacts(bank) : null, [bank])`
    - `const upgradeLink = bank ? upgradeHref(bank) : "/pricing"`
    - `const nudgesActive = Boolean(bank) && !bootstrapPending && !resolvedAccess.bankAccess && hasFreeTier(bank) && !worksheetId && !sharedSetView`
  - **Split `filtered`:** compute `matching` in its own `useMemo` (route + filters + search, before access), then `filtered` derives from it. This lets the teaser pool reuse `matching`:
    `const teaserPool = useMemo(() => nudgesActive && effectiveFreeOnly ? matching.filter((q) => !isPreviewQuestion(q.bankSlug, q.id)).sort((a, b) => b.year - a.year || sessionRank(b) - sessionRank(a)) : [], …)`
    `sessionRank` orders by month: Feb/March < May/June < Oct/Nov. Use an index lookup with fallback 0.
  - **Feed dismissal:** `const [feedDismissed, setFeedDismissed] = useState(false)`, with a `useEffect` reading `readFeedNudgeDismissed()` after mount.
  - **Question list rendering:** map `shownQuestions` to fragments.
    - After index `i` where `(i + 1) === 3 || ((i + 1) > 3 && (i + 1 - 3) % 5 === 0)`, the slot number `s = 0,1,2,…` decides the kind: even → teaser using `teaserPool[s / 2]`, falling back to the timeline when missing or when `yearFacts` is null; odd → timeline (skipped if `yearFacts` is null).
    - Only when `nudgesActive && effectiveFreeOnly && !feedDismissed`.
    - A slot is inserted only if a question follows it, or it's the 3rd position and at least 3 questions are shown, so there are no trailing cards beyond the list.
  - **Top note:** replace the strip's non-shared copy when `nudgesActive && yearFacts`:
    - free-only: `<strong>You’re practising {freeLabel} papers.</strong> <span>The {newerPaidLabel} papers, including {latestYear}, need a plan.</span>`
    - full preview: `<strong>Locked questions are from {newerPaidLabel} papers.</strong>`
    - Link text: `Unlock from {UPGRADE_PRICE_LABEL}` with the arrow span, href `upgradeLink`, `ref={useUpgradeView(bank, "top_note")}`, and an onClick that tracks.
    - Without facts, keep the old strong/span copy but change the link to "Unlock from $6/mo".
  - **Locked card:** pass `lockedTitle={`${question.year} paper · on any plan`}`, `lockedBody={`Unlock ${paidCount.toLocaleString()} more ${shortName} questions with mark schemes and PDFs.`}`, `upgradeLink` and `bank` into `QuestionCard`.
    - `paidCount = catalogQuestions.filter(q => !isPreviewQuestion(...)).length`.
    - `shortName` comes from `BANK_CATALOG.find(...)?.shortName ?? "bank"`.
    - The button reads "Unlock from $6/mo" and tracks `locked_card` (view once per page via the hook keyed `locked_card`).
  - **Milestone:**
    - `recordReveal()` runs from `QuestionCard`'s reveal (new `onReveal` prop, called in `toggleAnswer` when opening).
    - When `nudgesActive`, it increments `localStorage["ppp:reveals:<bank>"]`. When the count reaches ≥10 and `ppp:milestone-shown:<bank>` is unset, it sets the flag and `setMilestoneVisible(true)`.
    - Render `<PracticeMilestone>` under `.results-heading` while visible.
  - **PDF upgrade dialog:** link href `upgradeLink`, with an onClick tracking `pdf_dialog`.
  - **Gate:** pass `plansHref={upgradeLink}` and `plansLine={yearFacts ? `Want ${yearFacts.newerPaidLabel} too? Plans start at $6/month.` : "Want every year? Plans start at $6/month."}`.
  - **FreeQuestionSignupGate:**
    - Title "Keep practising for free".
    - Body: "Create a free account for the other {remaining} free questions. {plansLine}"
    - Add `<Link className="button secondary" href={plansHref} onClick={() => trackUpgrade("click", bankSlug, "signup_gate")}>See plans</Link>` after Create free account.
    - Make the new props optional, with defaults `/pricing` and the generic line.
  - `PLANS_LABEL` and `plansHrefFor` stay only where they are still used. If they are unused, delete them.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(upgrade): newest-years nudges across the bank page`.

---

### Task 4: Verify

- [ ] Run `npm run lint && npm run typecheck && npm test && npm run build`. All must pass.
- [ ] **Local browser check** (no images locally):
  - `/banks/igcse?free=1` signed out, at 1440 and 375px, in light and dark mode: top note, cards at positions 3 and 8, Not now, and the gate copy.
  - `/banks/ib-sl` full preview: locked-card copy.
- [ ] Fix visual issues by writing a test first, then commit.
