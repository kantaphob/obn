import { LoaderCircle } from "lucide-react";

export default function WorkspaceLoading() {
  return <div data-workspace-loading role="status" aria-live="polite" className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-white/50 bg-white/15 p-6 text-[#40473e]">
    <LoaderCircle size={28} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
    <p className="text-sm">กำลังโหลดหน้าและข้อมูล…</p>
  </div>;
}
