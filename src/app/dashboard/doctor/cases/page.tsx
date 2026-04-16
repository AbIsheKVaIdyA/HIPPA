"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function DoctorCasesPage() {
  return (
    <DashboardShell
      portalLabel="Physician"
      title="Patient cases"
      description="All cases assigned to you. Select a row to open the full chart."
      navItems={PORTAL_NAV.doctor}
    >
      <CasesListSection detailBase="/dashboard/doctor/cases" />
    </DashboardShell>
  );
}
