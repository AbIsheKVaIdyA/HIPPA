/**
 * Default Supabase browser storage key (see @supabase/supabase-js SupabaseClient).
 */
export function supabaseAuthCookieBaseName(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}

type CookieStoreLike = {
  getAll(): { name: string; value: string }[];
  set(
    name: string,
    value: string,
    options?: {
      path?: string;
      maxAge?: number;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      httpOnly?: boolean;
    }
  ): void;
};

/**
 * Removes Supabase auth cookies from this response without calling the Auth
 * `logout` API — so refresh/access tokens kept server-side (e.g. MFA challenge)
 * remain valid until they expire naturally.
 */
export function clearSupabaseAuthCookies(cookieStore: CookieStoreLike): void {
  const base = supabaseAuthCookieBaseName();
  if (!base) return;

  const secure = process.env.NODE_ENV === "production";
  const baseOpts = {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure,
  };

  for (const c of cookieStore.getAll()) {
    if (c.name === base || c.name.startsWith(`${base}.`)) {
      cookieStore.set(c.name, "", { ...baseOpts, httpOnly: false });
      cookieStore.set(c.name, "", { ...baseOpts, httpOnly: true });
    }
  }
}
