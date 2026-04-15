/**
 * Turns MFA challenge / Firestore failures into a safe, actionable API message.
 */
export function mapMfaChallengeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();

  if (
    msg.includes("PATIENT_DATA_ENCRYPTION_KEY") ||
    lower.includes("encryption_key")
  ) {
    return "Missing or invalid PATIENT_DATA_ENCRYPTION_KEY. Use a 32-byte key as base64 (e.g. openssl rand -base64 32).";
  }

  if (msg.includes("FIREBASE_SERVICE_ACCOUNT_JSON must be")) return msg;
  if (msg.includes("FIREBASE_SERVICE_ACCOUNT_BASE64")) return msg;
  if (msg.includes("Firebase is not configured")) return msg;

  if (
    lower.includes("unexpected token") ||
    lower.includes("json parse error") ||
    (lower.includes("json") && lower.includes("position"))
  ) {
    return "Firebase credentials are not valid JSON. Use the full service account file from Firebase (Project settings → Service accounts → Generate new private key), as one line in FIREBASE_SERVICE_ACCOUNT_JSON, or base64-encode the entire file into FIREBASE_SERVICE_ACCOUNT_BASE64.";
  }

  if (
    lower.includes("permission_denied") ||
    lower.includes("missing or insufficient permissions") ||
    /status[:\s]*7\b/.test(lower)
  ) {
    return "Firestore permission denied. Create a Firestore database in the Firebase console, enable the Firestore API for this GCP project, and ensure the service account can write data.";
  }

  if (
    lower.includes("not_found") &&
    (lower.includes("database") || lower.includes("default database"))
  ) {
    return "Firestore is not available for this project. In Firebase Console → Firestore → Create database.";
  }

  if (lower.includes("mfa_otp_pepper") || lower.includes("pepper")) {
    return msg;
  }

  const verbose =
    process.env.MFA_VERBOSE_ERRORS === "true" ||
    process.env.NODE_ENV === "development";

  if (verbose) {
    return `Could not start email verification. ${msg}`;
  }

  return "Could not start email verification. Check FIREBASE_SERVICE_ACCOUNT_* , PATIENT_DATA_ENCRYPTION_KEY, and that Firestore exists; see server logs.";
}
