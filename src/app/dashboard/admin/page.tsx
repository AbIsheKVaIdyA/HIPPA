import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { DashboardShell } from "@/components/dashboard-shell";

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      title="Administration"
      description="Staff invites, security audit log, and organization controls."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <InviteStaffForm />
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground backdrop-blur-sm">
          <p className="font-medium text-foreground">RBAC reminder</p>
          <p className="mt-2 leading-relaxed">
            Invites for doctor, nurse, and front desk are identical: secure email,
            set password, then only that role&apos;s dashboard. The staff invite
            API writes role into Auth metadata; the trigger mirrors it into{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">profiles</code>{" "}
            so portals stay isolated.
          </p>
        </div>
      </div>
      <AuditLogPanel />
    </DashboardShell>
  );
}
