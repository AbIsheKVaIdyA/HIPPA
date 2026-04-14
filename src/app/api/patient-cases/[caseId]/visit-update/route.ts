import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import { encryptPatientField } from "@/lib/crypto/patient-data";
import { getRequesterProfile } from "@/lib/patient-cases/access";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, ctx: RouteParams) {
  const { caseId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "doctor") {
    await auditPhi(request, me, {
      action: "patient_case.visit_update",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const note = (form.get("note") as string | null)?.trim() ?? "";
  const file = form.get("file");

  if (!note && !(file instanceof File)) {
    await auditPhi(request, me, {
      action: "patient_case.visit_update",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "empty_payload" },
    });
    return NextResponse.json(
      { error: "Add a clinical note and/or choose a file." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const results: { note?: boolean; file?: boolean } = {};

  if (note) {
    let enc: string;
    try {
      enc = encryptPatientField(note);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Encrypt failed";
      await auditPhi(request, me, {
        action: "patient_case.visit_update",
        status: "failure",
        resourceType: "patient_case",
        resourceId: caseId,
        details: { reason: "encrypt_error" },
      });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    const { error } = await supabase.from("patient_case_notes").insert({
      case_id: caseId,
      author_id: me.userId,
      body_enc: enc,
    });
    if (error) {
      await auditPhi(request, me, {
        action: "patient_case.visit_update",
        status: "failure",
        resourceType: "patient_case",
        resourceId: caseId,
        details: { reason: "note_insert_error", message: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    results.note = true;
  }

  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
    const objectPath = `${caseId}/${randomUUID()}-${safeName}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("case-attachments")
      .upload(objectPath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      await auditPhi(request, me, {
        action: "patient_case.visit_update",
        status: "failure",
        resourceType: "patient_case",
        resourceId: caseId,
        details: { reason: "storage_upload_error", message: upErr.message },
      });
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
    const { error: dbErr } = await supabase.from("patient_case_files").insert({
      case_id: caseId,
      uploaded_by: me.userId,
      storage_path: objectPath,
      original_name: file.name.slice(0, 240),
      content_type: file.type || null,
    });
    if (dbErr) {
      await supabase.storage.from("case-attachments").remove([objectPath]);
      await auditPhi(request, me, {
        action: "patient_case.visit_update",
        status: "failure",
        resourceType: "patient_case",
        resourceId: caseId,
        details: { reason: "file_row_insert_error", message: dbErr.message },
      });
      return NextResponse.json({ error: dbErr.message }, { status: 400 });
    }
    results.file = true;
  }

  await auditPhi(request, me, {
    action: "patient_case.visit_update",
    status: "success",
    resourceType: "patient_case",
    resourceId: caseId,
    details: {
      saved_note: Boolean(results.note),
      saved_file: Boolean(results.file),
      file_bytes:
        file instanceof File && file.size > 0
          ? file.size
          : undefined,
    },
  });
  return NextResponse.json({ ok: true, ...results });
}
