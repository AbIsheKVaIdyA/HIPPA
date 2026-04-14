import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, profile: null };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return { user, profile: null };
  return { user, profile };
}

export async function requireUser() {
  const { user } = await getSessionProfile();
  if (!user) redirect("/");
  return user;
}

export async function requireRole(role: UserRole) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/");
  if (!profile || profile.role !== role) redirect("/unauthorized");
  return { user, profile };
}
