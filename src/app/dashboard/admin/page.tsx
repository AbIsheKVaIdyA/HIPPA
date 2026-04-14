import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { DashboardShell } from "@/components/dashboard-shell";

export default function AdminDashboardPage() {
  return (
    <DashboardShell title="Administration">
      <div className="grid gap-6">
        <InviteStaffForm />
      </div>
      <AuditLogPanel />
    </DashboardShell>
  );
}
