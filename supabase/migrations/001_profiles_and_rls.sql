-- Run this in the Supabase SQL editor or via the Supabase CLI.
-- Creates application roles, profiles, RLS, and sync from auth.users metadata.

create type public.user_role as enum (
  'admin',
  'doctor',
  'nurse',
  'front_desk',
  'patient',
  'third_party_hospital'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_profiles_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  begin
    r := coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'patient'::public.user_role
    );
  exception when others then
    r := 'patient'::public.user_role;
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    r
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;

-- Bootstrap: after you create the first admin in Supabase Dashboard (Authentication),
-- set metadata role to "admin" on that user, or run:
--   update public.profiles
--   set role = 'admin', full_name = coalesce(nullif(full_name, ''), 'System admin')
--   where email = 'your-admin@example.com';
