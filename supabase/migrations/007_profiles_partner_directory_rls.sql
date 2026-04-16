-- Allow doctors (and admins) to list partner-hospital profiles for referrals.
-- Existing profiles_select_clinical_staff_directory only exposes doctor/nurse rows to front_desk/admin.
-- Run after 003_fix_profiles_rls_recursion.sql (needs public.current_user_profile_role()).

create policy profiles_select_partner_hospital_directory
  on public.profiles for select to authenticated
  using (
    public.current_user_profile_role() in (
      'doctor'::public.user_role,
      'admin'::public.user_role
    )
    and public.profiles.role = 'third_party_hospital'::public.user_role
  );

comment on policy profiles_select_partner_hospital_directory on public.profiles is
  'Doctors/admins can read third_party_hospital rows only (partner picker); not full staff directory.';
