import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getClientIp, getUserAgent } from "@/lib/http/client-ip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, role")
      .eq("id", user.id)
      .maybeSingle();

    await writeAuditLog({
      actorUserId: user.id,
      actorEmail: profile?.email ?? null,
      actorRole: profile?.role ?? null,
      action: "auth.sign_out",
      status: "success",
      details: {},
      ipAddress: ip,
      userAgent: ua,
    });
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
