import { DashboardShell } from "@/components/dashboard-shell";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function DoctorDashboardPage() {
  return (
    <DashboardShell
      portalLabel="Physician"
      title="Physician workspace"
      description="Open a patient case to document visits, review vitals, and coordinate partner referrals."
      navItems={PORTAL_NAV.doctor}
    >
      <CasesListSection detailBase="/dashboard/doctor/cases" />
    </DashboardShell>
  );
}
