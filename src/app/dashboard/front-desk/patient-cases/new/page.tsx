import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PatientCaseCreateForm } from "@/components/patient-cases/patient-case-create-form";
import { cn } from "@/lib/utils";

export default function NewPatientCasePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href="/dashboard/front-desk#cases"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}
      >
        ← Front desk
      </Link>
      <PatientCaseCreateForm />
    </div>
  );
}
