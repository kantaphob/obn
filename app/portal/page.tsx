import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleUserRound,
  CreditCard,
  HardHat,
  LayoutGrid,
  ScanLine,
  Sprout,
  Store,
} from "lucide-react";
import { getCurrentAccess } from "@/lib/authorization";

const portals = [
  {
    key: "loan",
    number: "01",
    name: "Loan-OBN Co., Ltd.",
    description: "ระบบบริหารการกู้ยืมและลูกหนี้",
    href: "/dashboard/loan",
    icon: CreditCard,
    tone: "emerald",
    links: [
      { label: "ผู้กู้ใหม่", detail: "อ่านข้อมูลจากบัตรประชาชน", href: "/portal/loan/new-borrower", menuHref: "/dashboard/loan/borrowers", icon: ScanLine, permission: "borrowers:write" },
      { label: "ผู้กู้เดิม", detail: "อัปเดตข้อมูลและยืนยันบัญชี", href: "/dashboard/loan/borrowers", icon: CircleUserRound, permission: "borrowers:write" },
    ],
  },
  {
    key: "construction",
    number: "02",
    name: "Construction-OBN Co., Ltd.",
    description: "ระบบรับเหมาก่อสร้างและติดตามโครงการ",
    href: "/dashboard/construction",
    icon: HardHat,
    tone: "amber",
    links: [
      { label: "สถานะงาน", detail: "ดูความคืบหน้าโครงการ", href: "/portal/construction/progress", icon: CheckCircle2 },
    ],
  },
  {
    key: "buildin",
    number: "03",
    name: "Build-In-OBN Co., Ltd.",
    description: "ระบบงานตกแต่งภายใน ผลิต และติดตั้ง",
    href: "/dashboard/buildin",
    icon: BriefcaseBusiness,
    tone: "sky",
    links: [
      { label: "สถานะงาน", detail: "ติดตามใบสั่งงานและการติดตั้ง", href: "/portal/buildin/work-orders", icon: CheckCircle2 },
    ],
  },
  {
    key: "agricultures",
    number: "04",
    name: "Agriculture-OBN Co., Ltd.",
    description: "ระบบจัดการสินค้า สต็อก และงานขายเกษตร",
    href: "/dashboard/agricultures",
    icon: Sprout,
    tone: "lime",
    links: [
      { label: "POS", detail: "เปิดหน้าขายสินค้า", href: "/tools/pos", icon: Store, appKey: "tool:pos" },
    ],
  },
] as const;

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  lime: "bg-lime-50 text-lime-700 ring-lime-100",
};

export default async function PortalPage() {
  const access = await getCurrentAccess({ includeNavigation: true });
  if (!access) redirect("/login?callbackURL=/portal");

  const availablePortals = portals.filter(
    (portal) => !access.accessConfigured || access.appKeys.includes(portal.key),
  );
  const availableApps = new Set(access.appKeys);

  return (
    <main className="min-h-dvh bg-[#f5f7f4] px-5 py-8 text-[#26352d] sm:px-8 sm:py-11">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e3e9e3] pb-6">
          <Link href="/" className="flex items-center gap-3 text-[#26352d] no-underline">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#315d4b] text-white"><LayoutGrid size={19} /></span>
            <span><strong className="block text-sm tracking-wide">OBNITHI</strong><small className="text-[11px] text-[#7a887e]">PORTAL CHANNEL</small></span>
          </Link>
          <div className="flex items-center gap-3 rounded-full border border-[#e1e8e1] bg-white px-4 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-[#edf4ee] text-[#477257]"><CircleUserRound size={17} /></span>
            <span className="leading-tight"><strong className="block text-xs">{access.session.user.name}</strong><small className="text-[10px] text-[#829087]">{access.roleName} · {access.roleCode}</small></span>
          </div>
        </header>

        <section className="py-10 sm:py-14">
          <p className="mb-3 text-[10px] font-bold tracking-[.22em] text-[#63816c]">COMPANY WORKSPACES</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">เลือกบริษัทในเครือ</h1>
              <p className="mb-0 text-sm text-[#718076]">เลือกพื้นที่ทำงานที่ต้องการ ระบบจะแสดงเฉพาะบริษัทตามสิทธิ์ของบัญชีคุณ</p>
            </div>
            <Link href="/" className="text-xs font-medium text-[#5d7664] hover:text-[#315d4b]">กลับหน้าแรก</Link>
          </div>
        </section>

        {availablePortals.length ? (
          <section aria-label="บริษัทในเครือ" className="grid gap-4 md:grid-cols-2">
            {availablePortals.map((portal) => {
              const Icon = portal.icon;
              const visibleLinks = portal.links.filter((item) =>
                !access.accessConfigured ||
                (!("appKey" in item) || availableApps.has(item.appKey)) &&
                (!("permission" in item) || access.permissions.includes("*") || access.permissions.includes(item.permission)) &&
                (access.navigationHrefs.includes("menuHref" in item ? item.menuHref : item.href) || item.href === "/tools/pos" && availableApps.has("tool:pos")),
              );

              return (
                <article key={portal.key} className="overflow-hidden rounded-[22px] border border-[#e2e9e2] bg-white shadow-[0_10px_32px_#203a2b0a]">
                  <div className="flex items-start gap-4 p-5 sm:p-6">
                    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ${toneClasses[portal.tone]}`}><Icon size={23} strokeWidth={1.8} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] font-bold tracking-[.18em] text-[#a0aaa2]">COMPANY {portal.number}</p>
                      <h2 className="mb-1 break-words text-lg font-semibold tracking-tight">{portal.name}</h2>
                      <p className="mb-0 text-xs leading-5 text-[#7e8b81]">{portal.description}</p>
                    </div>
                    <Link href={portal.href} aria-label={`เปิดระบบ ${portal.name}`} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#315d4b] text-white transition hover:bg-[#244a39]"><ArrowUpRight size={18} /></Link>
                  </div>

                  {visibleLinks.length > 0 && <div className="grid gap-2 border-t border-[#eef1ed] bg-[#fbfcfa] p-4 sm:grid-cols-2">
                    {visibleLinks.map((item) => {
                      const ItemIcon = item.icon;
                      return <Link key={`${portal.key}-${item.label}`} href={item.href} className="group flex min-h-[64px] items-center gap-3 rounded-xl border border-[#e8ede7] bg-white px-3.5 py-3 no-underline transition hover:border-[#b8cbbd] hover:bg-[#f8fbf8]">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0f5f0] text-[#52765d]"><ItemIcon size={16} /></span>
                        <span className="min-w-0 flex-1"><strong className="block text-xs text-[#35483a]">{item.label}</strong><small className="mt-1 block text-[10px] text-[#89948b]">{item.detail}</small></span>
                        <ArrowUpRight size={14} className="text-[#a3afa5] transition group-hover:text-[#477257]" />
                      </Link>;
                    })}
                  </div>}
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-[#cbd8cd] bg-white px-6 py-14 text-center">
            <CircleUserRound size={28} className="mx-auto mb-3 text-[#8a9a8d]" />
            <h2 className="mb-2 text-lg font-semibold">ยังไม่มีบริษัทที่เปิดให้บัญชีนี้ใช้งาน</h2>
            <p className="mb-0 text-sm text-[#7e8b81]">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนด Role และสิทธิ์เข้าใช้งานบริษัท</p>
          </section>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e9e3] pt-5 text-[10px] text-[#8a968d]">
          <span>OBNITHI WORKSPACE · ROLE-BASED ACCESS</span>
          <span>สิทธิ์การเข้าถึงจัดการโดยผู้ดูแลระบบ</span>
        </footer>
      </div>
    </main>
  );
}
