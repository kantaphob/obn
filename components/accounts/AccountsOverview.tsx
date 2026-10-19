'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CircleAlert,
  FileCheck2,
  FileText,
  Landmark,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

type LedgerEntry = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  title: string;
  category: string;
  amount: number;
  transactionDate: string;
  documentNumber: string | null;
  companyCode: string | null;
  branchCode: string | null;
  party: string;
  source: 'MANUAL' | 'LOAN';
};

type Company = {
  companycode: string;
  nameTH: string;
  nameEN: string;
  status: string;
};

type MonthSummary = { month: string; income: number; expense: number };
type CompanySummary = { companycode: string | null; name: string; isPrimary: boolean; income: number; expense: number; count: number };
const TARGET_COMPANY_COUNT = 5;

const bangkokMonth = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
}).format(date);

const monthDateRange = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  const today = bangkokMonth() === month
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    : `${year}-${String(monthNumber).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(start);
  return { from, to: today };
};

const addMonths = (month: string, offset: number) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const value = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return bangkokMonth(value);
};

const money = (satang: number) => new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', maximumFractionDigits: 2,
}).format(satang / 100);

const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit',
}).format(new Date(value));

const monthLabel = (value: string, options: Intl.DateTimeFormatOptions = { month: 'short' }) => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', options).format(new Date(Date.UTC(year, month - 1, 1)));
};

const modules = [
  { title: 'บันทึกรับจ่ายแยกบริษัท', description: 'เลือกบริษัทและสาขาทุกครั้งที่ลงรายการ', href: '/dashboard/loan/ledger', icon: BookOpenCheck, tone: 'green' },
  { title: 'บัญชีลูกหนี้ (AR)', description: 'ใบแจ้งหนี้ ใบเสร็จ และรับชำระเงิน', href: '/dashboard/accounts/ar/invoices', icon: ArrowDownLeft, tone: 'blue' },
  { title: 'บัญชีเจ้าหนี้ (AP)', description: 'ใบสั่งซื้อ ใบสำคัญจ่าย และจ่ายชำระ', href: '/dashboard/accounts/ap/vouchers', icon: ArrowUpRight, tone: 'amber' },
  { title: 'เงินสดและธนาคาร', description: 'ดูรายการเงินสดและช่องทางรับจ่าย', href: '/dashboard/accounts/cash-and-banks', icon: Landmark, tone: 'purple' },
  { title: 'ภาษีและกฎหมาย', description: 'ติดตามเอกสารและกำหนดการภาษี', href: '/dashboard/accounts/tax-and-legal', icon: FileText, tone: 'rose' },
  { title: 'ปิดบัญชีและงบการเงิน', description: 'ตรวจยอดก่อนปิดรอบบัญชี', href: '/dashboard/accounts/closing', icon: FileCheck2, tone: 'slate' },
  { title: 'ดุลยบัญชี', description: 'ตรวจสอบยอดเดบิตและเครดิต', href: '/dashboard/accounts/trial-balance', icon: Scale, tone: 'cyan' },
  { title: 'ตรวจสอบและเอกสาร', description: 'เอกสารประกอบและรายการตรวจสอบ', href: '/dashboard/accounts/audit', icon: ShieldCheck, tone: 'indigo' },
];

export default function AccountsOverview() {
  const [month, setMonth] = useState(bangkokMonth);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyListAvailable, setCompanyListAvailable] = useState(true);
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const range = useMemo(() => monthDateRange(month), [month]);
  const currentMonth = bangkokMonth();
  const fromSixMonthsBack = addMonths(month, -5);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from: `${fromSixMonthsBack}-01`, to: range.to });
      const response = await fetch(`/api/dashboard/accounts-overview?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดสรุปบัญชีไม่สำเร็จ');
      setEntries(data.entries as LedgerEntry[]);
      setCompanies(data.companies as Company[]);
      setCompanyListAvailable(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดสรุปบัญชีไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [fromSixMonthsBack, range.to]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = useMemo(() => {
    const monthEntries = entries.filter((entry) => bangkokMonth(new Date(entry.transactionDate)) === month);
    return {
      rows: monthEntries,
      income: monthEntries.reduce((total, entry) => total + (entry.type === 'INCOME' ? entry.amount : 0), 0),
      expense: monthEntries.reduce((total, entry) => total + (entry.type === 'EXPENSE' ? entry.amount : 0), 0),
      companies: new Set(monthEntries.map((entry) => entry.companyCode).filter(Boolean)).size,
    };
  }, [entries, month]);

  const companySummaries = useMemo<CompanySummary[]>(() => {
    const rows: CompanySummary[] = companies.map((company) => {
      const companyEntries = summary.rows.filter((entry) => entry.companyCode === company.companycode);
      const name = company.nameTH || company.nameEN || `บริษัท ${company.companycode}`;
      return {
        companycode: company.companycode,
        name,
        isPrimary: /obn/i.test(`${company.nameTH} ${company.nameEN}`),
        income: companyEntries.reduce((total, entry) => total + (entry.type === 'INCOME' ? entry.amount : 0), 0),
        expense: companyEntries.reduce((total, entry) => total + (entry.type === 'EXPENSE' ? entry.amount : 0), 0),
        count: companyEntries.length,
      };
    });
    const listedCodes = new Set(rows.map((company) => company.companycode));
    for (const code of new Set(summary.rows.map((entry) => entry.companyCode).filter((value): value is string => Boolean(value)))) {
      if (listedCodes.has(code)) continue;
      const companyEntries = summary.rows.filter((entry) => entry.companyCode === code);
      rows.push({ companycode: code, name: `บริษัท ${code}`, isPrimary: false,
        income: companyEntries.reduce((total, entry) => total + (entry.type === 'INCOME' ? entry.amount : 0), 0),
        expense: companyEntries.reduce((total, entry) => total + (entry.type === 'EXPENSE' ? entry.amount : 0), 0),
        count: companyEntries.length });
    }
    if (summary.rows.some((entry) => !entry.companyCode)) {
      const companyEntries = summary.rows.filter((entry) => !entry.companyCode);
      rows.push({ companycode: null, name: 'ยังไม่ระบุบริษัท', isPrimary: false,
        income: companyEntries.reduce((total, entry) => total + (entry.type === 'INCOME' ? entry.amount : 0), 0),
        expense: companyEntries.reduce((total, entry) => total + (entry.type === 'EXPENSE' ? entry.amount : 0), 0),
        count: companyEntries.length });
    }
    return rows.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, 'th'));
  }, [companies, summary.rows]);

  const trend = useMemo<MonthSummary[]>(() => Array.from({ length: 6 }, (_, index) => {
    const trendMonth = addMonths(month, index - 5);
    const rows = entries.filter((entry) => bangkokMonth(new Date(entry.transactionDate)) === trendMonth);
    return {
      month: trendMonth,
      income: rows.reduce((total, entry) => total + (entry.type === 'INCOME' ? entry.amount : 0), 0),
      expense: rows.reduce((total, entry) => total + (entry.type === 'EXPENSE' ? entry.amount : 0), 0),
    };
  }), [entries, month]);
  const maxTrend = Math.max(1, ...trend.flatMap((item) => [item.income, item.expense]));
  const activeCompanyCount = companies.filter((company) => company.status === 'ACTIVE').length;
  const visibleEntries = companyFilter === 'ALL' ? summary.rows : summary.rows.filter((entry) => (entry.companyCode ?? 'UNASSIGNED') === companyFilter);
  const recentEntries = [...visibleEntries].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()).slice(0, 6);
  const monthTitle = monthLabel(month, { month: 'long', year: 'numeric' });

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b958e]">
            <span>Accounts</span><span className="text-[#c5ccc7]">/</span><span className="text-[#52725d]">ภาพรวมบัญชี</span>
          </div>
          <h1>บัญชีรวมทั้งหมด</h1>
          <p>OBN · ศูนย์ควบคุมรับจ่ายและติดตามค่าใช้จ่ายของทั้งกลุ่ม</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae6] bg-white px-3 text-xs text-[#657168]">
            <CalendarDays size={15} aria-hidden="true" />
            <span className="sr-only">เลือกเดือน</span>
            <input aria-label="เลือกเดือน" type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} className="w-[132px] bg-transparent text-xs outline-none" />
          </label>
          <Link href="/dashboard/loan/ledger" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#477e66] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#386c54]">
            <Receipt size={15} aria-hidden="true" /> บันทึกรับ/จ่าย <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#f2d8d2] bg-[#fff7f5] px-4 py-3 text-sm text-[#9d493d]">
        <span className="flex items-center gap-2"><CircleAlert size={17} aria-hidden="true" />{error}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:bg-[#fbe9e5]"><RefreshCw size={14} aria-hidden="true" />ลองอีกครั้ง</button>
      </div>}

      <section aria-label={`สรุปบัญชีเดือน${monthTitle}`} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="รายรับรวม" value={money(summary.income)} note={`${monthTitle} · ${summary.rows.filter((row) => row.type === 'INCOME').length} รายการ`} icon={ArrowDownLeft} tone="green" loading={loading} />
        <SummaryCard label="รายจ่ายรวม" value={money(summary.expense)} note={`${monthTitle} · ${summary.rows.filter((row) => row.type === 'EXPENSE').length} รายการ`} icon={ArrowUpRight} tone="rose" loading={loading} />
        <SummaryCard label="ส่วนต่างรับ–จ่าย" value={money(summary.income - summary.expense)} note="รายรับรวม หัก รายจ่ายรวม" icon={Wallet} tone="blue" loading={loading} />
        <SummaryCard label="บริษัทที่เปิดใช้งาน" value={companyListAvailable ? `${new Intl.NumberFormat('th-TH').format(activeCompanyCount)} / ${TARGET_COMPANY_COUNT}` : '—'} note={companyListAvailable ? `เป้าหมาย OBN และอีก 4 บริษัท` : 'ไม่มีสิทธิ์ดูทะเบียนบริษัท'} icon={Banknote} tone="amber" loading={loading} />
      </section>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-[#e7ebe8] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#eef1ee] px-5 py-4">
            <div><h2 className="text-sm font-semibold text-[#29362f]">แนวโน้มรายรับและรายจ่าย</h2><p className="mt-1 text-[11px] text-[#929d96]">6 เดือนย้อนหลังถึง {monthTitle}</p></div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7a847e]"><ChartNoAxesCombined size={15} className="text-[#659274]" aria-hidden="true" /> บาท</span>
          </div>
          {loading ? <div className="flex h-[218px] items-center justify-center text-xs text-[#98a29c]">กำลังโหลดข้อมูล…</div> : <div className="grid h-[218px] grid-cols-6 items-end gap-3 px-5 pb-4 pt-6 sm:gap-5">
            {trend.map((item) => {
              const incomeHeight = item.income ? Math.max(7, item.income / maxTrend * 145) : 3;
              const expenseHeight = item.expense ? Math.max(7, item.expense / maxTrend * 145) : 3;
              return <div key={item.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                <div className="flex h-[150px] w-full max-w-[74px] items-end justify-center gap-1.5" title={`รายรับ ${money(item.income)} · รายจ่าย ${money(item.expense)}`}>
                  <div aria-label={`รายรับ ${money(item.income)}`} className="w-[min(28px,45%)] rounded-t-md bg-[#79a889] transition-all" style={{ height: `${incomeHeight}px` }} />
                  <div aria-label={`รายจ่าย ${money(item.expense)}`} className="w-[min(28px,45%)] rounded-t-md bg-[#d9a28f] transition-all" style={{ height: `${expenseHeight}px` }} />
                </div>
                <span className={`text-[10px] ${item.month === month ? 'font-semibold text-[#477e66]' : 'text-[#929d96]'}`}>{monthLabel(item.month)}</span>
              </div>;
            })}
          </div>}
          <div className="flex gap-4 border-t border-[#f0f2f0] px-5 py-3 text-[10px] text-[#7f8983]"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#79a889]" />รายรับ</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#d9a28f]" />รายจ่าย</span></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e7ebe8] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1ee] px-5 py-4">
            <div><h2 className="text-sm font-semibold text-[#29362f]">ค่าใช้จ่ายแยกบริษัท</h2><p className="mt-1 text-[11px] text-[#929d96]">เปรียบเทียบรายรับและรายจ่ายของทุกบริษัท · {monthTitle}</p></div>
            <Banknote size={17} className="text-[#6b9278]" aria-hidden="true" />
          </div>
          <div className="divide-y divide-[#f0f2f0]">
            {companySummaries.map((company) => {
              const expenseWidth = summary.expense ? Math.min(100, company.expense / Math.max(1, ...companySummaries.map((item) => item.expense)) * 100) : 0;
              return <div key={company.companycode ?? 'unassigned'} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><strong className="truncate text-xs font-semibold text-[#354239]">{company.name}</strong>{company.isPrimary && <span className="rounded-full bg-[#edf5ef] px-2 py-0.5 text-[9px] font-semibold text-[#4e8060]">OBN</span>}</div><span className="mt-1 block text-[10px] text-[#99a29d]">{company.companycode ? `รหัส ${company.companycode}` : 'รายการเดิมที่ยังไม่ผูกบริษัท'} · {company.count} รายการ</span></div>
                  <div className="shrink-0 text-right"><span className="block text-[11px] font-semibold text-[#b76d5b]">จ่าย {money(company.expense)}</span><span className="mt-1 block text-[10px] text-[#60896e]">รับ {money(company.income)}</span></div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f2f3f2]" aria-label={`รายจ่าย ${company.name} ${money(company.expense)}`}><div className="h-full rounded-full bg-[#d9a28f]" style={{ width: `${expenseWidth}%` }} /></div>
              </div>;
            })}
            {companySummaries.length === 0 && <p className="px-5 py-8 text-center text-xs text-[#929d96]">ไม่พบรายชื่อบริษัทที่มีสิทธิ์ดูข้อมูล</p>}
          </div>
          <div className="border-t border-[#eef1ee] bg-[#fafbfa] px-5 py-3"><div className="flex items-center justify-between gap-3 text-[10px]"><span className="text-[#7e8982]">รวมทั้งกลุ่ม OBN</span><strong className="text-[#b76d5b]">จ่าย {money(summary.expense)}</strong></div><p className="mt-1 text-[9px] leading-relaxed text-[#9aa39d]">ยอดรวมด้านบนรวมทุกรายการ หากรายการเก่ายังไม่มีรหัสบริษัท จะแสดงแยกเป็น “ยังไม่ระบุบริษัท”</p></div>
        </section>
      </div>

      {(!companyListAvailable || activeCompanyCount < TARGET_COMPANY_COUNT) && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eee2c6] bg-[#fffaf0] px-4 py-3">
        <div><p className="text-xs font-semibold text-[#705d32]">{companyListAvailable ? `เปิดใช้งานแล้ว ${activeCompanyCount} จาก ${TARGET_COMPANY_COUNT} บริษัท` : 'โหลดทะเบียนบริษัทไม่สำเร็จ'}</p><p className="mt-1 text-[10px] text-[#93835b]">โครงสร้างกลุ่มมี OBN และอีก 4 บริษัท เพิ่มและเปิดใช้งานให้ครบเพื่อแยกรายการรับจ่ายได้ครบทุกบริษัท</p></div>
        <Link href="/admin/companies" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ead8ac] bg-white px-3 text-[10px] font-semibold text-[#765f2d] hover:bg-[#fff6e1]">จัดการบริษัท <ArrowRight size={13} aria-hidden="true" /></Link>
      </div>}

      <section className="mb-5 rounded-xl border border-[#e7ebe8] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#eef1ee] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#29362f]">ทางลัดจัดการบัญชี</h2><p className="mt-1 text-[11px] text-[#929d96]">เริ่มจากลงรับจ่าย แล้วติดตามงานบัญชีส่วนอื่น</p></div><BookOpenCheck size={17} className="text-[#6b9278]" aria-hidden="true" /></div>
        <div className="grid gap-1 p-2 sm:grid-cols-2 xl:grid-cols-4">{modules.map((item) => <Link key={item.title} href={item.href} className="group flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-[#f7faf7]"><ModuleIcon icon={item.icon} tone={item.tone} /><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-[#3b4840]">{item.title}</strong><small className="mt-1 block truncate text-[10px] text-[#929d96]">{item.description}</small></span><ArrowRight size={15} className="shrink-0 text-[#b3bcb5] transition group-hover:translate-x-0.5 group-hover:text-[#477e66]" aria-hidden="true" /></Link>)}</div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e7ebe8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1ee] px-5 py-4">
          <div><h2 className="text-sm font-semibold text-[#29362f]">รายการล่าสุด</h2><p className="mt-1 text-[11px] text-[#929d96]">รายการรับและจ่ายของ {monthTitle}</p></div>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e7ebe8] bg-white px-3 text-[11px] text-[#7e8982]">บริษัท<select aria-label="กรองรายการตามบริษัท" value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="max-w-[180px] bg-transparent text-xs text-[#435148] outline-none"><option value="ALL">ทั้งหมด</option>{companySummaries.filter((company) => company.companycode).map((company) => <option key={company.companycode} value={company.companycode!}>{company.name}</option>)}<option value="UNASSIGNED">ยังไม่ระบุบริษัท</option></select></label>
          <Link href="/dashboard/loan/ledger" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#477e66] hover:bg-[#f3f8f4]">ดูสมุดบัญชีทั้งหมด <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        {loading ? <div className="px-5 py-10 text-center text-xs text-[#929d96]">กำลังโหลดรายการ…</div> : recentEntries.length === 0 ? <div className="flex flex-col items-center px-5 py-10 text-center">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#f2f6f2] text-[#70957b]"><Receipt size={18} aria-hidden="true" /></div>
          <p className="text-xs font-semibold text-[#526057]">ยังไม่มีรายการในเดือนนี้</p>
          <p className="mt-1 text-[11px] text-[#929d96]">เลือกเดือนอื่น หรือเปิดสมุดบัญชีเพื่อเพิ่มรายการ</p>
        </div> : <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead><tr className="h-10 bg-[#fafbfa] text-[10px] font-medium text-[#919a94]"><th className="px-5">วันที่</th><th>รายการ</th><th>บริษัท</th><th className="text-right">จำนวนเงิน</th><th className="px-5 text-right">ประเภท</th></tr></thead>
            <tbody className="divide-y divide-[#f0f2f0]">{recentEntries.map((entry) => <tr key={entry.id} className="h-[58px] text-xs hover:bg-[#fcfdfc]">
              <td className="whitespace-nowrap px-5 text-[#7e8982]">{dateLabel(entry.transactionDate)}</td>
              <td><div className="max-w-[320px]"><strong className="block truncate font-medium text-[#3b4740]">{entry.title}</strong><span className="mt-1 block truncate text-[10px] text-[#98a19b]">{entry.category}{entry.party ? ` · ${entry.party}` : ''}</span></div></td>
              <td className="whitespace-nowrap text-[11px] text-[#7e8982]">{entry.companyCode || 'ไม่ระบุบริษัท'}{entry.branchCode ? ` · ${entry.branchCode === entry.companyCode ? 'สำนักงานใหญ่' : entry.branchCode}` : ''}</td>
              <td className={`whitespace-nowrap text-right font-semibold tabular-nums ${entry.type === 'INCOME' ? 'text-[#4c8967]' : 'text-[#bb6c5a]'}`}>{entry.type === 'INCOME' ? '+' : '−'}{money(entry.amount)}</td>
              <td className="px-5 text-right"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${entry.type === 'INCOME' ? 'bg-[#edf6ef] text-[#4e8260]' : 'bg-[#fbf0ed] text-[#a66555]'}`}>{entry.type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}</span></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9aa39d]">
        <span>Dashboard แสดงภาพรวมรายการรับจ่ายของทุกบริษัท · ลงรายการและแก้ไขแยกตามสิทธิ์บริษัท</span>
        <span>{loading ? 'กำลังอัปเดตข้อมูล' : `อัปเดตตามข้อมูลล่าสุด · ${companyListAvailable ? `${activeCompanyCount} บริษัทเปิดใช้งาน` : 'ไม่สามารถอ่านทะเบียนบริษัท'}`}</span>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, note, icon: Icon, tone, loading }: {
  label: string;
  value: string;
  note: string;
  icon: typeof Wallet;
  tone: string;
  loading: boolean;
}) {
  return <article className="rounded-xl border border-[#e7ebe8] bg-white p-4 shadow-[0_1px_2px_#2c483709]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#89948d]">{label}</p><p className="mt-3 text-[21px] font-semibold tracking-tight text-[#29362f]">{loading ? '—' : value}</p></div><ModuleIcon icon={Icon} tone={tone} /></div>
    <p className="mt-2 truncate text-[10px] text-[#9aa39d]">{loading ? 'กำลังโหลดข้อมูล…' : note}</p>
  </article>;
}

function ModuleIcon({ icon: Icon, tone }: { icon: typeof Wallet; tone: string }) {
  const tones: Record<string, string> = {
    green: 'bg-[#edf5ef] text-[#5c8a6b]',
    rose: 'bg-[#fbf0ed] text-[#bd7867]',
    blue: 'bg-[#edf4f8] text-[#628aa3]',
    amber: 'bg-[#fbf5e9] text-[#b08b4e]',
    purple: 'bg-[#f3eff8] text-[#8b78a3]',
    slate: 'bg-[#f0f2f1] text-[#718078]',
    cyan: 'bg-[#edf6f6] text-[#5e9291]',
    indigo: 'bg-[#eff1f8] text-[#7783a7]',
  };
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone] ?? tones.green}`}><Icon size={17} aria-hidden="true" /></span>;
}
