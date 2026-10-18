"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function AuthSessionControl() {
  const { data } = authClient.useSession();
  const router = useRouter();
  if (!data?.user) return null;
  return <div className="mb-4 flex items-center justify-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2 text-sm text-[var(--text)]">
    <span className="min-w-0 truncate">{data.user.name} <span className="text-[var(--muted)]">({data.user.role || "staff"})</span></span>
    <Link href="/account/security" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-black/5">เปลี่ยนรหัสผ่าน</Link>
    <button type="button" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-black/5" onClick={async()=>{await authClient.signOut();router.replace("/login");router.refresh();}}>ออกจากระบบ</button>
  </div>;
}
