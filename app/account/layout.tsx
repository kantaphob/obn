import { Suspense, type ReactNode } from "react";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <AuthenticatedAccount>{children}</AuthenticatedAccount>
    </Suspense>
  );
}

async function AuthenticatedAccount({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackURL=/account/security");
  return children;
}
