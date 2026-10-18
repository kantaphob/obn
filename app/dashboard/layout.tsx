import { Suspense, type ReactNode } from "react";
import AppFrame from "@/components/AppFrame";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppFrame theme="modern-white"><WorkspaceLoading /></AppFrame>}>
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}

async function AuthenticatedDashboard({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackURL=/dashboard");
  return <AppFrame theme="modern-white">{children}</AppFrame>;
}
