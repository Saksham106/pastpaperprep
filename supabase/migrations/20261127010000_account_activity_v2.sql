-- Account activity v2 (review fixes on top of 20261127000000):
-- * the day is explicitly UTC, not the session's time zone;
-- * rows are kept for 13 months: each write also deletes a small batch of expired rows;
-- * accounts that object are listed in account_activity_opt_outs and never recorded;
-- * reads are granted explicitly to service_role only.
begin;

create table if not exists public.account_activity_opt_outs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.account_activity_opt_outs enable row level security;
revoke all on table public.account_activity_opt_outs from public, anon, authenticated;
grant select, insert, delete on table public.account_activity_opt_outs to service_role;

revoke all on table public.account_activity_daily from public, anon, authenticated, service_role;
grant select, delete on table public.account_activity_daily to service_role;

create or replace function public.record_account_activity(p_area text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_area text := case
    when p_area in ('home', 'bank', 'past_papers', 'notes', 'helper', 'worksheets', 'dashboard', 'pricing', 'account', 'articles', 'other')
      then p_area
    else 'other'
  end;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return;
  end if;
  if exists (select 1 from public.account_activity_opt_outs where user_id = v_user_id) then
    return;
  end if;

  insert into public.account_activity_daily (user_id, activity_date, first_seen_at, last_seen_at, page_views, areas)
  values (v_user_id, v_today, now(), now(), 1, array[v_area])
  on conflict (user_id, activity_date) do update
  set last_seen_at = now(),
      page_views = least(account_activity_daily.page_views + 1, 2000),
      areas = case
        when v_area = any (account_activity_daily.areas) then account_activity_daily.areas
        else array_append(account_activity_daily.areas, v_area)
      end;

  -- 13-month retention, a bounded batch per write (uses account_activity_daily_date_idx).
  delete from public.account_activity_daily
  where ctid in (
    select ctid from public.account_activity_daily
    where activity_date < v_today - interval '13 months'
    limit 100
  );
end;
$$;

alter function public.record_account_activity(text) owner to postgres;
revoke all on function public.record_account_activity(text) from public, anon, service_role;
grant execute on function public.record_account_activity(text) to authenticated;

notify pgrst, 'reload schema';
commit;
