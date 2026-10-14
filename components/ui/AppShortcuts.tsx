"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Asterisk, ShieldUser, LoaderCircle } from "lucide-react";
import { useWorkspaceStatus } from "./ToastProvider";
import { SYSTEMS, TOOLS, type SystemKey } from "@/lib/nav";

const mainKeys: SystemKey[] = ["dashboard", "construction", "buildin", "agricultures", "loan"];
const group = "flex w-full shrink-0 flex-col items-center gap-1.5 rounded-[19px] border border-white/10 bg-linear-to-br from-[#303231] to-[#202221] px-1 py-2 shadow-[3px_5px_10px_#0003,inset_1px_1px_2px_#ffffff40] max-[760px]:w-auto max-[760px]:flex-row max-[760px]:px-2 max-[760px]:py-2";
const button = "relative grid size-11 shrink-0 place-items-center rounded-[12px] border border-white/30 bg-[#454a47] text-[color:var(--shortcut)]! shadow-[inset_0_1px_1px_#ffffff35,0_3px_7px_#0004] transition-[background,box-shadow,transform] hover:border-white/60 hover:bg-[#555d57] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--shortcut)] aria-[current=page]:border-white/50 aria-[current=page]:bg-[var(--shortcut)] aria-[current=page]:text-[#171a19]! aria-[current=page]:shadow-[inset_1px_1px_3px_#fff8,0_5px_12px_#0005] motion-reduce:transition-none";
const accent = (color: string) => ({ "--shortcut": color } as CSSProperties);

function NavigationStatus({ delayed = false }: { delayed?: boolean }) {
  const { pending: linkPending } = useLinkStatus();
  const pending = delayed || linkPending;
  return <span data-navigation-pending={pending ? "true" : undefined} role="status" className={pending ? "absolute -right-1 -top-1 rounded-full bg-[#242b27] p-1 text-[#f2a93b]" : "sr-only"}>
    {pending && <LoaderCircle size={13} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
    <span className="sr-only">{pending ? "กำลังเปิดหน้า…" : ""}</span>
  </span>;
}

export default function AppShortcuts() {
  const pathname = usePathname();
  const router = useRouter();
  const { status: dataStatus } = useWorkspaceStatus();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [transitionPending, startTransition] = useTransition();
  const requestId = useRef(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { requestId.current += 1; }, []);
  const navigate = (event: { preventDefault: () => void }, href: string) => {
    event.preventDefault();
    if (pathname === href) return;
    const id = ++requestId.current;
    setPendingHref(href);
    setFailed(false);
    startTransition(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (id !== requestId.current) return;
      startTransition(() => {
        try { router.push(href); } catch { setFailed(true); }
      });
    });
  };
  const loadStatus = failed ? "error" : transitionPending ? "loading" : dataStatus;
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <div data-app-shortcuts data-load-status={loadStatus} role="group" aria-label="AppShortcuts" className="ring-2 ring-[#79d8a0] data-[load-status=loading]:ring-[#f2a93b] data-[load-status=loading]:shadow-[0_0_18px_#f2a93b80] data-[load-status=error]:ring-[#ef7070] data-[load-status=error]:shadow-[0_0_18px_#ef707080] has-[[data-navigation-pending=true]]:ring-2 has-[[data-navigation-pending=true]]:ring-[#f2a93b] has-[[data-navigation-pending=true]]:shadow-[0_0_18px_#f2a93b80] sticky top-5 flex h-[calc(100dvh-40px)] w-[76px] shrink-0 flex-col items-center gap-2 overflow-y-auto rounded-[27px] bg-[#d5d6d3] px-2 py-3 shadow-[inset_1px_1px_2px_#ffffff70,7px_8px_20px_#62665e23] [scrollbar-width:thin] max-[1100px]:top-3.5 max-[1100px]:h-[calc(100dvh-28px)] max-[760px]:static max-[760px]:h-auto max-[760px]:w-full max-[760px]:flex-row max-[760px]:items-center max-[760px]:gap-3 max-[760px]:overflow-x-auto max-[760px]:rounded-[20px] max-[760px]:p-2">
      <span role="status" aria-live="polite" className="sr-only">{loadStatus === "error" ? "โหลดข้อมูลหรือทำรายการไม่สำเร็จ" : loadStatus === "loading" ? "กำลังเรียกข้อมูล" : "โหลดข้อมูลสำเร็จ"}</span>
      <nav aria-label="Admin" className={`${group} bg-white/5 backdrop-blur-xl`}>
        <Link onNavigate={event => navigate(event, "/admin")} href="/admin" title="Admin — จัดการระบบ" aria-label="Admin — จัดการระบบ" aria-current={isActive("/admin") ? "page" : undefined} style={accent(SYSTEMS.admin.color)} className={button}>
          <NavigationStatus delayed={transitionPending && pendingHref === "/admin"} />
          <ShieldUser size={23} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </nav>

      <nav aria-label="Dashboard และกลุ่มบริษัท" className={group}>
        <span aria-hidden="true" className="mb-1 grid w-10 place-items-center border-b border-white/15 pb-2 text-[#d5d8d4] max-[760px]:hidden"><Asterisk size={30} strokeWidth={1.3} /></span>
        {mainKeys.map(key => {
          const { href, label, color, icon: Icon } = SYSTEMS[key];
          return <Link key={key} onNavigate={event => navigate(event, href)} href={href} title={label} aria-label={label} aria-current={isActive(href) ? "page" : undefined} style={accent(color)} className={button}>
            <NavigationStatus delayed={transitionPending && pendingHref === href} />
          <Icon size={23} strokeWidth={2.2} aria-hidden="true" />
          </Link>;
        })}
      </nav>

      <nav aria-label="เครื่องมือ — POS, Document, คำนวณ" className={group}>
        {TOOLS.map(({ key, href, label, shortLabel, icon: Icon }) => <Link key={key} onNavigate={event => navigate(event, href)} href={href} title={label} aria-label={label} aria-current={isActive(href) ? "page" : undefined} style={accent("#f5f3ed")} className={`${button} h-[52px] gap-0.5 py-1`}>
          <NavigationStatus delayed={transitionPending && pendingHref === href} />
          <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
          <span aria-hidden="true" className="text-[8px] leading-none tracking-wide">{shortLabel}</span>
        </Link>)}
      </nav>
      <span className="shrink-0 py-4 text-[10px] font-medium tracking-[1.5px] text-[#4b514b] [writing-mode:vertical-rl] rotate-180 max-[760px]:hidden">OBNITHI Co., LTD.</span>
    </div>
  );
}
