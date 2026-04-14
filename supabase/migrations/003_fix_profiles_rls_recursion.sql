-- Fix: profiles_select_clinical_staff_directory referenced public.profiles inside
-- an RLS policy ON public.profiles → infinite recursion → PostgREST 500.
-- Run this after 002_patient_cases_clinical.sql (safe to run even if 002 was edited).

drop policy if exists profiles_select_clinical_staff_directory on public.profiles;

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

comment on function public.current_user_profile_role() is
  'Reads viewer role bypassing RLS; used only in profiles directory policy to avoid recursion.';

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
