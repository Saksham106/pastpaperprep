-- Register the Economics product family and bank identifiers without activating checkout.
-- This migration is local release preparation only; do not apply it until the
-- external asset, rights, product, price, and storage gates have passed.
begin;

alter table public.products drop constraint if exists products_known_id;
alter table public.products add constraint products_known_id check (id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bank_ib_economics_hl', 'bank_ib_economics_sl',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics',
  'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom'
));

alter table public.saved_questions drop constraint if exists saved_questions_bank;
alter table public.saved_questions add constraint saved_questions_bank check (bank_slug in (
  'igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl',
  'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl',
  'ib-biology-hl', 'ib-biology-sl', 'ib-economics-hl', 'ib-economics-sl'
));

alter table public.attempts drop constraint if exists attempts_bank;
alter table public.attempts add constraint attempts_bank check (bank_slug in (
  'igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl',
  'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl',
  'ib-biology-hl', 'ib-biology-sl', 'ib-economics-hl', 'ib-economics-sl'
));

insert into public.products (id, name, active) values
  ('bank_ib_economics_hl', 'IB Economics HL', false),
  ('bank_ib_economics_sl', 'IB Economics SL', false),
  ('bundle_ib_economics', 'IB Economics pair', false)
on conflict (id) do update set name = excluded.name;

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_product;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_product check (product_id in (
  'bank_igcse', 'bank_igcse_additional', 'bank_ib_hl', 'bank_ib_sl', 'bank_ib_ai_hl', 'bank_ib_ai_sl',
  'bank_ib_chemistry_hl', 'bank_ib_chemistry_sl', 'bank_ib_physics_hl', 'bank_ib_physics_sl',
  'bank_ib_biology_hl', 'bank_ib_biology_sl', 'bank_ib_economics_hl', 'bank_ib_economics_sl',
  'bundle_igcse', 'bundle_ib_aa', 'bundle_ib_ai', 'bundle_ib_chemistry', 'bundle_ib_physics',
  'bundle_ib_biology', 'bundle_ib_economics', 'bundle_all', 'bundle_custom'
));

notify pgrst, 'reload schema';
commit;
