begin;

-- Economics is sold through the existing graduated custom bundle and All Access
-- prices. This migration changes no products, prices, or active flags. It only
-- permits the two exact Economics bank slugs in persisted custom selections.
create or replace function public.is_valid_custom_bank_ids(p_selected_bank_ids text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_selected_bank_ids is not null
    and cardinality(p_selected_bank_ids) between 1 and 5
    and not exists (
      select 1 from unnest(p_selected_bank_ids) as selected(bank_id)
      where selected.bank_id is null
         or selected.bank_id not in (
        'igcse', 'igcse-additional', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl',
        'ib-chemistry-hl', 'ib-chemistry-sl', 'ib-physics-hl', 'ib-physics-sl',
        'ib-biology-hl', 'ib-biology-sl', 'ib-economics-hl', 'ib-economics-sl'
      )
    )
    and cardinality(p_selected_bank_ids) = cardinality(
      array(select distinct selected.bank_id from unnest(p_selected_bank_ids) as selected(bank_id))
    );
$$;

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

alter table public.entitlements drop constraint if exists entitlements_custom_bank_shape;
alter table public.entitlements add constraint entitlements_custom_bank_shape check (
  (product_id = 'bundle_custom' and public.is_valid_custom_bank_ids(selected_bank_ids))
  or (product_id <> 'bundle_custom' and selected_bank_ids is null)
);

alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_custom_shape;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_custom_shape check (
  (product_id = 'bundle_custom'
    and public.is_valid_custom_bank_ids(selected_bank_ids)
    and quantity = cardinality(selected_bank_ids)
    and nullif(btrim(price_id), '') is not null)
  or (product_id <> 'bundle_custom' and selected_bank_ids is null and quantity = 1)
);

notify pgrst, 'reload schema';
commit;
