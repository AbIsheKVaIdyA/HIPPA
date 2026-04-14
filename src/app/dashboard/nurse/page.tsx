import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";

export default function NurseDashboardPage() {
  return (
    <DashboardShell
      title="Nursing workspace"
      description="Your assigned cases. Open a row to record vitals and view demographics."
    >
      <div className="rounded-xl border bg-card/50 p-4 text-sm text-muted-foreground">
        Basic patient details and vitals entry only—no health-issue narrative.
      </div>
      <CasesListSection detailBase="/dashboard/nurse/cases" />
    </DashboardShell>
  );
}
