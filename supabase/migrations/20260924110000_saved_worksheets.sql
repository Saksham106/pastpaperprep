create table if not exists public.saved_worksheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_slug text not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  question_ids jsonb not null check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 1 and 50),
  content_mode text not null check (content_mode in ('questions', 'answers', 'both')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_worksheets_owner_updated_idx on public.saved_worksheets(user_id, updated_at desc);
alter table public.saved_worksheets enable row level security;
revoke all on public.saved_worksheets from anon, authenticated;
grant select, insert, update, delete on public.saved_worksheets to authenticated;
drop policy if exists saved_worksheets_owner_all on public.saved_worksheets;
create policy saved_worksheets_owner_all on public.saved_worksheets
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
