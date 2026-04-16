/**
 * When true, **admin portal only** (`/login/admin`) uses email OTP after password;
 * session completes after POST /api/auth/verify-mfa. All other portals use password-only
 * (demo-friendly). Requires Firebase, Resend, and PATIENT_DATA_ENCRYPTION_KEY when enabled.
 */
export function isMfaEmailOtpEnabled(): boolean {
  return process.env.MFA_EMAIL_OTP_ENABLED?.trim().toLowerCase() === "true";
}
