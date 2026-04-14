-- Case metadata for patient matching + patient portal RLS.
-- Run after 003_fix_profiles_rls_recursion.sql

alter table public.patient_case_core
  add column if not exists patient_email_norm text,
  add column if not exists prior_case_id uuid references public.patient_case_core (id),
  add column if not exists visit_label text;

create index if not exists patient_case_core_email_norm_idx
  on public.patient_case_core (lower(patient_email_norm));

comment on column public.patient_case_core.patient_email_norm is
  'Lowercased registration email to match patient login and link visits; operational identifier.';

-- Replace RPC: add email norm + optional prior case (follow-up visit).
drop function if exists public.create_patient_case(uuid, uuid, text, text, text, text, text, text);

create or replace function public.create_patient_case(
  p_assigned_doctor_id uuid,
  p_assigned_nurse_id uuid,
  p_patient_legal_name_enc text,
  p_patient_email_enc text,
  p_patient_phone_enc text,
  p_patient_dob_enc text,
  p_patient_id_proof_enc text,
  p_health_issue_enc text,
  p_patient_email_norm text,
  p_prior_case_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  en text := lower(trim(p_patient_email_norm));
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'front_desk'::public.user_role
  ) then
    raise exception 'only front_desk can create patient cases';
  end if;

  if en = '' then
    raise exception 'patient_email_norm required';
  end if;

  insert into public.patient_case_core (
    created_by, assigned_doctor_id, assigned_nurse_id,
    patient_email_norm, prior_case_id
  ) values (
    uid, p_assigned_doctor_id, p_assigned_nurse_id,
    en, p_prior_case_id
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
  uuid, uuid, text, text, text, text, text, text, text, uuid
) to authenticated;

-- Patient can read their own care data (match profile email to case.patient_email_norm)
create policy patient_case_core_select_patient
  on public.patient_case_core for select to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid()
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and patient_case_core.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(patient_case_core.patient_email_norm))
    )
  );

create policy patient_case_pii_select_patient
  on public.patient_case_pii for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles pr on pr.id = auth.uid()
      where c.id = patient_case_pii.case_id
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and c.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(c.patient_email_norm))
    )
  );

create policy patient_case_clinical_select_patient
  on public.patient_case_clinical for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles pr on pr.id = auth.uid()
      where c.id = patient_case_clinical.case_id
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and c.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(c.patient_email_norm))
    )
  );

create policy patient_case_vitals_select_patient
  on public.patient_case_vitals for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles pr on pr.id = auth.uid()
      where c.id = patient_case_vitals.case_id
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and c.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(c.patient_email_norm))
    )
  );

create policy patient_case_notes_select_patient
  on public.patient_case_notes for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles pr on pr.id = auth.uid()
      where c.id = patient_case_notes.case_id
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and c.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(c.patient_email_norm))
    )
  );

create policy patient_case_files_select_patient
  on public.patient_case_files for select to authenticated
  using (
    exists (
      select 1 from public.patient_case_core c
      join public.profiles pr on pr.id = auth.uid()
      where c.id = patient_case_files.case_id
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and c.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(c.patient_email_norm))
    )
  );

-- Storage: patient read own case files
create policy case_attachments_select_patient
  on storage.objects for select to authenticated
  using (
    bucket_id = 'case-attachments'
    and exists (
      select 1 from public.patient_case_core c
      join public.profiles pr on pr.id = auth.uid()
      where c.id = split_part(storage.objects.name, '/', 1)::uuid
      and pr.role = 'patient'::public.user_role
      and pr.email is not null
      and c.patient_email_norm is not null
      and lower(trim(pr.email)) = lower(trim(c.patient_email_norm))
    )
  );
