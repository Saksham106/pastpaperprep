-- First-party account activity: one row per signed-in account per (UTC) day.
-- Records that the account used the site that day, how many pages it opened and which
-- areas it used. Kept in our own database (never sent to analytics providers), so it covers
-- every account whatever its analytics-cookie choice; disclosed on /privacy.
-- Rows go with the account (on delete cascade). Reads are service role only.
begin;

create table if not exists public.account_activity_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  page_views integer not null default 0 check (page_views >= 0 and page_views <= 2000),
  areas text[] not null default '{}' check (cardinality(areas) <= 12),
  primary key (user_id, activity_date)
);

create index if not exists account_activity_daily_date_idx on public.account_activity_daily (activity_date);

alter table public.account_activity_daily enable row level security;
revoke all on table public.account_activity_daily from public, anon, authenticated;

-- Called from the browser on each page a signed-in student opens. The account always comes from
-- the session (auth.uid()); the only input is a fixed area name, and anything else counts as
-- 'other'. A caller can only add page views to its own row, capped per day.
create or replace function public.record_account_activity(p_area text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_area text := case
    when p_area in ('home', 'bank', 'past_papers', 'notes', 'helper', 'worksheets', 'dashboard', 'pricing', 'account', 'articles', 'other')
      then p_area
    else 'other'
  end;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return;
  end if;

  insert into public.account_activity_daily (user_id, activity_date, first_seen_at, last_seen_at, page_views, areas)
  values (v_user_id, current_date, now(), now(), 1, array[v_area])
  on conflict (user_id, activity_date) do update
  set last_seen_at = now(),
      page_views = least(account_activity_daily.page_views + 1, 2000),
      areas = case
        when v_area = any (account_activity_daily.areas) then account_activity_daily.areas
        else array_append(account_activity_daily.areas, v_area)
      end;
end;
$$;

alter function public.record_account_activity(text) owner to postgres;
revoke all on function public.record_account_activity(text) from public, anon, service_role;
grant execute on function public.record_account_activity(text) to authenticated;

notify pgrst, 'reload schema';
commit;
