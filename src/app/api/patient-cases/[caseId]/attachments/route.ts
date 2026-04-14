import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, ctx: RouteParams) {
  const { caseId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "doctor") {
    await auditPhi(request, me, {
      action: "patient_case.file_upload",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    await auditPhi(request, me, {
      action: "patient_case.file_upload",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "missing_file" },
    });
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
  const objectPath = `${caseId}/${randomUUID()}-${safeName}`;

  const supabase = await createClient();
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("case-attachments")
    .upload(objectPath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) {
    await auditPhi(request, me, {
      action: "patient_case.file_upload",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "storage_upload_error", message: upErr.message },
    });
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const { data: row, error: dbErr } = await supabase
    .from("patient_case_files")
    .insert({
      case_id: caseId,
      uploaded_by: me.userId,
      storage_path: objectPath,
      original_name: file.name.slice(0, 240),
      content_type: file.type || null,
    })
    .select("id, storage_path, original_name, created_at")
    .single();

  if (dbErr) {
    await supabase.storage.from("case-attachments").remove([objectPath]);
    await auditPhi(request, me, {
      action: "patient_case.file_upload",
      status: "failure",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { reason: "db_insert_error", message: dbErr.message },
    });
    return NextResponse.json({ error: dbErr.message }, { status: 400 });
  }

  await auditPhi(request, me, {
    action: "patient_case.file_upload",
    status: "success",
    resourceType: "patient_case",
    resourceId: caseId,
    details: { file_id: row?.id, bytes: file.size },
  });
  return NextResponse.json({ file: row });
}
