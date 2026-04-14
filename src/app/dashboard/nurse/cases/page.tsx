"use client";

import Link from "next/link";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NurseCasesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">My patient cases</h1>
          <p className="text-sm text-muted-foreground">
            Basic demographics and vitals only—no diagnosis text.
          </p>
        </div>
        <Link
          href="/dashboard/nurse"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Nurse home
        </Link>
      </div>
      <CasesListSection detailBase="/dashboard/nurse/cases" />
    </div>
  );
}
