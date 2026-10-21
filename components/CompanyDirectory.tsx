"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  Layers3,
  Search,
} from "lucide-react";
import { SYSTEMS } from "@/lib/nav";

const companies = [
  {
    ...SYSTEMS.dashboard,
    label: "OBN Co., Ltd.",
    href: "/dashboard/accounts",
    description: "บริษัทหลัก · ภาพรวมบัญชีและการเงินของกลุ่มบริษัท",
    groups: [
      ...SYSTEMS.dashboard.groups
        .filter((group) => group.title === "Accounts")
        .map((group) => ({ ...group, title: "บัญชีและการเงิน" })),
      { title: "บริหารทรัพย์สิน", items: [{ label: "ทรัพย์สินถือครอง", href: "/dashboard/wealth/assets", icon: ChartNoAxesCombined }] },
    ],
  },
  {
    ...SYSTEMS.loan,
    label: "Loan-OBN Co., Ltd.",
    description: "ระบบบริหารการกู้ยืมและลูกหนี้",
  },
  {
    ...SYSTEMS.construction,
    label: "Construction-OBN Co., Ltd.",
    description: "ระบบรับเหมาก่อสร้าง",
  },
  {
    ...SYSTEMS.buildin,
    label: "Build-In-OBN Co., Ltd.",
    description: "ระบบงานตกแต่งภายใน",
  },
  {
    ...SYSTEMS.agricultures,
    label: "Agriculture-OBN Co., Ltd.",
    description: "ระบบการเกษตร",
  },
];
const categories = Array.from(
  new Set(companies.flatMap((company) => company.groups.filter((group) => group.title !== "ภาพรวม").map((group) => group.title))),
);
const categoryCount = companies.reduce(
  (total, company) => total + company.groups.filter((group) => group.title !== "ภาพรวม").length,
  0,
);
const menuCount = companies.reduce(
  (total, company) => total + company.groups.filter((group) => group.title !== "ภาพรวม").reduce((groupTotal, group) => groupTotal + group.items.length, 0),
  0,
);

export default function CompanyDirectory({ children }: { children?: ReactNode }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const normalizedQuery = query.trim().toLocaleLowerCase("th");

  const visibleCompanies = useMemo(() => companies.flatMap((company, companyIndex) => {
    const companyMatches = `${company.label} ${company.description}`.toLocaleLowerCase("th").includes(normalizedQuery);
    const groups = company.groups
      .filter((group) => group.title !== "ภาพรวม")
      .filter((group) => activeCategory === "ทั้งหมด" || group.title === activeCategory)
      .map((group) => ({
        ...group,
        items: companyMatches || !normalizedQuery
          ? group.items
          : group.items.filter((item) => `${item.label} ${group.title}`.toLocaleLowerCase("th").includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);

    return (companyMatches || !normalizedQuery || groups.length > 0) && groups.length > 0
      ? [{ company, companyIndex, groups }]
      : [];
  }), [activeCategory, normalizedQuery]);

  return (
    <div data-company-directory className="py-5 max-[760px]:py-4">
      <header className="mb-7 flex items-end justify-between gap-6 max-[760px]:mb-5 max-[760px]:items-start">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[2px] text-[#81877e]">OBNITHI GROUP / COMPANY DIRECTORY</p>
          <h1 className="text-[clamp(26px,3vw,38px)] font-medium leading-tight tracking-[-1.3px] text-[#272d28]">ภาพรวมกลุ่มบริษัท</h1>
          <p className="mt-2 text-[13px] text-[#737a72]">ภาพรวมรับจ่ายทุกบริษัทและสาขา พร้อมพื้นที่ทำงานแยกตามบริษัท</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#dce2d9] bg-white/55 px-3 py-2 text-[11px] text-[#687267] min-[761px]:flex">
          <span className="size-2 rounded-full bg-teal-600" />
          บริษัททั้งหมด · รวมสาขา
        </div>
      </header>

      {children}

      <section aria-label="สรุปข้อมูลกลุ่มบริษัท" className="mb-6 grid grid-cols-3 gap-3 max-[560px]:gap-2">
        {[
          { label: "บริษัท", value: companies.length, icon: Building2 },
          { label: "หมวดธุรกิจ", value: categoryCount, icon: Layers3 },
          { label: "เมนูงาน", value: menuCount, icon: ChevronRight },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} data-directory-summary className="flex items-center gap-3 rounded-2xl border border-white/70 bg-[var(--ws-soft,#efeee8)] px-4 py-3 shadow-[inset_1px_1px_2px_#fff8,3px_4px_9px_#9da19424] max-[560px]:gap-2 max-[560px]:px-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/70 text-[#5f765f]"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="min-w-0"><span className="block text-[10px] text-[#7d847a]">{label}</span><strong className="text-[20px] font-medium leading-tight text-[#2f3830]">{value}</strong></span>
          </div>
        ))}
      </section>

      <section aria-label="ค้นหาและกรองหมวดบริษัท" className="mb-6 rounded-2xl border border-white/70 bg-[var(--ws-soft,#f2f1eb)] p-4 shadow-[inset_1px_1px_2px_#fff8,3px_4px_9px_#9da19420] max-[560px]:p-3">
        <label className="flex max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500">
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาบริษัท หมวดงาน หรือเมนู" aria-label="ค้นหาบริษัท หมวดงาน หรือเมนู" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="ตัวกรองหมวดธุรกิจ">
          {["ทั้งหมด", ...categories].map((category) => {
            const selected = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1.5 text-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57745d] ${selected ? "border-[#526b56] bg-[var(--ws-accent-soft,#526b56)] text-white" : "border-[#d9ded5] bg-white/65 text-[#6c756a] hover:bg-white"}`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-[#303831]">พื้นที่ทำงานแยกตามบริษัท</h2>
        <span className="text-[10px] text-[#838a80]">แสดง {visibleCompanies.length} จาก {companies.length} บริษัท</span>
      </div>

      {visibleCompanies.length ? (
        <section className="grid grid-cols-2 items-start gap-4 max-[900px]:grid-cols-1" aria-label="รายการบริษัท">
          {visibleCompanies.map(({ company, companyIndex, groups }) => {
            const Icon = company.icon;
            const visibleItemCount = groups.reduce((total, group) => total + group.items.length, 0);
            return (
              <article data-company-card key={company.key} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
                <header className="flex items-start gap-3.5 border-b border-[#c8cbbf]/60 p-5 max-[560px]:p-4">
                  <span className="text-slate-600 grid size-12 shrink-0 place-items-center rounded-[15px] border border-white/75 bg-white/55 shadow-[inset_1px_1px_2px_#fff,3px_4px_7px_#aaa39140]">
                    <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-medium text-[#303831]">{company.label}</h3>
                      <span className="rounded-full border border-[#d9ddd4] bg-white/50 px-2 py-0.5 text-[9px] text-[#7a8278]">บริษัท 0{companyIndex + 1}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#737b71]">{company.description}</p>
                  </div>
                  <Link href={company.href} aria-label={`เข้าสู่ระบบ${company.label}`} className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#dce1d8] bg-white/60 text-[#5d6e5e] transition hover:bg-white">
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </header>

                <div className="grid gap-3 p-4 max-[560px]:p-3">
                  {groups.map((group) => (
                    <section key={group.title} className="rounded-[14px] border border-white/80 bg-white/45 p-3.5">
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <h4 className="text-[11px] font-semibold text-[#4c584d]">{group.title}</h4>
                        <span className="text-[9px] text-[#93998f]">{group.items.length} เมนู</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map(({ href, label, icon: ItemIcon }) => (
                          <Link key={href} href={href} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#e4e6df] bg-[var(--ws-surface,#fbfbf8)]/80 px-2.5 py-1.5 text-[10px] text-[#626b60] transition hover:border-[#b9c6b6] hover:bg-white hover:text-[#3e5d44]">
                            <ItemIcon size={13} strokeWidth={1.7} aria-hidden="true" />
                            {label}
                            <ArrowUpRight size={11} className="text-[#a2a99f]" aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                <footer className="flex items-center justify-between border-t border-[#c8cbbf]/60 px-5 py-3 text-[10px] text-[#81887e] max-[560px]:px-4">
                  <span>{groups.length} หมวดธุรกิจ · {visibleItemCount} เมนูที่แสดง</span>
                  <Link href={company.href} className="inline-flex items-center gap-1 font-medium text-[#526b56] hover:text-[#304c36]">เปิดพื้นที่ทำงาน <ArrowUpRight size={13} aria-hidden="true" /></Link>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#cbd1c7] bg-white/35 px-5 py-12 text-center">
          <Search size={23} className="mx-auto mb-3 text-[#8a9587]" aria-hidden="true" />
          <p className="text-[13px] font-medium text-[#4a554b]">ไม่พบข้อมูลที่ตรงกับการค้นหา</p>
          <p className="mt-1 text-[11px] text-[#858d82]">ลองเปลี่ยนคำค้นหาหรือเลือกหมวดธุรกิจอื่น</p>
        </div>
      )}
    </div>
  );
}
