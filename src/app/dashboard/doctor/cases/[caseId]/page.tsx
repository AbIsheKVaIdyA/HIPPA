"use client";

import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCaseDetailView } from "@/components/patient-cases/patient-case-detail-view";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function DoctorCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  return (
    <DashboardShell
      portalLabel="Physician"
      title="Patient case"
      description="Chart, vitals, partner referrals, and visit updates for this encounter."
      navItems={PORTAL_NAV.doctor}
    >
      <PatientCaseDetailView
        caseId={caseId}
        backHref="/dashboard/doctor/cases"
        role="doctor"
      />
    </DashboardShell>
  );
}
