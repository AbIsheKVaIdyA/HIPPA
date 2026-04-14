import { z } from "zod";

export const createPatientCaseSchema = z.object({
  assigned_doctor_id: z.string().uuid(),
  assigned_nurse_id: z.string().uuid(),
  patient_legal_name: z.string().min(1).max(200),
  patient_email: z.string().email(),
  patient_phone: z.string().max(40).optional().or(z.literal("")),
  patient_dob: z.string().min(4).max(32),
  patient_id_proof: z.string().max(2000).optional().or(z.literal("")),
  health_issue: z.string().min(1).max(8000),
  prior_case_id: z.string().uuid().optional().nullable(),
  invite_patient: z.boolean().optional().default(true),
});

export const vitalsPayloadSchema = z.object({
  temperature_c: z.string().max(20).optional().or(z.literal("")),
  height_cm: z.string().max(20).optional().or(z.literal("")),
  weight_kg: z.string().max(20).optional().or(z.literal("")),
  blood_pressure: z.string().max(40).optional().or(z.literal("")),
  heart_rate_bpm: z.string().max(20).optional().or(z.literal("")),
  spo2_pct: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const doctorNoteSchema = z.object({
  body: z.string().min(1).max(20000),
});
