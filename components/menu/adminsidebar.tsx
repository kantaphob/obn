"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Files,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Suspense } from "react";
import AppShortcuts from "../ui/AppShortcuts";

type AdminChildId = "postcode" | "unit" | "material" | "loglogin" | "logactivity";
type AdminTopLevelId = "overview" | "masterdata" | "logs" | "RBAC" | "documents" | "settings";
type AdminSection = {
  id: AdminTopLevelId;
  label: string; 
  icon: LucideIcon;
  children?: readonly { id: AdminChildId; label: string }[];
};

export const adminSections: readonly AdminSection[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  {
    id: "masterdata",
    label: "MasterData",
    icon: FolderKanban,
    children: [
      { id: "postcode", label: "Postcode" },
      { id: "unit", label: "Unit" },
      { id: "material", label: "Material" },
    ],
  },
  {
    id: "logs",
    label: "Logs",
    icon: ListChecks,
    children: [
      { id: "loglogin", label: "Loglogin" },
      { id: "logactivity", label: "logactivity" },
    ],
  },
  { id: "RBAC", label: "RBAC", icon: UsersRound },
  { id: "documents", label: "Documents", icon: Files },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

export type AdminSectionId = AdminTopLevelId | AdminChildId;

export function getAdminSectionLabel(id: AdminSectionId) {
  for (const section of adminSections) {
    if (section.id === id) return section.label;
    const child = section.children?.find((item) => item.id === id);
    if (child) return child.label;
  }
  return "Overview";
}

const sectionHref: Partial<Record<AdminSectionId, string>> = {
  overview: "/admin",
  masterdata: "/admin/masterdata",
  postcode: "/admin/masterdata/postcode",
  unit: "/admin/masterdata/unit",
  material: "/admin/masterdata/material",
  logs: "/admin/logs?view=login",
  loglogin: "/admin/logs?view=login",
  logactivity: "/admin/logs?view=activity",
  RBAC: "/admin/rbac",
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection: AdminSectionId = pathname === "/admin/masterdata"
    ? "masterdata"
    : pathname === "/admin/masterdata/postcode"
    ? "postcode"
    : pathname === "/admin/masterdata/unit"
      ? "unit"
      : pathname === "/admin/masterdata/material"
        ? "material"
        : pathname === "/admin/logs"
          ? searchParams.get("view") === "activity" ? "logactivity" : "loglogin"
          : pathname === "/admin/rbac"
            ? "RBAC"
            : "overview";
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["masterdata", ...(pathname.startsWith("/admin/logs") ? ["logs"] : [])]),
  );

  function toggleSection(id: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="sticky top-0 grid h-screen grid-cols-[76px_minmax(210px,252px)] gap-3 p-3 max-[1050px]:grid-cols-[66px_minmax(190px,220px)] max-[700px]:static max-[700px]:h-auto max-[700px]:grid-cols-1 max-[700px]:gap-2 max-[700px]:p-3 max-[700px]:pb-2">
      <aside className="flex h-full flex-col items-center rounded-[24px] border border-white/70 bg-white/35 px-2 py-3 shadow-[0_12px_35px_#263d3212,inset_0_1px_0_#ffffffd9] backdrop-blur-2xl max-[700px]:h-auto max-[700px]:flex-row max-[700px]:flex-wrap max-[700px]:justify-center max-[700px]:gap-2 max-[700px]:rounded-2xl max-[700px]:px-3 max-[700px]:py-2">
        <Suspense fallback={<div aria-hidden="true" className="size-11" />}><AppShortcuts /></Suspense>

        <span className="my-5 h-px w-8 bg-slate-500/15 max-[700px]:my-0 max-[700px]:mx-1 max-[700px]:h-7 max-[700px]:w-px" />
        <span className="mt-auto select-none text-[8px] font-medium tracking-[.2em] text-slate-500/45 [writing-mode:vertical-rl] max-[700px]:hidden">OBNITHI · ADMIN</span>
        <span className="mt-3 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/60 bg-white/35 text-slate-500 shadow-[0_5px_15px_#263d3210] max-[700px]:mt-0" aria-label="การแจ้งเตือน">
          <Bell size={17} />
        </span>
      </aside>

      <aside className="flex min-h-0 flex-col rounded-[24px] border border-white/70 bg-white/45 px-4 pt-5 pb-3 shadow-[0_12px_35px_#263d3212,inset_0_1px_0_#ffffffd9] backdrop-blur-2xl max-[1050px]:px-3 max-[700px]:min-h-0 max-[700px]:rounded-2xl max-[700px]:px-3 max-[700px]:pt-3 max-[700px]:pb-2">
        <Link className="flex items-center gap-[11px] rounded-xl px-2 py-1 text-[#292929]" href="/admin" aria-label="OBNITHI กลับสู่ภาพรวม">
          <span className="relative grid h-[38px] w-[38px] place-items-center rounded-[12px] bg-[#292a2c] font-serif text-[27px] font-bold text-white shadow-[0_6px_16px_#292a2c30]">O<span className="absolute right-[6px] bottom-[6px] h-[7px] w-[7px] rounded-full bg-[#b9cfc0]" /></span>
          <span className="text-[12px] font-extrabold tracking-[.04em]">OBNITHI<small className="mt-[3px] block text-[8px] font-semibold tracking-[.16em] text-slate-500/75">ADMIN CONSOLE</small></span>
        </Link>


        <p className="mt-6 mb-2 px-[9px] text-[9px] font-bold tracking-[.12em] text-slate-500/70 max-[700px]:mt-3 max-[700px]:mb-1">เมนูหลัก</p>
        <nav className="grid gap-1 max-[700px]:flex max-[700px]:flex-wrap max-[700px]:gap-1 max-[700px]:pb-1" aria-label="เมนูผู้ดูแลระบบ">
          {adminSections.map(({ id, label, icon: Icon, children }) => {
            const hasChildren = Boolean(children?.length);
            const expanded = expandedSections.has(id);
            const groupIsActive = activeSection === id || Boolean(children?.some((item) => item.id === activeSection));

            return (
              <div className="min-w-0 max-[700px]:w-[calc(50%-4px)] max-[700px]:shrink-0" key={id}>
                <div
                  className={`flex min-h-[40px] w-full items-center gap-[11px] rounded-xl border px-[11px] text-left text-[10px] transition-all hover:bg-white/55 hover:text-[#292929] max-[700px]:min-h-[36px] max-[700px]:w-full max-[700px]:gap-2 max-[700px]:px-[10px] max-[700px]:text-[9px] ${groupIsActive ? "border-white/80 bg-white/65 font-semibold text-[#292929] shadow-[0_5px_16px_#263d3212,inset_0_1px_0_#ffffff]" : "border-transparent bg-transparent text-slate-600"}`}
                >
                  {hasChildren ? (
                    <>
                      <Link className="flex min-w-0 flex-1 items-center gap-[11px] max-[700px]:gap-2" href={sectionHref[id] ?? "/admin"} aria-current={id === "logs" && pathname === "/admin/logs" ? "page" : undefined}>
                        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                      </Link>
                      <button className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" type="button" aria-label={`${expanded ? "ยุบ" : "ขยาย"}เมนู${label}`} aria-expanded={expanded} onClick={() => toggleSection(id)}>
                        <ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} size={14} aria-hidden="true" />
                      </button>
                    </>
                  ) : sectionHref[id] ? (
                    <Link className="flex min-w-0 flex-1 items-center gap-[11px] max-[700px]:gap-2" href={sectionHref[id]!} aria-current={activeSection === id ? "page" : undefined}>
                      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span className="flex-1">{label}</span>
                    </Link>
                  ) : (
                    <>
                      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span className="flex-1">{label}</span>
                    </>
                  )}
                </div>

                {hasChildren && expanded && (
                  <div className="ml-[19px] mt-1 mb-1 grid gap-1 border-l border-slate-400/20 pl-3 max-[700px]:ml-3 max-[700px]:pl-2">
                    {children?.map((child) => {
                      const childIsActive = activeSection === child.id;
                      return (
                        <Link
                          className={`flex min-h-[32px] items-center gap-2 rounded-lg px-2 text-left text-[9px] transition-colors hover:bg-white/60 hover:text-[#292929] ${childIsActive ? "bg-white/65 font-semibold text-[#292929] shadow-[0_3px_10px_#263d3210]" : "text-slate-600"}`}
                          key={child.id}
                          href={sectionHref[child.id] ?? "/admin"}
                          aria-current={childIsActive ? "page" : undefined}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${childIsActive ? "bg-slate-700" : "bg-slate-400/60"}`} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
