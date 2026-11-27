# Annual-plan sale runbook

Seasonal discount on the **first year of annual plans**, laddered by plan size. Monthly and Lifetime are never discounted.

| Plan | Normal annual | Sale | First year |
|---|---|---|---|
| One Bank | $48 | 25% | $36 |
| Build your plan, 2–3 banks | $84 / $120 | 30% | $58.80 / $84 |
| Build your plan, 4–5 banks | $156 / $192 | 35% | $101.40 / $124.80 |
| All Access (and 6+ banks) | $216 | 40% | $129.60 |

Window: 2026-11-26 00:00 to 2026-12-01 23:59:59 UTC. Config: `src/lib/annual-sale.ts` (`ANNUAL_SALE`: id, tiers, window, end label). Server: `src/lib/annual-sale-checkout.ts` and `src/app/api/billing/checkout/route.ts`.

## How it works

- Inert unless **both** hold: the clock is inside `[startsAt, endsAt)` and all four env vars are set (`STRIPE_SALE_COUPON_SINGLE`, `STRIPE_SALE_COUPON_BUILDER_SMALL`, `STRIPE_SALE_COUPON_BUILDER_LARGE`, `STRIPE_SALE_COUPON_ALL`). A partial setup stays off, so no card promises a discount that has no coupon.
- The tier comes from the server-resolved product: `bank_*` → One Bank; `bundle_all` (including 6+ banks promoted to it) → All Access; `bundle_custom` → 2–3 or 4–5 banks by its validated quantity (never a browser count); legacy subject pairs → 2–3 banks.
- Annual Checkout reads the tier's coupon back from Stripe. It must be `valid`, have `percent_off` equal to the tier's percent and `duration=once`, and have no `amount_off`. If it passes, the session gets `discounts: [{ coupon }]` and no promotion-code box (Stripe rejects both together). If the coupon is missing or doesn't match, the server logs an error and returns 503 `SALE_UNAVAILABLE` ("The sale price isn't available right now") without creating a Checkout. A buyer who was shown the sale price is never sent to a full-price Checkout. If Stripe is down, it also returns 503 so the buyer retries. Monthly checkout is unaffected either way.
- Monthly checkout never reads a coupon and keeps promotion codes.
- `duration=once` means one invoice, which on annual is the first year. Renewal is at full price.
- Sale sessions carry `metadata.annual_sale`. An open full-price session from before the sale is expired and replaced, and a sale session is not reused after the sale ends. On the last day, sale sessions expire at the sale end. Stripe won't let a session expire less than 30 minutes after it's created, so a checkout opened in the last 30 minutes (for example at 23:59 UTC) stays payable until 30 minutes after it opened (00:29). This grace only benefits buyers who started before the cutoff, so the advertised end date stands. No new discounted session is created after the end, and the coupons' `redeem_by` (01:00 UTC) covers the grace. When the countdown reaches zero it clears the sale flag, so an open tab drops the banner and sale prices without a reload.
- Banner and pricing copy ship in the build only when the env vars are set and the sale hasn't ended at build time. A `<head>` script shows them only inside the window.
- Upgrade nudge (site-wide, not sale-only), from `src/lib/plan-upgrade-nudge.ts`: one card above the button. During the sale it reads "N banks away from X% off" (or "All Access · 40% off"), with a progress bar and "Add a bank for just $X/mo more". Otherwise it reads "Add 1 more bank for just $X/mo more", or "1 bank away from All Access" at 5 banks. Annual shows the yearly difference ÷ 12. The owner asked (2026-11-26) for no bracketed yearly figure on the nudge; the card's own billing line shows the exact first-year charge and renewal, and updates as banks are added. During the sale the per-month figure uses first-year sale prices, which the page frames with "−X% first year". One Bank shows the nudge only while the builder holds fewer than 2 banks. Subscribers buying add-ons don't see it.
- Copy: the banner and Annual toggle say "up to 40%", and each card shows its exact struck-through price and sale price. UK ad rules (ASA/CTSI) require a significant share of the offer to get the full "up to" discount. All Access is one of the three plans and gets 40%.
- Plan changes in the account editor (switching monthly to annual) are not discounted. Only new Checkout subscriptions are.
- Stacking: sale sessions have no promotion codes. Partner referral commission is worked out on the amount actually collected (after the discount). Customer referral credit sits in the customer balance and comes off the next invoice, the same as before.

## Measure

- `pricing_view` and `checkout_start` carry `annualSale` (true while the sale is live in the browser).
- The server `conversion_outcome` event (`payment_initial_paid`) carries `interval` and `product`, plus `campaign=black-friday-2026` when the subscription came from a sale Checkout. `discounted` is true for any invoice discount, promo codes included, so don't use it to measure the sale.
- Annual completion during the sale = `conversion_outcome` (`payment_initial_paid`, `campaign=black-friday-2026`) ÷ sale Checkout Sessions created (Stripe sessions with `metadata.annual_sale`). `checkout_start` with `annualSale=true` is a browser click, so use it only as a rough upper bound. Break it down by `product` to see whether the ladder moved buyers up. Baseline (60 days to 2026-11-26): annual 50 started → 4 paid; monthly 132 → 51.

## Owner checklist (each step needs fresh owner approval)

Order matters: the coupons and env vars must exist **before** the production build, because the banner is decided at build time.

1. **Create the four live coupons.** Don't create promotion codes; customers can't type a bare coupon.

   ```bash
   stripe coupons create --live --confirm -d id=bf2026-annual-25 -d percent_off=25 -d duration=once -d redeem_by=1796173200 -d "name=Black Friday: 25% off first year" -d "metadata[sale]=black-friday-2026"
   ```

   ```bash
   stripe coupons create --live --confirm -d id=bf2026-annual-30 -d percent_off=30 -d duration=once -d redeem_by=1796173200 -d "name=Black Friday: 30% off first year" -d "metadata[sale]=black-friday-2026"
   ```

   ```bash
   stripe coupons create --live --confirm -d id=bf2026-annual-35 -d percent_off=35 -d duration=once -d redeem_by=1796173200 -d "name=Black Friday: 35% off first year" -d "metadata[sale]=black-friday-2026"
   ```

   ```bash
   stripe coupons create --live --confirm -d id=bf2026-annual-40 -d percent_off=40 -d duration=once -d redeem_by=1796173200 -d "name=Black Friday: 40% off first year" -d "metadata[sale]=black-friday-2026"
   ```

   `redeem_by=1796173200` is 2026-12-02 01:00 UTC, one hour after the app stops applying the coupons. It's a backstop, not the window. Don't set `applies_to`: monthly and annual share products, so it can't tell them apart. The server does that.

   Read each one back with `stripe coupons retrieve <id> --live` and check: `percent_off`, `duration: once`, `valid: true`, `redeem_by: 1796173200`, `livemode: true`.

2. **Set the Vercel env vars (Production only):**

   ```bash
   printf 'bf2026-annual-25' | vercel env add STRIPE_SALE_COUPON_SINGLE production
   ```

   ```bash
   printf 'bf2026-annual-30' | vercel env add STRIPE_SALE_COUPON_BUILDER_SMALL production
   ```

   ```bash
   printf 'bf2026-annual-35' | vercel env add STRIPE_SALE_COUPON_BUILDER_LARGE production
   ```

   ```bash
   printf 'bf2026-annual-40' | vercel env add STRIPE_SALE_COUPON_ALL production
   ```

   Check with `vercel env ls production | grep STRIPE_SALE_COUPON`.

3. **Merge the PR** so `main` builds with the env vars, and wait for the production deployment to be Ready.

4. **Verify:**
   - Any page shows the banner. `/pricing?interval=annual` shows the struck-through prices and "ends 1 Dec".
   - Sign in and start an annual checkout for each tier. The Stripe page should show 25%, 35% or 40% off and no promotion-code field. Monthly should show full price with the code field. Don't pay; close the tab.
   - In the Stripe Dashboard, the session's metadata has `annual_sale=black-friday-2026`.

## After the sale

Nothing is required: after 2026-12-02 00:00 UTC the banner hides and checkout stops applying the coupons. Optional tidy-up (needs approval): remove the four `STRIPE_SALE_COUPON_*` vars from Vercel. The coupons stop redeeming at `redeem_by` on their own.

## Next sale

Change `ANNUAL_SALE` in code (id, name, tiers, window, end label). Keep the ladder monotonic: the test `never makes a bigger plan cheaper than a smaller one` checks it. Create new coupons whose `percent_off` match, point the env vars at them, and deploy. Avoid March–April, the exam-season peak.
