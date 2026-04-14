import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";

export default function DoctorDashboardPage() {
  return (
    <DashboardShell title="Physician workspace">
      <CasesListSection detailBase="/dashboard/doctor/cases" />
    </DashboardShell>
  );
}
