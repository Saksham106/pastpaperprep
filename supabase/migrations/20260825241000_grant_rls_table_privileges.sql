begin;

-- RLS policies filter rows, but PostgreSQL table privileges are still required
-- before those policies can be evaluated by the API roles.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.entitlements from anon, authenticated;
revoke all on table public.saved_questions from anon, authenticated;
revoke all on table public.attempts from anon, authenticated;

-- Public catalog data is intentionally readable without an account. The
-- existing RLS policy still limits this to active products.
grant select on table public.products to anon, authenticated;

-- Authenticated users remain row-scoped by the existing owner policies.
grant select, update on table public.profiles to authenticated;
grant select on table public.entitlements to authenticated;
grant select, insert, delete on table public.saved_questions to authenticated;
grant select, insert, update, delete on table public.attempts to authenticated;

-- Stripe mappings and subscription synchronization remain server-only.
revoke all on table public.stripe_customers from anon, authenticated, service_role;
revoke all on table public.stripe_subscriptions from anon, authenticated, service_role;
revoke all on table public.stripe_webhook_events from anon, authenticated, service_role;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
