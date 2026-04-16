"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  sanitizeBpPart,
  sanitizeDigits,
  sanitizeVitalDecimal,
} from "@/lib/input-helpers";
import { vitalsPayloadSchema } from "@/lib/validators/patient-case";
import { PartnerReferralCard } from "@/components/patient-cases/partner-referral-card";

type CaseCore = {
  id: string;
  status: string;
  created_at: string;
  assigned_doctor_id: string;
  assigned_nurse_id: string;
  patient_email_norm?: string | null;
  prior_case_id?: string | null;
};

type VitalsRow = {
  id: string;
  submitted_by: string;
  created_at: string;
  payload: Record<string, string>;
};

type NoteRow = {
  id: string;
  author_id: string;
  author_name: string;
  created_at: string;
  body: string;
};

type ClinicalScope = {
  scope: "clinical_team" | "patient_portal";
  case: CaseCore;
  patient: {
    legalName: string;
    email: string;
    phone: string;
    dob: string;
    idProof: string;
  };
  healthIssue: string | null;
  vitals: VitalsRow[];
  notes: NoteRow[];
  files: {
    id: string;
    storage_path: string;
    original_name: string;
    content_type: string | null;
    created_at: string;
  }[];
  assignedDoctorName?: string;
};

type DetailResponse =
  | {
      scope: "nurse_basic";
      case: CaseCore;
      patient: {
        legalName: string;
        email: string;
        phone: string;
        dob: string;
      };
      vitals: VitalsRow[];
    }
  | ClinicalScope;

function VitalsHistoryCard({
  title,
  vitals,
}: {
  title: string;
  vitals: VitalsRow[];
}) {
  if (vitals.length === 0) return null;
  return (
    <Card className="glass-surface rounded-2xl border-primary/15 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vitals.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-border/60 bg-muted/25 p-4 text-sm shadow-sm"
          >
            <p className="text-xs text-muted-foreground">
              {new Date(v.created_at).toLocaleString()}
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(v.payload).map(([k, val]) =>
                val && k !== "recordedAt" ? (
                  <li key={k}>
                    <span className="text-muted-foreground">{k}: </span>
                    {val}
                  </li>
                ) : null
              )}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PatientCaseDetailView({
  caseId,
  backHref,
  role,
}: {
  caseId: string;
  backHref: string;
  role: "front_desk" | "doctor" | "nurse" | "patient";
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitNote, setVisitNote] = useState("");
  const [visitFile, setVisitFile] = useState<File | null>(null);
  const [visitSaving, setVisitSaving] = useState(false);

  const [vTemp, setVTemp] = useState("");
  const [vHeight, setVHeight] = useState("");
  const [vWeight, setVWeight] = useState("");
  const [vBpSys, setVBpSys] = useState("");
  const [vBpDia, setVBpDia] = useState("");
  const [vHr, setVHr] = useState("");
  const [vSpo2, setVSpo2] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [savingVitals, setSavingVitals] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/patient-cases/${caseId}`);
    const json = (await res.json()) as DetailResponse & { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Could not load case");
      setData(null);
      return;
    }
    setData(json as DetailResponse);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const res = await fetch(`/api/patient-cases/${caseId}`);
      const json = (await res.json()) as DetailResponse & { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        toast.error(json.error ?? "Could not load case");
        setData(null);
      } else {
        setData(json as DetailResponse);
      }
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function submitVisitUpdate() {
    if (!visitNote.trim() && !visitFile) {
      toast.error("Add a note and/or choose a file to upload.");
      return;
    }
    setVisitSaving(true);
    try {
      const fd = new FormData();
      if (visitNote.trim()) fd.set("note", visitNote.trim());
      if (visitFile) fd.set("file", visitFile);
      const res = await fetch(
        `/api/patient-cases/${caseId}/visit-update`,
        { method: "POST", body: fd }
      );
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Update failed");
        return;
      }
      toast.success("Visit details updated.");
      setVisitNote("");
      setVisitFile(null);
      await refresh();
    } finally {
      setVisitSaving(false);
    }
  }

  async function submitVitals() {
    const sys = vBpSys.trim();
    const dia = vBpDia.trim();
    let blood_pressure = "";
    if (sys || dia) {
      if (!sys || !dia) {
        toast.error("Enter both systolic and diastolic for blood pressure (e.g. 120 and 80).");
        return;
      }
      blood_pressure = `${sys}/${dia}`;
    }

    const payload = {
      temperature_c: vTemp,
      height_cm: vHeight,
      weight_kg: vWeight,
      blood_pressure,
      heart_rate_bpm: vHr,
      spo2_pct: vSpo2,
      notes: vNotes,
    };

    const parsed = vitalsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fromFields = Object.values(flat.fieldErrors).flat().filter(Boolean);
      const msg = fromFields[0] ?? flat.formErrors[0] ?? "Check vital sign values.";
      toast.error(msg);
      return;
    }

    setSavingVitals(true);
    try {
      const res = await fetch(`/api/patient-cases/${caseId}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const j = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        const err = j.error;
        if (err && typeof err === "object" && !Array.isArray(err)) {
          const msgs = Object.values(err as Record<string, string[]>).flat();
          toast.error(msgs[0] ?? "Failed to save vitals");
        } else {
          toast.error(typeof err === "string" ? err : "Failed to save vitals");
        }
        return;
      }
      toast.success("Vitals submitted to the care team.");
      setVTemp("");
      setVHeight("");
      setVWeight("");
      setVBpSys("");
      setVBpDia("");
      setVHr("");
      setVSpo2("");
      setVNotes("");
      await refresh();
    } finally {
      setSavingVitals(false);
    }
  }

  async function openSigned(fileId: string) {
    const res = await fetch(
      `/api/patient-cases/${caseId}/attachments/${fileId}`
    );
    const j = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !j.url) {
      toast.error(j.error ?? "Could not open file");
      return;
    }
    window.open(j.url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <span className="inline-flex size-6 animate-pulse rounded-full bg-primary/35" />
        Loading case…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-destructive">
        Case unavailable.{" "}
        <Link href={backHref} className="underline">
          Back
        </Link>
      </p>
    );
  }

  const clinical =
    data.scope === "clinical_team" || data.scope === "patient_portal"
      ? data
      : null;
  const readOnlyPatient = role === "patient" && data.scope === "patient_portal";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← All cases
        </Link>
        <Badge variant="secondary" className="px-3 py-1 text-xs capitalize">
          {data.case.status}
        </Badge>
      </div>

      {clinical?.assignedDoctorName ? (
        <p className="text-sm text-muted-foreground">
          Assigned physician:{" "}
          <span className="font-medium text-foreground">
            {clinical.assignedDoctorName}
          </span>
        </p>
      ) : null}

      <Card className="glass-surface border-border/40 shadow-md shadow-primary/[0.04]">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold tracking-tight">Patient</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:gap-5 lg:text-base">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{data.patient.legalName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">DOB</p>
            <p className="font-medium">{data.patient.dob}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{data.patient.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{data.patient.phone || "—"}</p>
          </div>
          {clinical ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">ID proof</p>
              <p className="font-medium">{clinical.patient.idProof || "—"}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {clinical && clinical.healthIssue ? (
        <Card className="glass-surface border-border/40">
          <CardHeader>
            <CardTitle className="text-lg">Health issue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {clinical.healthIssue}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {role === "doctor" && data.scope === "clinical_team" ? (
        <PartnerReferralCard caseId={caseId} />
      ) : null}

      {data.scope === "nurse_basic" && data.vitals.length > 0 ? (
        <VitalsHistoryCard title="Vitals history" vitals={data.vitals} />
      ) : null}

      {clinical && clinical.vitals.length > 0 ? (
        <VitalsHistoryCard title="Vitals history" vitals={clinical.vitals} />
      ) : null}

      {role === "nurse" && data.scope === "nurse_basic" ? (
        <Card className="glass-surface overflow-hidden rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-md shadow-primary/[0.06]">
          <CardHeader className="border-b border-primary/15 bg-primary/[0.06] pb-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Activity className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-xl font-semibold tracking-tight">Vital signs</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter measurements in typical clinical ranges. Blood pressure uses systolic / diastolic
                  (e.g. 120/80). At least one field or a note is required.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="v-temp">Temperature (°C)</Label>
              <Input
                id="v-temp"
                inputMode="decimal"
                value={vTemp}
                placeholder="36.5"
                onChange={(e) => setVTemp(sanitizeVitalDecimal(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Typical oral/tympanic ~32–43°C</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-hr">Heart rate (bpm)</Label>
              <Input
                id="v-hr"
                inputMode="numeric"
                value={vHr}
                placeholder="72"
                onChange={(e) => setVHr(sanitizeDigits(e.target.value, 3))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-h">Height (cm)</Label>
              <Input
                id="v-h"
                inputMode="numeric"
                value={vHeight}
                placeholder="170"
                onChange={(e) => setVHeight(sanitizeDigits(e.target.value, 3))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-w">Weight (kg)</Label>
              <Input
                id="v-w"
                inputMode="decimal"
                value={vWeight}
                placeholder="70"
                onChange={(e) => setVWeight(sanitizeVitalDecimal(e.target.value, 6))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Blood pressure (mmHg)</Label>
              <div className="mt-1 flex max-w-sm flex-wrap items-center gap-2 sm:gap-3">
                <Input
                  className="max-w-[5.5rem] text-center font-mono text-base tracking-tight"
                  inputMode="numeric"
                  value={vBpSys}
                  placeholder="120"
                  aria-label="Systolic blood pressure"
                  onChange={(e) => setVBpSys(sanitizeBpPart(e.target.value))}
                />
                <span className="select-none text-xl font-extralight text-muted-foreground">/</span>
                <Input
                  className="max-w-[5.5rem] text-center font-mono text-base tracking-tight"
                  inputMode="numeric"
                  value={vBpDia}
                  placeholder="80"
                  aria-label="Diastolic blood pressure"
                  onChange={(e) => setVBpDia(sanitizeBpPart(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">Systolic / diastolic</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-spo2">SpO₂ (%)</Label>
              <Input
                id="v-spo2"
                inputMode="numeric"
                value={vSpo2}
                placeholder="98"
                onChange={(e) => setVSpo2(sanitizeDigits(e.target.value, 3))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-notes">Notes</Label>
              <textarea
                id="v-notes"
                value={vNotes}
                onChange={(e) => setVNotes(e.target.value)}
                rows={3}
                className={cn(
                  "border-input bg-background min-h-[88px] w-full rounded-lg border px-3 py-2 text-sm",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
                placeholder="Position, symptoms, device issues…"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" size="lg" onClick={submitVitals} disabled={savingVitals}>
                {savingVitals ? "Saving…" : "Submit vitals"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {role === "doctor" && data.scope === "clinical_team" && clinical ? (
        <>
          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Clinical notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clinical.notes.map((n) => (
                <div key={n.id} className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {n.author_name} · {new Date(n.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Update visit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visit-note">Clinical note (optional)</Label>
                <textarea
                  id="visit-note"
                  value={visitNote}
                  onChange={(e) => setVisitNote(e.target.value)}
                  rows={4}
                  className={cn(
                    "border-input bg-background w-full rounded-lg border px-2 py-2 text-sm",
                    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-file">Attachment (optional)</Label>
                <Input
                  id="visit-file"
                  type="file"
                  onChange={(e) =>
                    setVisitFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <Button
                type="button"
                onClick={submitVisitUpdate}
                disabled={visitSaving}
              >
                {visitSaving ? "Saving…" : "Save visit update"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Files on record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinical.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              ) : (
                clinical.files.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{f.original_name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openSigned(f.id)}
                    >
                      Open
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {readOnlyPatient && clinical ? (
        <>
          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Physician notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clinical.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                clinical.notes.map((n) => (
                  <div key={n.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      {n.author_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinical.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files yet.</p>
              ) : (
                clinical.files.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{f.original_name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openSigned(f.id)}
                    >
                      Open
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {role === "front_desk" && data.scope === "clinical_team" && clinical ? (
        <>
          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Clinical notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clinical.notes.map((n) => (
                <div key={n.id} className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {n.author_name} · {new Date(n.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
              {clinical.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-surface border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinical.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files yet.</p>
              ) : (
                clinical.files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span>{f.original_name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openSigned(f.id)}
                    >
                      Open
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
