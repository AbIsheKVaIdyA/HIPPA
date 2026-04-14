"use client";

import { useParams } from "next/navigation";
import { PatientCaseDetailView } from "@/components/patient-cases/patient-case-detail-view";

export default function NurseCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PatientCaseDetailView
        caseId={caseId}
        backHref="/dashboard/nurse/cases"
        role="nurse"
      />
    </div>
  );
}
