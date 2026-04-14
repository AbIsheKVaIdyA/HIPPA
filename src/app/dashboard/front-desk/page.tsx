import { DashboardShell } from "@/components/dashboard-shell";
import { FrontDeskWorkspace } from "@/components/patient-cases/front-desk-workspace";

export default function FrontDeskDashboardPage() {
  return (
    <DashboardShell title="Front desk">
      <FrontDeskWorkspace />
    </DashboardShell>
  );
}
