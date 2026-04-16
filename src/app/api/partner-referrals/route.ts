import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import {
  decryptPatientField,
  encryptPatientJson,
} from "@/lib/crypto/patient-data";
import { createClient } from "@/lib/supabase/server";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { createPartnerReferralSchema } from "@/lib/validators/partner-referral";

export const runtime = "nodejs";

/** Doctor: list referrals for a case. Partner: inbox (no case_id). */
export async function GET(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || !me.role) {
    await auditPhi(request, me, {
      action: "partner_referral.list",
      status: "failure",
      details: { reason: "unauthenticated" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const caseId = url.searchParams.get("case_id")?.trim();

  if (me.role === "doctor") {
    if (!caseId) {
      return NextResponse.json(
        { error: "case_id query parameter is required" },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partner_referral")
      .select(
        "id, case_id, referring_doctor_id, partner_user_id, partner_display_name, referral_kind, expires_at, status, submitted_at, created_at, partner_result_enc"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) {
      await auditPhi(request, me, {
        action: "partner_referral.list",
        status: "failure",
        resourceType: "patient_case",
        resourceId: caseId,
        details: { message: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const referrals = (data ?? []).map((row) => {
      const enc = row.partner_result_enc as string | null | undefined;
      let result_text: string | null = null;
      if (row.status === "submitted" && enc) {
        try {
          result_text = decryptPatientField(enc);
        } catch {
          result_text = null;
        }
      }
      return {
        id: row.id,
        case_id: row.case_id,
        referring_doctor_id: row.referring_doctor_id,
        partner_user_id: row.partner_user_id,
        partner_display_name: row.partner_display_name,
        referral_kind: row.referral_kind,
        expires_at: row.expires_at,
        status: row.status,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        result_text,
      };
    });

    await auditPhi(request, me, {
      action: "partner_referral.list",
      status: "success",
      resourceType: "patient_case",
      resourceId: caseId,
      details: { count: referrals.length },
    });
    return NextResponse.json({ referrals });
  }

  if (me.role === "third_party_hospital") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partner_referral")
      .select(
        "id, case_id, referral_kind, partner_display_name, expires_at, status, submitted_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      await auditPhi(request, me, {
        action: "partner_referral.inbox",
        status: "failure",
        details: { message: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await auditPhi(request, me, {
      action: "partner_referral.inbox",
      status: "success",
      details: { count: data?.length ?? 0 },
    });
    return NextResponse.json({ referrals: data ?? [] });
  }

  await auditPhi(request, me, {
    action: "partner_referral.list",
    status: "failure",
    details: { reason: "forbidden" },
  });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "doctor") {
    await auditPhi(request, me, {
      action: "partner_referral.create",
      status: "failure",
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

  const parsed = createPartnerReferralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    case_id,
    partner_user_id,
    referral_kind,
    partner_display_name,
    shared_context,
  } = parsed.data;

  const shared_context_enc = encryptPatientJson(shared_context);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_referral")
    .insert({
      case_id,
      referring_doctor_id: me.userId,
      partner_user_id,
      referral_kind: referral_kind ?? "External study / service",
      partner_display_name: partner_display_name?.trim() ?? "",
      shared_context_enc,
    })
    .select("id, expires_at, status, created_at")
    .single();

  if (error) {
    await auditPhi(request, me, {
      action: "partner_referral.create",
      status: "failure",
      resourceType: "patient_case",
      resourceId: case_id,
      details: { message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auditPhi(request, me, {
    action: "partner_referral.create",
    status: "success",
    resourceType: "partner_referral",
    resourceId: data.id,
    details: {
      case_id,
      partner_user_id,
      referral_kind: referral_kind ?? "External study / service",
      expires_at: data.expires_at,
    },
  });

  return NextResponse.json({ referral: data });
}
