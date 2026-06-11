import { requireRole } from "@/lib/auth";

/**
 * One gate for the whole staff console. Every /manage/* route is staff/admin
 * only; members who reach any of them are redirected home (see requireRole).
 * Individual server actions still re-check the role — this layout guard is for
 * navigation, not the security boundary.
 */
export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("staff", "admin");
  return children;
}
