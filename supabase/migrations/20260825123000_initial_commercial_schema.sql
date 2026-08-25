begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint products_known_id check (id in ('bank_igcse', 'bank_ib_hl', 'bank_ib_sl', 'bundle_all'))
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id),
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  source text not null default 'manual',
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_status check (status in ('active', 'trialing', 'expired', 'revoked')),
  constraint entitlements_dates check (expires_at is null or expires_at > starts_at),
  constraint entitlements_user_product unique (user_id, product_id)
);

create table if not exists public.saved_questions (
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_slug text not null,
  question_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, bank_slug, question_id),
  constraint saved_questions_bank check (bank_slug in ('igcse', 'ib-hl', 'ib-sl'))
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_slug text not null,
  question_id text not null,
  confidence smallint,
  correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempts_bank check (bank_slug in ('igcse', 'ib-hl', 'ib-sl')),
  constraint attempts_confidence check (confidence is null or confidence between 1 and 5)
);

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists entitlements_user_status_idx
  on public.entitlements(user_id, status);
create index if not exists attempts_user_question_idx
  on public.attempts(user_id, bank_slug, question_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

drop trigger if exists attempts_set_updated_at on public.attempts;
create trigger attempts_set_updated_at
before update on public.attempts
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.entitlements enable row level security;
alter table public.saved_questions enable row level security;
alter table public.attempts enable row level security;
alter table public.stripe_customers enable row level security;

create policy "Profiles are readable by their owner"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Profiles are editable by their owner"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Active products are public"
on public.products for select
to anon, authenticated
using (active = true);

create policy "Entitlements are readable by their owner"
on public.entitlements for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Saved questions are readable by their owner"
on public.saved_questions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Saved questions are created by their owner"
on public.saved_questions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Saved questions are deleted by their owner"
on public.saved_questions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Attempts are readable by their owner"
on public.attempts for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Attempts are created by their owner"
on public.attempts for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Attempts are updated by their owner"
on public.attempts for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Attempts are deleted by their owner"
on public.attempts for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Stripe customer mappings are readable by their owner"
on public.stripe_customers for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.products (id, name, active)
values
  ('bank_igcse', 'Cambridge IGCSE Mathematics 0580', true),
  ('bank_ib_hl', 'IB Mathematics AA HL', true),
  ('bank_ib_sl', 'IB Mathematics AA SL', true),
  ('bundle_all', 'All-access bundle', true)
on conflict (id) do update
set name = excluded.name,
    active = excluded.active;

commit;
