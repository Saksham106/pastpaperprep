# Pricing page refresh

Date: 2026-10-09
Status: design approved in conversation, with two adjustments (always show the other plans, and no "for 2" wording on the builder price). Mockups: `pricing.html` in the brainstorm session.

## Goal

Make the pricing page explain what a plan gets you. People arriving from an upgrade prompt see their bank first, and are still shown every other plan. Plans, prices, Stripe checkout and entitlements are unchanged.

## Changes

1. **Bank focus panel.**
   - **When it shows:** for visitors without paid access whose URL has `?product=bank_*` (from the upgrade links).
   - **Contents:**
     - eyebrow (qualification · bank name)
     - "Unlock every {short name} paper"
     - a year-facts sub-line ("A plan opens {newerPaidLabel}, including {latestYear}'s papers.")
     - the One Bank price for the chosen interval
     - a list of what's included
     - free and paid year chips
     - the existing `PlanCheckout` for that single product, labelled "Unlock {short name}"
     - "Secure checkout · Cancel any time"
     - **Add another subject:** up to 4 other banks from the same qualification as links to `/pricing?banks=<this>,<other>` (the builder preselected with both), plus an "All {n} banks · $25/mo" link to `#plan-all`. Line: "Taking another subject too? Add it and pay {two-bank monthly price}/month for both."
   - **The full three-plan grid stays below it** under "Or compare every plan", with the bank already selected.
2. **Plan cards:**
   - Remove the decorative engravings.
   - Add a short "what you get" list per plan:
     - One Bank: every year incl. the newest papers; every mark scheme; save & download PDFs; mock paper builder
     - Builder: everything in One Bank; for every subject you take; one subscription, one bill
     - All Access: every bank, every subject; new banks as they launch; best for tutors and schools
   - Builder card: under its price it shows the same billing note as the other cards ("Billed monthly", or the annual line). The "Two-bank minimum. Select banks to see your exact price." note is removed. The picker still enforces two banks.
   - No "for 2 / for 3" wording.
   - The All Access card gets `id="plan-all"`.
3. **Headline:** "Practise every past paper, newest first." / "Start free with older years. A plan unlocks the latest papers and every mark scheme."
4. **Toggle no longer floats:** `.pricing-toggle-sticky` stops being sticky (static), so it can't overlap the stats, the table or the footer.
5. **FAQ** (visitors without paid access), placed before the bank catalogue:
   - "What's free?" Older exam years for each bank, with answers. No card needed.
   - "Can I cancel?" Yes, any time from your account. Access continues through the paid billing period.
   - "Monthly or annual?" Annual saves up to {max}%. You can switch later.
   - "Do I get the newest papers?" Yes. Every plan includes the latest sessions as they're added.
6. **Subscribers keep preselection:** paid users who reach an add-on offer (`addOnIntent`) get the requested banks preselected, minus banks they already own. Previously the selection was cleared.
7. **Free dashboard card:** replace the one-line upgrade strip with a "Your plan · Free" card: "You have the older years of every bank." / "Plans add the newest papers, every mark scheme and PDFs. From {price}/month." with a "See plans" button (`/pricing?from=dashboard`). Add `dashboard` to the accepted `from` values.

## Out of scope

Price or plan changes, Stripe objects, the lifetime offer layout, the bank comparison table design and the referral section.

## Testing

- **Focus panel:**
  - renders only for non-paid visitors with a `bank_*` product
  - links point to `/pricing?banks=a,b` and `#plan-all`
  - the grid still renders below it
  - the checkout button is labelled "Unlock {short name}"
- **Builder card:** shows no "Two-bank minimum" or "for 2" text, and shows "Billed monthly" before any selection.
- **Cards:** the engravings are gone and the inclusion lists are present.
- **FAQ** renders for non-paid visitors only.
- **Paid add-on preselection** excludes owned banks.
- **Dashboard card:** copy and link.
- **Style contract:** the toggle isn't `position: sticky`.
- **Existing pricing, checkout and billing tests** keep passing, apart from deliberate copy updates.
