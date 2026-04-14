import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function emailBucketKey(portalSlug: string, email: string): string {
  const norm = email.trim().toLowerCase();
  const hash = createHash("sha256").update(norm).digest("hex").slice(0, 24);
  return `sri:em:v1:${portalSlug}:${hash}`;
}

export function ipBucketKey(portalSlug: string, ip: string): string {
  const safeIp = ip.replace(/[^a-zA-Z0-9.:]/g, "_").slice(0, 128);
  return `sri:ip:v1:${portalSlug}:${safeIp}`;
}

/**
 * Returns false when the bucket is over the limit for the current window.
 */
export async function consumeSignInRate(
  bucketKey: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[rate-limit] SUPABASE_SERVICE_ROLE_KEY missing; allowing request");
    return true;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_sign_in_rate", {
    p_bucket_key: bucketKey,
    p_max: maxAttempts,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] rpc error:", error.message);
    return true;
  }
  return data === true;
}

/** Defaults tuned for shared-egress (many users behind one IP). */
export const SIGN_IN_RATE = {
  windowSeconds: 15 * 60,
  maxPerIp: 40,
  maxPerEmail: 12,
} as const;
