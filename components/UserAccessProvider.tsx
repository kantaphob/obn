"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SYSTEMS, TOOLS } from "@/lib/nav";

type UserAccess = { configured: boolean; companyCodes: string[]; appKeys: string[]; navigationHrefs: string[] };
type AccessState = { access: UserAccess | null; loading: boolean };
const AccessContext = createContext<AccessState>({ access: null, loading: true });

export function UserAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/account/access", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<UserAccess> : null)
      .then((value) => { if (active) { setAccess(value); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <AccessContext.Provider value={{ access, loading }}>{children}</AccessContext.Provider>;
}

export function useUserAccess() {
  return useContext(AccessContext);
}

export function WorkspaceAccessGate({ children }: { children: ReactNode }) {
  const { access, loading } = useUserAccess();
  const pathname = usePathname();
  if (loading) return <div aria-live="polite" className="mx-auto mt-12 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">กำลังตรวจสอบสิทธิ์การเข้าถึง…</div>;
  if (!access) return <div role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--text)]"><h1 className="text-xl font-bold">ตรวจสอบสิทธิ์ไม่สำเร็จ</h1><p className="mt-2 text-sm text-[var(--muted)]">กรุณาเข้าสู่ระบบใหม่ หรือแจ้งผู้ดูแลระบบ</p></div>;
  if (access?.configured) {
    const appKey = pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/tools/")
        ? `tool:${pathname.split("/")[2]}`
        : pathname.startsWith("/dashboard/")
          ? pathname.split("/")[2]
          : "dashboard";
    const allowedApp = access.appKeys.includes(appKey);
    const rootHrefs = [...Object.values(SYSTEMS).map((system) => system.href), ...TOOLS.map((tool) => tool.href)];
    const allowedMenu = rootHrefs.includes(pathname) || access.navigationHrefs.some((href) => href === pathname || (href !== "/dashboard" && pathname.startsWith(`${href}/`)));
    if (!allowedApp || !allowedMenu) return <div role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--text)]"><h1 className="text-xl font-bold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1><p className="mt-2 text-sm text-[var(--muted)]">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์บริษัท แอป หรือเมนูที่เกี่ยวข้อง</p></div>;
  }
  return children;
}
