/**
 * Best-effort client IP for rate limiting and audit (trust proxy headers when present).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

export function getUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  if (!ua) return null;
  return ua.slice(0, 512);
}
