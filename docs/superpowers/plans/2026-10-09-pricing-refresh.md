# Pricing Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** A clearer pricing page and free-dashboard plan card, with no billing behaviour change.

**Spec:** `docs/superpowers/specs/2026-10-09-pricing-refresh-design.md`

## Global Constraints
- Checkout components, product IDs, prices and the API calls are unchanged. Only props such as labels and preselection may change.
- Copy is short and plain.
- Use existing tokens. The page must work in light and dark mode and at 375px.

## Review Focus
1. **Paid, complimentary, manual and lifetime states** still render exactly the existing account sections and editors. The focus panel and FAQ never show to paid users.
2. **An unknown or non-bank `product`** (e.g. `bundle_all`) shows no focus panel.
3. **The annual interval** updates the focus panel price and billing line.
4. **The focus panel's checkout** uses the exact single product and the existing `PlanCheckout` auth handling (signed out → login with return).
5. **The toggle** still switches Lifetime correctly with the static layout.

### Task 1: Plan cards, headline, sticky toggle, FAQ
Files: `src/components/PricingContent.tsx`, `src/app/globals.css`, tests (`PricingContent.test.tsx`, `ux-polish-style-contract.test.ts`).
- RED: tests for the inclusion lists, no engraving images, the builder's "Billed monthly" without "Two-bank minimum", the headline, the FAQ for non-paid users only, and the toggle not sticky. Then GREEN, then commit.

### Task 2: Bank focus panel and paid preselection
Files: new `src/components/PricingBankFocus.tsx` (+test), `PricingContent.tsx`, `src/app/globals.css`.
- RED: tests for the panel's render conditions, copy, year chips, add-subject links, `#plan-all`, the checkout label and annual price, plus paid add-on preselection excluding owned banks. Then GREEN, then commit.

### Task 3: Free dashboard plan card
Files: `src/components/DashboardContent.tsx` (+test), `src/lib/upgrade-copy.ts` (accept `dashboard` for `from`), and CSS.
- RED, then GREEN, then commit.

### Task 4: Verify
- Run lint, typecheck, test and build.
- Browser-check the preview signed out at desktop width:
  - `/pricing`
  - `/pricing?product=bank_igcse&from=top_note`
  - `/pricing?banks=igcse,igcse-additional`
- Final review.
