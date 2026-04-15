import { Resend } from "resend";

/** Resend test sender; must be `email@domain` or `Display Name <email@domain>`. */
const RESEND_FROM_FALLBACK = "onboarding@resend.dev";

function isValidEmailAtom(s: string): boolean {
  return /^[^\s<>]+@[^\s<>]+$/.test(s);
}

/**
 * Resend rejects malformed `from` (validation_error). Common mistakes: missing `>`,
 * extra wrapping quotes in .env, or a display name without angle brackets.
 */
function resolveResendFrom(): string {
  let v = process.env.RESEND_FROM_EMAIL?.trim();
  if (!v) return RESEND_FROM_FALLBACK;
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  if (!v.includes("@")) return RESEND_FROM_FALLBACK;

  if (v.includes("<")) {
    if (!v.includes(">")) return RESEND_FROM_FALLBACK;
    const start = v.indexOf("<");
    const end = v.indexOf(">", start);
    if (end === -1) return RESEND_FROM_FALLBACK;
    const inner = v.slice(start + 1, end).trim();
    if (!isValidEmailAtom(inner)) return RESEND_FROM_FALLBACK;
    return v;
  }

  if (!isValidEmailAtom(v)) return RESEND_FROM_FALLBACK;
  return v;
}

/**
 * Sends the MFA code via Resend (https://resend.com).
 * Set `RESEND_API_KEY` in `.env.local` (replace the placeholder with your real key from the Resend dashboard).
 */
export async function sendMfaOtpEmail(
  to: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const from = resolveResendFrom();

  const resend = new Resend(key);

  try {
    const { error } = await resend.emails.send({
      from,
      to: to.trim(),
      subject: "Your CarePort sign-in code",
      html: `<p>Your verification code is:</p><p style="font-size:26px;font-weight:700;letter-spacing:0.25em;font-family:ui-monospace,monospace">${code}</p><p>This code expires in 10 minutes. If you did not try to sign in, ignore this email.</p>`,
    });

    if (error) {
      return {
        ok: false,
        error: `${error.message}${error.name ? ` (${error.name})` : ""}`,
      };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Resend request failed" };
  }
}
