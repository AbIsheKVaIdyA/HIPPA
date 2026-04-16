import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { createClient } from "@/lib/supabase/server";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import type { UserRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await getRequesterProfile();
  const role = new URL(request.url).searchParams.get("role");

  const allowedByRole =
    !!me &&
    (((me.role === "front_desk" || me.role === "admin") &&
      (role === "doctor" || role === "nurse")) ||
      (me.role === "doctor" && role === "third_party_hospital") ||
      (me.role === "admin" && role === "third_party_hospital"));

  if (!allowedByRole) {
    await auditPhi(request, me, {
      action: "staff_directory.list",
      status: "failure",
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    role !== "doctor" &&
    role !== "nurse" &&
    role !== "third_party_hospital"
  ) {
    await auditPhi(request, me, {
      action: "staff_directory.list",
      status: "failure",
      details: { reason: "invalid_role_param" },
    });
    return NextResponse.json(
      { error: "Query role must be doctor, nurse, or third_party_hospital" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("role", role as UserRole)
    .order("full_name", { ascending: true });

  if (error) {
    await auditPhi(request, me, {
      action: "staff_directory.list",
      status: "failure",
      details: { reason: "query_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staff = data ?? [];
  await auditPhi(request, me, {
    action: "staff_directory.list",
    status: "success",
    details: { role_filter: role, result_count: staff.length },
  });
  return NextResponse.json({ staff });
}
