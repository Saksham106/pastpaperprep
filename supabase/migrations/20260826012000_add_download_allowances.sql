begin;

update public.products
set name = 'PastPaperPrep All-Access'
where id = 'bundle_all';

create table if not exists public.download_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  signed_asset_count integer not null default 0 check (signed_asset_count between 0 and 1000),
  pdf_export_count integer not null default 0 check (pdf_export_count between 0 and 3),
  pdf_question_count integer not null default 0 check (pdf_question_count between 0 and 75),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.download_allowance_exemptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlimited_downloads boolean not null default true,
  expires_at timestamptz,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.download_usage_daily enable row level security;
alter table public.download_allowance_exemptions enable row level security;
revoke all on table public.download_usage_daily from public, anon, authenticated, service_role;
revoke all on table public.download_allowance_exemptions from public, anon, authenticated, service_role;

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
  where download_usage_daily.signed_asset_count + excluded.signed_asset_count <= 1000
    and download_usage_daily.pdf_export_count + excluded.pdf_export_count <= 3
    and download_usage_daily.pdf_question_count + excluded.pdf_question_count <= 75;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

alter function public.consume_download_allowance(integer, integer) owner to postgres;
revoke all on function public.consume_download_allowance(integer, integer) from public, anon, service_role;
grant execute on function public.consume_download_allowance(integer, integer) to authenticated;

create or replace function public.set_download_allowance_exemption(
  p_user_id uuid,
  p_unlimited_downloads boolean,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Unknown user';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long';
  end if;

  if p_unlimited_downloads then
    insert into public.download_allowance_exemptions (
      user_id,
      unlimited_downloads,
      expires_at,
      note,
      updated_at
    ) values (
      p_user_id,
      true,
      p_expires_at,
      p_note,
      now()
    )
    on conflict (user_id) do update
    set unlimited_downloads = true,
        expires_at = excluded.expires_at,
        note = excluded.note,
        updated_at = now();
  else
    delete from public.download_allowance_exemptions where user_id = p_user_id;
  end if;
end;
$$;

alter function public.set_download_allowance_exemption(uuid, boolean, timestamptz, text) owner to postgres;
-- This operator-only helper is deliberately unavailable through PostgREST.
-- Project owners can invoke it from the Supabase SQL editor after reviewing the
-- target user. Manual complimentary access continues to use entitlements.source
-- = 'manual'; Stripe promotion codes handle account-specific paid discounts.
revoke all on function public.set_download_allowance_exemption(uuid, boolean, timestamptz, text)
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
