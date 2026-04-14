-- Sign-in rate limiting (consumed from Next.js using service_role only).
-- Audit trail for PHI-related access (inserts via service_role; admins read via RLS).

create table if not exists public.sign_in_rate_bucket (
  bucket_key text primary key,
  window_start timestamptz not null,
  attempt_count int not null
);

alter table public.sign_in_rate_bucket enable row level security;

create or replace function public.consume_sign_in_rate(
  p_bucket_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  now_ts timestamptz := clock_timestamp();
  win interval := make_interval(secs => p_window_seconds);
begin
  select * into r from public.sign_in_rate_bucket where bucket_key = p_bucket_key for update;
  if not found then
    insert into public.sign_in_rate_bucket (bucket_key, window_start, attempt_count)
    values (p_bucket_key, now_ts, 1);
    return true;
  end if;
  if r.window_start + win < now_ts then
    update public.sign_in_rate_bucket
      set window_start = now_ts, attempt_count = 1
      where bucket_key = p_bucket_key;
    return true;
  end if;
  if r.attempt_count >= p_max then
    return false;
  end if;
  update public.sign_in_rate_bucket
    set attempt_count = attempt_count + 1
    where bucket_key = p_bucket_key;
  return true;
end;
$$;

revoke all on function public.consume_sign_in_rate(text, int, int) from public;
grant execute on function public.consume_sign_in_rate(text, int, int) to service_role;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,
  resource_type text,
  resource_id text,
  status text not null default 'success' check (status in ('success', 'failure')),
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_actor_user_idx on public.audit_log (actor_user_id);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_admin_select on public.audit_log;

create policy audit_log_admin_select
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
