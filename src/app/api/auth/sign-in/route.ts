import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getClientIp, getUserAgent } from "@/lib/http/client-ip";
import {
  consumeSignInRate,
  emailBucketKey,
  ipBucketKey,
  SIGN_IN_RATE,
} from "@/lib/rate-limit/sign-in-rate";
import {
  dashboardPathForRole,
  slugToRole,
  type UserRole,
} from "@/lib/roles";
import { authSignInSchema } from "@/lib/validators/auth-sign-in";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    await supabase.auth.signOut();
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
    await supabase.auth.signOut();
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
    redirect: dashboardPathForRole(profile.role as UserRole),
  });
}
