import { z } from "zod";

export const createPatientCaseSchema = z.object({
  assigned_doctor_id: z.string().uuid(),
  assigned_nurse_id: z.string().uuid(),
  patient_legal_name: z.string().min(1).max(200),
  patient_email: z.string().email(),
  /** Empty or exactly 10 digits (US mobile without country code). */
  patient_phone: z
    .union([
      z.literal(""),
      z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
    ])
    .default(""),
  patient_dob: z.string().min(4).max(32),
  patient_id_proof: z.string().max(2000).optional().or(z.literal("")),
  health_issue: z.string().min(1).max(8000),
  prior_case_id: z.string().uuid().optional().nullable(),
  invite_patient: z.boolean().optional().default(true),
});

function optionalNumField(
  val: string | undefined,
  label: string,
  min: number,
  max: number
): string | null {
  const t = (val ?? "").trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n) || n < min || n > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return null;
}

export const vitalsPayloadSchema = z
  .object({
    temperature_c: z.string().max(20).optional().or(z.literal("")),
    height_cm: z.string().max(20).optional().or(z.literal("")),
    weight_kg: z.string().max(20).optional().or(z.literal("")),
    blood_pressure: z.string().max(40).optional().or(z.literal("")),
    heart_rate_bpm: z.string().max(20).optional().or(z.literal("")),
    spo2_pct: z.string().max(20).optional().or(z.literal("")),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const err = (path: keyof typeof data, msg: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: [path] });
    };

    const keys = [
      "temperature_c",
      "height_cm",
      "weight_kg",
      "blood_pressure",
      "heart_rate_bpm",
      "spo2_pct",
      "notes",
    ] as const;
    const hasAny = keys.some((k) => data[k] && String(data[k]).trim());
    if (!hasAny) {
      err("temperature_c", "Enter at least one vital or a note.");
      return;
    }

    const t = optionalNumField(data.temperature_c, "Temperature (°C)", 32, 43);
    if (t) err("temperature_c", t);

    const h = optionalNumField(data.height_cm, "Height (cm)", 50, 250);
    if (h) err("height_cm", h);

    const w = optionalNumField(data.weight_kg, "Weight (kg)", 2, 400);
    if (w) err("weight_kg", w);

    const bp = (data.blood_pressure ?? "").trim();
    if (bp) {
      const m = /^(\d{2,3})\/(\d{2,3})$/.exec(bp);
      if (!m) {
        err("blood_pressure", "Blood pressure must look like 120/80 (systolic/diastolic).");
      } else {
        const sys = Number(m[1]);
        const dia = Number(m[2]);
        if (sys < 60 || sys > 250 || dia < 30 || dia > 180) {
          err("blood_pressure", "Blood pressure values look out of range.");
        }
        if (sys <= dia) {
          err("blood_pressure", "Systolic (first number) should be higher than diastolic.");
        }
      }
    }

    const hr = optionalNumField(data.heart_rate_bpm, "Heart rate (bpm)", 25, 250);
    if (hr) err("heart_rate_bpm", hr);

    const spo2 = optionalNumField(data.spo2_pct, "SpO₂ (%)", 50, 100);
    if (spo2) err("spo2_pct", spo2);
  });

export const doctorNoteSchema = z.object({
  body: z.string().min(1).max(20000),
});
