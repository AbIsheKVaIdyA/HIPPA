"use client";

import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCaseDetailView } from "@/components/patient-cases/patient-case-detail-view";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function PatientCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  return (
    <DashboardShell
      portalLabel="Patient"
      title="Visit details"
      description="Information your team has shared with you for this visit."
      navItems={PORTAL_NAV.patient}
    >
      <PatientCaseDetailView
        caseId={caseId}
        backHref="/dashboard/patient"
        role="patient"
      />
    </DashboardShell>
  );
}
