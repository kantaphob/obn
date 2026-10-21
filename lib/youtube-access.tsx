import { getCurrentAccess } from "@/lib/authorization";
import { SYSTEMS, TOOLS } from "@/lib/nav";

export async function getYoutubePageAccess(path: string) {
  const access = await getCurrentAccess({ includeNavigation: true });
  if (!access) return { access: null, allowed: false };
  if (!access.accessConfigured) return { access, allowed: true };
  const rootHrefs = [...Object.values(SYSTEMS).map((system) => system.href), ...TOOLS.map((tool) => tool.href)];
  const allowedMenu = rootHrefs.includes(path) || access.navigationHrefs.some((href) => href === path || (href !== "/dashboard" && path.startsWith(`${href}/`)));
  return { access, allowed: access.appKeys.includes("youtube") && allowedMenu };
}

export function youtubePageDenied() {
  return <main role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--text)]">
    <h1 className="text-xl font-bold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
    <p className="mt-2 text-sm text-[var(--muted)]">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์แอปหรือเมนู YouTube</p>
  </main>;
}
