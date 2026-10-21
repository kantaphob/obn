"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "@/lib/nav";

export function navItemIsActive(item: NavItem, pathname: string, view: string | null): boolean {
  const hrefPath = item.href;
  const pathMatches = hrefPath === pathname || (hrefPath.split("/").filter(Boolean).length > 2 && pathname.startsWith(`${hrefPath}/`));
  if (!pathMatches) return false;
  const expectedView = item.query?.view ?? null;
  if (!expectedView) return true;
  if (pathname !== hrefPath) return expectedView === "invoices" && hrefPath.endsWith("/invoices");
  return view === expectedView;
}

function includesPage(item: NavItem, pathname: string, view: string | null): boolean {
  return navItemIsActive(item, pathname, view) || Boolean(item.children?.some(child => includesPage(child, pathname, view)));
}

function MenuItem({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const id = useId();
  const searchParams = useSearchParams();
  const [override, setOverride] = useState<{ path: string; expanded: boolean } | null>(null);
  const active = includesPage(item, pathname, searchParams.get("view"));
  const expanded = override?.path === pathname ? override.expanded : active;
  const Icon = item.icon;
  const className = `flex min-h-11 w-full items-center gap-2 rounded-[11px] border px-2.5 py-2.5 text-left text-[13px] text-inherit! transition-colors focus-visible:outline-2 focus-visible:outline-current ${active ? "border-white/50 bg-[color-mix(in_srgb,var(--accent)_25%,var(--surface))] font-semibold shadow-[inset_1px_1px_3px_#fff4,3px_4px_8px_#0001]" : "border-transparent hover:bg-black/5"}`;
  const content = <><Icon size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" /><span className="min-w-0 flex-1 leading-relaxed">{item.label}</span></>;
  const href = item.query ? `${item.href}?${new URLSearchParams(item.query).toString()}` : item.href;

  return <li>
    {item.children?.length ? <>
      <button type="button" className={className} aria-expanded={expanded} aria-controls={id} onClick={() => setOverride({ path: pathname, expanded: !expanded })}>
        {content}<ChevronDown size={14} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "" : "-rotate-90"}`} />
      </button>
      <div id={id} hidden={!expanded} className="ml-3 mt-1 border-l border-current/15 pl-2">
        <SidebarMenu items={item.children} pathname={pathname} onNavigate={onNavigate} />
      </div>
    </> : <Link href={href} className={className} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      {content}{active && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden="true" />}
    </Link>}
  </li>;
}

export default function SidebarMenu({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return <ul className="m-0 grid list-none gap-1 p-0">{items.map(item => <MenuItem key={`${item.href}:${item.label}`} item={item} pathname={pathname} onNavigate={onNavigate} />)}</ul>;
}
