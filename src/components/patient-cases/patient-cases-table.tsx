"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type CaseListRow = {
  id: string;
  status: string;
  created_at: string;
  patient_email_norm?: string | null;
  prior_case_id?: string | null;
  patientName?: string;
};

export function PatientCasesTable({
  cases,
  detailBase,
}: {
  cases: CaseListRow[];
  detailBase: string;
}) {
  if (cases.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground backdrop-blur-sm">
        No cases yet.
      </p>
    );
  }

  return (
    <div className="glass-surface overflow-hidden rounded-2xl p-0">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 bg-muted/35 hover:bg-transparent dark:bg-muted/20">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Patient
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact email
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visit
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Opened
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer transition-colors hover:bg-primary/[0.04]"
            >
              <TableCell className="font-medium">
                <Link
                  href={`${detailBase}/${c.id}`}
                  className="text-primary hover:underline"
                >
                  {c.patientName ?? "—"}
                </Link>
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                {c.patient_email_norm ?? "—"}
              </TableCell>
              <TableCell>
                {c.prior_case_id ? (
                  <Badge variant="outline">Follow-up</Badge>
                ) : (
                  <Badge variant="secondary">New</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-xs">
                {new Date(c.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
