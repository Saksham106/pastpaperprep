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

Required when private signed asset delivery is enabled:

- `SUPABASE_SECRET_KEY` (server-only; never expose it through a `NEXT_PUBLIC_*` variable)

Keep local values in `.env.local`. Configure production values in Vercel. Never expose a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.

## Content architecture

- The private `Saksham106/pastpaperprep` repository contains the Next.js application and normalized question metadata in `src/data/raw/*.json`.
- Vercel builds and serves the application. The bundled metadata tells the browser which questions match each filter.
- The binary question and mark-scheme images have been copied into the private Supabase Storage bucket `question-assets`. The live application still serves the three public `Saksham106.github.io` source sites until entitlement-aware signed delivery is implemented and verified.
- Supabase currently handles accounts and commercial records: profiles, entitlements, saved questions, attempts, and Stripe customer mappings.
- The target paid architecture delivers the uploaded private objects through short-lived signed URLs after server-side entitlement checks.
- The access policy, strict public-URL-to-private-object mapping, and bounded `/api/assets/sign` endpoint are implemented. The current beta UI does not call that endpoint yet, so deploying this foundation does not interrupt the public testing flow.

Do not make the three source repositories private until the signed delivery cutover has passed production QA. Doing so now would break the images on PastPaperPrep.

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
5. Cut question and mark-scheme delivery over from public GitHub Pages to the uploaded private objects using authorized signed URLs.
6. Add transactional email branding and a monitored support inbox.
7. Run a real purchase, cancellation, renewal, and expired-access test before accepting customers.

## Important limitation

The current question and mark-scheme images are still served from the public GitHub Pages sites owned by `Saksham106`, even though a byte-matched private copy now exists in Supabase Storage. Account infrastructure is production-ready, but the content is not yet an enforceable paywall while those public files remain reachable. Do not claim paid exclusivity until signed delivery is live and the public source sites have been retired.
