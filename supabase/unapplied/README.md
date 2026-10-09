# Unapplied migrations

SQL kept for reference that must **not** run against production. The Supabase CLI only reads
`supabase/migrations/`, so files here are never picked up by `supabase db push`.

- `20260911010000_add_ib_economics_candidate.sql` — IB Economics product rows. Never applied;
  Economics shipped through `20260911020000_ib_economics_billing_allowlist.sql` instead
  (see `docs/ib-economics-db-migration-receipt.md`).

Production migration history was reconciled on 2026-10-09: every file in `supabase/migrations/`
is recorded as applied, including the earlier ones that were run by hand in the SQL editor.
