import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import {
  decryptPatientField,
  decryptPatientJson,
} from "@/lib/crypto/patient-data";
import { getRequesterProfile } from "@/lib/patient-cases/access";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ caseId: string }> };

function emailMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function GET(request: Request, ctx: RouteParams) {
  const { caseId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || !me.role) {
    await auditPhi(request, me, {
      action: "patient_case.open",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "unauthenticated" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: core, error: coreErr } = await supabase
    .from("patient_case_core")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (coreErr || !core) {
    await auditPhi(request, me, {
      action: "patient_case.open",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "case_not_found" },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", me.userId)
    .maybeSingle();

  const isNurse = me.role === "nurse";
  const isDoctor = me.role === "doctor";
  const isFront = me.role === "front_desk";
  const isAdmin = me.role === "admin";
  const isPatient = me.role === "patient";

  const participant =
    core.created_by === me.userId ||
    core.assigned_doctor_id === me.userId ||
    core.assigned_nurse_id === me.userId;

  const patientOwns =
    isPatient &&
    emailMatch(
      myProfile?.email ?? null,
      (core as { patient_email_norm?: string | null }).patient_email_norm ??
        null
    );

  if (!participant && !isAdmin && !patientOwns) {
    await auditPhi(request, me, {
      action: "patient_case.open",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: pii, error: piiErr } = await supabase
    .from("patient_case_pii")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (piiErr || !pii) {
    await auditPhi(request, me, {
      action: "patient_case.open",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "pii_not_found" },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const basics = {
      legalName: decryptPatientField(pii.patient_legal_name_enc),
      email: decryptPatientField(pii.patient_email_enc),
      phone: pii.patient_phone_enc
        ? decryptPatientField(pii.patient_phone_enc)
        : "",
      dob: decryptPatientField(pii.patient_dob_enc),
      idProof: pii.patient_id_proof_enc
        ? decryptPatientField(pii.patient_id_proof_enc)
        : "",
    };

    if (isNurse && participant) {
      const { data: vitalsRows } = await supabase
        .from("patient_case_vitals")
        .select("id, submitted_by, vitals_payload_enc, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      const vitals =
        vitalsRows?.map((row) => ({
          id: row.id,
          submitted_by: row.submitted_by,
          created_at: row.created_at,
          payload: decryptPatientJson<Record<string, string>>(
            row.vitals_payload_enc
          ),
        })) ?? [];

      await auditPhi(request, me, {
        action: "patient_case.open",
        status: "success",
        resourceType: "patient_case",
        resourceId: caseId,
        details: { scope: "nurse_basic" },
      });
      return NextResponse.json({
        case: core,
        patient: {
          legalName: basics.legalName,
          email: basics.email,
          phone: basics.phone,
          dob: basics.dob,
        },
        vitals,
        scope: "nurse_basic",
      });
    }

    const canSeeClinical =
      isDoctor || isFront || isAdmin || patientOwns;

    let healthIssue: string | null = null;
    if (canSeeClinical) {
      const { data: clin } = await supabase
        .from("patient_case_clinical")
        .select("health_issue_enc")
        .eq("case_id", caseId)
        .maybeSingle();
      if (clin?.health_issue_enc) {
        healthIssue = decryptPatientField(clin.health_issue_enc);
      }
    }

    const { data: vitalsRows } = await supabase
      .from("patient_case_vitals")
      .select("id, submitted_by, vitals_payload_enc, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    const vitals =
      vitalsRows?.map((row) => ({
        id: row.id,
        submitted_by: row.submitted_by,
        created_at: row.created_at,
        payload: decryptPatientJson<Record<string, string>>(
          row.vitals_payload_enc
        ),
      })) ?? [];

    let notes: {
      id: string;
      author_id: string;
      author_name: string;
      created_at: string;
      body: string;
    }[] = [];
    let files: {
      id: string;
      storage_path: string;
      original_name: string;
      content_type: string | null;
      created_at: string;
    }[] = [];

    if (canSeeClinical) {
      const { data: notesRows } = await supabase
        .from("patient_case_notes")
        .select("id, author_id, body_enc, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      const authorIds = [...new Set((notesRows ?? []).map((n) => n.author_id))];
      const nameById = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: authors } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        for (const a of authors ?? []) {
          nameById.set(a.id, a.full_name || "Physician");
        }
      }

      notes =
        notesRows?.map((n) => ({
          id: n.id,
          author_id: n.author_id,
          author_name: nameById.get(n.author_id) ?? "Physician",
          created_at: n.created_at,
          body: decryptPatientField(n.body_enc),
        })) ?? [];

      const { data: fileRows } = await supabase
        .from("patient_case_files")
        .select("id, storage_path, original_name, content_type, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      files = fileRows ?? [];
    }

    const { data: doctorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", core.assigned_doctor_id)
      .maybeSingle();

    await auditPhi(request, me, {
      action: "patient_case.open",
      status: "success",
      resourceType: "patient_case",
      resourceId: caseId,
      details: {
        scope: patientOwns ? "patient_portal" : "clinical_team",
      },
    });
    return NextResponse.json({
      case: core,
      patient: { ...basics, idProof: basics.idProof },
      healthIssue,
      vitals,
      notes,
      files,
      assignedDoctorName: doctorProfile?.full_name ?? "Physician",
      scope: patientOwns ? "patient_portal" : "clinical_team",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Decrypt failed";
    await auditPhi(request, me, {
      action: "patient_case.open",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "decrypt_error" },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
