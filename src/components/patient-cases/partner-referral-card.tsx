"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type PartnerRow = { id: string; email: string | null; full_name: string };

type ReferralRow = {
  id: string;
  partner_user_id: string;
  partner_display_name: string | null;
  referral_kind: string;
  expires_at: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  /** Decrypted partner submission; present when status is submitted (doctor list API). */
  result_text?: string | null;
};

export function PartnerReferralCard({ caseId }: { caseId: string }) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [kind, setKind] = useState("ECG / external study");
  const [clinicalRequest, setClinicalRequest] = useState("");
  const [instructions, setInstructions] = useState("");
  const [patientHint, setPatientHint] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch("/api/staff-directory?role=third_party_hospital"),
        fetch(`/api/partner-referrals?case_id=${encodeURIComponent(caseId)}`),
      ]);
      const pj = (await pRes.json()) as { staff?: PartnerRow[]; error?: string };
      const rj = (await rRes.json()) as { referrals?: ReferralRow[]; error?: string };
      if (!pRes.ok) toast.error(pj.error ?? "Could not load partner hospitals");
      else setPartners(pj.staff ?? []);
      if (!rRes.ok) toast.error(rj.error ?? "Could not load referrals");
      else setReferrals(rj.referrals ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  async function sendReferral() {
    if (!partnerId) {
      toast.error("Choose a partner hospital contact.");
      return;
    }
    if (!clinicalRequest.trim()) {
      toast.error("Describe what the partner needs to do (clinical request).");
      return;
    }
    const partner = partners.find((p) => p.id === partnerId);
    setSending(true);
    try {
      const res = await fetch("/api/partner-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          partner_user_id: partnerId,
          referral_kind: kind.trim() || "External study / service",
          partner_display_name: partner?.full_name?.trim() || partner?.email || "",
          shared_context: {
            clinicalRequest: clinicalRequest.trim(),
            instructions: instructions.trim() || undefined,
            patientHint: patientHint.trim() || undefined,
          },
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Could not create referral");
        return;
      }
      toast.success("Referral sent. The partner can see only what you entered above for 3 days.");
      setClinicalRequest("");
      setInstructions("");
      setPatientHint("");
      await load();
    } finally {
      setSending(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/partner-referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(j.error ?? "Could not revoke");
      return;
    }
    toast.success("Referral revoked.");
    await load();
  }

  return (
    <Card className="glass-surface rounded-2xl border-border/40 shadow-md shadow-primary/[0.04]">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-xl font-semibold tracking-tight">Partner hospital referral</CardTitle>
        <CardDescription>
          Share only what the partner needs (e.g. ECG request). Nothing from the chart is sent
          automatically—only the fields below. Access expires 3 days after you send. All actions are
          audited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
          <div className="space-y-2">
            <Label htmlFor="partner-pick">Partner hospital user</Label>
            <select
              id="partner-pick"
              className={cn(
                "border-input bg-background h-9 w-full rounded-lg border px-2 text-sm",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              disabled={loading || partners.length === 0}
            >
              <option value="">{loading ? "Loading…" : "Select contact"}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id}
                </option>
              ))}
            </select>
            {partners.length === 0 && !loading ? (
              <p className="text-xs text-muted-foreground">
                No partner hospital accounts yet. An admin can invite staff with the partner hospital
                role.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-kind">Service type (short label)</Label>
            <Input
              id="ref-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="e.g. ECG, imaging"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-clinical">Clinical request (required)</Label>
            <textarea
              id="ref-clinical"
              value={clinicalRequest}
              onChange={(e) => setClinicalRequest(e.target.value)}
              rows={4}
              className={cn(
                "border-input bg-background w-full rounded-lg border px-2 py-2 text-sm",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
              placeholder="What should the partner do? Include only necessary clinical context."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-inst">Logistics / instructions (optional)</Label>
            <textarea
              id="ref-inst"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              className={cn(
                "border-input bg-background w-full rounded-lg border px-2 py-2 text-sm",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-hint">Patient hint (optional, de-identified)</Label>
            <Input
              id="ref-hint"
              value={patientHint}
              onChange={(e) => setPatientHint(e.target.value)}
              placeholder="e.g. initials + year of birth — only if needed for matching"
            />
          </div>
          <Button type="button" onClick={sendReferral} disabled={sending}>
            {sending ? "Sending…" : "Send referral"}
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-tight">Sent referrals</p>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet for this case.</p>
          ) : (
            <ul className="space-y-4">
              {referrals.map((r) => (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{r.referral_kind}</span>
                        {r.partner_display_name ? (
                          <span className="text-sm text-muted-foreground">
                            → {r.partner_display_name}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Access until {new Date(r.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={r.status === "submitted" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {r.status === "submitted" ? (
                          <span className="inline-flex items-center gap-1">
                            <ClipboardCheck className="size-3.5" />
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Send className="size-3.5" />
                            {r.status}
                          </span>
                        )}
                      </Badge>
                      {r.status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => revoke(r.id)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {r.status === "submitted" && r.result_text ? (
                    <div className="space-y-2 bg-gradient-to-br from-primary/[0.06] to-transparent px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Third-party report
                      </p>
                      {r.submitted_at ? (
                        <p className="text-xs text-muted-foreground">
                          Received {new Date(r.submitted_at).toLocaleString()}
                        </p>
                      ) : null}
                      <div className="rounded-xl border border-primary/20 bg-background/80 px-4 py-3 text-sm leading-relaxed shadow-inner">
                        <p className="whitespace-pre-wrap text-foreground">{r.result_text}</p>
                      </div>
                    </div>
                  ) : r.status === "submitted" && !r.result_text ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground">
                      Submitted — result could not be displayed. Contact support if this persists.
                    </div>
                  ) : (
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                      Awaiting partner response before access expires.
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
