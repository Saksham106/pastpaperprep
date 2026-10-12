-- Forward correction: the original explanation migration is already applied.
-- A mixed signing response must charge both quotas or neither, never spend an
-- explanation when the image quota denies the complete response.
begin;

create or replace function public.consume_explanation_and_download_allowance(
  p_count integer,
  p_asset_count integer
)
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

  if p_count is null or p_count < 1 or p_count > 20
     or p_asset_count is null or p_asset_count < 0 or p_asset_count > 1000 then
    return false;
  end if;

  if exists (
    select 1 from public.download_allowance_exemptions
    where user_id = v_user_id
      and unlimited_downloads
      and (expires_at is null or expires_at > now())
  ) then
    return true;
  end if;

  -- ON CONFLICT locks the same per-user/day row used by the image/PDF RPC.
  -- Recheck both current counters while holding that lock, so concurrent calls
  -- across either RPC cannot overspend and a denial changes neither counter.
  insert into public.download_usage_daily (
    user_id, usage_date, explanation_count, signed_asset_count, updated_at
  ) values (v_user_id, current_date, p_count, p_asset_count, now())
  on conflict (user_id, usage_date) do update
  set explanation_count = download_usage_daily.explanation_count + excluded.explanation_count,
      signed_asset_count = download_usage_daily.signed_asset_count + excluded.signed_asset_count,
      updated_at = now()
  where download_usage_daily.explanation_count + excluded.explanation_count <= 200
    and download_usage_daily.signed_asset_count + excluded.signed_asset_count <= 1000;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

alter function public.consume_explanation_and_download_allowance(integer, integer) owner to postgres;
revoke all on function public.consume_explanation_and_download_allowance(integer, integer) from public, anon, service_role;
grant execute on function public.consume_explanation_and_download_allowance(integer, integer) to authenticated;

-- Keep old clients working and make NULL count validation fail closed even for
-- exempt users, instead of raising a NOT NULL error or bypassing validation.
create or replace function public.consume_explanation_allowance(p_count integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.consume_explanation_and_download_allowance(p_count, 0);
end;
$$;

alter function public.consume_explanation_allowance(integer) owner to postgres;
revoke all on function public.consume_explanation_allowance(integer) from public, anon, service_role;
grant execute on function public.consume_explanation_allowance(integer) to authenticated;

notify pgrst, 'reload schema';
commit;
