"use client";

import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCaseDetailView } from "@/components/patient-cases/patient-case-detail-view";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function FrontDeskCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  return (
    <DashboardShell
      portalLabel="Front desk"
      title="Patient case"
      description="Registration details, notes, and attachments for this visit."
      navItems={PORTAL_NAV.front_desk}
    >
      <PatientCaseDetailView
        caseId={caseId}
        backHref="/dashboard/front-desk#cases"
        role="front_desk"
      />
    </DashboardShell>
  );
}
