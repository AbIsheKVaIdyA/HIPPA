export type UserRole =
  | "admin"
  | "doctor"
  | "nurse"
  | "front_desk"
  | "patient"
  | "third_party_hospital";

export type PortalSlug =
  | "admin"
  | "doctor"
  | "nurse"
  | "front-desk"
  | "patient"
  | "partner-hospital";

export type PortalDefinition = {
  slug: PortalSlug;
  role: UserRole;
  title: string;
  description: string;
  gradient: string;
};

export const PORTALS: PortalDefinition[] = [
  {
    slug: "admin",
    role: "admin",
    title: "Administration",
    description: "Manage staff access, invites, and organization settings.",
    gradient: "from-violet-600/90 to-indigo-700/95",
  },
  {
    slug: "doctor",
    role: "doctor",
    title: "Physician",
    description: "Clinical workflows, orders, and patient care documentation.",
    gradient: "from-emerald-600/90 to-teal-700/95",
  },
  {
    slug: "nurse",
    role: "nurse",
    title: "Nursing",
    description: "Care coordination, vitals, and bedside documentation.",
    gradient: "from-teal-600/90 to-emerald-800/95",
  },
  {
    slug: "front-desk",
    role: "front_desk",
    title: "Front desk",
    description: "Registration, scheduling, and patient invitations.",
    gradient: "from-amber-600/90 to-orange-700/95",
  },
  {
    slug: "patient",
    role: "patient",
    title: "Patient",
    description: "Secure access to your health information and messages.",
    gradient: "from-rose-600/90 to-pink-700/95",
  },
  {
    slug: "partner-hospital",
    role: "third_party_hospital",
    title: "Partner hospital",
    description: "Coordinated care and referrals with your organization.",
    gradient: "from-slate-600/90 to-slate-800/95",
  },
];

const SLUG_TO_ROLE: Record<PortalSlug, UserRole> = PORTALS.reduce(
  (acc, p) => {
    acc[p.slug] = p.role;
    return acc;
  },
  {} as Record<PortalSlug, UserRole>
);

export function slugToRole(slug: string): UserRole | null {
  if (slug in SLUG_TO_ROLE) return SLUG_TO_ROLE[slug as PortalSlug];
  return null;
}

export function roleToSlug(role: UserRole): PortalSlug {
  const found = PORTALS.find((p) => p.role === role);
  if (!found) return "patient";
  return found.slug;
}

export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "doctor":
      return "/dashboard/doctor";
    case "nurse":
      return "/dashboard/nurse";
    case "front_desk":
      return "/dashboard/front-desk";
    case "patient":
      return "/dashboard/patient";
    case "third_party_hospital":
      return "/dashboard/partner-hospital";
    default:
      return "/";
  }
}

export function loginPathForSlug(slug: PortalSlug): string {
  return `/login/${slug}`;
}

/** Sign-in URL for a user role (used after staff invite). */
export function loginPathForRole(role: UserRole): string {
  return loginPathForSlug(roleToSlug(role));
}
