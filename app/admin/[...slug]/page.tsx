import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SYSTEMS, findItem } from "@/lib/nav";
import { SubPage, SystemHome } from "@/components/SystemPages";

export default function AdminPage({ params }: { params: Promise<{ slug: string[] }> }) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <AdminPageContent params={params} />
    </Suspense>
  );
}

async function AdminPageContent({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const admin = SYSTEMS.admin;
  const found = findItem(admin, `${admin.href}/${slug.join("/")}`);
  if (!found) notFound();
  return <SubPage system={admin} group={found.group.title} label={found.item.label} />;
}
