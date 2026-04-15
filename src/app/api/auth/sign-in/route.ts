import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getClientIp, getUserAgent } from "@/lib/http/client-ip";
import { isMfaEmailOtpEnabled } from "@/lib/mfa/config";
import { mapMfaChallengeError } from "@/lib/mfa/map-challenge-error";
import {
  consumeSignInRate,
  emailBucketKey,
  ipBucketKey,
  SIGN_IN_RATE,
} from "@/lib/rate-limit/sign-in-rate";
import { clearSupabaseAuthCookies } from "@/lib/supabase/clear-auth-cookies";
import {
  dashboardPathForRole,
  slugToRole,
  type UserRole,
} from "@/lib/roles";
import { authSignInSchema } from "@/lib/validators/auth-sign-in";

export const runtime = "nodejs";

async function safeSignOut(supabase: SupabaseClient) {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[api/auth/sign-in] signOut:", error.message);
    }
  } catch (e) {
    console.warn("[api/auth/sign-in] signOut exception:", e);
  }
}

export async function POST(request: Request) {
  try {
    return await handleSignIn(request);
  } catch (e) {
    console.error("[api/auth/sign-in] unhandled:", e);
    return NextResponse.json(
      { error: "Sign-in failed unexpectedly. Check the terminal for details." },
      { status: 500 }
    );
  }
}

async function handleSignIn(request: Request) {
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = authSignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sign-in payload" }, { status: 400 });
  }

  const { email, password, portal_slug } = parsed.data;
  const expectedRole = slugToRole(portal_slug);
  if (!expectedRole) {
    return NextResponse.json({ error: "Unknown portal" }, { status: 400 });
  }

  const emailNorm = email.trim().toLowerCase();

  const ipOk = await consumeSignInRate(
    ipBucketKey(portal_slug, ip),
    SIGN_IN_RATE.maxPerIp,
    SIGN_IN_RATE.windowSeconds
  );
  if (!ipOk) {
    await writeAuditLog({
      action: "auth.sign_in",
      status: "failure",
      details: { reason: "rate_limited", scope: "ip", portal_slug },
      ipAddress: ip,
      userAgent: ua,
      actorEmail: emailNorm,
    });
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const emOk = await consumeSignInRate(
    emailBucketKey(portal_slug, email),
    SIGN_IN_RATE.maxPerEmail,
    SIGN_IN_RATE.windowSeconds
  );
  if (!emOk) {
    await writeAuditLog({
      action: "auth.sign_in",
      status: "failure",
      details: { reason: "rate_limited", scope: "email", portal_slug },
      ipAddress: ip,
      userAgent: ua,
      actorEmail: emailNorm,
    });
    return NextResponse.json(
      { error: "Too many sign-in attempts for this account. Try again later." },
      { status: 429 }
    );
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

  const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signErr || !signData.user) {
    await writeAuditLog({
      action: "auth.sign_in",
      status: "failure",
      details: {
        reason: "invalid_credentials",
        portal_slug,
        code: signErr?.code ?? null,
      },
      ipAddress: ip,
      userAgent: ua,
      actorEmail: emailNorm,
    });
    return NextResponse.json(
      { error: signErr?.message ?? "Sign-in failed" },
      { status: 401 }
    );
  }

  const userId = signData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    await safeSignOut(supabase);
    await writeAuditLog({
      actorUserId: userId,
      actorEmail: emailNorm,
      action: "auth.sign_in",
      status: "failure",
      details: { reason: "profile_missing", portal_slug },
      ipAddress: ip,
      userAgent: ua,
    });
    return NextResponse.json(
      { error: "Profile not found. Complete your invite link first." },
      { status: 403 }
    );
  }

  if (profile.role !== expectedRole) {
    await safeSignOut(supabase);
    await writeAuditLog({
      actorUserId: userId,
      actorEmail: profile.email,
      actorRole: profile.role,
      action: "auth.sign_in",
      status: "failure",
      details: {
        reason: "wrong_portal",
        portal_slug,
        expected_role: expectedRole,
        actual_role: profile.role,
      },
      ipAddress: ip,
      userAgent: ua,
    });
    return NextResponse.json(
      {
        error:
          "This account is for a different portal. Use the correct portal from the home page.",
      },
      { status: 403 }
    );
  }

  const redirect = dashboardPathForRole(profile.role as UserRole);

  if (isMfaEmailOtpEnabled()) {
    const [{ createMfaChallenge, deleteMfaChallenge }, { generateNumericOtp, maskEmail }, { sendMfaOtpEmail }] =
      await Promise.all([
        import("@/lib/mfa/challenge-store"),
        import("@/lib/mfa/otp"),
        import("@/lib/mfa/send-otp-email"),
      ]);

    const session = signData.session;
    if (!session?.access_token || !session.refresh_token) {
      await safeSignOut(supabase);
      await writeAuditLog({
        actorUserId: userId,
        actorEmail: profile.email,
        actorRole: profile.role,
        action: "auth.mfa_challenge",
        status: "failure",
        details: { reason: "missing_session_tokens" },
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json(
        { error: "Could not start verification. Try again." },
        { status: 500 }
      );
    }

    const challengeId = randomUUID();
    const otpPlain = generateNumericOtp(6);

    try {
      await createMfaChallenge({
        challengeId,
        otpPlain,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        emailNorm,
        userId,
        redirect,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Challenge failed";
      console.error("[api/auth/sign-in] MFA Firestore / challenge:", e);
      await safeSignOut(supabase);
      await writeAuditLog({
        actorUserId: userId,
        actorEmail: profile.email,
        actorRole: profile.role,
        action: "auth.mfa_challenge",
        status: "failure",
        details: { reason: "firestore_error", message: msg },
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: mapMfaChallengeError(e) }, { status: 500 });
    }

    // Do not call auth.signOut() — even scope "local" hits /logout and can revoke the
    // refresh token we stored in Firestore. Only clear cookies so MFA can call setSession.
    clearSupabaseAuthCookies(cookieStore);

    const targetEmail = profile.email?.trim() || email.trim();
    const sent = await sendMfaOtpEmail(targetEmail, otpPlain);
    if (!sent.ok) {
      console.error("[api/auth/sign-in] MFA Resend:", sent.error);
      await deleteMfaChallenge(challengeId);
      await writeAuditLog({
        actorUserId: userId,
        actorEmail: profile.email,
        actorRole: profile.role,
        action: "auth.mfa_challenge",
        status: "failure",
        details: { reason: "email_send_failed", message: sent.error },
        ipAddress: ip,
        userAgent: ua,
      });
      const emailHint =
        process.env.NODE_ENV === "development" ? ` ${sent.error}` : "";
      return NextResponse.json(
        {
          error: `Could not send verification email.${emailHint || " Configure Resend (RESEND_API_KEY) or the from address."}`,
        },
        { status: 500 }
      );
    }

    await writeAuditLog({
      actorUserId: userId,
      actorEmail: profile.email,
      actorRole: profile.role,
      action: "auth.mfa_challenge",
      status: "success",
      details: { portal_slug },
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({
      mfa_required: true,
      challenge_id: challengeId,
      email_masked: maskEmail(targetEmail),
    });
  }

  await writeAuditLog({
    actorUserId: userId,
    actorEmail: profile.email,
    actorRole: profile.role,
    action: "auth.sign_in",
    status: "success",
    details: { portal_slug },
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json({
    ok: true,
    redirect,
  });
}
