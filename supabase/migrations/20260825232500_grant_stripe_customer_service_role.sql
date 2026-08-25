-- Stripe customer IDs are server-managed infrastructure.
-- Browser roles must never read or mutate this mapping directly.
revoke all on table public.stripe_customers from anon, authenticated;
revoke all on table public.stripe_customers from service_role;
grant select, insert, update on table public.stripe_customers to service_role;
