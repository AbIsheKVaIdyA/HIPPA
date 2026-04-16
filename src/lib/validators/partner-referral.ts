import { z } from "zod";

/** What the doctor explicitly shares with the partner (encrypted at rest). */
export const sharedPartnerContextSchema = z.object({
  clinicalRequest: z.string().min(1).max(8000),
  instructions: z.string().max(8000).optional(),
  /** Optional de-identified hint only — never auto-filled from full chart. */
  patientHint: z.string().max(500).optional(),
});

export const createPartnerReferralSchema = z.object({
  case_id: z.string().uuid(),
  partner_user_id: z.string().uuid(),
  referral_kind: z.string().min(1).max(200).optional(),
  /** Copied from staff directory at send time (not verified PHI). */
  partner_display_name: z.string().max(200).optional(),
  shared_context: sharedPartnerContextSchema,
});

export const submitPartnerReferralResultSchema = z.object({
  action: z.literal("submit"),
  result_text: z.string().min(1).max(16000),
});

export const revokePartnerReferralSchema = z.object({
  action: z.literal("revoke"),
});

export const patchPartnerReferralSchema = z.discriminatedUnion("action", [
  submitPartnerReferralResultSchema,
  revokePartnerReferralSchema,
]);
