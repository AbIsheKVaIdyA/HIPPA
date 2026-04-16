"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizePhoneDigits } from "@/lib/input-helpers";
import { cn } from "@/lib/utils";

type StaffRow = { id: string; email: string | null; full_name: string };

type SearchMatch = {
  case_id: string;
  patientName: string;
  patientEmail: string;
  created_at: string;
};

export function PatientCaseCreateForm() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<StaffRow[]>([]);
  const [nurses, setNurses] = useState<StaffRow[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [doctorId, setDoctorId] = useState("");
  const [nurseId, setNurseId] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [idProof, setIdProof] = useState("");
  const [healthIssue, setHealthIssue] = useState("");
  const [priorCaseId, setPriorCaseId] = useState<string | null>(null);
  const [invitePatient, setInvitePatient] = useState(true);

  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [dRes, nRes] = await Promise.all([
          fetch("/api/staff-directory?role=doctor"),
          fetch("/api/staff-directory?role=nurse"),
        ]);
        const dJson = (await dRes.json()) as { staff?: StaffRow[]; error?: string };
        const nJson = (await nRes.json()) as { staff?: StaffRow[]; error?: string };
        if (!dRes.ok) throw new Error(dJson.error ?? "Failed to load doctors");
        if (!nRes.ok) throw new Error(nJson.error ?? "Failed to load nurses");
        setDoctors(dJson.staff ?? []);
        setNurses(nJson.staff ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load staff list");
      } finally {
        setLoadingStaff(false);
      }
    }
    void load();
  }, []);

  async function runSearch() {
    if (searchQ.trim().length < 2) {
      toast.error("Type at least 2 characters (name or email).");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/patient-cases/search?q=${encodeURIComponent(searchQ.trim())}`
      );
      const j = (await res.json()) as { matches?: SearchMatch[]; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Search failed");
        setMatches([]);
        return;
      }
      setMatches(j.matches ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function applyReturningPatient(m: SearchMatch) {
    const res = await fetch(`/api/patient-cases/${m.case_id}`);
    const j = (await res.json()) as {
      patient?: {
        legalName: string;
        email: string;
        phone: string;
        dob: string;
        idProof?: string;
      };
      error?: string;
    };
    if (!res.ok || !j.patient) {
      toast.error(j.error ?? "Could not load prior case");
      return;
    }
    setPriorCaseId(m.case_id);
    setLegalName(j.patient.legalName);
    setEmail(j.patient.email);
    setPhone(normalizePhoneDigits(j.patient.phone ?? ""));
    setDob(j.patient.dob);
    setIdProof(j.patient.idProof ?? "");
    setHealthIssue("");
    toast.message(
      "Prefilled from prior visit — update health issue and assignments, then save."
    );
  }

  function clearReturning() {
    setPriorCaseId(null);
    setMatches([]);
    setSearchQ("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorId || !nurseId) {
      toast.error("Choose both a doctor and a nurse.");
      return;
    }
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
      toast.error("Phone must be exactly 10 digits (numbers only), or leave blank.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/patient-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_doctor_id: doctorId,
          assigned_nurse_id: nurseId,
          patient_legal_name: legalName,
          patient_email: email,
          patient_phone: phoneDigits,
          patient_dob: dob,
          patient_id_proof: idProof,
          health_issue: healthIssue,
          prior_case_id: priorCaseId,
          invite_patient: invitePatient,
        }),
      });
      const body = (await res.json()) as {
        case_id?: string;
        invite?: string;
        error?: unknown;
      };
      if (!res.ok) {
        toast.error(
          typeof body.error === "string"
            ? body.error
            : "Could not create case"
        );
        return;
      }
      if (body.invite) {
        toast.success(body.invite);
      } else {
        toast.success("Patient case created.");
      }
      router.push(`/dashboard/front-desk/patient-cases/${body.case_id}`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      id="register-case"
      className="glass-surface rounded-2xl border-border/40 shadow-md shadow-primary/[0.05]"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold tracking-tight">Register patient visit</CardTitle>
        <p className="text-sm text-muted-foreground">
          Phone accepts 10 digits only. Leave blank if not collected.
        </p>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
            <Label className="text-base">Returning patient?</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Name or email contains…"
                value={searchQ}
                onChange={(ev) => setSearchQ(ev.target.value)}
                className="max-w-xs"
              />
              <Button type="button" variant="secondary" onClick={runSearch} disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </Button>
              {priorCaseId ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearReturning}>
                  Clear follow-up link
                </Button>
              ) : null}
            </div>
            {priorCaseId ? (
              <p className="text-xs text-muted-foreground">
                Follow-up linked to prior case{" "}
                <span className="font-mono">{priorCaseId.slice(0, 8)}…</span>
              </p>
            ) : null}
            {matches.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {matches.map((m) => (
                  <li key={m.case_id}>
                    <button
                      type="button"
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-left hover:bg-muted"
                      onClick={() => void applyReturningPatient(m)}
                    >
                      <span className="font-medium">{m.patientName}</span>{" "}
                      <span className="text-muted-foreground">{m.patientEmail}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <input
              id="invite-patient"
              type="checkbox"
              className="size-4 accent-primary"
              checked={invitePatient}
              onChange={(e) => setInvitePatient(e.target.checked)}
            />
            <Label htmlFor="invite-patient" className="cursor-pointer text-sm font-normal">
              Send patient portal invite email automatically after registration
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doctor">Assigned doctor</Label>
              <select
                id="doctor"
                required
                disabled={loadingStaff}
                className={cn(
                  "border-input bg-background h-8 w-full rounded-lg border px-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
                value={doctorId}
                onChange={(ev) => setDoctorId(ev.target.value)}
              >
                <option value="">Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name || d.email || d.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nurse">Assigned nurse</Label>
              <select
                id="nurse"
                required
                disabled={loadingStaff}
                className={cn(
                  "border-input bg-background h-8 w-full rounded-lg border px-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
                value={nurseId}
                onChange={(ev) => setNurseId(ev.target.value)}
              >
                <option value="">Select nurse…</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.full_name || n.email || n.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal">Legal name</Label>
              <Input
                id="legal"
                required
                value={legalName}
                onChange={(ev) => setLegalName(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                required
                type="date"
                value={dob}
                onChange={(ev) => setDob(ev.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="em">Email</Label>
              <Input
                id="em"
                type="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph">Mobile phone (10 digits)</Label>
              <Input
                id="ph"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={phone}
                placeholder="5551234567"
                onChange={(ev) => setPhone(normalizePhoneDigits(ev.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {phone.length}/10 digits · letters and symbols are ignored
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="idp">ID proof (reference / number)</Label>
            <Input
              id="idp"
              value={idProof}
              onChange={(ev) => setIdProof(ev.target.value)}
              placeholder="License or document reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hi">Health issue / reason for visit</Label>
            <textarea
              id="hi"
              required
              rows={4}
              value={healthIssue}
              onChange={(ev) => setHealthIssue(ev.target.value)}
              className={cn(
                "border-input bg-background min-h-[96px] w-full rounded-lg border px-2.5 py-2 text-sm shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
              placeholder="Visible only to the assigned doctor and front desk."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/40">
          <Button type="submit" disabled={submitting || loadingStaff}>
            {submitting ? "Saving…" : "Save visit & notify patient"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
