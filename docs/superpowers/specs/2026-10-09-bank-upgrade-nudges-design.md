# Bank page upgrade nudges

Date: 2026-10-09
Status: design approved in conversation, awaiting written-spec review
Builds on: PR #200 (bank page refresh). This branch is stacked on `feat/bank-page-refresh`.

## Goal

Make upgrading obvious to anyone on a bank page without a plan for that bank, whether signed out or signed in on the free tier. Lead with fear of missing out on the **newest exam years**, show the price wherever a limit is hit, and track every prompt in PostHog by where it appears.

This is PR 1 of the upgrade pass. Later PRs: tracking gaps (PR 2), pricing page and free dashboard (PR 3), landing page (PR 4).

## Who sees nudges

Nudges show only when **all** of these are true:
- Bootstrap has finished (`!bootstrapPending`).
- The user has no access to this bank (`!resolvedAccess.bankAccess`).
- The bank has a free tier (`hasFreeTier`).
- The view is the normal bank view: not a saved worksheet and not a shared set.

Paying users never see them.

## Year facts (new helper)

Add `src/lib/upgrade-copy.ts`:

```ts
export type BankYearFacts = {
  freeLabel: string;          // "2016–2018", "2017", "2020"
  newerPaidLabel: string;     // paid years after the newest free year: "2019–2026", "2021–2025"
  latestYear: number;         // newest year in the bank's coverage, e.g. 2026
  newerPaidYears: number[];   // e.g. [2019, …, 2026]
};
export function bankYearFacts(bankSlug: BankSlug): BankYearFacts | null
```

- Free years come from `freeQuestionYears(bank)`.
- Coverage comes from the catalog `years` string (`"2016-2026"`).
- Contiguous runs display as `A–B` with an en dash, and a single year displays as `A`.
- Returns `null` when the bank has no free years or no paid years after the newest free year. All nudge copy that uses year facts is then omitted, with a generic fallback where noted.

Price label: `formatPrice(PRICING_MODEL.oneBank.monthlyCents)` + `/mo`, which gives `$6/mo`.

Upgrade link: `/pricing?product=<bank.productId>` for everyone. The pricing page is public, preselects that bank, and already handles sign-in at checkout. The old `/login?next=/pricing` hop for signed-out users is dropped from these upgrade links only.

## Placements

All copy below is for 0580. Other banks substitute their own facts.

### 1. Top note (`top_note`)

Replaces the "Free exam years are open." line in the free-only view:

**You're practising 2016–2018 papers.** The 2019–2026 papers, including 2026, need a plan. · **Unlock from $6/mo →**

- In full-bank preview (free-only off): **Locked questions are from 2019–2026 papers.** · **Unlock from $6/mo →**
- The shared-set copy is unchanged.
- Fallback without year facts: today's copy, with the link reading "Unlock from $6/mo →".

### 2. In-feed upgrade cards (`feed_teaser`, `feed_timeline`)

These appear inside `.question-list` in the **free-only view only**. In full-bank preview, locked cards already do this job.

- **Positions:** after the 3rd, 8th, 13th, 18th… question shown. Cards alternate starting with the teaser: teaser, timeline, teaser, …
- **Teaser card (B):**
  - Looks like a question card, using the metadata of the **newest paid question that matches the current filters**. To find it, run the same filter pipeline with free-only off, keep questions that are not free, sort by year descending then session, and take one per slot without repeating.
  - Shows the metadata line and topic line, a hidden body (grey skeleton lines, no image request), and an overlay: **This is from the 2026 paper**, then "Practise the newest questions on {primaryTopic}, with mark schemes.", then **Unlock from $6/mo** and **Not now**.
  - If no matching paid question exists, the slot uses the timeline card instead.
- **Timeline card (A):**
  - Eyebrow "Missing the latest papers", then **Exams change. Practise the newest papers.**, then "2019–2026 papers, with every mark scheme, are on any plan."
  - Year chips run across the coverage range: free years in grey, paid years in cobalt.
  - Buttons: **Unlock {shortName} · $6/mo** and **Not now**.
  - Not shown without year facts.
- **Not now** hides every in-feed card for the rest of the browser session (`sessionStorage` key `ppp:feed-nudge-dismissed`). Wrap access in try/catch; if storage fails, the card stays hidden until the page is reloaded.
- **Accessibility:** cards are `<aside aria-label="Upgrade">`, and the skeleton is `aria-hidden`.

### 3. Locked card (`locked_card`)

This is the existing locked card in full-bank preview.
- Title: **{year} paper · on any plan**, for example "2025 paper · on any plan".
- Body: "Unlock {paidCount} more {shortName} questions with mark schemes and PDFs." Here `paidCount` is the number of non-free questions in the loaded catalog for this bank.
- Button: **Unlock from $6/mo**.

### 4. Practice milestone (`practice_milestone`)

- **When it appears:** on the 10th answer reveal for this bank in this browser. The count is kept in `localStorage` per bank and includes signed-out visitors.
- **What it shows:** one slim green line under the results heading, **10 practised. Nice.** Keep going with 2019–2026 papers. · **Unlock →**, plus a dismiss button.
- It is shown at most once per bank. It sets `ppp:milestone-shown:<bank>` when it is shown, and the dismiss button hides it.

### 5. Free-account gate (`signup_gate`)

`FreeQuestionSignupGate` keeps its behaviour. The copy changes to:
- Kicker: Free account.
- Title: **Keep practising for free**.
- Body: "Create a free account for the other {remaining} free questions. Want 2019–2026 too? Plans start at $6/month."
- Actions: **Create free account** (primary), **See plans** (secondary, linking to the upgrade link), then "Already have an account? Sign in".
- Without year facts: "Want every year? Plans start at $6/month."

### 6. PDF upgrade dialog (`pdf_dialog`)

The copy is unchanged from #200. The **View plans** button uses the upgrade link and is tracked.

## Tracking

New events through `trackProductEvent`:
- `upgrade_prompt_view` with `{ bank, placement }`. Sent once per placement per page view; for in-feed cards, once per card position when 50% of the card is visible (IntersectionObserver, which jsdom skips gracefully).
- `upgrade_prompt_click` with `{ bank, placement }`.
- `upgrade_prompt_dismiss` with `{ bank, placement }`.

`placement` is one of: `top_note`, `feed_teaser`, `feed_timeline`, `locked_card`, `practice_milestone`, `signup_gate`, `pdf_dialog`.

Existing events are unchanged: `free_gate_*`, `pdf_upgrade_view`, `answer_reveal`.

## Out of scope

Pricing page changes, the dashboard, server-side tracking or error tracking (PR 2), email, trials, and any Stripe or entitlement change.

## Testing

- **Unit tests for `bankYearFacts`:** 0580 (2016–2018 free, 2019–2026 paid), IB AA SL (2017 / 2018–2026), an IB science bank (free 2020 gives newer paid 2021–2025), and a bank without free years (null).
- **Explorer tests:**
  - Nudges never render with bank access or in worksheet or shared-set views.
  - Top note copy in free-only and full-preview modes.
  - In-feed card positions and alternation.
  - The teaser uses the newest matching paid question's metadata and requests no asset for it.
  - Not now hides all in-feed cards and is remembered for the session.
  - Locked card copy.
  - The milestone appears on the 10th reveal only once.
  - Gate copy and its See plans link.
  - View, click and dismiss events carry the right placement.
  - Upgrade links point to `/pricing?product=<productId>`.
- **Existing tests** asserting `/login?next=/pricing` for these links are updated deliberately.
- **Browser check** on the preview: 0580 signed out, IB AA SL signed in on a free account, at desktop and 375px, in light and dark mode.

## Style

Copy stays short. Cards use existing tokens, and dark mode must work. No popups beyond the existing sign-up gate.
