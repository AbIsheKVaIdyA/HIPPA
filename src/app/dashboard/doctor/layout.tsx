import { requireRole } from "@/lib/auth/guards";

export default async function DoctorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("doctor");
  return children;
}
