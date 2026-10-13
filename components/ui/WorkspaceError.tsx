"use client";

export default function WorkspaceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section data-workspace-error role="alert" className="rounded-2xl border border-red-400/50 bg-red-50/70 p-6 text-[#802525]">
    <h2 className="text-lg font-medium">โหลดหน้าไม่สำเร็จ</h2>
    <p className="mt-2 text-sm">ลองเรียกข้อมูลอีกครั้ง</p>
    <button type="button" onClick={retry} className="mt-4 rounded-xl bg-[#802525] px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2">ลองใหม่</button>
  </section>;
}
