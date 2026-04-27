-- Progressive sign-in lockout across all portals (email + portal scoped).
-- Policy:
--  - 4 wrong attempts -> lock 15 minutes
--  - then 2 wrong attempts -> lock 30 minutes
--  - then 1 wrong attempt -> lock 60 minutes
--  - then 1 wrong attempt -> blocked (help desk required)

create table if not exists public.sign_in_lockout (
  lock_key text primary key,
  portal_slug text not null,
  email_norm text not null,
  stage smallint not null default 0, -- 0..3 escalation stages
  failures_in_stage int not null default 0,
  locked_until timestamptz,
  blocked boolean not null default false,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sign_in_lockout_email_portal_idx
  on public.sign_in_lockout (email_norm, portal_slug);

alter table public.sign_in_lockout enable row level security;

-- service_role-only table: no authenticated policy grants by design.
