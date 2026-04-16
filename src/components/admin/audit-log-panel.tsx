"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
};

export function AuditLogPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 40;

  const load = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/admin/audit-log?limit=${limit}&offset=${nextOffset}`
      );
      const j = (await res.json()) as {
        rows?: AuditRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(j.error ?? "Could not load audit log");
        setLoading(false);
        return;
      }
      const nextRows = j.rows ?? [];
      setTotal(j.total ?? 0);
      setRows((prev) => (append ? [...prev, ...nextRows] : nextRows));
      setLoading(false);
    },
    [limit]
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  const hasMore = rows.length < total;

  return (
    <Card className="glass-surface rounded-2xl border-border/40 shadow-md shadow-primary/[0.04]">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold tracking-tight">Audit log</CardTitle>
        <p className="text-sm text-muted-foreground">
          Recent PHI-related actions across the system. Use for compliance review.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <div className="rounded-xl border border-border/50 bg-card/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Time
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Action
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actor
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resource
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  IP
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] align-top font-mono text-xs">
                      {r.action}
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top text-xs">
                      <div className="truncate text-foreground">
                        {r.actor_email ?? "—"}
                      </div>
                      {r.actor_role ? (
                        <Badge variant="outline" className="mt-1 text-[0.65rem] capitalize">
                          {r.actor_role.replace("_", " ")}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[180px] align-top text-xs text-muted-foreground">
                      {r.resource_type ? (
                        <span className="font-mono">{r.resource_type}</span>
                      ) : (
                        "—"
                      )}
                      {r.resource_id ? (
                        <div className="mt-0.5 truncate font-mono text-[0.65rem]">
                          {r.resource_id}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={r.status === "success" ? "secondary" : "destructive"}
                        className="text-[0.65rem] capitalize"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate align-top font-mono text-xs text-muted-foreground">
                      {r.ip_address ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <details className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">
            Raw details (per row)
          </summary>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto font-mono text-[0.65rem] text-muted-foreground">
            {rows.map((r) => (
              <li key={`d-${r.id}`}>
                <span className="text-foreground">{r.action}</span> ·{" "}
                {JSON.stringify(r.details ?? {})}
              </li>
            ))}
          </ul>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {rows.length} of {total}
          </span>
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void load(rows.length, true)}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
