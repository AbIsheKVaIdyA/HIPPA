-- Patient cases: encrypted PHI split so nurses cannot read clinical / health issue.
-- Encryption payloads are produced by the app (AES-256-GCM) before insert; DB stores ciphertext only.
-- Run after 001_profiles_and_rls.sql
--
-- After running:
-- 1) Add PATIENT_DATA_ENCRYPTION_KEY to your Next.js env (openssl rand -base64 32).
-- 2) If "insert into storage.buckets" fails, create bucket "case-attachments" (private)
--    in Dashboard → Storage, then re-run only the storage policy section from this file.

-- ---------------------------------------------------------------------------
-- Core case row (assignments + metadata). Everyone involved can read this.
-- ---------------------------------------------------------------------------
create table public.patient_case_core (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  assigned_doctor_id uuid not null references auth.users (id) on delete restrict,
  assigned_nurse_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patient_case_core_created_by_idx on public.patient_case_core (created_by);
create index patient_case_core_doctor_idx on public.patient_case_core (assigned_doctor_id);
create index patient_case_core_nurse_idx on public.patient_case_core (assigned_nurse_id);

-- ---------------------------------------------------------------------------
-- Demographics + contact (encrypted at rest). Nurse & doctor & creator read.
-- ---------------------------------------------------------------------------
create table public.patient_case_pii (
  case_id uuid primary key references public.patient_case_core (id) on delete cascade,
  patient_legal_name_enc text not null,
  patient_email_enc text not null,
  patient_phone_enc text,
  patient_dob_enc text not null,
  patient_id_proof_enc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clinical: health issue only. Nurse has NO policy here — cannot read or infer via SQL.
-- ---------------------------------------------------------------------------
create table public.patient_case_clinical (
  case_id uuid primary key references public.patient_case_core (id) on delete cascade,
  health_issue_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Nurse vitals (encrypted JSON blob from app).
-- ---------------------------------------------------------------------------
create table public.patient_case_vitals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.patient_case_core (id) on delete cascade,
  submitted_by uuid not null references auth.users (id) on delete restrict,
  vitals_payload_enc text not null,
  created_at timestamptz not null default now()
);

create index patient_case_vitals_case_idx on public.patient_case_vitals (case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Doctor clinical notes / reports (encrypted).
-- ---------------------------------------------------------------------------
create table public.patient_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.patient_case_core (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body_enc text not null,
  created_at timestamptz not null default now()
);

create index patient_case_notes_case_idx on public.patient_case_notes (case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- File metadata (binary lives in Storage; path is not secret).
-- ---------------------------------------------------------------------------
create table public.patient_case_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.patient_case_core (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  storage_path text not null,
  original_name text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create index patient_case_files_case_idx on public.patient_case_files (case_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + validate doctor/nurse roles on case insert/update
-- ---------------------------------------------------------------------------
create or replace function public.patient_case_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger patient_case_core_touch
  before update on public.patient_case_core
  for each row execute procedure public.patient_case_touch_updated_at();

create trigger patient_case_pii_touch
  before update on public.patient_case_pii
  for each row execute procedure public.patient_case_touch_updated_at();

create trigger patient_case_clinical_touch
  before update on public.patient_case_clinical
  for each row execute procedure public.patient_case_touch_updated_at();

create or replace function public.enforce_case_assignee_roles()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  d_role public.user_role;
  n_role public.user_role;
begin
  select role into d_role from public.profiles where id = new.assigned_doctor_id;
  select role into n_role from public.profiles where id = new.assigned_nurse_id;
  if d_role is distinct from 'doctor'::public.user_role then
    raise exception 'assigned_doctor_id must reference a user with role doctor';
  end if;
  if n_role is distinct from 'nurse'::public.user_role then
    raise exception 'assigned_nurse_id must reference a user with role nurse';
  end if;
  return new;
end;
$$;

create trigger patient_case_core_assignee_roles
  before insert or update of assigned_doctor_id, assigned_nurse_id
  on public.patient_case_core
  for each row execute procedure public.enforce_case_assignee_roles();

-- ---------------------------------------------------------------------------
-- Atomic create (front desk only). Inserts core + pii + clinical in one call.
-- ---------------------------------------------------------------------------
create or replace function public.create_patient_case(
  p_assigned_doctor_id uuid,
  p_assigned_nurse_id uuid,
  p_patient_legal_name_enc text,
  p_patient_email_enc text,
  p_patient_phone_enc text,
  p_patient_dob_enc text,
  p_patient_id_proof_enc text,
  p_health_issue_enc text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'front_desk'::public.user_role
  ) then
    raise exception 'only front_desk can create patient cases';
  end if;

  insert into public.patient_case_core (
    created_by, assigned_doctor_id, assigned_nurse_id
  ) values (
    uid, p_assigned_doctor_id, p_assigned_nurse_id
  )
  returning id into new_id;

  insert into public.patient_case_pii (
    case_id, patient_legal_name_enc, patient_email_enc, patient_phone_enc,
    patient_dob_enc, patient_id_proof_enc
  ) values (
    new_id, p_patient_legal_name_enc, p_patient_email_enc, p_patient_phone_enc,
    p_patient_dob_enc, nullif(trim(p_patient_id_proof_enc), '')
  );

  insert into public.patient_case_clinical (case_id, health_issue_enc)
  values (new_id, p_health_issue_enc);

  return new_id;
end;
$$;

grant execute on function public.create_patient_case(
  uuid, uuid, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
alter table public.patient_case_core enable row level security;
alter table public.patient_case_pii enable row level security;
alter table public.patient_case_clinical enable row level security;
alter table public.patient_case_vitals enable row level security;
alter table public.patient_case_notes enable row level security;
alter table public.patient_case_files enable row level security;

-- Admins see everything
create policy patient_case_core_admin_all
  on public.patient_case_core for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy patient_case_pii_admin_all
  on public.patient_case_pii for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy patient_case_clinical_admin_all
  on public.patient_case_clinical for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy patient_case_vitals_admin_all
  on public.patient_case_vitals for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy patient_case_notes_admin_all
  on public.patient_case_notes for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy patient_case_files_admin_all
  on public.patient_case_files for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Core: participants read; front desk creator inserts via RPC only (no direct insert grant)
create policy patient_case_core_select_participants
  on public.patient_case_core for select to authenticated
  using (
    created_by = auth.uid()
    or assigned_doctor_id = auth.uid()
    or assigned_nurse_id = auth.uid()
  );

create policy patient_case_core_update_front_creator
  on public.patient_case_core for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'front_desk'::public.user_role
    )
    and created_by = auth.uid()
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'front_desk'::public.user_role
    )
    and created_by = auth.uid()
  );

-- PII: creator, assigned doctor, assigned nurse (nurse does NOT get clinical elsewhere)
create policy patient_case_pii_select_participants
  on public.patient_case_pii for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      where c.id = patient_case_pii.case_id
      and (
        c.created_by = auth.uid()
        or c.assigned_doctor_id = auth.uid()
        or c.assigned_nurse_id = auth.uid()
      )
    )
  );

create policy patient_case_pii_update_front_creator
  on public.patient_case_pii for update to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_pii.case_id
      and c.created_by = auth.uid()
      and p.role = 'front_desk'::public.user_role
    )
  )
  with check (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_pii.case_id
      and c.created_by = auth.uid()
      and p.role = 'front_desk'::public.user_role
    )
  );

-- Clinical: doctor on case + front desk who created (NOT nurse)
create policy patient_case_clinical_select_doctor_or_creator
  on public.patient_case_clinical for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_clinical.case_id
      and (
        c.assigned_doctor_id = auth.uid()
        or (c.created_by = auth.uid() and p.role = 'front_desk'::public.user_role)
      )
    )
  );

create policy patient_case_clinical_update_front_creator
  on public.patient_case_clinical for update to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_clinical.case_id
      and c.created_by = auth.uid()
      and p.role = 'front_desk'::public.user_role
    )
  )
  with check (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_clinical.case_id
      and c.created_by = auth.uid()
      and p.role = 'front_desk'::public.user_role
    )
  );

-- Vitals: assigned nurse inserts; doctor / nurse / creator read
create policy patient_case_vitals_select_participants
  on public.patient_case_vitals for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      where c.id = patient_case_vitals.case_id
      and (
        c.created_by = auth.uid()
        or c.assigned_doctor_id = auth.uid()
        or c.assigned_nurse_id = auth.uid()
      )
    )
  );

create policy patient_case_vitals_insert_assigned_nurse
  on public.patient_case_vitals for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_vitals.case_id
      and c.assigned_nurse_id = auth.uid()
      and p.role = 'nurse'::public.user_role
    )
  );

-- Notes: assigned doctor reads/writes; front desk creator reads; nurse has no policy
create policy patient_case_notes_select_doctor_or_creator
  on public.patient_case_notes for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_notes.case_id
      and (
        c.assigned_doctor_id = auth.uid()
        or (c.created_by = auth.uid() and p.role = 'front_desk'::public.user_role)
      )
    )
  );

create policy patient_case_notes_insert_assigned_doctor
  on public.patient_case_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_notes.case_id
      and c.assigned_doctor_id = auth.uid()
      and p.role = 'doctor'::public.user_role
    )
  );

-- Files: doctor upload; doctor + front creator read
create policy patient_case_files_select_doctor_or_creator
  on public.patient_case_files for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_files.case_id
      and (
        c.assigned_doctor_id = auth.uid()
        or (c.created_by = auth.uid() and p.role = 'front_desk'::public.user_role)
      )
    )
  );

create policy patient_case_files_insert_assigned_doctor
  on public.patient_case_files for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = patient_case_files.case_id
      and c.assigned_doctor_id = auth.uid()
      and p.role = 'doctor'::public.user_role
    )
  );

-- Grants (RLS still applies)
grant select, update on public.patient_case_core to authenticated;
grant select, insert, update on public.patient_case_pii to authenticated;
grant select, insert, update on public.patient_case_clinical to authenticated;
grant select, insert on public.patient_case_vitals to authenticated;
grant select, insert on public.patient_case_notes to authenticated;
grant select, insert on public.patient_case_files to authenticated;

-- No direct insert on core / pii / clinical for normal users — use RPC for create.
revoke insert on public.patient_case_core from authenticated;
revoke insert on public.patient_case_pii from authenticated;
revoke insert on public.patient_case_clinical from authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for doctor attachments (path: {case_id}/{filename})
-- Create bucket in Dashboard if insert fails due to permissions; then re-run policies only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-attachments',
  'case-attachments',
  false,
  52428800,
  null
)
on conflict (id) do nothing;

create policy case_attachments_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'case-attachments'
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = split_part(storage.objects.name, '/', 1)::uuid
      and (
        c.assigned_doctor_id = auth.uid()
        or (c.created_by = auth.uid() and p.role = 'front_desk'::public.user_role)
        or p.role = 'admin'::public.user_role
      )
    )
  );

create policy case_attachments_insert_doctor
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'case-attachments'
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = split_part(storage.objects.name, '/', 1)::uuid
      and c.assigned_doctor_id = auth.uid()
      and p.role = 'doctor'::public.user_role
    )
  );

create policy case_attachments_delete_doctor
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'case-attachments'
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles p on p.id = auth.uid()
      where c.id = split_part(storage.objects.name, '/', 1)::uuid
      and c.assigned_doctor_id = auth.uid()
      and p.role = 'doctor'::public.user_role
    )
  );

-- ---------------------------------------------------------------------------
-- Staff directory: front desk / admin must list doctors & nurses for assignment.
-- Uses SECURITY DEFINER helper so the policy does not SELECT profiles from
-- within profiles RLS (that causes infinite recursion and PostgREST 500).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_user_profile_role() to authenticated;

create policy profiles_select_clinical_staff_directory
  on public.profiles for select to authenticated
  using (
    public.current_user_profile_role() in (
      'front_desk'::public.user_role,
      'admin'::public.user_role
    )
    and public.profiles.role in (
      'doctor'::public.user_role,
      'nurse'::public.user_role
    )
  );
