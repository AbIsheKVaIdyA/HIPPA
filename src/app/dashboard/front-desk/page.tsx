import { DashboardShell } from "@/components/dashboard-shell";
import { FrontDeskWorkspace } from "@/components/patient-cases/front-desk-workspace";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function FrontDeskDashboardPage() {
  return (
    <DashboardShell
      portalLabel="Front desk"
      title="Front desk workspace"
      description="Register new visits and manage the active case list in one place."
      navItems={PORTAL_NAV.front_desk}
    >
      <FrontDeskWorkspace />
    </DashboardShell>
  );
}
