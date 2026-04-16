import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import {
  decryptPatientField,
  decryptPatientJson,
  encryptPatientField,
} from "@/lib/crypto/patient-data";
import { createClient } from "@/lib/supabase/server";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { patchPartnerReferralSchema } from "@/lib/validators/partner-referral";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ referralId: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const { referralId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || !me.role) {
    await auditPhi(request, me, {
      action: "partner_referral.open",
      status: "failure",
      resourceType: "partner_referral",
      resourceId: referralId,
      details: { reason: "unauthenticated" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    me.role !== "doctor" &&
    me.role !== "third_party_hospital" &&
    me.role !== "admin"
  ) {
    await auditPhi(request, me, {
      action: "partner_referral.open",
      status: "failure",
      resourceType: "partner_referral",
      resourceId: referralId,
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("partner_referral")
    .select("*")
    .eq("id", referralId)
    .maybeSingle();

  if (error || !row) {
    await auditPhi(request, me, {
      action: "partner_referral.open",
      status: "failure",
      resourceType: "partner_referral",
      resourceId: referralId,
      details: { reason: "not_found" },
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let shared_context: Record<string, unknown>;
  try {
    shared_context = decryptPatientJson<Record<string, unknown>>(
      row.shared_context_enc as string
    );
  } catch {
    await auditPhi(request, me, {
      action: "partner_referral.open",
      status: "failure",
      resourceType: "partner_referral",
      resourceId: referralId,
      details: { reason: "decrypt_shared_failed" },
    });
    return NextResponse.json({ error: "Could not read referral" }, { status: 500 });
  }

  let result_text: string | null = null;
  if (row.partner_result_enc) {
    try {
      result_text = decryptPatientField(row.partner_result_enc as string);
    } catch {
      result_text = null;
    }
  }

  await auditPhi(request, me, {
    action: "partner_referral.open",
    status: "success",
    resourceType: "partner_referral",
    resourceId: referralId,
    details: { case_id: row.case_id, status: row.status },
  });

  return NextResponse.json({
    referral: {
      id: row.id,
      case_id: row.case_id,
      referral_kind: row.referral_kind,
      partner_display_name: row.partner_display_name,
      expires_at: row.expires_at,
      status: row.status,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      shared_context,
      result_text,
    },
  });
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const { referralId } = await ctx.params;
  const me = await getRequesterProfile();
  if (!me?.userId || !me.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchPartnerReferralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();

  if (parsed.data.action === "revoke") {
    if (me.role !== "doctor") {
      await auditPhi(request, me, {
        action: "partner_referral.revoke",
        status: "failure",
        resourceType: "partner_referral",
        resourceId: referralId,
        details: { reason: "forbidden" },
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("partner_referral")
      .update({ status: "revoked" })
      .eq("id", referralId)
      .select("id, status")
      .maybeSingle();

    if (error) {
      await auditPhi(request, me, {
        action: "partner_referral.revoke",
        status: "failure",
        resourceType: "partner_referral",
        resourceId: referralId,
        details: { message: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found or not allowed" }, { status: 404 });
    }

    await auditPhi(request, me, {
      action: "partner_referral.revoke",
      status: "success",
      resourceType: "partner_referral",
      resourceId: referralId,
      details: {},
    });
    return NextResponse.json({ ok: true, referral: data });
  }

  if (parsed.data.action === "submit") {
    if (me.role !== "third_party_hospital") {
      await auditPhi(request, me, {
        action: "partner_referral.submit",
        status: "failure",
        resourceType: "partner_referral",
        resourceId: referralId,
        details: { reason: "forbidden" },
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result_enc = encryptPatientField(parsed.data.result_text);
    const { data, error } = await supabase
      .from("partner_referral")
      .update({
        partner_result_enc: result_enc,
        submitted_at: new Date().toISOString(),
        status: "submitted",
      })
      .eq("id", referralId)
      .select("id, status, submitted_at")
      .maybeSingle();

    if (error) {
      await auditPhi(request, me, {
        action: "partner_referral.submit",
        status: "failure",
        resourceType: "partner_referral",
        resourceId: referralId,
        details: { message: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Not found, expired, or already submitted" },
        { status: 404 }
      );
    }

    await auditPhi(request, me, {
      action: "partner_referral.submit",
      status: "success",
      resourceType: "partner_referral",
      resourceId: referralId,
      details: {},
    });
    return NextResponse.json({ ok: true, referral: data });
  }

  return NextResponse.json({ error: "Unsupported" }, { status: 400 });
}
