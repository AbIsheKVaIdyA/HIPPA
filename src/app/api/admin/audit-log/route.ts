import { NextResponse } from "next/server";
import { auditPhi } from "@/lib/audit/audit-api";
import { getRequesterProfile } from "@/lib/patient-cases/access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await getRequesterProfile();
  if (!me?.userId || me.role !== "admin") {
    await auditPhi(request, me, {
      action: "audit_log.list",
      status: "failure",
      details: { reason: "forbidden" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50)
  );
  const offset = Math.max(
    0,
    Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0
  );

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    await auditPhi(request, me, {
      action: "audit_log.list",
      status: "failure",
      details: { reason: "query_error", message: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    offset,
    limit,
  });
}
