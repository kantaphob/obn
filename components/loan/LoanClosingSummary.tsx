import { canReadLoanFinancials } from "@/lib/loan-access";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { summarizeCompanyLedgerRows } from "@/lib/company-ledger-summary";
import { readLoanClosingSnapshot } from "@/lib/loan-closing-snapshot";
import { thaiDay } from "@/lib/loan-balance";
import { resolveBusinessSystemScope } from "@/lib/company-system";

const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value / 100);
const date = (value: Date | string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(typeof value === "string" ? new Date(`${value}T12:00:00+07:00`) : value);

export default async function LoanClosingSummary() {
  await connection();
  const access = await getCurrentAccess();
  if (!canReadLoanFinancials(access) || !access) return null;
  const scope = access.accessConfigured ? { companyCode: { in: access.companyCodes } } : {};
  const [allCompanies, branches] = await Promise.all([
    prisma.companySequence.findMany({ where: { type: "COMPANY", status: "ACTIVE", ...(access.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) }, select: { companycode: true, nameTH: true, nameEN: true } }),
    prisma.branchCodeSequence.findMany({ where: { type: "BRANCH", status: "ACTIVE", ...(access.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) }, select: { companycode: true, branchcode: true, nameTH: true, nameEN: true } }),
  ]);
  const loanScope = resolveBusinessSystemScope("LOAN", allCompanies, branches);
  const companies = allCompanies.filter((company) => loanScope.companyCodes.has(company.companycode));
  const loanCompanyCodes = companies.map((company) => company.companycode);
  const soleLoanCompanyCode = loanCompanyCodes.length === 1 ? loanCompanyCodes[0] : null;
  const canReadUnassignedLoanHistory = Boolean(soleLoanCompanyCode && (!access.accessConfigured || access.companyCodes.includes(soleLoanCompanyCode)));
  const [periods, ledger] = await Promise.all([
    prisma.loanAccountingPeriod.findMany({ where: { ...scope, companyCode: { in: loanCompanyCodes } }, orderBy: [{ throughDate: "desc" }, { createdAt: "desc" }] }),
    getCompanyLedgerRows(null, new Date(thaiDay(new Date()) - 7 * 3600000)),
  ]);
  const latestByCompany = new Map<string, (typeof periods)[number]>();
  for (const period of periods) if (!latestByCompany.has(period.companyCode)) latestByCompany.set(period.companyCode, period);
  const latest = [...latestByCompany.values()];
  return <section aria-labelledby="loan-closing-summary-title" className="mb-6 rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="loan-closing-summary-title" className="flex items-center gap-2 text-base font-semibold text-slate-800"><LockKeyhole size={17} aria-hidden="true" /> รอบบัญชี Loan ล่าสุด</h2><p className="mt-1 text-xs text-slate-500">ปิดแยกตามบริษัท · ยอดยืนยันตอนปิดรอบเทียบกับยอดปัจจุบัน</p></div><Link href="/dashboard/loan/accounting" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">รายละเอียด / ปิดรอบ <ArrowUpRight size={14} aria-hidden="true" /></Link></header>
    {!latest.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">ยังไม่มีรอบบัญชีที่ปิด เมื่อปิดรอบแล้วสรุปจะปรากฏที่นี่</p> : <div className="grid gap-4 xl:grid-cols-2">{latest.map(period => {
      const company = companies.find(item => item.companycode === period.companyCode);
      const snapshot = readLoanClosingSnapshot(period.snapshot);
      const current = summarizeCompanyLedgerRows(ledger.filter(row => row.source === "LOAN"
        && (row.companyCode ? loanScope.allowsLocation(row.companyCode, row.branchCode) && row.companyCode === period.companyCode
          : canReadUnassignedLoanHistory && period.companyCode === soleLoanCompanyCode))).net;
      const closed = period.status === "CLOSED";
      return <article key={period.id} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">{company?.nameTH || company?.nameEN || period.companyCode}<span className="ml-2 text-[10px] font-normal text-slate-400">{period.companyCode}</span></h3><span className={`rounded-full px-2 py-1 text-[10px] ${closed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{closed ? "ปิดรอบแล้ว" : "เปิดรอบอีกครั้ง"}</span></div><p className="mt-2 text-[11px] text-slate-500">{snapshot?.from ? `${date(snapshot.from)} – ` : "สะสมถึง "}{date(period.throughDate)}</p>
        {snapshot ? <><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[{ label: "รับในรอบ", amount: snapshot.income }, { label: "จ่ายในรอบ", amount: snapshot.expense }, { label: "เงินสด ณ ปิดรอบ", amount: snapshot.cashBalance }, { label: "เงินสดปัจจุบัน", amount: current }, { label: "ต่างจากยอดปิดรอบ", amount: current - snapshot.cashBalance }].map(item => <div key={item.label}><dt className="text-[10px] text-slate-500">{item.label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-800">{money(item.amount)}</dd></div>)}</dl><p className="mt-4 text-[11px] text-slate-500">กระทบยอดตอนปิด: {snapshot.difference === null ? "รอตรวจสอบ · ยังไม่มียอดจริงครบทุกช่องทาง" : snapshot.difference === 0 ? "ตรงกัน · ผลต่าง ฿0.00" : `รอตรวจสอบ · ผลต่าง ${money(snapshot.difference)}`}</p>{!closed && <p className="mt-2 text-[11px] text-amber-800">ยอดข้างต้นเป็นประวัติตอนปิดเดิม ต้องปิดรอบใหม่เพื่อยืนยันยอดอีกครั้ง</p>}</> : <p className="mt-4 text-xs leading-relaxed text-slate-500">รอบเดิมยังไม่มีบันทึกยอดยืนยัน ไม่คำนวณย้อนหลังแทนยอดที่ปิดไว้ เงินสดปัจจุบัน {money(current)}</p>}
      </article>;
    })}</div>}
    <p className="mt-3 text-[10px] leading-relaxed text-slate-400">เงินสดเป็นยอดสะสมของ Loan ตามสมุดบัญชี วันปิดรอบของแต่ละบริษัทอาจต่างกัน ส่วนต่างอาจรวมรายการย้อนหลังที่เพิ่มหลังเปิดรอบใหม่</p>
  </section>;
}
