import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import { encryptPatientField } from "@/lib/crypto/patient-data";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { doctorNoteSchema } from "@/lib/validators/patient-case";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, ctx: RouteParams) {
  const { caseId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "doctor") {
    await auditPhi(request, me, {
      action: "patient_case.note_create",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = doctorNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  let enc: string;
  try {
    enc = encryptPatientField(parsed.data.body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Encryption failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_case_notes")
    .insert({
      case_id: caseId,
      author_id: me.userId,
      body_enc: enc,
    })
    .select("id, created_at")
    .single();

  if (error) {
    await auditPhi(request, me, {
      action: "patient_case.note_create",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "insert_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auditPhi(request, me, {
    action: "patient_case.note_create",
    status: "success",
    resourceType: "patient_case",
    resourceId: caseId,
    details: { note_id: data?.id },
  });
  return NextResponse.json({ note: data });
}
