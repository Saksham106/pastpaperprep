-- Local/rollback-only regression probes; never seed or mutate live production.
begin;
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000213';
  v_ok boolean;
  v_count integer;
begin
  insert into auth.users (id) values (v_user);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Both counters commit together on success.
  v_ok := public.consume_explanation_and_download_allowance(1, 2);
  if v_ok is distinct from true then raise exception 'mixed quota success denied'; end if;
  if not exists (select 1 from public.download_usage_daily where user_id = v_user and usage_date = current_date and explanation_count = 1 and signed_asset_count = 2 and pdf_export_count = 0) then
    raise exception 'mixed counters not committed';
  end if;

  -- Download denial must not consume explanations, including first failed request.
  update public.download_usage_daily set signed_asset_count = 1000 where user_id = v_user;
  if public.consume_explanation_and_download_allowance(1, 1) is distinct from false then raise exception 'download overflow allowed'; end if;
  select explanation_count into v_count from public.download_usage_daily where user_id = v_user and usage_date = current_date;
  if v_count <> 1 then raise exception 'download denial consumed explanation'; end if;

  -- Explanation denial must not consume downloads.
  update public.download_usage_daily set explanation_count = 200, signed_asset_count = 2 where user_id = v_user;
  if public.consume_explanation_and_download_allowance(1, 1) is distinct from false then raise exception 'explanation overflow allowed'; end if;
  select signed_asset_count into v_count from public.download_usage_daily where user_id = v_user and usage_date = current_date;
  if v_count <> 2 then raise exception 'explanation denial consumed download'; end if;

  -- Competing calls share the same row; the exact 200th explanation wins, next loses.
  update public.download_usage_daily set explanation_count = 199 where user_id = v_user;
  if public.consume_explanation_allowance(1) is distinct from true then raise exception '200th explanation denied'; end if;
  if public.consume_explanation_and_download_allowance(1, 1) is distinct from false then raise exception '201st explanation allowed'; end if;

  -- Invalid and NULL counts fail closed without constraint errors or mutation.
  foreach v_count in array array[-1, 0, 21] loop
    if public.consume_explanation_allowance(v_count) is distinct from false then raise exception 'invalid explanation count allowed'; end if;
  end loop;
  if public.consume_explanation_allowance(null) is distinct from false then raise exception 'null explanation count allowed'; end if;
  if public.consume_explanation_and_download_allowance(1, null) is distinct from false then raise exception 'null image count allowed'; end if;
  if public.consume_explanation_and_download_allowance(1, -1) is distinct from false then raise exception 'negative image count allowed'; end if;
  if public.consume_explanation_and_download_allowance(1, 1001) is distinct from false then raise exception 'oversized image count allowed'; end if;

  -- Only a current operator exemption bypasses both counters; authentication still required.
  insert into public.download_allowance_exemptions(user_id, expires_at) values (v_user, now() - interval '1 minute');
  if public.consume_explanation_allowance(1) is distinct from false then raise exception 'expired exemption bypass'; end if;
  update public.download_allowance_exemptions set expires_at = null where user_id = v_user;
  if public.consume_explanation_and_download_allowance(20, 1000) is distinct from true then raise exception 'current exemption denied'; end if;
  if public.consume_explanation_allowance(null) is distinct from false then raise exception 'exemption bypassed validation'; end if;
  perform set_config('request.jwt.claim.role', 'anon', true);
  if public.consume_explanation_allowance(1) is distinct from false then raise exception 'anon bypass'; end if;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if public.consume_explanation_allowance(1) is distinct from false then raise exception 'missing uid bypass'; end if;

  -- Both RPCs stay unavailable to public/anon/service_role and directly writable tables stay private.
  if has_function_privilege('anon', 'public.consume_explanation_and_download_allowance(integer,integer)', 'execute') or
     has_function_privilege('service_role', 'public.consume_explanation_and_download_allowance(integer,integer)', 'execute') or
     not has_function_privilege('authenticated', 'public.consume_explanation_and_download_allowance(integer,integer)', 'execute') then
    raise exception 'mixed RPC ACL invalid';
  end if;
  if has_function_privilege('anon', 'public.consume_explanation_allowance(integer)', 'execute') or
     has_function_privilege('service_role', 'public.consume_explanation_allowance(integer)', 'execute') then
    raise exception 'explanation RPC ACL invalid';
  end if;
  if has_table_privilege('authenticated', 'public.download_usage_daily', 'insert,update,delete') or
     has_table_privilege('authenticated', 'public.download_allowance_exemptions', 'insert,update,delete') then
    raise exception 'usage/exemptions directly writable';
  end if;
end;
$$;
rollback;
