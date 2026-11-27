-- "Your access ends soon" reminders: one row per (subscription, scheduled end), so each paid
-- period gets at most one email however often the daily job runs or retries.
-- A claim is taken before sending; a stale claim (the send timed out) may be retried once.
-- Service role only. Rows go with the account (on delete cascade).
begin;

create table if not exists public.subscription_end_reminders (
  subscription_id text not null check (subscription_id ~ '^sub_[A-Za-z0-9]{8,64}$'),
  ends_at timestamptz not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  attempts smallint not null default 1 check (attempts between 1 and 2),
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (subscription_id, ends_at)
);

create index if not exists subscription_end_reminders_user_idx on public.subscription_end_reminders (user_id);

alter table public.subscription_end_reminders enable row level security;
revoke all on table public.subscription_end_reminders from public, anon, authenticated, service_role;
-- The dry run reports who was already reminded; every write goes through the functions below.
grant select on table public.subscription_end_reminders to service_role;

-- True when this caller now owns the send: a new claim, or a claim left over by a send that
-- timed out at least 30 minutes ago (once). False when already sent, failed or claimed.
create or replace function public.claim_subscription_end_reminder(p_subscription_id text, p_ends_at timestamptz, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if p_subscription_id is null or p_subscription_id !~ '^sub_[A-Za-z0-9]{8,64}$' or p_ends_at is null or p_user_id is null then
    raise exception 'invalid reminder claim' using errcode = '22023';
  end if;

  insert into public.subscription_end_reminders (subscription_id, ends_at, user_id)
  values (p_subscription_id, p_ends_at, p_user_id)
  on conflict (subscription_id, ends_at) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 1 then
    return true;
  end if;

  update public.subscription_end_reminders
  set attempts = attempts + 1, claimed_at = now()
  where subscription_id = p_subscription_id
    and ends_at = p_ends_at
    and user_id = p_user_id
    and status = 'claimed'
    and attempts < 2
    and claimed_at < now() - interval '30 minutes';
  get diagnostics v_claimed = row_count;
  return v_claimed = 1;
end;
$$;

-- Records the outcome of a claimed send. Only a row still 'claimed' changes.
create or replace function public.finish_subscription_end_reminder(p_subscription_id text, p_ends_at timestamptz, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_status is null or p_status not in ('sent', 'failed') then
    raise exception 'invalid reminder status' using errcode = '22023';
  end if;
  update public.subscription_end_reminders
  set status = p_status, finished_at = now()
  where subscription_id = p_subscription_id and ends_at = p_ends_at and status = 'claimed';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

alter function public.claim_subscription_end_reminder(text, timestamptz, uuid) owner to postgres;
alter function public.finish_subscription_end_reminder(text, timestamptz, text) owner to postgres;
revoke all on function public.claim_subscription_end_reminder(text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.finish_subscription_end_reminder(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_subscription_end_reminder(text, timestamptz, uuid) to service_role;
grant execute on function public.finish_subscription_end_reminder(text, timestamptz, text) to service_role;

notify pgrst, 'reload schema';
commit;
