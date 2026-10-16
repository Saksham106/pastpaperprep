-- Daily allowance headroom for members (2026-10-16).
-- 1. PDF questions 75 -> 150: three exports a day were allowed, but a second
--    50-question worksheet always failed (50 + 50 > 75).
-- 2. Signed images 1000 -> 3000: links were re-signed (and re-counted) every
--    10 minutes, so long study sessions hit the cap. Links now last an hour.
-- Bodies are unchanged apart from the caps.
begin;

alter table public.download_usage_daily
  drop constraint download_usage_daily_signed_asset_count_check,
  add constraint download_usage_daily_signed_asset_count_check check (signed_asset_count between 0 and 3000),
  drop constraint download_usage_daily_pdf_question_count_check,
  add constraint download_usage_daily_pdf_question_count_check check (pdf_question_count between 0 and 150);

create or replace function public.consume_download_allowance(
  p_asset_count integer,
  p_pdf_question_count integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows integer := 0;
  v_pdf_export_increment integer := case when p_pdf_question_count > 0 then 1 else 0 end;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return false;
  end if;

  if p_asset_count < 0 or p_asset_count > 1000
     or p_pdf_question_count < 0 or p_pdf_question_count > 50
     or (p_asset_count = 0 and p_pdf_question_count = 0) then
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

  insert into public.download_usage_daily (
    user_id,
    usage_date,
    signed_asset_count,
    pdf_export_count,
    pdf_question_count,
    updated_at
  ) values (
    v_user_id,
    current_date,
    p_asset_count,
    v_pdf_export_increment,
    p_pdf_question_count,
    now()
  )
  on conflict (user_id, usage_date) do update
  set signed_asset_count = download_usage_daily.signed_asset_count + excluded.signed_asset_count,
      pdf_export_count = download_usage_daily.pdf_export_count + excluded.pdf_export_count,
      pdf_question_count = download_usage_daily.pdf_question_count + excluded.pdf_question_count,
      updated_at = now()
  where download_usage_daily.signed_asset_count + excluded.signed_asset_count <= 3000
    and download_usage_daily.pdf_export_count + excluded.pdf_export_count <= 3
    and download_usage_daily.pdf_question_count + excluded.pdf_question_count <= 150;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

alter function public.consume_download_allowance(integer, integer) owner to postgres;
revoke all on function public.consume_download_allowance(integer, integer) from public, anon, service_role;
grant execute on function public.consume_download_allowance(integer, integer) to authenticated;

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
    and download_usage_daily.signed_asset_count + excluded.signed_asset_count <= 3000;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

alter function public.consume_explanation_and_download_allowance(integer, integer) owner to postgres;
revoke all on function public.consume_explanation_and_download_allowance(integer, integer) from public, anon, service_role;
grant execute on function public.consume_explanation_and_download_allowance(integer, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
