import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function parseServiceAccount(): Record<string, unknown> {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    let decoded: string;
    try {
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64. Encode the entire service account .json file (UTF-8)."
      );
    }
    try {
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_BASE64 decodes to invalid JSON. Base64 must be the full service account JSON from Firebase."
      );
    }
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "Firebase is not configured: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64"
    );
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON (the full object from Firebase → Project settings → Service accounts → Generate new private key). Not a private key string by itself."
    );
  }
}

let app: App | null = null;

export function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }
  app = initializeApp({
    credential: cert(parseServiceAccount() as Parameters<typeof cert>[0]),
  });
  return app;
}

export function getFirestoreDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
