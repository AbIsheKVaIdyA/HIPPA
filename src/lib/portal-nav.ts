export type PortalNavItem = { href: string; label: string };

/** Side navigation for each role — used by `DashboardShell` on large screens. */
export const PORTAL_NAV: Record<
  "doctor" | "nurse" | "front_desk" | "patient" | "admin" | "partner",
  PortalNavItem[]
> = {
  doctor: [
    { href: "/dashboard/doctor", label: "Overview" },
    { href: "/dashboard/doctor/cases", label: "Patient cases" },
  ],
  nurse: [
    { href: "/dashboard/nurse", label: "Overview" },
    { href: "/dashboard/nurse/cases", label: "Patient cases" },
  ],
  front_desk: [{ href: "/dashboard/front-desk", label: "Workspace" }],
  patient: [{ href: "/dashboard/patient", label: "My care" }],
  admin: [{ href: "/dashboard/admin", label: "Dashboard" }],
  partner: [{ href: "/dashboard/partner-hospital", label: "Referrals" }],
};

export function isNavActive(
  pathname: string,
  href: string,
  allHrefs: string[]
): boolean {
  const others = allHrefs.filter((h) => h !== href);
  const normalized = href.endsWith("/") ? href.slice(0, -1) : href;
  const isParentOfAnother = others.some((h) => {
    const o = h.endsWith("/") ? h.slice(0, -1) : h;
    return o.startsWith(normalized + "/");
  });
  if (isParentOfAnother) {
    return pathname === href || pathname === href + "/" || pathname === normalized;
  }
  return pathname === href || pathname.startsWith(normalized + "/");
}
