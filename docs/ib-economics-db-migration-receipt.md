# IB Economics billing allowlist migration receipt

- Scope: `public` database only; IB Economics billing allowlist.
- Project ref: `wrigscheuwsooyvayclz` (PastPaperPrep production main).
- Verification receipt recorded: `2026-09-11T19:40:03Z`; the SQL Editor apply completed before this receipt.
- Migration file: `supabase/migrations/20260911020000_ib_economics_billing_allowlist.sql`
- Migration SHA-256: `90a828f9af42378ead01640d252b2ed7f3a7edbe1ea4cf8a65599f013ee0acf5`
- SQL Editor model matched the local file byte-for-byte before Run: 2,707 bytes.
- SQL execution receipt: `Success. No rows returned`.

## Scope controls

- `20260911010000_add_ib_economics_candidate.sql` was not run.
- No `db push` was run.
- The migration contains no product insert/update, Stripe price ID, or product-active flag mutation.
- No deployment flag was enabled. Asset upload remains pending.

## Readback

The target migration was absent before execution. After the transaction succeeded, the exact migration was recorded in `supabase_migrations.schema_migrations` with:

- version: `20260911020000`
- name: `ib_economics_billing_allowlist`
- statements: 1
- rollback: NULL
- stored statement SHA-256: `90a828f9af42378ead01640d252b2ed7f3a7edbe1ea4cf8a65599f013ee0acf5`

`public.is_valid_custom_bank_ids(text[])` read back as owner `postgres`, non-security-definer, immutable, `search_path=""`, with all 14 slugs present. Existing 12 slugs were retained; the two additions are `ib-economics-hl` and `ib-economics-sl`.

All four reviewed check constraints were present and validated:

- `public.saved_questions.saved_questions_bank`: existing 12 plus both Economics slugs.
- `public.attempts.attempts_bank`: existing 12 plus both Economics slugs.
- `public.entitlements.entitlements_custom_bank_shape`: validated and references `is_valid_custom_bank_ids`.
- `public.stripe_subscriptions.stripe_subscriptions_custom_shape`: validated and references `is_valid_custom_bank_ids`.

## Preservation receipts

Product and catalog rows were compared using count plus canonical SHA-256 before/after:

| Relation | Before | After | Result |
|---|---:|---:|---|
| `public.products` | 20 / `c4b0483e99db64f80fea3a220d7c5364653716624165a52bc6a86819faf66289` | identical | unchanged |
| `public.stripe_price_catalog` | 42 / `dfe4da2e964c96c906e4c0401df56fa3edb56f01ea0079889d34db33bf950b33` | identical | unchanged |

RLS, ACL, policy, and table-grant readbacks matched before/after for `products`, `stripe_price_catalog`, `saved_questions`, `attempts`, `entitlements`, and `stripe_subscriptions`. RLS remained enabled, force-RLS remained false, and no grant/policy drift was observed.

## Local verification

- Candidate file matched the Git index and passed `src/lib/ib-economics-billing-migration.test.ts` (3/3 tests).
- The reviewed candidate was checked to exclude the 01:00 migration, product inserts, price IDs, and `active = false`.
