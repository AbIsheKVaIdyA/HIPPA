import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getClientIp, getUserAgent } from "@/lib/http/client-ip";
import { isMfaEmailOtpEnabled } from "@/lib/mfa/config";
import { verifyMfaChallenge } from "@/lib/mfa/challenge-store";
import { mfaVerifySchema } from "@/lib/validators/mfa-verify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  if (!isMfaEmailOtpEnabled()) {
    return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { challenge_id, otp } = parsed.data;

  let result;
  try {
    result = await verifyMfaChallenge(challenge_id, otp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    await writeAuditLog({
      action: "auth.mfa_verify",
      status: "failure",
      details: { reason: "server_error", message: msg },
      ipAddress: ip,
      userAgent: ua,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!result.ok) {
    await writeAuditLog({
      action: "auth.mfa_verify",
      status: "failure",
      details: { reason: result.reason, challenge_id },
      ipAddress: ip,
      userAgent: ua,
    });
    const status =
      result.reason === "not_found" || result.reason === "expired"
        ? 410
        : result.reason === "locked"
          ? 423
          : 401;
    const msg =
      result.reason === "expired"
        ? "Code expired. Sign in again."
        : result.reason === "locked"
          ? "Too many wrong codes. Sign in again."
        : result.reason === "not_found"
          ? "Invalid or unknown code."
          : "Incorrect code.";
    return NextResponse.json({ error: msg }, { status });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });

  if (error) {
    console.error("[api/auth/verify-mfa] setSession:", error.message);
    await writeAuditLog({
      actorUserId: result.userId,
      action: "auth.mfa_verify",
      status: "failure",
      details: { reason: "set_session_failed", message: error.message },
      ipAddress: ip,
      userAgent: ua,
    });
    const hint =
      process.env.NODE_ENV === "development" ? ` ${error.message}` : "";
    return NextResponse.json(
      {
        error: `Could not complete sign-in.${hint || " Request a new code from the login page."}`,
      },
      { status: 500 }
    );
  }

  await writeAuditLog({
    actorUserId: result.userId,
    action: "auth.mfa_verify",
    status: "success",
    details: { challenge_id },
    ipAddress: ip,
    userAgent: ua,
  });

  await writeAuditLog({
    actorUserId: result.userId,
    action: "auth.sign_in",
    status: "success",
    details: { via: "mfa_email_otp" },
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json({ ok: true, redirect: result.redirect });
}
