import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import { getRequesterProfile } from "@/lib/patient-cases/access";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ caseId: string; fileId: string }>;
};

export async function GET(request: Request, ctx: RouteParams) {
  const { caseId, fileId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || !me.role) {
    await auditPhi(request, me, {
      action: "patient_case.file_signed_url",
      status: "failure",
      resourceType: "patient_case_file",
      resourceId: fileId,
      details: { reason: "unauthenticated", case_id: caseId },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    me.role !== "doctor" &&
    me.role !== "front_desk" &&
    me.role !== "admin" &&
    me.role !== "patient"
  ) {
    await auditPhi(request, me, {
      action: "patient_case.file_signed_url",
      status: "failure",
      resourceType: "patient_case_file",
      resourceId: fileId,
      details: { reason: "forbidden", case_id: caseId },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("patient_case_files")
    .select("storage_path, case_id")
    .eq("id", fileId)
    .maybeSingle();

  if (error || !file || file.case_id !== caseId) {
    await auditPhi(request, me, {
      action: "patient_case.file_signed_url",
      status: "failure",
      resourceType: "patient_case_file",
      resourceId: fileId,
      details: { reason: "not_found", case_id: caseId },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("case-attachments")
    .createSignedUrl(file.storage_path, 600);

  if (signErr || !signed) {
    await auditPhi(request, me, {
      action: "patient_case.file_signed_url",
      status: "failure",
      resourceType: "patient_case_file",
      resourceId: fileId,
      details: { reason: "sign_failed", case_id: caseId },
    });
    return NextResponse.json(
      { error: signErr?.message ?? "Sign failed" },
      { status: 400 }
    );
  }

  await auditPhi(request, me, {
    action: "patient_case.file_signed_url",
    status: "success",
    resourceType: "patient_case_file",
    resourceId: fileId,
    details: { case_id: caseId },
  });
  return NextResponse.json({ url: signed.signedUrl });
}
