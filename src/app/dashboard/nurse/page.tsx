import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";

export default function NurseDashboardPage() {
  return (
    <DashboardShell title="Nursing workspace">
      <CasesListSection detailBase="/dashboard/nurse/cases" />
    </DashboardShell>
  );
}
