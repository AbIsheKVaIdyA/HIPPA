"use client";

import { useEffect, useState } from "react";
import { PatientCasesTable, type CaseListRow } from "@/components/patient-cases/patient-cases-table";

export function CasesListSection({
  detailBase,
}: {
  detailBase: string;
}) {
  const [cases, setCases] = useState<CaseListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/patient-cases");
      const j = (await res.json()) as { cases?: CaseListRow[] };
      if (res.ok) setCases(j.cases ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-14 text-sm text-muted-foreground backdrop-blur-sm">
        <span className="inline-flex size-6 animate-pulse rounded-full bg-primary/35" />
        Loading cases…
      </div>
    );
  }

  return <PatientCasesTable cases={cases} detailBase={detailBase} />;
}
