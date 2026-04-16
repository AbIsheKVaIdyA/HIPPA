"use client";

import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { PatientCaseCreateForm } from "@/components/patient-cases/patient-case-create-form";

export function FrontDeskWorkspace() {
  return (
    <div className="grid gap-12 xl:grid-cols-2 xl:items-start xl:gap-14">
      <section className="space-y-5" id="cases">
        <div className="border-b border-border/50 pb-4">
          <h2 className="page-section-title">Case list</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and open cases registered at this desk.
          </p>
        </div>
        <CasesListSection
          detailBase="/dashboard/front-desk/patient-cases"
          layout="table"
        />
      </section>
      <section className="space-y-5" id="register">
        <div className="border-b border-border/50 pb-4">
          <h2 className="page-section-title">New registration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Intake a new patient visit and assign the care team.
          </p>
        </div>
        <PatientCaseCreateForm />
      </section>
    </div>
  );
}
