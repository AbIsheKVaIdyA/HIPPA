/**
 * When true, password sign-in issues an email OTP; session is completed only after
 * POST /api/auth/verify-mfa. Requires Firebase, Resend, and encryption key (see .env.example).
 */
export function isMfaEmailOtpEnabled(): boolean {
  return process.env.MFA_EMAIL_OTP_ENABLED?.trim().toLowerCase() === "true";
}
