import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type LockoutRow = {
  lock_key: string;
  stage: number;
  failures_in_stage: number;
  locked_until: string | null;
  blocked: boolean;
};

type LockResult =
  | { allowed: true }
  | {
      allowed: false;
      code: "locked" | "blocked";
      message: string;
      remainingSeconds?: number;
    };

const STAGE_RULES = [
  { threshold: 4, lockMinutes: 15 },
  { threshold: 2, lockMinutes: 30 },
  { threshold: 1, lockMinutes: 60 },
  // stage 3 threshold => block
  { threshold: 1, lockMinutes: 0 },
] as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function signInLockKey(portalSlug: string, email: string): string {
  const hash = createHash("sha256")
    .update(`${portalSlug}|${normalizeEmail(email)}`)
    .digest("hex")
    .slice(0, 32);
  return `sil:v1:${hash}`;
}

function lockMessage(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  return `Too many wrong sign-in attempts. Please wait ${mins} minute${mins === 1 ? "" : "s"} before trying again.`;
}

function blockedMessage(): string {
  return "Account is blocked due to repeated failed sign-in attempts. Please contact IT help desk.";
}

export async function checkSignInLockout(
  portalSlug: string,
  email: string
): Promise<LockResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { allowed: true };
  const admin = createAdminClient();
  const lockKey = signInLockKey(portalSlug, email);
  const { data, error } = await admin
    .from("sign_in_lockout")
    .select("lock_key, stage, failures_in_stage, locked_until, blocked")
    .eq("lock_key", lockKey)
    .maybeSingle<LockoutRow>();

  if (error || !data) return { allowed: true };
  if (data.blocked) {
    return { allowed: false, code: "blocked", message: blockedMessage() };
  }
  if (!data.locked_until) return { allowed: true };

  const until = new Date(data.locked_until).getTime();
  const now = Date.now();
  if (!Number.isFinite(until) || until <= now) {
    await admin
      .from("sign_in_lockout")
      .update({ locked_until: null, updated_at: new Date().toISOString() })
      .eq("lock_key", lockKey);
    return { allowed: true };
  }
  const remainingSeconds = Math.ceil((until - now) / 1000);
  return {
    allowed: false,
    code: "locked",
    message: lockMessage(remainingSeconds),
    remainingSeconds,
  };
}

export async function recordSignInFailure(
  portalSlug: string,
  email: string
): Promise<LockResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { allowed: true };
  const admin = createAdminClient();
  const lockKey = signInLockKey(portalSlug, email);
  const emailNorm = normalizeEmail(email);
  const nowIso = new Date().toISOString();

  const { data: current } = await admin
    .from("sign_in_lockout")
    .select("lock_key, stage, failures_in_stage, locked_until, blocked")
    .eq("lock_key", lockKey)
    .maybeSingle<LockoutRow>();

  if (!current) {
    await admin.from("sign_in_lockout").insert({
      lock_key: lockKey,
      portal_slug: portalSlug,
      email_norm: emailNorm,
      stage: 0,
      failures_in_stage: 1,
      last_failed_at: nowIso,
      updated_at: nowIso,
    });
    return { allowed: true };
  }

  if (current.blocked) {
    return { allowed: false, code: "blocked", message: blockedMessage() };
  }

  if (current.locked_until && new Date(current.locked_until).getTime() > Date.now()) {
    const secs = Math.ceil(
      (new Date(current.locked_until).getTime() - Date.now()) / 1000
    );
    return {
      allowed: false,
      code: "locked",
      message: lockMessage(secs),
      remainingSeconds: secs,
    };
  }

  const stage = Math.max(0, Math.min(3, current.stage ?? 0));
  const failures = (current.failures_in_stage ?? 0) + 1;
  const rule = STAGE_RULES[stage];

  if (failures < rule.threshold) {
    await admin
      .from("sign_in_lockout")
      .update({
        failures_in_stage: failures,
        locked_until: null,
        last_failed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("lock_key", lockKey);
    return { allowed: true };
  }

  // Threshold hit for this stage -> escalate.
  if (stage >= 3) {
    await admin
      .from("sign_in_lockout")
      .update({
        blocked: true,
        failures_in_stage: 0,
        locked_until: null,
        last_failed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("lock_key", lockKey);
    return { allowed: false, code: "blocked", message: blockedMessage() };
  }

  const nextStage = stage + 1;
  const lockMinutes = STAGE_RULES[stage].lockMinutes;
  const untilIso = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();
  await admin
    .from("sign_in_lockout")
    .update({
      stage: nextStage,
      failures_in_stage: 0,
      locked_until: untilIso,
      last_failed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("lock_key", lockKey);

  return {
    allowed: false,
    code: "locked",
    message: `Too many wrong sign-in attempts. Please wait ${lockMinutes} minutes before trying again.`,
    remainingSeconds: lockMinutes * 60,
  };
}

export async function resetSignInLockout(
  portalSlug: string,
  email: string
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createAdminClient();
  const lockKey = signInLockKey(portalSlug, email);
  await admin
    .from("sign_in_lockout")
    .upsert({
      lock_key: lockKey,
      portal_slug: portalSlug,
      email_norm: normalizeEmail(email),
      stage: 0,
      failures_in_stage: 0,
      locked_until: null,
      blocked: false,
      updated_at: new Date().toISOString(),
    })
    .select("lock_key");
}
