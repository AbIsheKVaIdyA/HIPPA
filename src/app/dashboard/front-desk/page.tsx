import { DashboardShell } from "@/components/dashboard-shell";
import { FrontDeskWorkspace } from "@/components/patient-cases/front-desk-workspace";

export default function FrontDeskDashboardPage() {
  return (
    <DashboardShell
      title="Front desk"
      description="Cases, returning-patient lookup, and registration—with optional patient portal invite sent automatically."
    >
      <FrontDeskWorkspace />
    </DashboardShell>
  );
}
