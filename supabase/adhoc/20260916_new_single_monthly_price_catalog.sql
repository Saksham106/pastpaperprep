-- Add the new $6/month fixed single-bank price (2026-09 v1) to the Stripe price
-- catalog for every single-bank product. Idempotent. Apply in Supabase Dashboard
-- SQL Editor. Readback query is at the bottom.
begin;

insert into public.stripe_price_catalog (price_id, product_id, billing_interval, grandfathered, active)
values
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse_additional', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_hl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_sl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_ai_hl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_ai_sl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_chemistry_hl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_chemistry_sl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_physics_hl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_physics_sl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_biology_hl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_ib_biology_sl', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse_biology_0610', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse_economics_0455', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse_chemistry_0620', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse_physics_0625', 'monthly', false, true),
  ('price_1UGI5xCrKkuSqWuMtyA0L1hV', 'bank_igcse_coordinated_sciences_0654', 'monthly', false, true)
on conflict (price_id, product_id, billing_interval) do update
set grandfathered = excluded.grandfathered, active = excluded.active, updated_at = now();

commit;

-- Readback: expect 17 rows, all active.
select product_id, active from public.stripe_price_catalog
where price_id = 'price_1UGI5xCrKkuSqWuMtyA0L1hV'
order by product_id;
