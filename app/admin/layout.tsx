import { Suspense, type ReactNode } from "react";
import AppFrame from "@/components/AppFrame";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppFrame theme="glass-dark"><WorkspaceLoading /></AppFrame>}>
      <AuthenticatedAdmin>{children}</AuthenticatedAdmin>
    </Suspense>
  );
}

async function AuthenticatedAdmin({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackURL=/admin");
  return <AppFrame theme="glass-dark">{children}</AppFrame>;
}
