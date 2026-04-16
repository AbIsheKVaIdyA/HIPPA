/** US-style mobile: digits only, max 10 (no country code in field). */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function formatPhoneDisplay(digits: string): string {
  const d = normalizePhoneDigits(digits);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function initialsFromName(name: string | undefined | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Allow decimal numbers for vitals fields (e.g. temp 36.5). */
export function sanitizeVitalDecimal(raw: string, maxLen = 6): string {
  let s = raw.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s.slice(0, maxLen);
}

/** Whole numbers only for HR, SpO2, height, etc. */
export function sanitizeDigits(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

/** BP systolic / diastolic — 2–3 digits each. */
export function sanitizeBpPart(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 3);
}
