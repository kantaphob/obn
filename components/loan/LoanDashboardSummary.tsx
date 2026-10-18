import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLoanDashboardData } from "@/lib/loan-dashboard";

const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value / 100);

export default async function LoanDashboardSummary() {
  const { year, now, cashBalance, lifetimeFinance, outstanding, annualCashflow, finance, upfrontInterestTotal, cashflow, openContracts, overdue, overdueBalance } = await getLoanDashboardData();
  const maxFlow = Math.max(1, ...cashflow.flatMap(month => [month.income, month.expense]));
  const metrics = [
    { label: "เงินสดคงเหลือตามบัญชี", amount: cashBalance, note: "เงินรับ − เงินจ่ายสะสมถึงวันนี้" },
    { label: "ทุนสุทธิคงอยู่ในกิจการ", amount: lifetimeFinance.capitalReceived - lifetimeFinance.capitalWithdrawn, note: "ทุนเข้า " + money(lifetimeFinance.capitalReceived) + " · ถอน " + money(lifetimeFinance.capitalWithdrawn) },
    { label: "เงินต้นที่ยังอยู่กับผู้กู้", amount: outstanding.principal, note: `${openContracts.length} สัญญาที่ยังมียอดคงเหลือ` },
  ];
  return <section aria-labelledby="group-loan-title" className="mb-7 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_8px_30px_#315b4910] sm:p-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">LOAN MANAGEMENT</p><h2 id="group-loan-title" className="mt-1 text-xl font-semibold text-slate-800">สรุปบริษัท Loan</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลจากระบบสินเชื่อและสมุดบัญชี · อัปเดตทุก 10 วินาที · ล่าสุด {new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)}</p></div>
      <Link href="/dashboard/loan" className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2 text-xs font-medium text-white">ดูภาพรวมสินเชื่อ <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </header>
    <dl className="grid gap-3 md:grid-cols-3">{metrics.map(metric => <div key={metric.label} className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4"><dt className="text-xs text-slate-600">{metric.label}</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums text-teal-900">{money(metric.amount)}</dd><dd className="mt-2 text-[11px] text-slate-500">{metric.note}</dd></div>)}</dl>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="min-w-0 rounded-2xl border border-slate-100 p-4" aria-labelledby="group-loan-cashflow">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="group-loan-cashflow" className="text-sm font-semibold text-slate-800">รับ–จ่ายทั้งปี {year + 543}</h3><span className="text-[10px] text-slate-500">ม.ค.–ธ.ค. · รับจริงถึงวันนี้</span></div>
        <dl className="my-4 grid grid-cols-3 gap-2">{[{ label: "รับทั้งหมด", amount: annualCashflow.income }, { label: "จ่ายทั้งหมด", amount: annualCashflow.expense }, { label: "กระแสเงินสดสุทธิ", amount: annualCashflow.net }].map(item => <div key={item.label}><dt className="text-[10px] text-slate-500">{item.label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-800">{money(item.amount)}</dd></div>)}</dl>
        <div className="grid h-36 grid-cols-12 items-end gap-1 sm:gap-2" role="img" aria-label={`กราฟเงินรับและเงินจ่ายรายเดือน ปี ${year + 543} รายละเอียดอยู่ในตารางด้านล่าง`}>{cashflow.map(month => <div key={month.key} className="flex h-full min-w-0 flex-col justify-end"><div className="flex h-28 items-end justify-center gap-0.5"><span className="w-2/5 rounded-t bg-teal-500" style={{ height: `${month.income / maxFlow * 100}%` }} /><span className="w-2/5 rounded-t bg-amber-400" style={{ height: `${month.expense / maxFlow * 100}%` }} /></div><span className="mt-2 text-center text-[9px] text-slate-500">{month.label}</span></div>)}</div>
        <p className="mt-3 flex gap-4 text-[10px] text-slate-500"><span><span className="mr-1 inline-block size-2 rounded bg-teal-500" />เงินรับ</span><span><span className="mr-1 inline-block size-2 rounded bg-amber-400" />เงินจ่าย</span></p>
        <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">รายละเอียดรายเดือน</summary><table className="mt-2 w-full text-right"><caption className="sr-only">เงินรับและเงินจ่ายรายเดือน</caption><thead><tr><th scope="col" className="text-left">เดือน</th><th scope="col">เงินรับ</th><th scope="col">เงินจ่าย</th></tr></thead><tbody>{cashflow.map(month => <tr key={month.key}><th scope="row" className="py-1 text-left font-normal">{month.label}</th><td>{money(month.income)}</td><td>{money(month.expense)}</td></tr>)}</tbody></table></details>
        <p className="mt-3 text-[10px] text-slate-400">ยอดรับรวมเงินต้นและเงินเพิ่มทุน จึงไม่ใช่กำไร</p>
      </section>
      <section className="rounded-2xl bg-slate-50 p-4" aria-labelledby="group-loan-interest"><h3 id="group-loan-interest" className="text-sm font-semibold text-slate-800">ดอกเบี้ยและยอดติดตาม</h3><dl className="mt-3 divide-y divide-slate-200/70">{[
        { label: `ดอกเบี้ยรับ ปี ${year + 543}`, amount: finance.interestReceived },
        { label: `ดอกเบี้ยหักล่วงหน้า ปี ${year + 543}`, amount: upfrontInterestTotal },
        { label: "ดอกเบี้ยรอรับ ณ วันนี้", amount: outstanding.interest },
        { label: `ยอดค้างชำระ ${overdue.length} สัญญา`, amount: overdueBalance },
        { label: `ค่าใช้จ่ายดำเนินงาน ปี ${year + 543}`, amount: finance.operatingExpenses },
      ].map(item => <div key={item.label} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-xs text-slate-500">{item.label}</dt><dd className="text-sm font-semibold tabular-nums text-slate-800">{money(item.amount)}</dd></div>)}</dl><Link href="/dashboard/loan/ledger" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700">เปิดสมุดบัญชี <ArrowUpRight size={13} aria-hidden="true" /></Link></section>
    </div>
  </section>;
}
