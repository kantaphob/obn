"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  combineFinancePositions, monthlyFinanceRows, summarizeFinanceRows,
  type FinanceDashboardData, type FinanceRow, type FinanceUnit,
} from "@/lib/dashboard-finance";
import { wealthAssetCategoryLabel } from "@/lib/wealth-assets";
import { matchesBusinessSystem, type BusinessSystem } from "@/lib/company-system";

const moneyFormat = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" });
const monthFormat = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", month: "short", year: "2-digit" });
const money = (value: number) => moneyFormat.format(value / 100);
const monthLabel = (key: string) => monthFormat.format(new Date(key + "-01T12:00:00+07:00"));
const dateLabel = (key: string) => dateFormat.format(new Date(key + "T12:00:00+07:00"));
const unitOrder: BusinessSystem[] = ["LOAN", "CONSTRUCTION", "BUILDIN", "AGRICULTURE", "YOUTUBE", "NETFLIX"];
const sortUnit = (unit: FinanceUnit) => unit.headquarters ? 0 : unitOrder.findIndex(system => unit.system === system || matchesBusinessSystem(system, unit.name, "")) + 1 || 99;
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
type Month = ReturnType<typeof monthlyFinanceRows>[number];

export default function DashboardFinanceReport() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [scope, setScope] = useState("ALL");
  const requestId = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/finance", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดข้อมูลการเงินไม่สำเร็จ");
      if (id === requestId.current && !signal?.aborted) { setData(result); setError(""); }
    } catch (cause) {
      if (id === requestId.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลการเงินไม่สำเร็จ");
    } finally {
      if (id === requestId.current && !signal?.aborted) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const first = window.setTimeout(() => { void load(controller.signal); }, 0);
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearTimeout(first); window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const report = useMemo(() => {
    if (!data) return null;
    const today = dayFormat.format(new Date(data.generatedAt));
    const years = [...new Set([today.slice(0, 4), ...data.rows.map(row => row.date.slice(0, 4))])].sort().reverse();
    const firstDate = data.rows[0]?.date || today.slice(0, 4) + "-01-01";
    const from = period === "ALL" ? firstDate : period + "-01-01";
    const to = period === "ALL" ? today : period + "-12-31" < today ? period + "-12-31" : today;
    const units = data.units.filter(unit => scope === "ALL" || scope === unit.id || scope === "company:" + unit.companyCode)
      .sort((a, b) => Number(!a.companyCode) - Number(!b.companyCode) || (a.companyCode || "").localeCompare(b.companyCode || "") || sortUnit(a) - sortUnit(b) || a.name.localeCompare(b.name));
    const selectedIds = new Set(units.map(unit => unit.id));
    const lifetimeRows = data.rows.filter(row => selectedIds.has(row.unitId));
    const rows = lifetimeRows.filter(row => row.date >= from && row.date <= to);
    const totals = summarizeFinanceRows(rows);
    const lifetime = summarizeFinanceRows(lifetimeRows);
    const position = combineFinancePositions(data.positions.filter(item => selectedIds.has(item.unitId)));
    const categories = new Map<string, number>();
    const unitRows = new Map<string, FinanceRow[]>();
    const unitLifetimeRows = new Map<string, FinanceRow[]>();
    for (const row of lifetimeRows) {
      const list = unitLifetimeRows.get(row.unitId) ?? [];
      list.push(row); unitLifetimeRows.set(row.unitId, list);
      if (row.date < from || row.date > to) continue;
      const filtered = unitRows.get(row.unitId) ?? [];
      filtered.push(row); unitRows.set(row.unitId, filtered);
      if (row.type === "EXPENSE" && !row.opening) categories.set(row.category, (categories.get(row.category) ?? 0) + row.amount);
    }
    const positions = new Map(data.positions.map(item => [item.unitId, item]));
    const details = units.map(unit => ({
      unit,
      totals: summarizeFinanceRows(unitRows.get(unit.id) ?? []),
      lifetime: summarizeFinanceRows(unitLifetimeRows.get(unit.id) ?? []),
      months: monthlyFinanceRows(unitRows.get(unit.id) ?? [], from, to),
      position: positions.get(unit.id),
    }));
    const companies = [...new Set(units.map(unit => unit.companyCode))].map(code => {
      const companyUnits = details.filter(item => item.unit.companyCode === code);
      const ids = new Set(companyUnits.map(item => item.unit.id));
      return { code, name: companyUnits[0]?.unit.companyName || "ไม่ระบุบริษัท", totals: summarizeFinanceRows(rows.filter(row => ids.has(row.unitId))) };
    });
    return { years, today, from, to, totals, lifetime, position, months: monthlyFinanceRows(rows, from, to), expenseCategories: [...categories].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount), details, companies };
  }, [data, period, scope]);

  const companyCodes = data ? [...new Set(data.units.map(unit => unit.companyCode).filter((code): code is string => Boolean(code)))] : [];
  const comparisonMax = report ? Math.max(1, ...report.details.flatMap(item => [item.totals.income, item.totals.expense])) : 1;

  return <div className="mx-auto w-full max-w-[1600px] space-y-5 py-5 sm:py-7">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">ภาพรวมการเงิน OBN</h1><p className="mt-1 text-xs text-slate-500">{report ? dateLabel(report.from) + " – " + dateLabel(report.to) : "กำลังโหลดข้อมูลการเงิน…"}</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11px] text-slate-500">บริษัท / สาขา<select disabled={!data} value={scope} onChange={event => setScope(event.target.value)} className="h-10 max-w-[280px] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800"><option value="ALL">OBN รวมทุกบริษัทและสาขา</option>{companyCodes.map(code => {
          const units = data!.units.filter(unit => unit.companyCode === code).sort((a, b) => sortUnit(a) - sortUnit(b));
          return <optgroup key={code} label={units[0]?.companyName}><option value={"company:" + code}>{units[0]?.companyName} · รวมสาขา</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</optgroup>;
        })}{data?.units.filter(unit => !unit.companyCode).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <label className="grid gap-1 text-[11px] text-slate-500">ช่วงข้อมูล<select disabled={!data} value={period} onChange={event => setPeriod(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800"><option value="ALL">ทั้งหมด</option>{(report?.years ?? []).map(year => <option key={year} value={year}>ปี {Number(year) + 543}</option>)}</select></label>
        <button type="button" onClick={() => { void load(); }} disabled={refreshing} aria-label="อัปเดตข้อมูลการเงิน" title="อัปเดตข้อมูล" className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-50"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /></button>
      </div>
    </header>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={() => { void load(); }} className="shrink-0 font-medium underline">ลองอีกครั้ง</button></div>}
    {!report ? <div role="status" className={panelClass + " py-16 text-center text-sm text-slate-500"}>{error ? "ยังโหลดข้อมูลไม่สำเร็จ" : "กำลังรวบรวมข้อมูลบริษัทและสาขา…"}</div> : <>
      <section aria-label="ยอดรับจ่ายรวม" className={"grid gap-3 sm:grid-cols-2 " + (period === "ALL" ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
        <Metric label="เงินรับในช่วงที่เลือก" amount={report.totals.income} tone="text-emerald-700" note={report.totals.count.toLocaleString("th-TH") + " รายการรับ–จ่าย"} />
        <Metric label="เงินจ่ายในช่วงที่เลือก" amount={report.totals.expense} tone="text-rose-700" note={"จ่าย / รับ " + (report.totals.income > 0 ? (report.totals.expense / report.totals.income * 100).toFixed(1) + "%" : "—")} />
        <Metric label="รับ−จ่ายสุทธิในช่วงที่เลือก" amount={report.totals.net} tone={report.totals.net < 0 ? "text-rose-700" : "text-teal-800"} note={report.details.length + " บริษัท / หน่วยงาน"} />
        {period !== "ALL" && <Metric label="สุทธิสะสมตั้งแต่เริ่มบันทึก" amount={report.lifetime.net + report.lifetime.opening} tone="text-slate-900" note={"ถึง " + dateLabel(report.today)} />}
      </section>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel title="แนวโน้มเงินรับ–จ่าย" extra={<Legend />}>
          <CashflowChart months={report.months} />
          <details className="mt-3 text-xs text-slate-500"><summary className="w-fit cursor-pointer py-1">ตัวเลขรายเดือน</summary><div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-right text-xs"><caption className="sr-only">เงินรับ เงินจ่าย และสุทธิรายเดือน</caption><thead><tr className="border-b border-slate-200"><th scope="col" className="py-2 text-left">เดือน</th><th scope="col">เงินรับ</th><th scope="col">เงินจ่าย</th><th scope="col">สุทธิ</th></tr></thead><tbody>{report.months.map(month => <tr key={month.key} className="border-b border-slate-100"><th scope="row" className="py-2 text-left font-normal">{monthLabel(month.key)}</th><td className="text-emerald-700">{money(month.income)}</td><td className="text-rose-700">{money(month.expense)}</td><td>{money(month.net)}</td></tr>)}</tbody></table></div></details>
        </Panel>
        <Panel title="เงินจ่ายตามหมวด" extra={<span className="text-xs tabular-nums text-rose-700">{money(report.totals.expense)}</span>}><RankedAmounts rows={report.expenseCategories} total={report.totals.expense} tone="bg-rose-400" empty="ไม่มีรายการจ่ายในช่วงที่เลือก" /></Panel>
      </div>
      <Panel title="เปรียบเทียบเงินรับ–จ่ายแต่ละบริษัท / สาขา" extra={<Legend />}>
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">{report.details.map(({ unit, totals }) => <div key={unit.id}><p className="mb-2 truncate text-xs font-medium text-slate-700" title={unit.name}>{unit.name}</p><div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5"><div className="h-2.5 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-500" style={{ width: Math.max(0, totals.income) / comparisonMax * 100 + "%" }} /></div><span className="text-right text-xs tabular-nums text-emerald-700">{money(totals.income)}</span><div className="h-2.5 overflow-hidden rounded-full bg-rose-50"><div className="h-full rounded-full bg-rose-400" style={{ width: Math.max(0, totals.expense) / comparisonMax * 100 + "%" }} /></div><span className="text-right text-xs tabular-nums text-rose-700">{money(totals.expense)}</span></div></div>)}</div>
      </Panel>
      <section aria-label="สถานะทรัพย์สินและลูกหนี้" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-slate-800">ทรัพย์สินและภาระคงเหลือ</h2><span className="text-[11px] text-slate-500">ณ {dateFormat.format(new Date(data!.generatedAt))}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="สินทรัพย์ตามทะเบียน" amount={report.position.assetCount ? report.position.assetValue : null} tone="text-blue-800" note={report.position.assetCount + " รายการ" + (report.position.assetCount ? " · ทุน " + money(report.position.assetCost) : "")} />
          <Metric label="หนี้สินตามทะเบียน" amount={report.position.liabilityValue} tone="text-amber-800" note={report.position.liabilityCount + " รายการ"} />
          <Metric label="มูลค่าสุทธิตามทะเบียน" amount={report.position.assetCount || report.position.liabilityCount ? report.position.assetValue - report.position.liabilityValue : null} tone="text-teal-800" note="สินทรัพย์ตามทะเบียน − หนี้สินตามทะเบียน" />
          <Metric label="เงินต้นลูกหนี้สินเชื่อคงเหลือ" amount={report.position.receivablePrincipal} tone="text-violet-800" note={report.position.receivableCount + " สัญญา · ดอกเบี้ยรอรับ " + money(report.position.receivableInterest)} />
        </div>
        {(report.position.pendingPayments > 0 || report.position.pendingReceipts > 0) && <div className="grid gap-3 sm:grid-cols-2"><Metric label="รายการรอรับเงิน" amount={report.position.pendingReceipts} tone="text-emerald-700" /><Metric label="รายการรอจ่าย / รออนุมัติ" amount={report.position.pendingPayments} tone="text-amber-800" /></div>}
        {report.position.assetCount > 0 && <Panel title="สัดส่วนสินทรัพย์ตามทะเบียน" extra={<span className="text-xs text-slate-500">{report.position.assetCount} รายการ</span>}><RankedAmounts rows={report.position.assetCategories.map(item => ({ label: wealthAssetCategoryLabel(item.category), amount: item.value })).sort((a, b) => b.amount - a.amount)} total={report.position.assetValue} tone="bg-blue-500" empty="ไม่มีข้อมูลมูลค่าทรัพย์สิน" /></Panel>}
      </section>
      <section aria-labelledby="company-finance-detail-title" className="space-y-3">
        <h2 id="company-finance-detail-title" className="text-base font-semibold text-slate-800">ข้อมูลแยกตามบริษัท / สาขา</h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">{report.details.map(({ unit, totals, lifetime, months, position }) => <article key={unit.id} className={panelClass}>
          <header className="mb-4 flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">{unit.name}</h3><span className="shrink-0 text-[10px] text-slate-400">{totals.count.toLocaleString("th-TH")} รายการ</span></header>
          <dl className="grid grid-cols-3 gap-2">{[{ label: "เงินรับ", amount: totals.income, tone: "text-emerald-700" }, { label: "เงินจ่าย", amount: totals.expense, tone: "text-rose-700" }, { label: "สุทธิ", amount: totals.net, tone: totals.net < 0 ? "text-rose-700" : "text-slate-800" }].map(item => <div key={item.label}><dt className="text-[11px] text-slate-500">{item.label}</dt><dd className={"mt-1 break-words text-sm font-semibold tabular-nums sm:text-base " + item.tone}>{money(item.amount)}</dd></div>)}</dl>
          <MiniCashflowChart months={months.slice(-12)} />
          <dl className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs">
            <NumberRow label="สุทธิสะสมตั้งแต่เริ่มบันทึก" amount={lifetime.net + lifetime.opening} />
            {position && position.assetCount > 0 && <NumberRow label={"สินทรัพย์ตามทะเบียน " + position.assetCount + " รายการ"} amount={position.assetValue} />}
            {position && position.liabilityCount > 0 && <NumberRow label={"หนี้สินตามทะเบียน " + position.liabilityCount + " รายการ"} amount={position.liabilityValue} />}
            {position && position.receivableCount > 0 && <><NumberRow label={"เงินต้นลูกหนี้ " + position.receivableCount + " สัญญา"} amount={position.receivablePrincipal} /><NumberRow label="ดอกเบี้ยรอรับ" amount={position.receivableInterest} /></>}
            {position && position.pendingReceipts > 0 && <NumberRow label="รอรับเงิน" amount={position.pendingReceipts} />}
            {position && position.pendingPayments > 0 && <NumberRow label="รอจ่าย / รออนุมัติ" amount={position.pendingPayments} />}
          </dl>
        </article>)}</div>
      </section>
      <Panel title="ยอดรวมแยกตามบริษัทจดทะเบียน">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-right text-xs"><caption className="sr-only">ยอดเงินรับและจ่ายของบริษัท รวมสาขา</caption><thead className="border-b border-slate-200 text-slate-500"><tr><th scope="col" className="pb-3 text-left font-medium">บริษัท · รวมสาขา</th><th scope="col" className="pb-3 font-medium">เงินรับ</th><th scope="col" className="pb-3 font-medium">เงินจ่าย</th><th scope="col" className="pb-3 font-medium">สุทธิ</th></tr></thead><tbody className="divide-y divide-slate-100">{report.companies.map(company => <tr key={company.code || "UNASSIGNED"}><th scope="row" className="py-3 text-left font-medium text-slate-700">{company.name}</th><td className="py-3 tabular-nums text-emerald-700">{money(company.totals.income)}</td><td className="py-3 tabular-nums text-rose-700">{money(company.totals.expense)}</td><td className="py-3 tabular-nums font-semibold text-slate-800">{money(company.totals.net)}</td></tr>)}</tbody></table></div>
      </Panel>
      <p className="text-right text-[10px] text-slate-400">อัปเดต {new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(new Date(data!.generatedAt))}</p>
    </>}
  </div>;
}

function Metric({ label, amount, tone, note }: { label: string; amount: number | null; tone: string; note?: string }) {
  return <article className={panelClass}><p className="text-xs text-slate-500">{label}</p><strong className={"mt-2 block break-words text-xl font-semibold tabular-nums xl:text-[clamp(17px,1.5vw,24px)] " + tone}>{amount === null ? "—" : money(amount)}</strong>{note && <p className="mt-2 text-[10px] text-slate-400">{note}</p>}</article>;
}
function Panel({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return <section className={panelClass + " min-w-0"}><header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-800">{title}</h2>{extra}</header>{children}</section>;
}
function NumberRow({ label, amount }: { label: string; amount: number }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="shrink-0 tabular-nums font-medium text-slate-700">{money(amount)}</dd></div>;
}
function Legend() {
  return <div className="flex gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-emerald-500" aria-hidden="true" />เงินรับ</span><span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-rose-400" aria-hidden="true" />เงินจ่าย</span></div>;
}
function RankedAmounts({ rows, total, tone, empty }: { rows: { label: string; amount: number }[]; total: number; tone: string; empty: string }) {
  if (!rows.length) return <p className="grid min-h-44 place-items-center text-xs text-slate-400">{empty}</p>;
  const shown = rows.slice(0, 6);
  if (rows.length > 6) shown.push({ label: "อื่น ๆ", amount: rows.slice(6).reduce((sum, row) => sum + row.amount, 0) });
  return <div className="space-y-4">{shown.map((row, index) => <div key={row.label + ":" + index}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="min-w-0 truncate text-slate-600" title={row.label}>{row.label}</span><span className="shrink-0 tabular-nums font-medium text-slate-800">{money(row.amount)} <small className="ml-1 inline-block min-w-10 text-right font-normal text-slate-400">{total ? (row.amount / total * 100).toFixed(1) : "0.0"}%</small></span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={"h-full rounded-full " + tone} style={{ width: (total > 0 ? Math.min(100, Math.max(0, row.amount / total * 100)) : 0) + "%" }} /></div></div>)}</div>;
}
function MiniCashflowChart({ months }: { months: Month[] }) {
  const max = Math.max(1, ...months.flatMap(month => [Math.abs(month.income), Math.abs(month.expense)]));
  return <div className="mt-4 flex h-16 items-end gap-1 border-b border-slate-100" role="img" aria-label="เงินรับและจ่าย สูงสุด 12 เดือนท้ายในช่วงที่เลือก">{months.map(month => <div key={month.key} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={monthLabel(month.key) + " · รับ " + money(month.income) + " · จ่าย " + money(month.expense)}><span className="w-1/3 rounded-t-sm bg-emerald-400" style={{ height: Math.abs(month.income) / max * 100 + "%" }} /><span className="w-1/3 rounded-t-sm bg-rose-300" style={{ height: Math.abs(month.expense) / max * 100 + "%" }} /></div>)}</div>;
}
function CashflowChart({ months }: { months: Month[] }) {
  const titleId = useId();
  const width = Math.max(620, months.length * 40 + 64), height = 250;
  const left = 60, top = 12, bottom = 35;
  const max = Math.max(1, ...months.flatMap(month => [month.income, month.expense]));
  const min = Math.min(0, ...months.flatMap(month => [month.income, month.expense]));
  const scale = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const baseline = scale(0);
  const step = (width - left - 12) / Math.max(1, months.length);
  const labelStep = Math.max(1, Math.ceil(months.length / 14));
  return <div className="overflow-x-auto"><svg viewBox={"0 0 " + width + " " + height} style={{ minWidth: Math.min(width, 800) }} className="w-full" role="img" aria-labelledby={titleId}><title id={titleId}>กราฟเงินรับและเงินจ่ายรายเดือน ตัวเลขอยู่ในตารางรายเดือน</title>
    {Array.from({ length: 5 }, (_, index) => max - (max - min) * index / 4).map((tick, index) => <g key={index}><line x1={left} x2={width - 8} y1={scale(tick)} y2={scale(tick)} stroke="#e2e8f0" strokeDasharray="3 4" /><text x={left - 8} y={scale(tick) + 3} textAnchor="end" fill="#94a3b8" fontSize="10">{compactFormat.format(tick / 100)}</text></g>)}
    {months.map((month, index) => {
      const x = left + index * step + step * 0.18;
      return <g key={month.key}><title>{monthLabel(month.key) + " · รับ " + money(month.income) + " · จ่าย " + money(month.expense) + " · สุทธิ " + money(month.net)}</title><rect x={x} y={Math.min(scale(month.income), baseline)} width={step * 0.29} height={Math.abs(baseline - scale(month.income))} rx="2" fill="#10b981" /><rect x={x + step * 0.34} y={Math.min(scale(month.expense), baseline)} width={step * 0.29} height={Math.abs(baseline - scale(month.expense))} rx="2" fill="#fb7185" />{index % labelStep === 0 && <text x={left + index * step + step / 2} y={height - 12} textAnchor="middle" fill="#64748b" fontSize="10">{monthLabel(month.key)}</text>}</g>;
    })}
  </svg></div>;
}
