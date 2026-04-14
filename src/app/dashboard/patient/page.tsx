import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCareDashboard } from "@/components/patient-cases/patient-care-dashboard";

export default function PatientDashboardPage() {
  return (
    <DashboardShell title="My care">
      <PatientCareDashboard />
    </DashboardShell>
  );
}
