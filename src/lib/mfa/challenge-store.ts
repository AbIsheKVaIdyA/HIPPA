import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { encryptPatientJson, decryptPatientJson } from "@/lib/crypto/patient-data";
import { getFirestoreDb } from "@/lib/firebase/admin";
import { hashOtpForChallenge, otpsMatch } from "@/lib/mfa/otp";

const DEFAULT_COLLECTION = "auth_mfa_challenges";

function collectionName(): string {
  return process.env.MFA_FIRESTORE_COLLECTION?.trim() || DEFAULT_COLLECTION;
}

export type SessionBundle = {
  access_token: string;
  refresh_token: string;
};

export async function createMfaChallenge(params: {
  challengeId: string;
  otpPlain: string;
  session: SessionBundle;
  emailNorm: string;
  userId: string;
  redirect: string;
}): Promise<void> {
  const db = getFirestoreDb();
  const ref = db.collection(collectionName()).doc(params.challengeId);
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
  const sessionCipher = encryptPatientJson(params.session);
  await ref.set({
    otpHash: hashOtpForChallenge(params.challengeId, params.otpPlain),
    sessionCipher,
    expiresAt,
    failedAttempts: 0,
    emailNorm: params.emailNorm,
    userId: params.userId,
    redirect: params.redirect,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Removes a challenge (e.g. if email send fails after the doc was written). */
export async function deleteMfaChallenge(challengeId: string): Promise<void> {
  const db = getFirestoreDb();
  await db.collection(collectionName()).doc(challengeId).delete().catch(() => {});
}

export type VerifyMfaResult =
  | { ok: true; session: SessionBundle; redirect: string; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "locked" | "bad_otp" };

export async function verifyMfaChallenge(
  challengeId: string,
  otpPlain: string
): Promise<VerifyMfaResult> {
  const db = getFirestoreDb();
  const ref = db.collection(collectionName()).doc(challengeId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, reason: "not_found" };
  }

  const d = snap.data() as {
    otpHash: string;
    sessionCipher: string;
    expiresAt: Timestamp;
    failedAttempts?: number;
    redirect: string;
    userId: string;
  };

  if (d.expiresAt.toMillis() < Date.now()) {
    await ref.delete().catch(() => {});
    return { ok: false, reason: "expired" };
  }

  const fails = d.failedAttempts ?? 0;
  if (fails >= 5) {
    await ref.delete().catch(() => {});
    return { ok: false, reason: "locked" };
  }

  if (!otpsMatch(challengeId, otpPlain, d.otpHash)) {
    await ref.update({ failedAttempts: FieldValue.increment(1) });
    return { ok: false, reason: "bad_otp" };
  }

  let session: SessionBundle;
  try {
    session = decryptPatientJson<SessionBundle>(d.sessionCipher);
  } catch {
    await ref.delete().catch(() => {});
    return { ok: false, reason: "not_found" };
  }

  await ref.delete().catch(() => {});

  return {
    ok: true,
    session,
    redirect: d.redirect,
    userId: d.userId,
  };
}
