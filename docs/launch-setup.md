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

Auth supports either a password or a one-time email link. New accounts can start with email and add a password later. Production and local callback URLs are allow-listed in Supabase, and Supabase sends branded authentication mail through Resend custom SMTP.

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
- The binary question and mark-scheme images live in the private Supabase Storage bucket `question-assets` and are delivered through short-lived signed URLs after server-side entitlement checks.
- Supabase currently handles accounts and commercial records: profiles, entitlements, saved questions, attempts, and Stripe customer mappings.
- The access policy, strict logical-question-to-private-object mapping, and bounded `/api/assets/sign` endpoint are live. Locked browser payloads do not contain premium content or private Storage paths.
- PDF worksheets are capped at 50 questions and require a paid entitlement. The server atomically enforces daily worksheet, exported-question, and signed-asset allowances. Generated PDFs carry a privacy-safe account marker.
- Operator-approved accounts can be exempted from download allowances through the SQL-editor-only `set_download_allowance_exemption` helper. It is not callable by browser or service roles.

The three legacy source repositories are private, GitHub Pages is disabled, and the old public content URLs return `404`.

Stripe Checkout, Billing Portal, verified webhook handling, and entitlement synchronization are implemented behind server-only configuration. The dedicated PastPaperPrep Stripe sandbox contains the approved founding prices: $4.99 monthly and $39.99 annually. Both billing API routes remain disabled unless `STRIPE_BILLING_ENABLED=true`; live keys additionally require `STRIPE_LIVE_MODE_ENABLED=true`. Keep both flags false until credentials, the webhook endpoint, private asset delivery, and lifecycle tests are complete.

## Product identifiers

- `bank_igcse`
- `bank_ib_hl`
- `bank_ib_sl`
- `bundle_all`

These identifiers are stable internal entitlement keys. Stripe price IDs can change without changing the access model.

Complimentary access uses a manually issued `bundle_all` entitlement. Checkout accepts Stripe promotion codes so the operator can create teacher, partner, or individual discounts without accepting browser-supplied prices. Manual entitlements and promotion codes must be created only after reviewing the target account or campaign.

## Remaining commercial launch gates

1. Apply and verify the download-allowance migration.
2. Deploy and test password sign-in, password reset, one-link authentication email, free-only filtering, iPad layouts, PDF limits, and watermarks in production.
3. Confirm the live Stripe product names, prices, webhook, Billing Portal, and production environment use only live-mode values.
4. Run a controlled live purchase, entitlement grant, Portal access, cancellation/refund, webhook revocation, and post-revocation denial.
5. Keep public billing gated until every production lifecycle check passes.
