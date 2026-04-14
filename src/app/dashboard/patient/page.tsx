import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCareDashboard } from "@/components/patient-cases/patient-care-dashboard";

export default function PatientDashboardPage() {
  return (
    <DashboardShell
      title="My care"
      description="Visits, vitals, notes from your care team, and documents shared with you."
    >
      <PatientCareDashboard />
    </DashboardShell>
  );
}
