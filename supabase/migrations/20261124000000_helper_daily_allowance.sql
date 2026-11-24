-- AI study helper: one row per user per (UTC) day counting helper messages.
-- The route passes the caller's limit (free or paid). Calling the RPC directly
-- can only spend the caller's own allowance faster, never raise it.
begin;

create table if not exists public.helper_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  message_count integer not null default 0 check (message_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.helper_usage_daily enable row level security;
revoke all on table public.helper_usage_daily from public, anon, authenticated;

-- Returns the messages left today after this one, or -1 when the limit is reached (nothing is spent then).
create or replace function public.consume_helper_allowance(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return -1;
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    return -1;
  end if;

  -- ON CONFLICT locks the user's row for today, so concurrent messages cannot overspend.
  insert into public.helper_usage_daily (user_id, usage_date, message_count, updated_at)
  values (v_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
  set message_count = helper_usage_daily.message_count + 1,
      updated_at = now()
  where helper_usage_daily.message_count + 1 <= p_limit
  returning message_count into v_count;

  if v_count is null then
    return -1;
  end if;
  return greatest(p_limit - v_count, 0);
end;
$$;

alter function public.consume_helper_allowance(integer) owner to postgres;
revoke all on function public.consume_helper_allowance(integer) from public, anon, service_role;
grant execute on function public.consume_helper_allowance(integer) to authenticated;

-- Gives back one message when the AI call failed before any answer reached the student.
-- Service role only: a student must not be able to refund themselves.
create or replace function public.release_helper_allowance(p_user_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.helper_usage_daily
  set message_count = greatest(message_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id and usage_date = current_date;
$$;

alter function public.release_helper_allowance(uuid) owner to postgres;
revoke all on function public.release_helper_allowance(uuid) from public, anon, authenticated;
grant execute on function public.release_helper_allowance(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
