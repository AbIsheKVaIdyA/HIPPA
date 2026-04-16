-- Partner hospital referrals: limited encrypted share, 3-day access, audit-friendly.
-- Run after 002_patient_cases_clinical.sql (patient_case_core exists).

create type public.partner_referral_status as enum (
  'pending',
  'submitted',
  'expired',
  'revoked'
);

create table public.partner_referral (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.patient_case_core (id) on delete cascade,
  referring_doctor_id uuid not null references auth.users (id) on delete restrict,
  partner_user_id uuid not null references auth.users (id) on delete restrict,
  referral_kind text not null default 'External study / service',
  partner_display_name text not null default '',
  shared_context_enc text not null,
  expires_at timestamptz not null,
  status public.partner_referral_status not null default 'pending',
  partner_result_enc text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partner_referral_case_idx on public.partner_referral (case_id, created_at desc);
create index partner_referral_partner_idx on public.partner_referral (partner_user_id, expires_at desc);
create index partner_referral_doctor_idx on public.partner_referral (referring_doctor_id);

create or replace function public.partner_referral_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger partner_referral_touch
  before update on public.partner_referral
  for each row execute procedure public.partner_referral_touch_updated_at();

create or replace function public.partner_referral_set_expiry()
returns trigger language plpgsql as $$
begin
  new.expires_at := now() + interval '3 days';
  return new;
end;
$$;

create trigger partner_referral_expiry
  before insert on public.partner_referral
  for each row execute procedure public.partner_referral_set_expiry();

create or replace function public.enforce_partner_referral_roles()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  d_role public.user_role;
  p_role public.user_role;
  doc_id uuid;
begin
  select assigned_doctor_id into doc_id
  from public.patient_case_core where id = new.case_id;
  if doc_id is null then
    raise exception 'Case not found';
  end if;
  if doc_id <> new.referring_doctor_id then
    raise exception 'Referring doctor must be the assigned physician on this case';
  end if;

  select role into d_role from public.profiles where id = new.referring_doctor_id;
  if d_role is distinct from 'doctor'::public.user_role then
    raise exception 'Referring user must be a doctor';
  end if;

  select role into p_role from public.profiles where id = new.partner_user_id;
  if p_role is distinct from 'third_party_hospital'::public.user_role then
    raise exception 'Partner user must have partner hospital role';
  end if;

  return new;
end;
$$;

create trigger partner_referral_enforce_roles
  before insert on public.partner_referral
  for each row execute procedure public.enforce_partner_referral_roles();

alter table public.partner_referral enable row level security;

-- Assigned doctor: full read on their cases' referrals; insert only via trigger checks above
create policy partner_referral_doctor_select
  on public.partner_referral for select
  to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      where c.id = partner_referral.case_id
        and c.assigned_doctor_id = auth.uid()
    )
  );

create policy partner_referral_doctor_insert
  on public.partner_referral for insert
  to authenticated
  with check (
    referring_doctor_id = auth.uid()
    and exists (
      select 1 from public.patient_case_core c
      where c.id = case_id and c.assigned_doctor_id = auth.uid()
    )
  );

create policy partner_referral_doctor_update_revoke
  on public.partner_referral for update
  to authenticated
  using (
    referring_doctor_id = auth.uid()
    and status = 'pending'::public.partner_referral_status
  )
  with check (
    referring_doctor_id = auth.uid()
    and status = 'revoked'::public.partner_referral_status
  );

-- Partner: read only while not expired and not revoked; update only to submit result while pending
create policy partner_referral_partner_select
  on public.partner_referral for select
  to authenticated
  using (
    partner_user_id = auth.uid()
    and expires_at > now()
    and status in ('pending'::public.partner_referral_status, 'submitted'::public.partner_referral_status)
  );

create policy partner_referral_partner_update_submit
  on public.partner_referral for update
  to authenticated
  using (
    partner_user_id = auth.uid()
    and expires_at > now()
    and status = 'pending'::public.partner_referral_status
  )
  with check (
    partner_user_id = auth.uid()
    and status = 'submitted'::public.partner_referral_status
  );

-- Admin read (no PHI decryption in API without admin role check)
create policy partner_referral_admin_select
  on public.partner_referral for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Optional cleanup: delete rows whose access window ended (run daily via cron or manually)
-- delete from public.partner_referral where expires_at < now();

comment on table public.partner_referral is
  'Doctor-to-partner referrals with limited encrypted context; partner access expires 3 days after creation.';
