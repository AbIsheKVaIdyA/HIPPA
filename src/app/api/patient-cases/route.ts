import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import {
  decryptPatientField,
  encryptPatientField,
} from "@/lib/crypto/patient-data";
import { sendPatientInviteEmail } from "@/lib/invites/send-patient-invite";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { createPatientCaseSchema } from "@/lib/validators/patient-case";

export const runtime = "nodejs";

async function enrichCasesWithPatientNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseRows: {
    id: string;
    created_by: string;
    assigned_doctor_id: string;
    assigned_nurse_id: string;
    status: string;
    created_at: string;
    patient_email_norm?: string | null;
    prior_case_id?: string | null;
  }[]
) {
  if (caseRows.length === 0) return [];
  const ids = caseRows.map((c) => c.id);
  const { data: piiRows } = await supabase
    .from("patient_case_pii")
    .select("case_id, patient_legal_name_enc")
    .in("case_id", ids);

  const encByCase = new Map(
    (piiRows ?? []).map((r) => [r.case_id, r.patient_legal_name_enc])
  );

  return caseRows.map((c) => {
    const encName = encByCase.get(c.id);
    let patientName = "—";
    if (encName) {
      try {
        patientName = decryptPatientField(encName);
      } catch {
        patientName = "—";
      }
    }
    return { ...c, patientName };
  });
}

export async function POST(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "front_desk") {
    await auditPhi(request, me, {
      action: "patient_case.create",
      status: "failure",
      details: { reason: !me?.userId ? "unauthenticated" : "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await auditPhi(request, me, {
      action: "patient_case.create",
      status: "failure",
      details: { reason: "invalid_json" },
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPatientCaseSchema.safeParse(body);
  if (!parsed.success) {
    await auditPhi(request, me, {
      action: "patient_case.create",
      status: "failure",
      details: { reason: "validation_error" },
    });
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const v = parsed.data;
  const emailNorm = v.patient_email.trim().toLowerCase();

  let enc: {
    patient_legal_name_enc: string;
    patient_email_enc: string;
    patient_phone_enc: string;
    patient_dob_enc: string;
    patient_id_proof_enc: string;
    health_issue_enc: string;
  };
  try {
    enc = {
      patient_legal_name_enc: encryptPatientField(v.patient_legal_name),
      patient_email_enc: encryptPatientField(v.patient_email),
      patient_phone_enc: encryptPatientField(v.patient_phone?.trim() ?? ""),
      patient_dob_enc: encryptPatientField(v.patient_dob),
      patient_id_proof_enc: encryptPatientField(
        v.patient_id_proof?.trim() ?? ""
      ),
      health_issue_enc: encryptPatientField(v.health_issue),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encryption failed";
    await auditPhi(request, me, {
      action: "patient_case.create",
      status: "failure",
      details: { reason: "encryption_error" },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_patient_case", {
    p_assigned_doctor_id: v.assigned_doctor_id,
    p_assigned_nurse_id: v.assigned_nurse_id,
    p_patient_legal_name_enc: enc.patient_legal_name_enc,
    p_patient_email_enc: enc.patient_email_enc,
    p_patient_phone_enc: enc.patient_phone_enc,
    p_patient_dob_enc: enc.patient_dob_enc,
    p_patient_id_proof_enc: enc.patient_id_proof_enc,
    p_health_issue_enc: enc.health_issue_enc,
    p_patient_email_norm: emailNorm,
    p_prior_case_id: v.prior_case_id ?? null,
  });

  if (error) {
    await auditPhi(request, me, {
      action: "patient_case.create",
      status: "failure",
      details: { reason: "rpc_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const caseId = data as string;

  let inviteMessage: string | undefined;
  if (v.invite_patient !== false) {
    const inv = await sendPatientInviteEmail({
      email: v.patient_email,
      full_name: v.patient_legal_name,
    });
    if (!inv.ok) {
      inviteMessage = `Case saved; invite email failed: ${inv.error}`;
    } else if (inv.skipped) {
      inviteMessage =
        "Case saved. Patient already has an account—no new invite sent.";
    } else {
      inviteMessage = "Case saved and patient invite email sent.";
    }
  }

  await auditPhi(request, me, {
    action: "patient_case.create",
    status: "success",
    resourceType: "patient_case",
    resourceId: caseId,
    details: {
      invite_attempted: v.invite_patient !== false,
      prior_case_id: v.prior_case_id ?? null,
    },
  });

  return NextResponse.json({ case_id: caseId, invite: inviteMessage });
}

export async function GET(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || !me.role) {
    await auditPhi(request, me, {
      action: "patient_case.list",
      status: "failure",
      details: { reason: "unauthenticated" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  let q = supabase
    .from("patient_case_core")
    .select(
      "id, created_by, assigned_doctor_id, assigned_nurse_id, status, created_at, patient_email_norm, prior_case_id"
    )
    .order("created_at", { ascending: false });

  if (me.role === "front_desk") {
    q = q.eq("created_by", me.userId);
  } else if (me.role === "doctor") {
    q = q.eq("assigned_doctor_id", me.userId);
  } else if (me.role === "nurse") {
    q = q.eq("assigned_nurse_id", me.userId);
  } else if (me.role === "admin") {
    /* all */
  } else {
    await auditPhi(request, me, {
      action: "patient_case.list",
      status: "failure",
      details: { reason: "forbidden", role: me.role },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await q;
  if (error) {
    await auditPhi(request, me, {
      action: "patient_case.list",
      status: "failure",
      details: { reason: "query_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  try {
    const enriched = await enrichCasesWithPatientNames(supabase, rows);
    await auditPhi(request, me, {
      action: "patient_case.list",
      status: "success",
      details: { result_count: enriched.length },
    });
    return NextResponse.json({ cases: enriched });
  } catch {
    await auditPhi(request, me, {
      action: "patient_case.list",
      status: "success",
      details: { result_count: rows.length, enrich_failed: true },
    });
    return NextResponse.json({ cases: rows });
  }
}
