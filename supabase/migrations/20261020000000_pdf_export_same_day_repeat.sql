-- Re-downloading the same worksheet on the same day no longer uses another PDF export.
--
-- The PDF allowance is charged when /api/pdf/sign returns signed URLs, before the browser
-- builds the file. A double click, a retry after a failed build or a cancelled-then-repeated
-- export of the *same* worksheet therefore used up the 3-a-day export limit without giving
-- the student anything new. The server now derives an export key (a hash of the bank,
-- content mode and sorted question IDs) and records it per user and day; a repeat of an
-- already-charged key is allowed without charging again. A different worksheet still
-- charges normally, so the limit on new content is unchanged.
begin;

create table if not exists public.pdf_export_charges (
  user_id uuid not null,
  usage_date date not null,
  export_key text not null check (export_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, usage_date, export_key)
);

alter table public.pdf_export_charges enable row level security;
revoke all on table public.pdf_export_charges from public, anon, authenticated, service_role;

create or replace function public.consume_pdf_export_allowance(
  p_export_key text,
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
  v_new_charge integer := 0;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    return false;
  end if;
  if p_export_key is null or p_export_key !~ '^[0-9a-f]{64}$'
     or p_asset_count is null or p_pdf_question_count is null
     or p_pdf_question_count < 1 then
    return false;
  end if;

  -- Claim the key first. A concurrent identical request blocks on this row until the first
  -- commits, then sees the conflict and is treated as a repeat, so it can't charge twice.
  insert into public.pdf_export_charges (user_id, usage_date, export_key)
  values (v_user_id, current_date, p_export_key)
  on conflict (user_id, usage_date, export_key) do nothing;
  get diagnostics v_new_charge = row_count;

  if v_new_charge = 0 then
    return true;  -- same worksheet already charged today
  end if;

  if public.consume_download_allowance(p_asset_count, p_pdf_question_count) then
    return true;
  end if;

  -- Denied: forget the claim so the key isn't remembered as charged.
  delete from public.pdf_export_charges
  where user_id = v_user_id and usage_date = current_date and export_key = p_export_key;
  return false;
end;
$$;

alter function public.consume_pdf_export_allowance(text, integer, integer) owner to postgres;
revoke all on function public.consume_pdf_export_allowance(text, integer, integer) from public, anon, service_role;
grant execute on function public.consume_pdf_export_allowance(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
