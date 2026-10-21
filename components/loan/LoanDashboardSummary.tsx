import { canReadLoanFinancials } from "@/lib/loan-access";
import { getCurrentAccess } from "@/lib/authorization";
import LoanClosingSummary from "./LoanClosingSummary";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLoanDashboardData } from "@/lib/loan-dashboard";
import { prisma } from "@/lib/prisma";
import { summarizeCompanyLedgerRows } from "@/lib/company-ledger-summary";
import { resolveBusinessSystemScope } from "@/lib/company-system";

const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value / 100);

export default async function LoanDashboardSummary() {
  const access = await getCurrentAccess();
  if (!canReadLoanFinancials(access) || !access) return null;
  const { year, now, ledgerRows, outstanding, annualCashflow, finance, upfrontInterestTotal, cashflow, overdue, overdueBalance } = await getLoanDashboardData();
  const [companies, branches] = await Promise.all([
    prisma.companySequence.findMany({ where: { type: "COMPANY", ...(access.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) }, select: { companycode: true, nameTH: true, nameEN: true } }),
    prisma.branchCodeSequence.findMany({ where: { type: "BRANCH", ...(access.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) }, select: { companycode: true, branchcode: true, nameTH: true, nameEN: true } }),
  ]);
  const loanScope = resolveBusinessSystemScope("LOAN", companies, branches);
  const loanCompanies = companies.filter((company) => loanScope.companyCodes.has(company.companycode));
  const loanBranches = loanScope.visibleBranches;
  const soleLoanCompanyCode = loanScope.companyCodes.size === 1 ? [...loanScope.companyCodes][0] : null;
  const canReadUnassignedLoanHistory = Boolean(soleLoanCompanyCode && (!access.accessConfigured || access.companyCodes.includes(soleLoanCompanyCode)));
  const loanLedgerRows = ledgerRows.filter((row) => row.source === "LOAN"
    && (row.companyCode ? loanScope.allowsLocation(row.companyCode, row.branchCode) : canReadUnassignedLoanHistory));
  const allTime = summarizeCompanyLedgerRows(loanLedgerRows);
  const branchRows = loanCompanies.flatMap((company) => {
    const companyRows = loanLedgerRows.filter((row) => row.companyCode === company.companycode);
    const branchByCode = new Map<string, { branchcode: string; name: string }>();
    branchByCode.set(company.companycode, { branchcode: company.companycode, name: "สำนักงานใหญ่" });
    loanBranches.filter((branch) => branch.companycode === company.companycode).forEach((branch) => {
      branchByCode.set(branch.branchcode, { branchcode: branch.branchcode, name: branch.nameTH || branch.nameEN || `สาขา ${branch.branchcode}` });
    });
    companyRows.forEach((row) => {
      const branchCode = row.branchCode || company.companycode;
      if (!branchByCode.has(branchCode)) branchByCode.set(branchCode, { branchcode: branchCode, name: branchCode === company.companycode ? "สำนักงานใหญ่" : `สาขา ${branchCode}` });
    });
    return [...branchByCode.values()].map((branch) => {
      const rows = companyRows.filter((row) => (row.branchCode || company.companycode) === branch.branchcode);
      const totals = summarizeCompanyLedgerRows(rows);
      return { company: company.nameTH || company.nameEN || company.companycode, companyCode: company.companycode, ...branch, ...totals, count: rows.length };
    });
  });
  const unassignedRows = loanLedgerRows.filter((row) => !row.companyCode);
  if (unassignedRows.length) {
    const totals = summarizeCompanyLedgerRows(unassignedRows);
    branchRows.push({ company: "ยังไม่ระบุบริษัท", companyCode: "", branchcode: "", name: "ยังไม่ระบุสาขา", ...totals, count: unassignedRows.length });
  }
  const metrics = [
    { label: "เงินสดสุทธิ Loan", amount: allTime.net, note: `รับ ${money(allTime.income)} · จ่าย ${money(allTime.expense)}` },
    { label: "รายรับสะสม Loan", amount: allTime.income, note: `${loanLedgerRows.filter((row) => row.type === "INCOME").length.toLocaleString("th-TH")} รายการ · ระบบ Loan` },
    { label: "รายจ่ายสะสม Loan", amount: allTime.expense, note: `${loanLedgerRows.filter((row) => row.type === "EXPENSE").length.toLocaleString("th-TH")} รายการ · ระบบ Loan` },
  ];
  const maxFlow = Math.max(1, ...cashflow.flatMap(month => [month.income, month.expense]));
  return <section aria-labelledby="group-loan-title" className="mb-7 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_8px_30px_#315b4910] sm:p-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">LOAN FINANCE</p><h2 id="group-loan-title" className="mt-1 text-xl font-semibold text-slate-800">ภาพรวมรับ–จ่าย Loan · {loanCompanies.length} บริษัท</h2><p className="mt-1 text-xs text-slate-500">รวมรายการของบริษัทที่ผูกกับระบบ Loan จากสำนักงานใหญ่และทุกสาขา · อัปเดตทุก 10 วินาที · ล่าสุด {new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)}</p></div>
      <Link href="/dashboard/loan" className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2 text-xs font-medium text-white">ดูภาพรวมสินเชื่อ <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </header>
    <LoanClosingSummary />
    <dl className="grid gap-3 md:grid-cols-3">{metrics.map(metric => <div key={metric.label} className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4"><dt className="text-xs text-slate-600">{metric.label}</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums text-teal-900">{money(metric.amount)}</dd><dd className="mt-2 text-[11px] text-slate-500">{metric.note}</dd></div>)}</dl>
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-100" aria-labelledby="obn-branch-ledger-title">
      <header className="flex flex-wrap items-end justify-between gap-2 p-4"><div><h3 id="obn-branch-ledger-title" className="text-sm font-semibold text-slate-800">รับ–จ่ายแยกตามบริษัทและสาขา</h3><p className="mt-1 text-[10px] text-slate-500">ยอดสะสมตั้งแต่รายการแรก · รายการที่ไม่มีรหัสสาขาจัดเป็นสำนักงานใหญ่</p></div><Link href="/dashboard/loan/ledger" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">เปิดสมุดบัญชี <ArrowUpRight size={13} aria-hidden="true" /></Link></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><caption className="sr-only">ยอดรับจ่ายสะสมแยกบริษัทและสาขา</caption><thead className="bg-slate-50 text-slate-500"><tr><th scope="col" className="px-4 py-2 text-left font-medium">บริษัท</th><th scope="col" className="px-4 py-2 text-left font-medium">สำนักงานใหญ่ / สาขา</th><th scope="col" className="px-4 py-2 text-right font-medium">รับ</th><th scope="col" className="px-4 py-2 text-right font-medium">จ่าย</th><th scope="col" className="px-4 py-2 text-right font-medium">สุทธิ</th><th scope="col" className="px-4 py-2 text-right font-medium">รายการ</th></tr></thead><tbody className="divide-y divide-slate-100">{branchRows.map((row) => <tr key={`${row.companyCode}-${row.branchcode || "unknown"}`}><th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-700">{row.company}<span className="ml-1 font-normal text-slate-400">{row.companyCode}</span></th><td className="px-4 py-2.5 text-slate-600">{row.name}<span className="ml-1 text-slate-400">{row.branchcode}</span></td><td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{money(row.income)}</td><td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{money(row.expense)}</td><td className={`px-4 py-2.5 text-right tabular-nums font-medium ${row.net < 0 ? "text-rose-700" : "text-slate-700"}`}>{money(row.net)}</td><td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{row.count}</td></tr>)}</tbody></table></div>
    </section>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="min-w-0 rounded-2xl border border-slate-100 p-4" aria-labelledby="group-loan-cashflow">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="group-loan-cashflow" className="text-sm font-semibold text-slate-800">รับ–จ่ายทั้งปี {year + 543}</h3><span className="text-[10px] text-slate-500">ม.ค.–ธ.ค. · รับจริงถึงวันนี้</span></div>
        <dl className="my-4 grid grid-cols-3 gap-2">{[{ label: "รับทั้งหมด", amount: annualCashflow.income }, { label: "จ่ายทั้งหมด", amount: annualCashflow.expense }, { label: "กระแสเงินสดสุทธิ", amount: annualCashflow.net }].map(item => <div key={item.label}><dt className="text-[10px] text-slate-500">{item.label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-800">{money(item.amount)}</dd></div>)}</dl>
        <div className="grid h-36 grid-cols-12 items-end gap-1 sm:gap-2" role="img" aria-label={`กราฟเงินรับและเงินจ่ายรายเดือน ปี ${year + 543} รายละเอียดอยู่ในตารางด้านล่าง`}>{cashflow.map(month => <div key={month.key} className="flex h-full min-w-0 flex-col justify-end"><div className="flex h-28 items-end justify-center gap-0.5"><span className="w-2/5 rounded-t bg-teal-500" style={{ height: `${month.income / maxFlow * 100}%` }} /><span className="w-2/5 rounded-t bg-amber-400" style={{ height: `${month.expense / maxFlow * 100}%` }} /></div><span className="mt-2 text-center text-[9px] text-slate-500">{month.label}</span></div>)}</div>
        <p className="mt-3 flex gap-4 text-[10px] text-slate-500"><span><span className="mr-1 inline-block size-2 rounded bg-teal-500" />เงินรับ</span><span><span className="mr-1 inline-block size-2 rounded bg-amber-400" />เงินจ่าย</span></p>
        <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">รายละเอียดรายเดือน</summary><table className="mt-2 w-full text-right"><caption className="sr-only">เงินรับและเงินจ่ายรายเดือน</caption><thead><tr><th scope="col" className="text-left">เดือน</th><th scope="col">เงินรับ</th><th scope="col">เงินจ่าย</th></tr></thead><tbody>{cashflow.map(month => <tr key={month.key}><th scope="row" className="py-1 text-left font-normal">{month.label}</th><td>{money(month.income)}</td><td>{money(month.expense)}</td></tr>)}</tbody></table></details>
        <p className="mt-3 text-[10px] text-slate-400">ยอดรับรวมเงินต้นและเงินเพิ่มทุน จึงไม่ใช่กำไร</p>
      </section>
      <section className="rounded-2xl bg-slate-50 p-4" aria-labelledby="group-loan-interest"><h3 id="group-loan-interest" className="text-sm font-semibold text-slate-800">สินเชื่อ Loan · ดอกเบี้ยและยอดติดตาม</h3><dl className="mt-3 divide-y divide-slate-200/70">{[
        { label: `ดอกเบี้ยรับ ปี ${year + 543}`, amount: finance.interestReceived },
        { label: `ดอกเบี้ยหักล่วงหน้า ปี ${year + 543}`, amount: upfrontInterestTotal },
        { label: "ดอกเบี้ยรอรับ ณ วันนี้", amount: outstanding.interest },
        { label: `ยอดค้างชำระ ${overdue.length} สัญญา`, amount: overdueBalance },
        { label: `ค่าใช้จ่ายดำเนินงาน ปี ${year + 543}`, amount: finance.operatingExpenses },
      ].map(item => <div key={item.label} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-xs text-slate-500">{item.label}</dt><dd className="text-sm font-semibold tabular-nums text-slate-800">{money(item.amount)}</dd></div>)}</dl><Link href="/dashboard/loan/ledger" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700">เปิดสมุดบัญชี <ArrowUpRight size={13} aria-hidden="true" /></Link></section>
    </div>
  </section>;
}
