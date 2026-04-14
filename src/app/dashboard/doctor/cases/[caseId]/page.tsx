"use client";

import { useParams } from "next/navigation";
import { PatientCaseDetailView } from "@/components/patient-cases/patient-case-detail-view";

export default function DoctorCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PatientCaseDetailView
        caseId={caseId}
        backHref="/dashboard/doctor/cases"
        role="doctor"
      />
    </div>
  );
}
