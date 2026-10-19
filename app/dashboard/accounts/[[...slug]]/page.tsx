import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SYSTEMS, findItem } from "@/lib/nav";
import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import AccountsOverview from "@/components/accounts/AccountsOverview";

async function AccountsContent({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (slug.length === 0) return <AccountsOverview />;
  const href = ["/dashboard/accounts", ...slug].join("/");
  const found = findItem(SYSTEMS.dashboard, href);
  if (!found || !href.startsWith("/dashboard/accounts")) notFound();
  const { item } = found;
  const Icon = item.icon;
  return <section className="py-6 text-[#272b29]">
    <p className="mb-3 text-xs text-[#626862]">Accounts / {item.label}</p>
    <h1 className="mb-6 flex items-center gap-3 text-2xl font-medium"><Icon size={25} aria-hidden="true" />{item.label}</h1>
    {item.children?.length ? <div className="grid gap-3 sm:grid-cols-2">{item.children.map(child => <Link key={child.href} href={child.href} className="rounded-2xl border border-white/70 bg-white/50 p-5 shadow-sm hover:bg-white/80">{child.label}</Link>)}</div> : <div className="rounded-2xl border border-white/70 bg-white/40 p-8 text-center"><p>พื้นที่สำหรับ{item.label}</p><p className="mt-2 text-sm text-[#626862]">ยังไม่เชื่อมต่อข้อมูลบัญชี</p></div>}
  </section>;
}

export default function AccountsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  return <Suspense fallback={<WorkspaceLoading />}><AccountsContent params={params} /></Suspense>;
}
