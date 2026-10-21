"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Search } from "lucide-react";

type Entry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  transactionDate: string;
  companyCode: string | null;
  branchCode: string | null;
  title: string;
  category: string;
  documentNumber: string | null;
  party: string;
  reference: string;
  method: string;
  settlementStatus?: "PAID" | "PENDING_APPROVAL" | "APPROVED";
};
type Company = { companycode: string; nameTH: string | null; nameEN: string | null; status: string };
type Branch = { companycode: string; branchcode: string; nameTH: string | null; nameEN: string | null };
type Totals = { income: number; expense: number; net: number; count: number };
type ReportData = { entries: Entry[]; companies: Company[]; branches: Branch[] };

const emptyTotals = (): Totals => ({ income: 0, expense: 0, net: 0, count: 0 });
const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(new Date(value));
const methodLabels: Record<string, string> = { CASH: "เงินสด", BANK_TRANSFER: "โอนเงิน", CARD: "บัตร", OTHER: "อื่น ๆ" };
const statusLabels: Record<NonNullable<Entry["settlementStatus"]>, string> = { PAID: "รับ/จ่ายแล้ว", APPROVED: "อนุมัติแล้ว · รอจ่าย", PENDING_APPROVAL: "รออนุมัติ" };

function addEntry(totals: Totals, entry: Entry) {
  if (entry.type === "INCOME") totals.income += entry.amount;
  else totals.expense += entry.amount;
  totals.net = totals.income - totals.expense;
  totals.count += 1;
}

function totalsLabel(totals: Totals) {
  return `${totals.count.toLocaleString("th-TH")} รายการ`;
}

export default function DashboardFinanceReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | Entry["type"]>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/dashboard/accounts-overview", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "โหลดรายงานการเงินไม่สำเร็จ");
      setData(result as ReportData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดรายงานการเงินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const report = useMemo(() => {
    const companies = new Map<string, { company: Company; totals: Totals }>();
    const locations = new Map<string, { companyCode: string; branchCode: string; name: string; totals: Totals }>();
    const unassigned = emptyTotals();
    for (const company of data?.companies ?? []) companies.set(company.companycode, { company, totals: emptyTotals() });

    for (const entry of data?.entries ?? []) {
      if (!entry.companyCode) {
        addEntry(unassigned, entry);
        continue;
      }
      const company = companies.get(entry.companyCode);
      if (!company) continue;
      addEntry(company.totals, entry);
      const branchCode = entry.branchCode || entry.companyCode;
      const branch = data?.branches.find((item) => item.companycode === entry.companyCode && item.branchcode === branchCode);
      const key = `${entry.companyCode}:${branchCode}`;
      const location = locations.get(key) ?? {
        companyCode: entry.companyCode,
        branchCode,
        name: branchCode === entry.companyCode ? "สำนักงานใหญ่" : branch?.nameTH || branch?.nameEN || `สาขา ${branchCode}`,
        totals: emptyTotals(),
      };
      addEntry(location.totals, entry);
      locations.set(key, location);
    }

    for (const branch of data?.branches ?? []) {
      const key = `${branch.companycode}:${branch.branchcode}`;
      if (!locations.has(key)) locations.set(key, {
        companyCode: branch.companycode,
        branchCode: branch.branchcode,
        name: branch.nameTH || branch.nameEN || `สาขา ${branch.branchcode}`,
        totals: emptyTotals(),
      });
    }

    for (const { company } of companies.values()) {
      const key = `${company.companycode}:${company.companycode}`;
      if (!locations.has(key)) locations.set(key, {
        companyCode: company.companycode,
        branchCode: company.companycode,
        name: "สำนักงานใหญ่",
        totals: emptyTotals(),
      });
    }

    const overall = emptyTotals();
    for (const { totals } of companies.values()) {
      overall.income += totals.income;
      overall.expense += totals.expense;
      overall.count += totals.count;
    }
    overall.income += unassigned.income;
    overall.expense += unassigned.expense;
    overall.count += unassigned.count;
    overall.net = overall.income - overall.expense;
    if (unassigned.count) locations.set(":", { companyCode: "", branchCode: "", name: "ยังไม่ระบุบริษัท / สาขา", totals: unassigned });
    return {
      overall,
      companies: [...companies.values()].sort((a, b) => a.company.companycode.localeCompare(b.company.companycode)),
      locations: [...locations.values()].sort((a, b) => a.companyCode.localeCompare(b.companyCode) || a.branchCode.localeCompare(b.branchCode)),
    };
  }, [data]);

  const transactions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th-TH");
    return (data?.entries ?? []).filter((entry) => {
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(entry.transactionDate));
      const matchesCompany = companyFilter === "ALL" || (companyFilter === "UNASSIGNED" ? !entry.companyCode : entry.companyCode === companyFilter);
      const matchesType = typeFilter === "ALL" || entry.type === typeFilter;
      const matchesFrom = !fromDate || date >= fromDate;
      const matchesTo = !toDate || date <= toDate;
      const company = data?.companies.find((item) => item.companycode === entry.companyCode);
      const branch = data?.branches.find((item) => item.companycode === entry.companyCode && item.branchcode === entry.branchCode);
      const searchable = `${entry.title} ${entry.category} ${entry.party} ${entry.reference} ${entry.documentNumber ?? ""} ${entry.companyCode ?? ""} ${company?.nameTH ?? ""} ${company?.nameEN ?? ""} ${branch?.nameTH ?? ""} ${branch?.nameEN ?? ""}`.toLocaleLowerCase("th-TH");
      return matchesCompany && matchesType && matchesFrom && matchesTo && (!needle || searchable.includes(needle));
    });
  }, [companyFilter, data, fromDate, query, toDate, typeFilter]);
  const pageSize = 25;
  const pageCount = Math.ceil(transactions.length / pageSize);
  const pageEntries = transactions.slice(page * pageSize, (page + 1) * pageSize);
  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(0);
  }

  return <section aria-labelledby="dashboard-finance-report-title" className="mb-7 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_8px_30px_#315b4910] sm:p-6">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">GROUP FINANCE · CONSOLIDATED</p><h2 id="dashboard-finance-report-title" className="mt-1 text-xl font-semibold text-slate-800">รายงานการเงินรวม</h2><p className="mt-1 text-xs text-slate-500">เรียงจากภาพรวมทุกบริษัท ไปยังบริษัทหลัก และสาขาทั้งหมด · เฉพาะรายการรับ–จ่ายที่ลงเงินจริงแล้ว</p></div>
      <button type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 disabled:opacity-50"><RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} />อัปเดตข้อมูล</button>
    </header>

    {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"><span>{error}</span><button type="button" onClick={() => { setLoading(true); void load(); }} className="font-semibold underline">ลองอีกครั้ง</button></div>}

    <section aria-labelledby="dashboard-finance-all-title" className="mb-5 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h3 id="dashboard-finance-all-title" className="text-sm font-semibold text-teal-950">1. ภาพรวมทุกบริษัท</h3><p className="mt-1 text-[11px] text-slate-500">ยอดสะสมจากรายการที่ลงเงินจริงแล้ว · รวมรายการในขอบเขตบริษัทที่บัญชีของคุณเข้าถึงได้</p></div><span className="text-[10px] text-slate-500">{loading && !data ? "กำลังโหลด…" : totalsLabel(report.overall)}</span></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="รายรับ" amount={report.overall.income} icon={ArrowDownLeft} tone="text-emerald-700" loading={loading && !data} />
        <Metric label="รายจ่าย" amount={report.overall.expense} icon={ArrowUpRight} tone="text-rose-700" loading={loading && !data} />
        <Metric label="สุทธิ" amount={report.overall.net} icon={null} tone="text-teal-900" loading={loading && !data} />
      </div>
      <p className="mt-3 text-[10px] text-slate-400">ยอดรวมเพื่อการบริหาร ไม่ใช่งบการเงินรวมที่ผ่านการตัดรายการระหว่างบริษัท</p>
    </section>

    <section aria-labelledby="dashboard-finance-companies-title" className="mb-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 id="dashboard-finance-companies-title" className="text-sm font-semibold text-slate-800">2. บริษัทหลัก</h3><p className="mt-1 text-[11px] text-slate-500">ยอดรับ–จ่ายรวมสำนักงานใหญ่และสาขาของแต่ละบริษัท</p></div></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[620px] text-xs"><caption className="sr-only">สรุปการเงินแยกตามบริษัท</caption><thead className="bg-slate-50 text-slate-500"><tr><th scope="col" className="px-4 py-3 text-left font-medium">บริษัท</th><th scope="col" className="px-4 py-3 text-right font-medium">รายรับ</th><th scope="col" className="px-4 py-3 text-right font-medium">รายจ่าย</th><th scope="col" className="px-4 py-3 text-right font-medium">สุทธิ</th><th scope="col" className="px-4 py-3 text-right font-medium">รายการ</th></tr></thead><tbody className="divide-y divide-slate-100">{report.companies.map(({ company, totals }) => <tr key={company.companycode}><th scope="row" className="px-4 py-3 text-left font-medium text-slate-700">{company.nameTH || company.nameEN || company.companycode}<small className="ml-2 font-normal text-slate-400">{company.companycode}</small></th><td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(totals.income)}</td><td className="px-4 py-3 text-right tabular-nums text-rose-700">{money(totals.expense)}</td><td className={`px-4 py-3 text-right tabular-nums font-medium ${totals.net < 0 ? "text-rose-700" : "text-slate-700"}`}>{money(totals.net)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-500">{totals.count.toLocaleString("th-TH")}</td></tr>)}{!report.companies.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">ไม่พบบริษัทในขอบเขตสิทธิ์</td></tr>}</tbody></table></div>
    </section>

    <section aria-labelledby="dashboard-finance-branches-title">
      <div className="mb-3"><h3 id="dashboard-finance-branches-title" className="text-sm font-semibold text-slate-800">3. สาขาทั้งหมด</h3><p className="mt-1 text-[11px] text-slate-500">แสดงสำนักงานใหญ่และทุกสาขาที่เปิดใช้งาน รวมสาขาที่ยังไม่มีรายการ</p></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[700px] text-xs"><caption className="sr-only">สรุปการเงินแยกสำนักงานใหญ่และสาขา</caption><thead className="bg-slate-50 text-slate-500"><tr><th scope="col" className="px-4 py-3 text-left font-medium">บริษัท</th><th scope="col" className="px-4 py-3 text-left font-medium">สำนักงานใหญ่ / สาขา</th><th scope="col" className="px-4 py-3 text-right font-medium">รายรับ</th><th scope="col" className="px-4 py-3 text-right font-medium">รายจ่าย</th><th scope="col" className="px-4 py-3 text-right font-medium">สุทธิ</th><th scope="col" className="px-4 py-3 text-right font-medium">รายการ</th></tr></thead><tbody className="divide-y divide-slate-100">{report.locations.map((location) => {
        const company = report.companies.find((item) => item.company.companycode === location.companyCode)?.company;
        return <tr key={`${location.companyCode}:${location.branchCode}`}><th scope="row" className="px-4 py-3 text-left font-medium text-slate-700">{location.companyCode ? company?.nameTH || company?.nameEN || location.companyCode : "ยังไม่ระบุบริษัท"}</th><td className="px-4 py-3 text-slate-600">{location.name}<small className="ml-2 text-slate-400">{location.branchCode}</small></td><td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(location.totals.income)}</td><td className="px-4 py-3 text-right tabular-nums text-rose-700">{money(location.totals.expense)}</td><td className={`px-4 py-3 text-right tabular-nums font-medium ${location.totals.net < 0 ? "text-rose-700" : "text-slate-700"}`}>{money(location.totals.net)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-500">{location.totals.count.toLocaleString("th-TH")}</td></tr>;
      })}{!report.locations.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">ยังไม่มีข้อมูลสำนักงานใหญ่หรือสาขา</td></tr>}</tbody></table></div>
    </section>

    <section aria-labelledby="dashboard-finance-transactions-title" className="mt-6 border-t border-slate-100 pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 id="dashboard-finance-transactions-title" className="text-sm font-semibold text-slate-800">4. รายการรับ–จ่ายทั้งหมด</h3><p className="mt-1 text-[11px] text-slate-500">ค้นหารายการของทุกบริษัทและสาขาที่คุณเข้าถึงได้ · แสดง {transactions.length.toLocaleString("th-TH")} รายการ</p></div></div>
      <div className="mb-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="relative sm:col-span-2 xl:col-span-1"><Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="ค้นหารายการ / ผู้เกี่ยวข้อง" aria-label="ค้นหารายการหรือผู้เกี่ยวข้อง" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-teal-600" /></label>
        <label className="grid gap-1 text-[10px] text-slate-500">บริษัท<select value={companyFilter} onChange={(event) => updateFilter(setCompanyFilter, event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="ALL">ทุกบริษัท</option>{report.companies.map(({ company }) => <option key={company.companycode} value={company.companycode}>{company.nameTH || company.nameEN || company.companycode}</option>)}{report.locations.some((location) => !location.companyCode) && <option value="UNASSIGNED">ยังไม่ระบุบริษัท</option>}</select></label>
        <label className="grid gap-1 text-[10px] text-slate-500">ประเภทรายการ<select value={typeFilter} onChange={(event) => updateFilter(setTypeFilter, event.target.value as "ALL" | Entry["type"])} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="ALL">รับและจ่าย</option><option value="INCOME">รายการรับ</option><option value="EXPENSE">รายการจ่าย</option></select></label>
        <label className="grid gap-1 text-[10px] text-slate-500">ตั้งแต่วันที่<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => updateFilter(setFromDate, event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700" /></label>
        <label className="grid gap-1 text-[10px] text-slate-500">ถึงวันที่<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => updateFilter(setToDate, event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700" /></label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[900px] text-xs"><caption className="sr-only">รายการรับและจ่ายทั้งหมดของบริษัท</caption><thead className="bg-slate-50 text-slate-500"><tr><th scope="col" className="px-4 py-3 text-left font-medium">วันที่</th><th scope="col" className="px-4 py-3 text-left font-medium">บริษัท / สาขา</th><th scope="col" className="px-4 py-3 text-left font-medium">รายการ</th><th scope="col" className="px-4 py-3 text-left font-medium">ผู้เกี่ยวข้อง / อ้างอิง</th><th scope="col" className="px-4 py-3 text-left font-medium">สถานะ</th><th scope="col" className="px-4 py-3 text-right font-medium">รับ</th><th scope="col" className="px-4 py-3 text-right font-medium">จ่าย</th></tr></thead><tbody className="divide-y divide-slate-100">{pageEntries.map((entry) => {
        const company = report.companies.find((item) => item.company.companycode === entry.companyCode)?.company;
        const branch = data?.branches.find((item) => item.companycode === entry.companyCode && item.branchcode === entry.branchCode);
        const location = !entry.companyCode ? "ยังไม่ระบุบริษัท" : entry.branchCode === entry.companyCode ? "สำนักงานใหญ่" : branch?.nameTH || branch?.nameEN || `สาขา ${entry.branchCode}`;
        const settlementStatus = entry.settlementStatus ?? "PAID";
        return <tr key={entry.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 text-slate-600">{dateLabel(entry.transactionDate)}</td><td className="px-4 py-3"><strong className="block font-medium text-slate-700">{company?.nameTH || company?.nameEN || entry.companyCode || "ยังไม่ระบุบริษัท"}</strong><small className="text-slate-400">{location}{entry.branchCode && entry.branchCode !== entry.companyCode ? ` · ${entry.branchCode}` : ""}</small></td><td className="px-4 py-3"><strong className="block font-medium text-slate-700">{entry.title}</strong><small className="text-slate-400">{entry.category}</small></td><td className="px-4 py-3 text-slate-600">{entry.party || "—"}<small className="block text-slate-400">{entry.documentNumber || entry.reference || methodLabels[entry.method] || entry.method || "—"}</small></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] ${settlementStatus === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{statusLabels[settlementStatus]}</span></td><td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700">{entry.type === "INCOME" ? money(entry.amount) : "—"}</td><td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-700">{entry.type === "EXPENSE" ? money(entry.amount) : "—"}</td></tr>;
      })}{!pageEntries.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">ไม่พบรายการตามตัวกรอง</td></tr>}</tbody></table></div>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500"><span>แสดง {transactions.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, transactions.length)} จาก {transactions.length.toLocaleString("th-TH")} รายการ · หน้าละ {pageSize} รายการ</span><div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">ก่อนหน้า</button><span className="self-center">หน้า {pageCount ? page + 1 : 0} / {pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">ถัดไป</button></div></footer>
    </section>
  </section>;
}

function Metric({ label, amount, icon: Icon, tone, loading }: { label: string; amount: number; icon: typeof ArrowDownLeft | null; tone: string; loading: boolean }) {
  return <article className="rounded-xl border border-white bg-white/80 p-3.5"><div className="flex items-center gap-2 text-[11px] text-slate-500">{Icon && <Icon size={15} aria-hidden="true" />}{label}</div><strong className={`mt-2 block break-words text-lg font-semibold tabular-nums ${tone}`}>{loading ? "กำลังโหลด…" : money(amount)}</strong></article>;
}
