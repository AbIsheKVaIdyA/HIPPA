-- Let patients view referral status for their own cases in patient portal timeline.
-- Does NOT expose encrypted shared context or submitted result text in this flow.

create policy partner_referral_patient_select_own_case
  on public.partner_referral
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles me
      join public.patient_case_core c on c.id = partner_referral.case_id
      where me.id = auth.uid()
        and me.role = 'patient'::public.user_role
        and c.patient_email_norm = lower(me.email)
    )
  );
