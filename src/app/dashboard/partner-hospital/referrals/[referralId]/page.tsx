"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Shared = {
  clinicalRequest?: string;
  instructions?: string;
  patientHint?: string;
};

type Detail = {
  id: string;
  case_id: string;
  referral_kind: string;
  partner_display_name: string | null;
  expires_at: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  shared_context: Shared;
  result_text: string | null;
};

export default function PartnerReferralDetailPage() {
  const params = useParams();
  const router = useRouter();
  const referralId = params.referralId as string;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultText, setResultText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const res = await fetch(`/api/partner-referrals/${referralId}`);
      const j = (await res.json()) as { referral?: Detail; error?: string };
      if (cancelled) return;
      if (!res.ok) {
        toast.error(j.error ?? "Could not load referral");
        setData(null);
      } else {
        setData(j.referral ?? null);
        if (j.referral?.result_text) setResultText(j.referral.result_text);
      }
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [referralId]);

  async function submit() {
    if (!resultText.trim()) {
      toast.error("Enter your findings / result.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/partner-referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", result_text: resultText.trim() }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Submit failed");
        return;
      }
      toast.success("Result submitted.");
      router.push("/dashboard/partner-hospital");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell
        portalLabel="Partner hospital"
        title="Referral"
        navItems={PORTAL_NAV.partner}
      >
        <p className="text-sm text-muted-foreground">Loading…</p>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell
        portalLabel="Partner hospital"
        title="Referral"
        navItems={PORTAL_NAV.partner}
      >
        <p className="text-sm text-destructive">Referral not found or access expired.</p>
        <Link href="/dashboard/partner-hospital" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back
        </Link>
      </DashboardShell>
    );
  }

  const sc = data.shared_context ?? {};
  const expired = new Date(data.expires_at) < new Date();

  return (
    <DashboardShell
      portalLabel="Partner hospital"
      title={data.referral_kind}
      description={`Referral ${data.id.slice(0, 8)}… · Case ${data.case_id.slice(0, 8)}…`}
      navItems={PORTAL_NAV.partner}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant={expired ? "destructive" : "secondary"}>
            {expired ? "Expired" : data.status}
          </Badge>
          {!expired ? (
            <span className="text-muted-foreground">
              Access ends {new Date(data.expires_at).toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <h2 className="text-sm font-semibold">What we need</h2>
          <p className="whitespace-pre-wrap text-sm">{sc.clinicalRequest ?? "—"}</p>
          {sc.instructions ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Instructions</p>
              <p className="whitespace-pre-wrap text-sm">{sc.instructions}</p>
            </div>
          ) : null}
          {sc.patientHint ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Patient hint (if provided)</p>
              <p className="text-sm">{sc.patientHint}</p>
            </div>
          ) : null}
        </div>

        {data.status === "submitted" && data.result_text ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Submitted result
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">{data.result_text}</p>
            {data.submitted_at ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(data.submitted_at).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        {data.status === "pending" && !expired ? (
          <div className="space-y-3">
            <Label htmlFor="result">Your result / report</Label>
            <textarea
              id="result"
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              rows={8}
              className={cn(
                "border-input bg-background w-full rounded-lg border px-2 py-2 text-sm",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
              placeholder="Enter findings, measurements, or attach narrative as instructed by the referring physician."
            />
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit result"}
            </Button>
          </div>
        ) : null}

        {expired && data.status === "pending" ? (
          <p className="text-sm text-destructive">
            This referral has expired. You can no longer submit a result.
          </p>
        ) : null}

        <Link
          href="/dashboard/partner-hospital"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ← All referrals
        </Link>
      </div>
    </DashboardShell>
  );
}
