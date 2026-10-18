import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authorization";
import UpdateBorrowerForm from "./UpdateBorrowerForm";

async function AuthorizedUpdateBorrowerPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?callbackURL=/portal/loan/update-borrower");

  const canUpdateBorrower = access.permissions.includes("*") || access.permissions.includes("borrowers:write");
  const canUseLoan = !access.accessConfigured || access.appKeys.includes("loan");
  if (!canUpdateBorrower || !canUseLoan) redirect("/portal");

  return <UpdateBorrowerForm />;
}

export default function UpdateBorrowerPortalPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-[#f5f7f4] px-4 text-sm text-[#718076]">
          กำลังตรวจสอบสิทธิ์และโหลดรายชื่อผู้กู้…
        </main>
      }
    >
      <AuthorizedUpdateBorrowerPage />
    </Suspense>
  );
}
