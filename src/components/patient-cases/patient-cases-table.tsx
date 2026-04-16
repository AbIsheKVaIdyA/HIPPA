"use client";

import Link from "next/link";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { initialsFromName } from "@/lib/input-helpers";
import { cn } from "@/lib/utils";

export type CaseListRow = {
  id: string;
  status: string;
  created_at: string;
  patient_email_norm?: string | null;
  prior_case_id?: string | null;
  patientName?: string;
};

function formatRelativeOpened(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function PatientCasesTable({
  cases,
  detailBase,
  layout = "cards",
}: {
  cases: CaseListRow[];
  detailBase: string;
  /** `cards`: richer layout for clinical roles; `table`: compact for front desk. */
  layout?: "table" | "cards";
}) {
  if (cases.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground backdrop-blur-sm">
        No cases yet.
      </p>
    );
  }

  if (layout === "cards") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => {
          const isReturn = Boolean(c.prior_case_id);
          const name = c.patientName ?? "—";
          const initials = initialsFromName(name);
          return (
            <Link
              key={c.id}
              href={`${detailBase}/${c.id}`}
              className={cn(
                "group glass-surface relative block overflow-hidden rounded-2xl border-border/60 p-5 shadow-md shadow-primary/[0.04] transition-all",
                "hover:border-primary/35 hover:shadow-lg hover:shadow-primary/[0.08]"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold tracking-tight",
                    isReturn
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      : "bg-primary/12 text-primary"
                  )}
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground group-hover:text-primary">
                      {name}
                    </span>
                    {isReturn ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                      >
                        <RefreshCw className="size-3" />
                        Return visit
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-primary/90 text-primary-foreground">
                        <Sparkles className="size-3" />
                        First visit
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.patient_email_norm ?? "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="capitalize">
                      {c.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      Opened {formatRelativeOpened(c.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="glass-surface overflow-hidden rounded-2xl p-0 shadow-md shadow-primary/[0.03]">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 bg-muted/35 hover:bg-transparent dark:bg-muted/20">
            <TableHead className="h-12 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:px-5">
              Patient
            </TableHead>
            <TableHead className="h-12 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:px-5">
              Contact email
            </TableHead>
            <TableHead className="h-12 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:px-5">
              Visit
            </TableHead>
            <TableHead className="h-12 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:px-5">
              Status
            </TableHead>
            <TableHead className="h-12 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:px-5">
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
              <TableCell className="px-4 py-4 font-medium lg:px-5">
                <Link
                  href={`${detailBase}/${c.id}`}
                  className="text-primary hover:underline"
                >
                  {c.patientName ?? "—"}
                </Link>
              </TableCell>
              <TableCell className="max-w-[220px] truncate px-4 py-4 text-muted-foreground text-xs lg:px-5 lg:text-sm">
                {c.patient_email_norm ?? "—"}
              </TableCell>
              <TableCell className="px-4 py-4 lg:px-5">
                {c.prior_case_id ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                  >
                    Return
                  </Badge>
                ) : (
                  <Badge variant="secondary">New</Badge>
                )}
              </TableCell>
              <TableCell className="px-4 py-4 lg:px-5">
                <Badge variant="outline" className="capitalize">
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-4 text-right text-muted-foreground text-xs lg:px-5 lg:text-sm">
                {new Date(c.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
