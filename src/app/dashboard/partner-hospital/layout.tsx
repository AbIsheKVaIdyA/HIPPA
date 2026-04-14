import { requireRole } from "@/lib/auth/guards";

export default async function PartnerHospitalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("third_party_hospital");
  return children;
}
