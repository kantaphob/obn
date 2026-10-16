import LoanOverview from "@/components/loan/LoanOverview";
import LoanOverviewAutoRefresh from "@/components/loan/LoanOverviewAutoRefresh";
import { Suspense } from "react";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";

export default function LoanOverviewPage() {
  return <><LoanOverviewAutoRefresh /><Suspense fallback={<WorkspaceLoading />}><LoanOverview /></Suspense></>;
}
