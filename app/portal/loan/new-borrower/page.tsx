import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authorization";

export default async function NewBorrowerPortalPage() {
  const access = await getCurrentAccess({ includeNavigation: true });
  if (!access) redirect("/login?callbackURL=/portal/loan/new-borrower");

  const canCreateBorrower = access.permissions.includes("*") || access.permissions.includes("borrowers:write");
  const canUseLoan = !access.accessConfigured || access.appKeys.includes("loan");
  const canOpenBorrowerMenu = !access.accessConfigured || access.permissions.includes("*") || access.navigationHrefs.includes("/dashboard/loan/borrowers");
  if (!canCreateBorrower || !canUseLoan || !canOpenBorrowerMenu) redirect("/portal");

  redirect("/dashboard/loan/borrowers?new=1");
}
