import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCareDashboard } from "@/components/patient-cases/patient-care-dashboard";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function PatientDashboardPage() {
  return (
    <DashboardShell
      portalLabel="Patient"
      title="My care"
      description="Your visits, timeline, and documents shared by your care team."
      navItems={PORTAL_NAV.patient}
    >
      <PatientCareDashboard />
    </DashboardShell>
  );
}
