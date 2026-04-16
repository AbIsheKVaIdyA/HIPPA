"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  case_id: string;
  referral_kind: string;
  partner_display_name: string | null;
  expires_at: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
};

export function PartnerReferralInbox() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const res = await fetch("/api/partner-referrals");
      const j = (await res.json()) as { referrals?: Row[]; error?: string };
      if (cancelled) return;
      if (!res.ok) {
        toast.error(j.error ?? "Could not load referrals");
        setRows([]);
      } else {
        setRows(j.referrals ?? []);
      }
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading referrals…</p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-8 py-16 text-center">
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          No referrals yet. When a physician sends you a request, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2 xl:gap-5">
      {rows.map((r) => (
        <li
          key={r.id}
          className="glass-surface flex flex-col gap-4 rounded-2xl border-border/50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-2">
            <p className="text-lg font-semibold tracking-tight">{r.referral_kind}</p>
            <p className="text-xs text-muted-foreground">
              Referral <span className="font-mono">{r.id.slice(0, 8)}…</span> · Case{" "}
              <span className="font-mono">{r.case_id.slice(0, 8)}…</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Access until {new Date(r.expires_at).toLocaleString()}
            </p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {r.status}
            </Badge>
          </div>
          <Link
            href={`/dashboard/partner-hospital/referrals/${r.id}`}
            className={cn(buttonVariants({ size: "default" }), "w-full shrink-0 sm:w-auto")}
          >
            {r.status === "pending" ? "Open & submit" : "View"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
