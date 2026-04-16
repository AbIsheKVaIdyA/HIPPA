"use client";

import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCaseDetailView } from "@/components/patient-cases/patient-case-detail-view";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function NurseCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  return (
    <DashboardShell
      portalLabel="Nursing"
      title="Patient case"
      description="Vitals and chart information for this assignment."
      navItems={PORTAL_NAV.nurse}
    >
      <PatientCaseDetailView
        caseId={caseId}
        backHref="/dashboard/nurse/cases"
        role="nurse"
      />
    </DashboardShell>
  );
}
