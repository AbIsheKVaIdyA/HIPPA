import { createAdminClient } from "@/lib/supabase/admin";

export type AuditStatus = "success" | "failure";

const MAX_DETAILS_BYTES = 12_000;

function clampDetails(details: Record<string, unknown> | undefined) {
  if (!details || Object.keys(details).length === 0) return {};
  try {
    const s = JSON.stringify(details);
    if (s.length <= MAX_DETAILS_BYTES) return details;
    return {
      _truncated: true,
      _original_length: s.length,
    };
  } catch {
    return { _invalid: true };
  }
}

/**
 * Persists an audit row using the Supabase service role (bypasses RLS).
 * Never include passwords, decrypted PHI, or raw clinical text in `details`.
 */
export async function writeAuditLog(entry: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  status: AuditStatus;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[audit] SUPABASE_SERVICE_ROLE_KEY missing; event not logged:", entry.action);
    return;
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      actor_user_id: entry.actorUserId ?? null,
      actor_email: entry.actorEmail ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      status: entry.status,
      details: clampDetails(entry.details),
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });
    if (error) {
      console.error("[audit] insert failed:", error.message, entry.action);
    }
  } catch (e) {
    console.error("[audit] insert exception:", e);
  }
}
