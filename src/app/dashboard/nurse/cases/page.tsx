"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function NurseCasesPage() {
  return (
    <DashboardShell
      portalLabel="Nursing"
      title="Patient cases"
      description="Cases assigned to nursing. Open a row to record vitals and view the chart."
      navItems={PORTAL_NAV.nurse}
    >
      <CasesListSection detailBase="/dashboard/nurse/cases" />
    </DashboardShell>
  );
}
