import { requireRole } from "@/lib/auth/guards";

export default async function FrontDeskDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("front_desk");
  return children;
}
