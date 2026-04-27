import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import {
  decryptPatientField,
  decryptPatientJson,
} from "@/lib/crypto/patient-data";
import { getRequesterProfile } from "@/lib/patient-cases/access";

export const runtime = "nodejs";

type TimelineEvent = {
  at: string;
  kind: string;
  title: string;
  detail?: string;
  meta?: Record<string, string>;
};

export async function GET(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "patient") {
    await auditPhi(request, me, {
      action: "patient.my_care",
      status: "failure",
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", me.userId)
    .maybeSingle();

  const emailNorm = profile?.email?.trim().toLowerCase();
  if (!emailNorm) {
    await auditPhi(request, me, {
      action: "patient.my_care",
      status: "failure",
      details: { reason: "profile_email_missing" },
    });
    return NextResponse.json({ error: "Profile email missing" }, { status: 400 });
  }

  const { data: cases, error } = await supabase
    .from("patient_case_core")
    .select(
      "id, created_at, status, patient_email_norm, prior_case_id, assigned_doctor_id"
    )
    .eq("patient_email_norm", emailNorm)
    .order("created_at", { ascending: false });

  if (error) {
    await auditPhi(request, me, {
      action: "patient.my_care",
      status: "failure",
      details: { reason: "query_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const timeline: TimelineEvent[] = [];
  const visits: {
    caseId: string;
    createdAt: string;
    isFollowUp: boolean;
    healthIssue: string | null;
    doctorName: string;
    referrals: {
      kind: string;
      partnerName: string | null;
      status: string;
      createdAt: string;
      submittedAt: string | null;
    }[];
    vitals: { at: string; payload: Record<string, string> }[];
    notes: { at: string; authorName: string; body: string }[];
    files: { id: string; name: string; at: string }[];
  }[] = [];

  for (const c of cases ?? []) {
    const caseId = c.id as string;
    const { data: doc } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", c.assigned_doctor_id as string)
      .maybeSingle();
    const doctorName = doc?.full_name ?? "Your physician";

    const { data: clin } = await supabase
      .from("patient_case_clinical")
      .select("health_issue_enc")
      .eq("case_id", caseId)
      .maybeSingle();

    let healthIssue: string | null = null;
    if (clin?.health_issue_enc) {
      try {
        healthIssue = decryptPatientField(clin.health_issue_enc as string);
      } catch {
        healthIssue = null;
      }
    }

    timeline.push({
      at: c.created_at as string,
      kind: "visit",
      title: c.prior_case_id ? "Follow-up visit" : "Visit opened",
      detail: healthIssue ?? undefined,
    });

    const { data: vitalsRows } = await supabase
      .from("patient_case_vitals")
      .select("vitals_payload_enc, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    const { data: referralRows } = await supabase
      .from("partner_referral")
      .select(
        "referral_kind, partner_display_name, status, created_at, submitted_at"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    const referralsOut = (referralRows ?? []).map((r) => {
      const item = {
        kind: (r.referral_kind as string) ?? "Partner referral",
        partnerName: (r.partner_display_name as string | null) ?? null,
        status: (r.status as string) ?? "pending",
        createdAt: r.created_at as string,
        submittedAt: (r.submitted_at as string | null) ?? null,
      };
      timeline.push({
        at: item.createdAt,
        kind: "referral",
        title: item.partnerName
          ? `Referred to ${item.partnerName}`
          : "Referred to partner hospital",
        detail: `${item.kind} · ${item.status}`,
      });
      if (item.submittedAt) {
        timeline.push({
          at: item.submittedAt,
          kind: "referral_result",
          title: item.partnerName
            ? `Result received from ${item.partnerName}`
            : "Result received from partner hospital",
          detail: item.kind,
        });
      }
      return item;
    });

    const vitalsOut: { at: string; payload: Record<string, string> }[] = [];
    for (const v of vitalsRows ?? []) {
      try {
        const payload = decryptPatientJson<Record<string, string>>(
          v.vitals_payload_enc as string
        );
        const at = v.created_at as string;
        vitalsOut.push({ at, payload });
        timeline.push({
          at,
          kind: "vitals",
          title: "Vitals updated",
          meta: payload,
        });
      } catch {
        /* skip */
      }
    }

    const { data: noteRows } = await supabase
      .from("patient_case_notes")
      .select("id, author_id, body_enc, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    const notesOut: { at: string; authorName: string; body: string }[] = [];
    for (const n of noteRows ?? []) {
      try {
        const body = decryptPatientField(n.body_enc as string);
        const at = n.created_at as string;
        const { data: au } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", n.author_id as string)
          .maybeSingle();
        const authorName = au?.full_name ?? "Physician";
        notesOut.push({ at, authorName, body });
        timeline.push({
          at,
          kind: "note",
          title: `Note from ${authorName}`,
          detail: body,
        });
      } catch {
        /* skip */
      }
    }

    const { data: fileRows } = await supabase
      .from("patient_case_files")
      .select("id, original_name, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    const filesOut: { id: string; name: string; at: string }[] = [];
    for (const f of fileRows ?? []) {
      const at = f.created_at as string;
      filesOut.push({
        id: f.id as string,
        name: f.original_name as string,
        at,
      });
      timeline.push({
        at,
        kind: "file",
        title: `File: ${f.original_name}`,
      });
    }

    visits.push({
      caseId,
      createdAt: c.created_at as string,
      isFollowUp: Boolean(c.prior_case_id),
      healthIssue,
      doctorName,
      referrals: referralsOut,
      vitals: vitalsOut,
      notes: notesOut,
      files: filesOut,
    });
  }

  timeline.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  await auditPhi(request, me, {
    action: "patient.my_care",
    status: "success",
    details: {
      visit_count: visits.length,
      timeline_count: timeline.length,
    },
  });
  return NextResponse.json({
    patientName: profile?.full_name ?? "",
    visits,
    timeline,
  });
}
