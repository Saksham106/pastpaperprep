-- AI study helper allowance, version 2 (20261124000000 is already applied, so this is a forward change).
-- 1. consume returns the day it charged, and refunds name that day, so a refund after UTC midnight
--    never restores a use on the new day.
-- 2. A runtime kill switch and a site-wide daily message cap (a spend cap), changed with SQL, no deploy.
begin;

create table if not exists public.helper_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  global_daily_limit integer not null default 1000 check (global_daily_limit >= 0),
  updated_at timestamptz not null default now()
);
insert into public.helper_settings (id) values (true) on conflict (id) do nothing;
alter table public.helper_settings enable row level security;
revoke all on table public.helper_settings from public, anon, authenticated;

create table if not exists public.helper_global_daily (
  usage_date date primary key,
  message_count integer not null default 0 check (message_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.helper_global_daily enable row level security;
revoke all on table public.helper_global_daily from public, anon, authenticated;

-- {"status": "ok", "remaining": n, "usage_date": "YYYY-MM-DD"} | {"status": "limit"} | {"status": "busy"} | {"status": "disabled"}
-- Nothing is spent unless the status is "ok".
create or replace function public.consume_helper_allowance_v2(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_enabled boolean;
  v_global_limit integer;
  v_global integer;
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return jsonb_build_object('status', 'limit');
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    return jsonb_build_object('status', 'limit');
  end if;

  select enabled, global_daily_limit into v_enabled, v_global_limit from public.helper_settings where id;
  if not coalesce(v_enabled, false) then
    return jsonb_build_object('status', 'disabled');
  end if;

  -- Per-user first: a student at their own limit never touches the shared count.
  insert into public.helper_usage_daily (user_id, usage_date, message_count, updated_at)
  values (v_user_id, v_today, 1, now())
  on conflict (user_id, usage_date) do update
  set message_count = helper_usage_daily.message_count + 1,
      updated_at = now()
  where helper_usage_daily.message_count + 1 <= p_limit
  returning message_count into v_count;
  if v_count is null then
    return jsonb_build_object('status', 'limit');
  end if;

  insert into public.helper_global_daily (usage_date, message_count, updated_at)
  values (v_today, 1, now())
  on conflict (usage_date) do update
  set message_count = helper_global_daily.message_count + 1,
      updated_at = now()
  where helper_global_daily.message_count + 1 <= v_global_limit
  returning message_count into v_global;
  if v_global is null or v_global > v_global_limit then
    -- Site-wide cap reached: undo this student's charge so nothing is spent.
    update public.helper_usage_daily
    set message_count = greatest(message_count - 1, 0), updated_at = now()
    where user_id = v_user_id and usage_date = v_today;
    return jsonb_build_object('status', 'busy');
  end if;

  return jsonb_build_object('status', 'ok', 'remaining', greatest(p_limit - v_count, 0), 'usage_date', v_today);
end;
$$;

alter function public.consume_helper_allowance_v2(integer) owner to postgres;
revoke all on function public.consume_helper_allowance_v2(integer) from public, anon, service_role;
grant execute on function public.consume_helper_allowance_v2(integer) to authenticated;

-- Gives back one message on the day it was charged. Service role only: a student must not refund themselves.
create or replace function public.release_helper_allowance_v2(p_user_id uuid, p_usage_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  if p_user_id is null or p_usage_date is null then
    return;
  end if;
  update public.helper_usage_daily
  set message_count = message_count - 1, updated_at = now()
  where user_id = p_user_id and usage_date = p_usage_date and message_count > 0;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    update public.helper_global_daily
    set message_count = message_count - 1, updated_at = now()
    where usage_date = p_usage_date and message_count > 0;
  end if;
end;
$$;

alter function public.release_helper_allowance_v2(uuid, date) owner to postgres;
revoke all on function public.release_helper_allowance_v2(uuid, date) from public, anon, authenticated;
grant execute on function public.release_helper_allowance_v2(uuid, date) to service_role;

-- The v1 refund could restore a use on the wrong day; nothing may call it any more.
revoke all on function public.release_helper_allowance(uuid) from service_role;

notify pgrst, 'reload schema';
commit;
