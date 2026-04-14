"use client";

import Link from "next/link";
import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DoctorCasesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">My patient cases</h1>
        <Link
          href="/dashboard/doctor"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Doctor home
        </Link>
      </div>
      <CasesListSection detailBase="/dashboard/doctor/cases" />
    </div>
  );
}
