import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      portalLabel="Administration"
      title="Administration"
      description="Invite staff, assign roles, and review PHI access audit events."
      navItems={PORTAL_NAV.admin}
    >
      <div className="flex flex-col gap-12 lg:gap-16">
        <InviteStaffForm />
        <AuditLogPanel />
      </div>
    </DashboardShell>
  );
}
