import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardPathForRole, type UserRole } from "@/lib/roles";

function hashSearchParams(url: URL): URLSearchParams {
  const raw = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  return new URLSearchParams(raw);
}

/**
 * Completes auth from the current invite / magic-link URL.
 * Supports PKCE (?code=) and implicit flow (#access_token=&refresh_token=).
 * Hash is never sent to the server, so this must run in the browser.
 *
 * Invited users are sent to /auth/set-password first so they choose a password
 * before entering a dashboard (Supabase stores it hashed in Auth, not in public tables).
 */
export async function completeSessionFromUrl(
  supabase: SupabaseClient,
  fullUrl: string
): Promise<{ ok: true; redirect: string } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(fullUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const hashParams = hashSearchParams(url);
  const linkTypeFromHash = hashParams.get("type");
  const inviteFlag = url.searchParams.get("invite") === "1";
  const isInviteFlow = inviteFlag || linkTypeFromHash === "invite";

  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, reason: error.message };
  } else {
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) return { ok: false, reason: error.message };
    } else {
      return { ok: false, reason: "no_code_or_hash_tokens" };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no_user" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const destination =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : profile?.role
        ? dashboardPathForRole(profile.role as UserRole)
        : "/";

  if (isInviteFlow) {
    return {
      ok: true,
      redirect: `/auth/set-password?next=${encodeURIComponent(destination)}`,
    };
  }

  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return { ok: true, redirect: nextParam };
  }

  if (profile?.role) {
    return {
      ok: true,
      redirect: dashboardPathForRole(profile.role as UserRole),
    };
  }

  return { ok: false, reason: "no_profile" };
}
