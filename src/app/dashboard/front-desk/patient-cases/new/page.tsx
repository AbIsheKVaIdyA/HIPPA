import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatientCaseCreateForm } from "@/components/patient-cases/patient-case-create-form";
import { buttonVariants } from "@/components/ui/button";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";

export default function NewPatientCasePage() {
  return (
    <DashboardShell
      portalLabel="Front desk"
      title="New registration"
      description="Create a patient case and intake record. All fields are audited."
      navItems={PORTAL_NAV.front_desk}
    >
      <div className="max-w-3xl space-y-6">
        <Link
          href="/dashboard/front-desk#cases"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}
        >
          ← Workspace
        </Link>
        <PatientCaseCreateForm />
      </div>
    </DashboardShell>
  );
}
