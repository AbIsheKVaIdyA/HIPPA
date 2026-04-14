import { requireRole } from "@/lib/auth/guards";

export default async function NurseDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("nurse");
  return children;
}
