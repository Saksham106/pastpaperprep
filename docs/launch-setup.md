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
- `ASSET_STORAGE_PROVIDER=r2`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME=pastpaperprep-assets`
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` from an **Object Read only** token scoped only to `pastpaperprep-assets`

Keep local values in `.env.local`. Configure production values in Vercel. Never expose a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.

R2 stays private. Apply `config/r2-cors.json` with `wrangler r2 bucket cors set pastpaperprep-assets --file config/r2-cors.json`, then read it back with `wrangler r2 bucket cors list pastpaperprep-assets`. For an upload, create a temporary bucket-scoped Object Read & Write token, expose it locally only as `R2_SYNC_ACCESS_KEY_ID` and `R2_SYNC_SECRET_ACCESS_KEY`, run `npm run r2:sync`, and delete the token immediately after exact reconciliation. Never put sync credentials in Vercel. Before every asset-metadata deployment, run `npm run r2:verify` with a scoped token and require zero missing, mismatched, or unexpected objects. `npm run storage:plan` derives the Supabase retention split from the same normalized runtime paths, including `officialMarkscheme.images`; never use a separately hand-built deletion list. When a release introduces new free-year assets, run `npm run storage:sync-previews` before deployment. That command uploads only missing required previews and verifies their readback; it never deletes or overwrites objects.

Cloudflare R2 has no hard spending cap. Keep the account budget alert at the minimum `$0.01` threshold and monitor usage; the alert is notification-only. The current corpus is below R2's free storage allowance, but future storage and request traffic still need monitoring.

## Content architecture

- The private `Saksham106/pastpaperprep` repository contains the Next.js application and normalized question metadata in `src/data/raw/*.json`.
- Vercel builds and serves the application. The bundled metadata tells the browser which questions match each filter.
- The preview corpus (currently 4,386 objects, including official mark-scheme images and the 2020 Biology, Chemistry, and Physics previews) remains in the private Supabase Storage bucket `question-assets`, so anonymous preview traffic cannot generate billable R2 operations. Both providers use short-lived signed URLs. R2 presigning is local and performs no per-request `HeadObject`; exact object existence is instead a mandatory deployment gate through `npm run r2:verify`, and the production token is read-only so runtime code cannot create drift. After production verification and premium Supabase cleanup, this R2-aware release is the rollback floor: never roll back to an older Supabase-only deployment because those premium Supabase copies no longer exist.
- Supabase currently handles accounts and commercial records: profiles, entitlements, saved questions, attempts, and Stripe customer mappings.
- The access policy, strict logical-question-to-private-object mapping, and bounded `/api/assets/sign` endpoint are live. Locked browser payloads do not contain premium content or private Storage paths.
- PDF worksheets are capped at 50 questions and require a paid entitlement. The server atomically enforces daily worksheet, exported-question, and signed-asset allowances. Generated PDFs carry a privacy-safe account marker.
- Operator-approved accounts can be exempted from download allowances through the SQL-editor-only `set_download_allowance_exemption` helper. It is not callable by browser or service roles.

All source repositories are private. Private R2 is authoritative for premium assets; private Supabase Storage is authoritative for free preview assets. GitHub Pages is not a production asset source.

Stripe Checkout, Billing Portal, verified webhook handling, and entitlement synchronization are implemented behind server-only configuration. Existing founding All-Access subscriptions keep their original price. New checkout uses the bank-based prices documented in `docs/pricing-strategy.md`. Both billing API routes remain disabled unless `STRIPE_BILLING_ENABLED=true`; live keys additionally require `STRIPE_LIVE_MODE_ENABLED=true`.

## Product identifiers

- `bank_igcse`
- `bank_igcse_additional`
- `bank_ib_hl`
- `bank_ib_sl`
- `bank_ib_ai_hl`
- `bank_ib_ai_sl`
- `bank_ib_chemistry_hl`
- `bank_ib_chemistry_sl`
- `bank_ib_physics_hl`
- `bank_ib_physics_sl`
- `bank_ib_biology_hl`
- `bank_ib_biology_sl`
- `bundle_igcse`
- `bundle_ib_aa`
- `bundle_ib_ai`
- `bundle_ib_chemistry`
- `bundle_ib_physics`
- `bundle_ib_biology`
- `bundle_all`

These identifiers are stable internal entitlement keys. Stripe price IDs can change without changing the access model.

Complimentary access uses a manually issued `bundle_all` entitlement. Checkout accepts Stripe promotion codes so the operator can create teacher, partner, or individual discounts without accepting browser-supplied prices. Manual entitlements and promotion codes must be created only after reviewing the target account or campaign.

## Remaining commercial launch gates

1. Apply and verify the download-allowance migration.
2. Apply and read back `supabase/migrations/20260826194645_add_bank_based_pricing.sql` before deploying bank-based Checkout.
3. Deploy and test password sign-in, password reset, one-link authentication email, free-only filtering, iPad layouts, PDF limits, and watermarks in production.
4. Confirm the live Stripe product names, prices, webhook, Billing Portal, and production environment use only live-mode values. Keep Portal subscription switching disabled until a server-owned plan-change flow updates subscription metadata and entitlements atomically; Portal may manage payment methods and cancellation.
5. Run a controlled live purchase, entitlement grant, Portal access, cancellation/refund, webhook revocation, and post-revocation denial.
6. Keep public billing gated until every production lifecycle check passes.
