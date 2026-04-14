import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import { decryptPatientField } from "@/lib/crypto/patient-data";
import { getRequesterProfile } from "@/lib/patient-cases/access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "front_desk") {
    await auditPhi(request, me, {
      action: "patient_case.search",
      status: "failure",
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase();
  if (!q || q.length < 2) {
    await auditPhi(request, me, {
      action: "patient_case.search",
      status: "failure",
      details: { reason: "query_too_short" },
    });
    return NextResponse.json(
      { error: "Query q must be at least 2 characters" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: cores, error } = await supabase
    .from("patient_case_core")
    .select("id, created_at, patient_email_norm, prior_case_id")
    .eq("created_by", me.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    await auditPhi(request, me, {
      action: "patient_case.search",
      status: "failure",
      details: { reason: "query_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = cores ?? [];
  if (list.length === 0) {
    await auditPhi(request, me, {
      action: "patient_case.search",
      status: "success",
      details: { result_count: 0, q_len: q.length },
    });
    return NextResponse.json({ matches: [] });
  }

  const ids = list.map((c) => c.id);
  const { data: piiRows } = await supabase
    .from("patient_case_pii")
    .select("case_id, patient_legal_name_enc, patient_email_enc")
    .in("case_id", ids);

  const piiByCase = new Map((piiRows ?? []).map((r) => [r.case_id, r]));

  const matches: {
    case_id: string;
    patientName: string;
    patientEmail: string;
    created_at: string;
  }[] = [];

  for (const c of list) {
    const pii = piiByCase.get(c.id);
    if (!pii) continue;
    try {
      const name = decryptPatientField(
        pii.patient_legal_name_enc as string
      ).toLowerCase();
      const em = decryptPatientField(
        pii.patient_email_enc as string
      ).toLowerCase();
      if (name.includes(q) || em.includes(q)) {
        matches.push({
          case_id: c.id,
          patientName: decryptPatientField(pii.patient_legal_name_enc as string),
          patientEmail: decryptPatientField(pii.patient_email_enc as string),
          created_at: c.created_at as string,
        });
      }
    } catch {
      /* skip row */
    }
  }

  const out = matches.slice(0, 25);
  await auditPhi(request, me, {
    action: "patient_case.search",
    status: "success",
    details: { result_count: out.length, q_len: q.length },
  });
  return NextResponse.json({ matches: out });
}
