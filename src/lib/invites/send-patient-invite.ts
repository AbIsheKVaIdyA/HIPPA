import { createAdminClient } from "@/lib/supabase/admin";
import { dashboardPathForRole } from "@/lib/roles";

export type InvitePatientResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

/**
 * Sends Supabase invite email for a patient account (same flow as front-desk API).
 */
export async function sendPatientInviteEmail(params: {
  email: string;
  full_name: string;
}): Promise<InvitePatientResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    return { ok: false, error: "NEXT_PUBLIC_APP_URL is not configured" };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" };
  }

  const nextPath = dashboardPathForRole("patient");
  const { error } = await adminClient.auth.admin.inviteUserByEmail(
    params.email.trim(),
    {
      data: {
        full_name: params.full_name.trim(),
        role: "patient",
      },
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(nextPath)}&invite=1`,
    }
  );

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("duplicate")
    ) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
