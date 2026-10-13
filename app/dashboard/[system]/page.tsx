import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { COMPANY_KEYS, SYSTEMS, type SystemKey } from "@/lib/nav";
import { SystemHome } from "@/components/SystemPages";

export default function SystemPage({ params }: { params: Promise<{ system: string }> }) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <SystemPageContent params={params} />
    </Suspense>
  );
}

async function SystemPageContent({ params }: { params: Promise<{ system: string }> }) {
  const { system } = await params;
  if (!COMPANY_KEYS.includes(system as SystemKey)) notFound();
  return <SystemHome system={SYSTEMS[system as SystemKey]} />;
}
