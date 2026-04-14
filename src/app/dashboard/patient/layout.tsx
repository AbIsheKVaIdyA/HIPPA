import { requireRole } from "@/lib/auth/guards";

export default async function PatientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("patient");
  return children;
}
