import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function NurseDashboardPage() {
  return (
    <DashboardShell
      portalLabel="Nursing"
      title="Nursing workspace"
      description="Review assigned cases, capture vitals, and support the care team."
      navItems={PORTAL_NAV.nurse}
    >
      <CasesListSection detailBase="/dashboard/nurse/cases" />
    </DashboardShell>
  );
}
