import { Suspense } from "react";
import PaymentsClient from "./PaymentsClient";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";

export const instant = false;
export default function PaymentsPage({ searchParams }: { searchParams: Promise<{ contractId?: string; borrowerCode?: string }> }) {
  return <Suspense fallback={<WorkspaceLoading />}><PaymentsContent searchParams={searchParams} /></Suspense>;
}
async function PaymentsContent({ searchParams }: { searchParams: Promise<{ contractId?: string; borrowerCode?: string }> }) {
  const params = await searchParams;
  return <PaymentsClient initialContractId={params.contractId} initialBorrowerCode={params.borrowerCode} />;
}
