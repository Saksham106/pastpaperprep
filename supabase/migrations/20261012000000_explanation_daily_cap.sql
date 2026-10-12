-- Worked explanations do not spend the download allowance, but each member may open at most
-- 200 paid explanations per day. Far above real study use; it stops scripted bulk copying.
begin;

alter table public.download_usage_daily
  add column if not exists explanation_count integer not null default 0
  check (explanation_count between 0 and 200);

create or replace function public.consume_explanation_allowance(p_count integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows integer := 0;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return false;
  end if;

  if p_count < 1 or p_count > 20 then
    return false;
  end if;

  if exists (
    select 1
    from public.download_allowance_exemptions
    where user_id = v_user_id
      and unlimited_downloads
      and (expires_at is null or expires_at > now())
  ) then
    return true;
  end if;

  insert into public.download_usage_daily (user_id, usage_date, explanation_count, updated_at)
  values (v_user_id, current_date, p_count, now())
  on conflict (user_id, usage_date) do update
  set explanation_count = download_usage_daily.explanation_count + excluded.explanation_count,
      updated_at = now()
  where download_usage_daily.explanation_count + excluded.explanation_count <= 200;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

alter function public.consume_explanation_allowance(integer) owner to postgres;
revoke all on function public.consume_explanation_allowance(integer) from public, anon, service_role;
grant execute on function public.consume_explanation_allowance(integer) to authenticated;

commit;
