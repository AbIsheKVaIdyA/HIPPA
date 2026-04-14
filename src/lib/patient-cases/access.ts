import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

export type SessionRole = UserRole | null;

export async function getRequesterProfile(): Promise<{
  userId: string;
  role: SessionRole;
  email: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();
  return {
    userId: user.id,
    role: (profile?.role as UserRole) ?? null,
    email: profile?.email ?? null,
  };
}
