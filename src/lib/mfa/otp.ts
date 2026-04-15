import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

function pepper(): string {
  const p = process.env.MFA_OTP_PEPPER?.trim();
  if (p) return p;
  const fallback = process.env.PATIENT_DATA_ENCRYPTION_KEY?.trim();
  if (fallback) return `mfa-otp:${fallback}`;
  throw new Error(
    "MFA_OTP_PEPPER or PATIENT_DATA_ENCRYPTION_KEY must be set when MFA is enabled"
  );
}

export function generateNumericOtp(length = 6): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

export function hashOtpForChallenge(challengeId: string, otp: string): string {
  return createHmac("sha256", pepper())
    .update(`${challengeId}:${otp.trim()}`)
    .digest("hex");
}

export function otpsMatch(
  challengeId: string,
  plainOtp: string,
  storedHash: string
): boolean {
  const a = Buffer.from(hashOtpForChallenge(challengeId, plainOtp), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf("@");
  if (at < 1) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const show = local.slice(0, Math.min(2, local.length));
  return `${show}***@${domain}`;
}
