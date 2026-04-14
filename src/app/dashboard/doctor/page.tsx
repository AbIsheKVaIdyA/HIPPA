import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";

export default function DoctorDashboardPage() {
  return (
    <DashboardShell
      title="Physician workspace"
      description="Your assigned cases. Open a chart to review intake, add visit notes, and attach files in one step."
    >
      <div className="rounded-xl border bg-card/50 p-4 text-sm text-muted-foreground">
        Full clinical view: encrypted intake, nursing vitals, physician notes, and
        secure attachments.
      </div>
      <CasesListSection detailBase="/dashboard/doctor/cases" />
    </DashboardShell>
  );
}
