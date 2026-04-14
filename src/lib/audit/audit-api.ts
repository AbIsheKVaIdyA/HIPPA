import { getClientIp, getUserAgent } from "@/lib/http/client-ip";
import type { AuditStatus } from "@/lib/audit/write-audit-log";
import { writeAuditLog } from "@/lib/audit/write-audit-log";

export type Requester = {
  userId: string;
  role: string | null;
  email: string | null;
} | null;

export async function auditPhi(
  request: Request,
  me: Requester,
  opts: {
    action: string;
    status: AuditStatus;
    resourceType?: string | null;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await writeAuditLog({
    actorUserId: me?.userId ?? null,
    actorEmail: me?.email ?? null,
    actorRole: me?.role ?? null,
    action: opts.action,
    resourceType: opts.resourceType ?? null,
    resourceId: opts.resourceId ?? null,
    status: opts.status,
    details: opts.details,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });
}
