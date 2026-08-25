# PastPaperPrep launch setup

Updated: 25 August 2026

## Live infrastructure

- Production: https://pastpaperprep.com
- `www.pastpaperprep.com`: permanent redirect to the apex domain
- Hosting: Vercel project `pastpaperprep`
- Source: private GitHub repository `Saksham106/pastpaperprep`
- Database/auth: dedicated Supabase project `PastPaperPrep`

## Supabase

The initial commercial schema lives in:

`supabase/migrations/20260825123000_initial_commercial_schema.sql`

It creates:

- `profiles`
- `products`
- `entitlements`
- `saved_questions`
- `attempts`
- `stripe_customers`

RLS is enabled on every user-data table. Browser clients can only read or mutate rows owned by the authenticated user. Entitlements and Stripe mappings are read-only to browser clients and must later be updated by trusted webhook/server code.

Auth uses passwordless email links. Production and local callback URLs are allow-listed in Supabase.

## Environment variables

Required now:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://pastpaperprep.com`

Keep local values in `.env.local`. Configure production values in Vercel. Never expose a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.

Stripe placeholders remain in `.env.example`, but checkout is intentionally disabled until prices, billing periods, refund terms, and product access are finalized.

## Product identifiers

- `bank_igcse`
- `bank_ib_hl`
- `bank_ib_sl`
- `bundle_all`

These identifiers are stable internal entitlement keys. Stripe price IDs can change without changing the access model.

## Remaining commercial launch gates

1. Finalize prices and refund terms.
2. Create matching Stripe products/prices in Saksham's Stripe account.
3. Add server-side Checkout, Billing Portal, and signed webhook handling.
4. Update entitlements only from verified Stripe webhook events.
5. Move question and mark-scheme assets off public GitHub Pages into private storage with authorized delivery.
6. Add transactional email branding and a monitored support inbox.
7. Run a real purchase, cancellation, renewal, and expired-access test before accepting customers.

## Important limitation

The current question and mark-scheme images are still served from Swati's public GitHub Pages URLs. Account infrastructure is production-ready, but the content is not yet an enforceable paywall while those files remain publicly available. Do not claim paid exclusivity until the asset migration is complete.
