import { NextResponse } from "next/server";
import { z } from "zod";
import { auditPhi } from "@/lib/audit/audit-api";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { dashboardPathForRole, type UserRole } from "@/lib/roles";

const bodySchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
});

function isFrontDesk(role: UserRole | undefined): boolean {
  return role === "front_desk";
}

export async function POST(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId) {
    await auditPhi(request, me, {
      action: "invite.patient",
      status: "failure",
      details: { reason: "unauthenticated" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFrontDesk(me.role as UserRole | undefined)) {
    await auditPhi(request, me, {
      action: "invite.patient",
      status: "failure",
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    await auditPhi(request, me, {
      action: "invite.patient",
      status: "failure",
      details: { reason: "invalid_body" },
    });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    await auditPhi(request, me, {
      action: "invite.patient",
      status: "failure",
      details: { reason: "missing_app_url" },
    });
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not configured" },
      { status: 500 }
    );
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    await auditPhi(request, me, {
      action: "invite.patient",
      status: "failure",
      details: { reason: "missing_service_role" },
    });
    return NextResponse.json(
      { error: "Server invite is not configured (service role key missing)." },
      { status: 500 }
    );
  }

  const role: UserRole = "patient";
  const nextPath = dashboardPathForRole(role);
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    parsed.email,
    {
      data: {
        full_name: parsed.full_name,
        role,
      },
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(nextPath)}&invite=1`,
    }
  );

  if (error) {
    await auditPhi(request, me, {
      action: "invite.patient",
      status: "failure",
      details: { reason: "invite_failed", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auditPhi(request, me, {
    action: "invite.patient",
    status: "success",
    details: { invited_user_id: data.user?.id ?? null },
  });
  return NextResponse.json({ userId: data.user?.id ?? null });
}
