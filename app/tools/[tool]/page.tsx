import WorkspaceLoading from "@/components/ui/WorkspaceLoading";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TOOLS } from "@/lib/nav";

async function ToolContent({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const t = TOOLS.find((x) => x.key === tool);
  if (!t) notFound();
  const Icon = t.icon;
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#171a19] text-white">
          <Icon size={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold text-[#171a19]">{t.label}</h1>
      </header>
      <section className="rounded-2xl border border-black/10 bg-white p-8 text-center">
        <p className="font-medium text-[#171a19]">พื้นที่ทำงานของ “{t.label}”</p>
        <p className="mt-1 text-sm text-black/55">เครื่องมือนี้ยังไม่เปิดใช้งาน</p>
      </section>
    </div>
  );
}

export default function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  return <Suspense fallback={<WorkspaceLoading />}><ToolContent params={params} /></Suspense>;
}
