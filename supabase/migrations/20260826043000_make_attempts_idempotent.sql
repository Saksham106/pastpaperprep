begin;

-- A lightweight attempt is a question-level state, not an event stream. Keep the
-- newest existing row before enforcing idempotent writes from answer reveals.
delete from public.attempts
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, bank_slug, question_id
        order by updated_at desc, created_at desc, id desc
      ) as duplicate_number
    from public.attempts
  ) ranked
  where duplicate_number > 1
);

create unique index if not exists attempts_user_bank_question_unique_idx
  on public.attempts(user_id, bank_slug, question_id);

commit;
