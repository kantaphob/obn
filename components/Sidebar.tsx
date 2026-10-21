"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, PanelLeft } from "lucide-react";
import SidebarMenu from "./SidebarMenu";
import { flattenNavItems, getSystem, type NavItem } from "@/lib/nav";
import { workspaceStyles as styles } from "./ui/workspace-styles";
import { useUserAccess } from "@/components/UserAccessProvider";

function filterMenu(items: NavItem[], hrefs: string[]): NavItem[] {
  return items.map((item) => {
    const children = item.children ? filterMenu(item.children, hrefs) : undefined;
    return { ...item, ...(children ? { children } : {}) };
  }).filter((item) => hrefs.includes(item.href) || Boolean(item.children?.length));
}

export default function Sidebar() {
  const pathname = usePathname();
  const system = getSystem(pathname);
  const { access, loading: accessLoading } = useUserAccess();
  const navigationHrefs = access?.appKeys.includes("dashboard")
    ? [...access.navigationHrefs, "/dashboard/wealth/assets"]
    : access?.navigationHrefs ?? [];
  const visibleGroups = accessLoading || !access ? [] : system.groups.map((group) => ({ ...group, items: filterMenu(group.items, navigationHrefs) })).filter((group) => group.items.length > 0);
  const [closed, setClosed] = useState<Record<string, { path: string; collapsed: boolean }>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const connectionLabel = online === null ? "กำลังตรวจสอบเครือข่าย" : online ? "เครือข่ายออนไลน์" : "เครือข่ายออฟไลน์";
  const lights = [
    { label: "เครือข่ายออฟไลน์", active: online === false, color: "bg-[#ef7070] shadow-[0_0_9px_#ef7070]" },
    { label: "กำลังตรวจสอบเครือข่าย", active: online === null, color: "bg-[#eac65e] shadow-[0_0_9px_#eac65e]" },
    { label: "เครือข่ายออนไลน์", active: online === true, color: "bg-[#79d8a0] shadow-[0_0_9px_#79d8a0]" },
  ];
  const Icon = system.icon;

  return <aside data-system={system.key} style={{ "--accent": system.color } as CSSProperties} className={`${styles.sidebar} ${sidebarCollapsed ? "min-[761px]:w-[76px]! min-[761px]:px-3!" : ""} text-[color:var(--text)]`} aria-label={`เมนู${system.label}`}>
    <div className={`${styles.windowBar} ${sidebarCollapsed ? "min-[761px]:flex-col min-[761px]:gap-3" : ""}`}><span role="status" aria-label={connectionLabel} title={`${connectionLabel} (สถานะจากเบราว์เซอร์)`} className="flex shrink-0 items-center gap-1.5">{lights.map(light => <span key={light.label} aria-hidden="true" className={`size-2.5 rounded-full border border-white/35 ${light.active ? light.color : "bg-[#92988f]/30"}`} />)}</span><button type="button" onClick={() => setSidebarCollapsed(value => !value)} aria-expanded={!sidebarCollapsed} aria-controls="sidebar-content" aria-label={sidebarCollapsed ? "ขยาย Sidebar" : "ยุบ Sidebar"} title={sidebarCollapsed ? "ขยาย Sidebar" : "ยุบ Sidebar"} className="grid size-9 place-items-center rounded-lg border border-current/20 text-[color:var(--text)] hover:bg-white/15 focus-visible:outline-current"><PanelLeft size={20} aria-hidden="true" /></button></div>
    {sidebarCollapsed && <nav aria-label={`ไอคอนเมนู${system.label}`} className="hidden min-[761px]:block">
      {visibleGroups.map(group => <div key={group.title} className="mb-3 grid gap-2 border-b border-current/15 pb-3">
        {flattenNavItems(group.items).filter(item => !item.children?.length).map(({ href, label, icon: ItemIcon }) => {
          const selected = pathname === href || (href !== system.href && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} title={`${group.title} — ${label}`} aria-label={label} aria-current={selected ? "page" : undefined} className={`grid size-11 place-items-center rounded-xl border text-inherit! focus-visible:outline-current ${selected ? "border-white/50 bg-[color-mix(in_srgb,var(--accent)_25%,var(--surface))] shadow-[inset_1px_1px_3px_#fff4,3px_4px_8px_#0002]" : "border-transparent hover:bg-white/15"}`}><ItemIcon size={22} aria-hidden="true" /></Link>;
        })}
      </div>)}
    </nav>}
    <div id="sidebar-content" className={sidebarCollapsed ? "min-[761px]:hidden" : undefined}>
    <div className={styles.profile}>
      <span className="grid size-[45px] shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[var(--ws-accent-soft)] text-[#273244] shadow-sm"><Icon size={25} strokeWidth={1.6} aria-hidden="true" /></span>
      <div><strong>{system.label}</strong><span>OBNITHI Group</span></div>
      <button type="button" className={styles.mobileToggle} onClick={() => setMobileOpen(value => !value)} aria-expanded={mobileOpen} aria-controls="workspace-menu" aria-label={mobileOpen ? "ปิดเมนู" : "เปิดเมนู"}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    <div id="workspace-menu" className={`${styles.menu} ${mobileOpen ? styles.menuOpen : "max-[760px]:hidden"}`}>
      <nav aria-label="เมนูในระบบ">
        {visibleGroups.map(group => {
          const key = `${system.key}:${group.title}`;
          const collapsed = closed[key]?.path === pathname ? closed[key].collapsed : false;
          return <section className={styles.navGroup} key={key}>
            <button type="button" className={styles.groupTitle} aria-expanded={!collapsed} onClick={() => setClosed(previous => ({ ...previous, [key]: { path: pathname, collapsed: !collapsed } }))}>
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[var(--accent)] ring-1 ring-black/15" aria-hidden="true" />{group.title}</span><ChevronDown size={14} className={collapsed ? "-rotate-90" : undefined} />
            </button>
            {!collapsed && <SidebarMenu items={group.items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />}
          </section>;
        })}
      </nav>
      <div className={styles.sidebarNote}><span>WORKSPACE</span><strong>พื้นที่ทำงานของคุณ</strong><p>เลือกเมนูเพื่อจัดการแต่ละส่วนของธุรกิจ</p></div>
    </div>
    </div>
  </aside>;
}
