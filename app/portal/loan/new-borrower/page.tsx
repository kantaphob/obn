import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authorization";
import NewBorrowerForm from "./NewBorrowerForm";

async function AuthorizedNewBorrowerPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?callbackURL=/portal/loan/new-borrower");

  const canCreateBorrower = access.permissions.includes("*") || access.permissions.includes("borrowers:write");
  const canUseLoan = !access.accessConfigured || access.appKeys.includes("loan");
  if (!canCreateBorrower || !canUseLoan) redirect("/portal");

  return <NewBorrowerForm />;
}

export default function NewBorrowerPortalPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-[#f5f7f4] px-4 text-sm text-[#718076]">
          กำลังตรวจสอบสิทธิ์และโหลดแบบฟอร์มผู้กู้ใหม่…
        </main>
      }
    >
      <AuthorizedNewBorrowerPage />
    </Suspense>
  );
}
