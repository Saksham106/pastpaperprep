-- Add IB Mathematics AI SL and AI HL banks.

begin;

alter table products drop constraint if exists products_known_id;
alter table products add constraint products_known_id
  check (id in (
    'bank_igcse',
    'bank_igcse_additional',
    'bank_ib_hl',
    'bank_ib_sl',
    'bank_ib_ai_hl',
    'bank_ib_ai_sl',
    'bundle_igcse',
    'bundle_ib_aa',
    'bundle_ib_ai',
    'bundle_all'
  ));

alter table saved_questions drop constraint if exists saved_questions_bank;
alter table saved_questions add constraint saved_questions_bank
  check (bank_slug in ('igcse', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl'));

alter table attempts drop constraint if exists attempts_bank;
alter table attempts add constraint attempts_bank
  check (bank_slug in ('igcse', 'ib-hl', 'ib-sl', 'ib-ai-hl', 'ib-ai-sl'));

insert into products (id, name, active) values
  ('bank_ib_ai_hl', 'IB Mathematics AI HL', true),
  ('bank_ib_ai_sl', 'IB Mathematics AI SL', true)
on conflict (id) do nothing;

commit;
