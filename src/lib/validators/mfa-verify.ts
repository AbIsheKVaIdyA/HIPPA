import { z } from "zod";

export const mfaVerifySchema = z.object({
  challenge_id: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});
