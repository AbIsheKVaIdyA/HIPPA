import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.PATIENT_DATA_ENCRYPTION_KEY;
  if (!raw?.trim()) {
    throw new Error(
      "PATIENT_DATA_ENCRYPTION_KEY is not set (use 32-byte key as base64, e.g. openssl rand -base64 32)"
    );
  }
  const buf = Buffer.from(raw.trim(), "base64");
  if (buf.length === 32) return buf;
  return scryptSync(raw.trim(), "careport-patient-data", 32);
}

/** AES-256-GCM encrypt; output is URL-safe base64 of iv|tag|ciphertext. */
export function encryptPatientField(plainText: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ciphertext]);
  return packed.toString("base64url");
}

export function decryptPatientField(payload: string): string {
  const key = getKey();
  const packed = Buffer.from(payload, "base64url");
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  );
}

export function encryptPatientJson(value: unknown): string {
  return encryptPatientField(JSON.stringify(value));
}

export function decryptPatientJson<T = unknown>(payload: string): T {
  return JSON.parse(decryptPatientField(payload)) as T;
}
