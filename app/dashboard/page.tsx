import { GroupOverview } from "@/components/SystemPages";

import LoanOverviewAutoRefresh from "@/components/loan/LoanOverviewAutoRefresh";

export default function DashboardPage() {
  return <><LoanOverviewAutoRefresh /><GroupOverview /></>;
}
