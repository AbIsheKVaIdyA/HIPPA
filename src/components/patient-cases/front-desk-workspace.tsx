"use client";

import { CasesListSection } from "@/components/patient-cases/cases-list-section";
import { PatientCaseCreateForm } from "@/components/patient-cases/patient-case-create-form";

export function FrontDeskWorkspace() {
  return (
    <div className="space-y-10">
      <section className="space-y-4" id="cases">
        <div className="border-b border-border/40 pb-4">
          <h2 className="text-lg font-semibold tracking-tight">Case list</h2>
        </div>
        <CasesListSection detailBase="/dashboard/front-desk/patient-cases" />
      </section>
      <section className="space-y-4" id="register">
        <div className="border-b border-border/40 pb-4">
          <h2 className="text-lg font-semibold tracking-tight">New registration</h2>
        </div>
        <PatientCaseCreateForm />
      </section>
    </div>
  );
}
