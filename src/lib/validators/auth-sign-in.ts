import { z } from "zod";
import { PORTALS, type PortalSlug } from "@/lib/roles";

const portalSlugs = new Set(PORTALS.map((p) => p.slug));

function isPortalSlug(s: string): s is PortalSlug {
  return portalSlugs.has(s as PortalSlug);
}

export const authSignInSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  portal_slug: z
    .string()
    .max(64)
    .refine((s) => isPortalSlug(s), "Invalid portal"),
});
