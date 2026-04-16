import { DashboardShell } from "@/components/dashboard-shell";
import { PartnerReferralInbox } from "@/components/partner-hospital/partner-referral-inbox";
import { PORTAL_NAV } from "@/lib/portal-nav";

export default function PartnerHospitalDashboardPage() {
  return (
    <DashboardShell
      portalLabel="Partner hospital"
      title="Referral inbox"
      description="Referrals from CarePort physicians. You only see what was explicitly shared. Each referral is available for three days—submit results before access expires."
      navItems={PORTAL_NAV.partner}
    >
      <div className="space-y-8">
        <PartnerReferralInbox />
        <p className="text-sm text-muted-foreground">
          Need help? Contact your CarePort administrator.
        </p>
      </div>
    </DashboardShell>
  );
}
