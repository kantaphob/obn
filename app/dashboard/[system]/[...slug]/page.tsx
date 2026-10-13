import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { COMPANY_KEYS, SYSTEMS, findItem, type SystemKey } from "@/lib/nav";
import { SubPage } from "@/components/SystemPages";

export default function SystemSubPage({
  params,
}: {
  params: Promise<{ system: string; slug: string[] }>;
}) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <SystemSubPageContent params={params} />
    </Suspense>
  );
}

async function SystemSubPageContent({ params }: { params: Promise<{ system: string; slug: string[] }> }) {
  const { system, slug } = await params;
  if (!COMPANY_KEYS.includes(system as SystemKey)) notFound();
  const sys = SYSTEMS[system as SystemKey];
  const found = findItem(sys, `${sys.href}/${slug.join("/")}`);
  if (!found) notFound();
  return <SubPage system={sys} group={found.group.title} label={found.item.label} />;
}
