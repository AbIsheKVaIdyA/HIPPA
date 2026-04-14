import { DashboardShell } from "@/components/dashboard-shell";

export default function PartnerHospitalDashboardPage() {
  return (
    <DashboardShell
      title="Partner hospital"
      description="Coordinate referrals and shared episodes with the host organization."
    >
      <div className="glass-surface rounded-2xl border-border/40 p-8 text-sm leading-relaxed text-muted-foreground">
        Placeholder dashboard — extend with BAA-governed data exchange when you
        connect external facilities.
      </div>
    </DashboardShell>
  );
}
