import LoanOverview from "@/components/loan/LoanOverview";
import { Suspense } from "react";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";

export default function LoanOverviewPage() {
  return <Suspense fallback={<WorkspaceLoading />}><LoanOverview /></Suspense>;
}
