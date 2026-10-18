import { Suspense, type ReactNode } from "react";
import AppFrame from "@/components/AppFrame";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// เครื่องมือไม่มี Sidebar ของระบบ — ใช้พื้นที่เต็มหน้า
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppFrame sidebar={false}><WorkspaceLoading /></AppFrame>}>
      <AuthenticatedTools>{children}</AuthenticatedTools>
    </Suspense>
  );
}

async function AuthenticatedTools({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackURL=/tools");
  return <AppFrame sidebar={false}>{children}</AppFrame>;
}
