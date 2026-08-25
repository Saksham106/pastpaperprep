# PastPaperPrep Commercial Launch Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn the current working PastPaperPrep beta into a sellable product with secure paid access, Stripe billing, private content delivery, and a clean retirement path for the three legacy public sites.

**Architecture:** Keep discovery pages and a small sample public, but require an authenticated entitlement for the complete bank, answers, and PDF exports. Stripe is the billing source of truth; verified, idempotent webhooks update Supabase entitlements. All 9,853 image assets remain in the private `question-assets` Supabase Storage bucket and are delivered through short-lived server-authorized URLs. GitHub Pages stays online during testing and is disabled only after the private delivery path passes production QA.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/Storage, Stripe Checkout/Customer Portal/Webhooks, Vercel, Vitest.

---

## Launch strategy

Do not start by adding a Stripe button to publicly available content. The correct order is:

1. Lock the product offer and preview rules.
2. Build and test entitlement enforcement.
3. Cut image delivery to private Supabase Storage.
4. Add Stripe and webhook synchronization.
5. Test the complete customer lifecycle.
6. Disable the three legacy GitHub Pages sites.
7. Start accepting customers.

Recommended initial access model:

- Public: homepage, pricing, bank/topic discovery, counts, filters, and a deliberately limited sample.
- Signed-in without purchase: account plus the same samples.
- Bank entitlement: complete purchased bank, answers, selection, and PDF export.
- `bundle_all`: all three banks.
- Keep monthly and annual Stripe prices under the same stable internal products. Avoid lifetime deals until content and support economics are known.

## Decisions required before Stripe setup

Saksham should approve these business values before real prices are created:

- Monthly and annual price for one bank.
- Monthly and annual price for all access.
- Whether tutors use the same plan initially or launch later as a separate product.
- Trial policy. Recommendation: no card-based free trial at first; use public samples.
- Refund window and support address.
- Number of public sample questions per bank. Recommendation: 3–5 representative questions, with no downloadable bulk export.

---

### Task 1: Encode the access policy independently of Stripe

**Objective:** Create one tested server-side policy that answers whether a user may access a bank, answer, export, or asset.

**Files:**
- Create: `src/lib/access.ts`
- Create: `src/lib/access.test.ts`
- Modify: `src/lib/banks.ts`

**Steps:**

1. Write failing tests covering anonymous previews, no-entitlement users, bank-specific access, `bundle_all`, expired/revoked access, answer access, and PDF access.
2. Add an explicit per-bank preview-question allowlist rather than relying on array position.
3. Implement `hasBankAccess`, `canViewQuestionAsset`, `canViewAnswer`, and `canExportPdf` as pure functions.
4. Run `npm test -- src/lib/access.test.ts`; expected: all access-policy tests pass.
5. Commit: `Add centralized bank access policy`.

**Acceptance:** No route or component needs to invent its own entitlement rules.

---

### Task 2: Add trusted Supabase server infrastructure

**Objective:** Allow server-only code to read entitlements and sign private Storage objects without exposing the secret key.

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/supabase/admin.test.ts`
- Modify: `.env.example`
- Modify: `docs/launch-setup.md`

**Steps:**

1. Add a failing test that rejects missing or browser-exposed server credentials.
2. Create a `server-only` Supabase admin client using `SUPABASE_SECRET_KEY`; never use a `NEXT_PUBLIC_*` variable.
3. Add only the variable name to `.env.example`.
4. Configure the real value in Vercel Production/Preview and ignored `.env.local`; never print or commit it.
5. Verify the client can read bucket metadata and entitlement rows from a server context.
6. Commit: `Add server-only Supabase admin client`.

**Acceptance:** The secret cannot enter client bundles, logs, Git history, chat, or test snapshots.

---

### Task 3: Map every question asset to private Storage

**Objective:** Replace assumptions about public GitHub URLs with deterministic Supabase object paths.

**Files:**
- Create: `src/lib/assets.ts`
- Create: `src/lib/assets.test.ts`
- Modify: `src/lib/questions.ts`
- Modify: `scripts/upload-question-assets.mjs`

**Steps:**

1. Write failing tests for question, answer, and official mark-scheme object paths across IB SL, IB HL, and IGCSE.
2. Implement deterministic path mapping matching the already-uploaded `ib-sl/`, `ib-hl/`, and `igcse/` objects.
3. Add an inventory verifier that compares JSON references against bucket objects and reports missing/extra objects without exposing credentials.
4. Run the verifier and require exactly 9,853 matched objects and zero missing referenced assets.
5. Commit: `Map question assets to private storage`.

**Acceptance:** The application can locate every paid asset without constructing a GitHub Pages URL.

---

### Task 4: Build entitlement-aware signed asset delivery

**Objective:** Serve private images only after applying the centralized access policy.

**Files:**
- Create: `src/app/api/assets/sign/route.ts`
- Create: `src/app/api/assets/sign/route.test.ts`
- Create: `src/lib/entitlements.ts`
- Create: `src/lib/entitlements.test.ts`
- Modify: `src/components/QuestionExplorer.tsx`
- Modify: `src/lib/pdf-export.ts`

**Steps:**

1. Write failing route tests for invalid paths, unknown question IDs, cross-bank access, expired entitlements, anonymous preview assets, answer denial, batch limits, and successful signing.
2. Read the authenticated user through the existing Supabase SSR client.
3. Load only active/trialing non-expired entitlements.
4. Validate requested object paths against normalized question metadata; never sign arbitrary caller-provided paths.
5. Issue short-lived signed URLs, initially 10 minutes, in bounded batches.
6. Update question images, answers, and PDF generation to request authorized signed URLs.
7. Keep public sample behavior explicit and deny bulk anonymous signing.
8. Commit: `Serve bank assets through authorized signed URLs`.

**Acceptance:** Network inspection of a paid page contains no `github.io` asset URLs and an unauthorized user cannot obtain a paid signed URL.

---

### Task 5: Gate answers, selection, and PDF export in the UI and server flow

**Objective:** Make access restrictions understandable without turning discovery pages into dead login walls.

**Files:**
- Modify: `src/app/banks/[slug]/page.tsx`
- Modify: `src/components/QuestionExplorer.tsx`
- Modify: `src/components/QuestionExplorer.test.tsx`
- Modify: `src/app/globals.css`

**Steps:**

1. Add failing tests for preview questions, locked questions, locked answers, locked exports, sign-in CTA, and purchase CTA.
2. Pass a server-derived access state into `QuestionExplorer`; never trust a client entitlement flag.
3. Preserve filters and public discovery while replacing inaccessible results with a clear locked state.
4. Allow selected-question PDF export only when every selected item is authorized.
5. Verify desktop and mobile behavior for all three banks.
6. Commit: `Gate premium question bank features`.

**Acceptance:** Users understand what is available, but client-side state cannot unlock paid content.

---

### Task 6: Extend the billing schema for Stripe synchronization

**Objective:** Store Stripe subscription state and webhook idempotency safely.

**Files:**
- Create: `supabase/migrations/20260825xxxxxx_stripe_billing_state.sql`
- Modify: `docs/launch-setup.md`

**Steps:**

1. Add `stripe_subscriptions` with user/customer/subscription/product/price/status/period fields and unique constraints.
2. Add `stripe_events` keyed by Stripe event ID for idempotent processing.
3. Add indexes for customer, subscription, and active status lookups.
4. Enable RLS. Users may read their own billing summary but may not write billing or entitlement rows.
5. Revoke direct browser execution on any security-definer billing functions.
6. Apply to Supabase and run read-only schema/policy verification.
7. Commit: `Add Stripe billing synchronization schema`.

**Acceptance:** Replaying the same webhook cannot duplicate grants or corrupt access.

---

### Task 7: Create Stripe products and prices

**Objective:** Configure real Stripe catalog objects only after pricing is approved.

**External state:** Saksham’s Stripe account.

**Steps:**

1. Confirm Stripe account business identity, payout details, statement descriptor, support email, tax settings, and customer-facing branding.
2. Create products matching `bank_igcse`, `bank_ib_hl`, `bank_ib_sl`, and `bundle_all`.
3. Create approved monthly/annual prices and record IDs only in Vercel environment variables or trusted server configuration.
4. Enable Stripe Customer Portal for payment-method updates and cancellation; disable unsupported plan changes initially.
5. Create separate test-mode and live-mode values.
6. Read back every product/price/portal setting before proceeding.

**Acceptance:** Internal product IDs remain stable even if Stripe prices are replaced later.

---

### Task 8: Implement Checkout and Customer Portal

**Objective:** Let authenticated users purchase a plan and manage billing safely.

**Files:**
- Add dependency: `stripe`
- Create: `src/lib/stripe/server.ts`
- Create: `src/lib/stripe/catalog.ts`
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/portal/route.ts`
- Create tests beside each module/route
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/account/page.tsx`

**Steps:**

1. Write failing tests for unauthenticated requests, unknown price keys, open redirects, duplicate customer creation, checkout metadata, and portal ownership.
2. Accept a server allowlisted plan key, never an arbitrary Stripe price ID from the browser.
3. Create/reuse one Stripe customer per Supabase user.
4. Create subscription Checkout Sessions with Supabase user ID and internal product ID in trusted metadata.
5. Use fixed same-origin success/cancel URLs.
6. Add Customer Portal access to `/account`.
7. Keep live-mode Checkout disabled behind `BILLING_ENABLED=false` until lifecycle QA passes.
8. Commit: `Add Stripe checkout and billing portal`.

**Acceptance:** Users cannot purchase a mismatched price, open an external redirect, or manage another customer.

---

### Task 9: Implement signed, idempotent Stripe webhooks

**Objective:** Make verified Stripe events the sole automatic writer of paid entitlements.

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/api/stripe/webhook/route.test.ts`
- Create: `src/lib/stripe/sync-subscription.ts`
- Create: `src/lib/stripe/sync-subscription.test.ts`

**Steps:**

1. Write failing tests for bad signatures, unknown products, duplicate event IDs, out-of-order events, active/trialing subscriptions, cancellations, failed payment states, and expiration.
2. Verify the raw request body with `STRIPE_WEBHOOK_SECRET` before parsing.
3. Process only allowlisted event types.
4. Upsert subscription state and entitlement state transactionally/idempotently.
5. Derive entitlement expiry from Stripe’s current period; do not trust browser claims or Checkout redirects.
6. Return success for already-processed events.
7. Register test and production webhook endpoints and read them back.
8. Commit: `Synchronize Stripe subscriptions to entitlements`.

**Acceptance:** Checkout success alone grants nothing; only a verified webhook grants or removes access.

---

### Task 10: Harden authentication and abuse controls

**Objective:** Prevent public magic-link abuse before promotion.

**Files:**
- Modify: `src/app/auth/actions.ts`
- Modify: `src/components/MagicLinkForm.tsx`
- Add focused tests
- Potentially create a rate-limit migration/module depending on chosen provider

**Steps:**

1. Add generic non-enumerating responses.
2. Add per-IP and per-email rate limits backed by a production-appropriate shared store, not process memory.
3. Add bot protection if traffic warrants it; prefer a low-friction challenge that does not damage sign-up conversion.
4. Verify repeated requests are throttled and ordinary sign-in still works.
5. Commit: `Harden passwordless sign-in against abuse`.

**Acceptance:** A bot cannot use PastPaperPrep as a mass email sender.

---

### Task 11: Test the full billing and access lifecycle in Stripe test mode

**Objective:** Prove behavior beyond the happy path before enabling live payments.

**Scenarios:**

1. New account → purchase one bank → access only that bank.
2. All-access purchase → access all banks.
3. Duplicate webhook replay → no duplicate entitlements.
4. Payment failure → access follows the approved grace policy.
5. Cancellation at period end → access remains until expiry, then closes.
6. Immediate refund/revocation behavior matches the refund policy.
7. Portal payment-method update and cancellation work.
8. Signed URLs expire and cannot be reused indefinitely.
9. Unauthorized answer/PDF/API requests are denied.
10. Public previews remain crawlable and usable.

Run after each implementation batch:

- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm audit`
- Independent security/code review

**Acceptance:** Every scenario has captured evidence from Stripe, Supabase, HTTP responses, and the browser.

---

### Task 12: Cut over and retire the three legacy public sites

**Objective:** Remove alternate public access only after PastPaperPrep no longer depends on it.

**Steps:**

1. Verify production HTML/network traffic for all three banks has zero `saksham106.github.io` or `swati1977.github.io` paid asset references.
2. Verify private signed delivery for anonymous previews, one-bank users, all-access users, answers, and PDFs.
3. Disable GitHub Pages on the three source repositories.
4. Make the repositories private if they are not already private.
5. Keep repository history for provenance; do not delete it impulsively.
6. Verify old Pages URLs return unavailable/404 and PastPaperPrep still works.
7. Update `docs/launch-setup.md` with the final architecture.

**Acceptance:** PastPaperPrep is the only functional public product surface, and old direct image/page URLs no longer provide the full corpus.

---

### Task 13: Live-launch gate

**Objective:** Enable real billing only after all technical and operational controls are ready.

**Checklist:**

- Prices and refund policy approved.
- Support inbox monitored.
- Stripe live-mode identity/payouts/tax settings complete.
- Production webhook verified.
- Entitlement lifecycle tested.
- Private asset cutover complete.
- Legacy sites unavailable.
- Magic-link rate limiting active.
- Terms, Privacy, and Refund pages match actual behavior.
- Monitoring/alerts cover webhook failures and elevated 5xx rates.
- Database and Storage backup/recovery procedure documented.
- Independent final security review passed.

Then set `BILLING_ENABLED=true`, perform one real low-value purchase using Saksham’s own account, verify the complete database and access readback, refund it if appropriate, and only then announce the product.

---

## Files likely to change

- `src/app/banks/[slug]/page.tsx`
- `src/app/pricing/page.tsx`
- `src/app/account/page.tsx`
- `src/app/auth/actions.ts`
- `src/components/QuestionExplorer.tsx`
- `src/components/MagicLinkForm.tsx`
- `src/lib/questions.ts`
- `src/lib/pdf-export.ts`
- `src/lib/access.ts`
- `src/lib/assets.ts`
- `src/lib/entitlements.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/stripe/*`
- `src/app/api/assets/sign/route.ts`
- `src/app/api/stripe/*`
- `supabase/migrations/*`
- `.env.example`
- `docs/launch-setup.md`

## Main risks and tradeoffs

- **Public GitHub Pages during beta:** Fine temporarily, but paid exclusivity is impossible until they are retired.
- **Signed URL leakage:** Short expiry reduces damage but does not prevent screenshots or a paying user sharing a currently valid URL. The goal is practical access control, not impossible DRM.
- **SEO versus paywall:** Keep metadata/topic discovery and selected samples public; gate the bulk corpus and answers.
- **Stripe state drift:** Webhook verification, idempotency, and reconciliation are mandatory. Never grant access from the success page alone.
- **Large client payload:** IGCSE currently ships a large question dataset. After launch security, move filtering/pagination server-side or load metadata in chunks for performance.
- **Teacher plans:** Useful later, but adding seats, classrooms, and sharing now would delay revenue. Launch individual access first unless a tutor buyer is already committed.

## Definition of done

PastPaperPrep is commercially ready when a new customer can sign in, pay, receive only the purchased access, use private question/answer/PDF assets, manage or cancel billing, lose access correctly at expiry, and cannot bypass payment through the old three public sites.