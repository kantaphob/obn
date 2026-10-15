'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, FileText, Plus, Search, Wallet, X } from 'lucide-react';
import { summarizeCompanyLedgerRows } from '@/lib/company-ledger-summary';
import './ledger.css';

type LedgerType = 'INCOME' | 'EXPENSE';
type LedgerEntry = {
  id: string;
  type: LedgerType;
  title: string;
  category: string;
  amount: number;
  transactionDate: string;
  party: string;
  method: string;
  reference: string;
  note: string;
  source: 'MANUAL' | 'LOAN';
};
type Draft = { type: LedgerType; title: string; categoryId: string; amount: string; transactionDate: string; party: string; method: string; reference: string; note: string };
type FinanceCategory = { id: string; direction: LedgerType; name: string; isActive: boolean };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const currentMonthStart = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-01`;
};
const bangkokDate = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const PAGE_SIZE = 25;
const currency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const freshDraft = (type: LedgerType = 'EXPENSE'): Draft => ({ type, title: '', categoryId: '', amount: '', transactionDate: today(), party: '', method: 'CASH', reference: '', note: '' });

export default function Ledger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [closingBalance, setClosingBalance] = useState(0);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [from, setFrom] = useState(currentMonthStart);
  const [to, setTo] = useState(today());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LedgerType>('ALL');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft>(freshDraft());
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Load the full ledger through the selected end date so the closing cash balance
      // carries forward capital and earlier transactions outside the visible date range.
      const params = new URLSearchParams({ to });
      const response = await fetch(`/api/company-ledger?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดบัญชีไม่สำเร็จ');
      const throughDate = data.filter((entry: LedgerEntry) => !from || bangkokDate(entry.transactionDate) >= from);
      setEntries(throughDate);
      setClosingBalance(summarizeCompanyLedgerRows(data).net);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดบัญชีไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch('/api/company-finance-categories?activeOnly=true', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดหมวดหมู่ไม่สำเร็จ');
      setFinanceCategories(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดหมวดหมู่ไม่สำเร็จ');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCategories(); }, 0);
    window.addEventListener('focus', loadCategories);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', loadCategories); };
  }, [loadCategories]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th-TH');
    return entries.filter((entry) => (typeFilter === 'ALL' || entry.type === typeFilter)
      && (!needle || `${entry.title} ${entry.category} ${entry.party} ${entry.reference} ${entry.note}`.toLocaleLowerCase('th-TH').includes(needle)));
  }, [entries, query, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = useMemo(() => visibleEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visibleEntries, currentPage]);
  const totals = useMemo(() => summarizeCompanyLedgerRows(entries), [entries]);
  const categories = financeCategories.filter((category) => category.direction === draft.type && category.isActive);
  const amountSatang = /^\d+(\.\d{1,2})?$/.test(draft.amount) ? Math.round(Number(draft.amount) * 100) : 0;

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !amountSatang) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/company-ledger', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, amount: amountSatang }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกรายการไม่สำเร็จ');
      setDraft(freshDraft());
      setFormOpen(false);
      setNotice('บันทึกรายการเรียบร้อยแล้ว');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกรายการไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const link = document.createElement('a');
    link.href = `/api/company-ledger/export?${new URLSearchParams({ from, to })}`;
    link.download = 'company-ledger.csv';
    document.body.append(link);
    link.click();
    link.remove();
  }

  return <main className="company-ledger-page">
    <div className="company-ledger-wrap">
      <div className="cl-breadcrumb"><span>จัดการบริษัท</span><span aria-hidden="true">/</span><strong>บัญชีรับ–จ่าย</strong></div>
      <header className="cl-header">
        <div><div className="cl-eyebrow"><CircleDollarSign size={15}/> COMPANY FINANCE</div><h1>บัญชีรับ–จ่าย</h1><p>บันทึกและติดตามกระแสเงินสดของบริษัทในที่เดียว</p></div>
        <div className="cl-header-actions"><button className="cl-button" type="button" onClick={exportCsv}><ArrowDownToLine size={17}/> ส่งออก CSV</button><button className="cl-button primary" type="button" onClick={() => { setDraft(freshDraft()); setFormOpen(true); }}><Plus size={18}/> เพิ่มรายการ</button></div>
      </header>

      {error && <div className="cl-alert error" role="alert"><X size={17}/>{error}<button type="button" aria-label="ปิด" onClick={() => setError('')}><X size={16}/></button></div>}
      {notice && <div className="cl-alert success" role="status"><Check size={17}/>{notice}<button type="button" aria-label="ปิด" onClick={() => setNotice('')}><X size={16}/></button></div>}

      <section className="cl-summary" aria-label="สรุปบัญชี">
        <article className="cl-summary-card"><div className="cl-summary-label"><span className="cl-summary-icon income"><ArrowDownLeft size={18}/></span><span>รายรับในช่วงที่เลือก</span></div><strong className="positive">{currency(totals.income)}</strong><small>{entries.filter((entry) => entry.type === 'INCOME').length} รายการ · ไม่รวมตัวกรองรายการ</small></article>
        <article className="cl-summary-card"><div className="cl-summary-label"><span className="cl-summary-icon expense"><ArrowUpRight size={18}/></span><span>รายจ่ายในช่วงที่เลือก</span></div><strong className="negative">{currency(totals.expense)}</strong><small>{entries.filter((entry) => entry.type === 'EXPENSE').length} รายการ · ไม่รวมตัวกรองรายการ</small></article>
        <article className="cl-summary-card period-net"><div className="cl-summary-label"><span className="cl-summary-icon net"><CircleDollarSign size={18}/></span><span>สุทธิในช่วงที่เลือก</span></div><strong className={totals.net < 0 ? 'negative' : 'positive'}>{currency(totals.net)}</strong><small>รายรับลบรายจ่ายตามช่วงวันที่เลือก</small></article>
        <article className="cl-summary-card balance"><div className="cl-summary-label"><span className="cl-summary-icon net"><Wallet size={18}/></span><span>ยอดสะสม ณ {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${to}T12:00:00+07:00`))}</span></div><strong className={closingBalance < 0 ? 'negative' : ''}>{currency(closingBalance)}</strong><small>สะสมตั้งแต่รายการแรกถึงวันที่เลือก</small></article>
      </section>

      <section className="cl-panel">
        <div className="cl-toolbar">
          <div className="cl-tabs" role="group" aria-label="กรองประเภทรายการ">
            {([['ALL', 'ทั้งหมด'], ['INCOME', 'รายรับ'], ['EXPENSE', 'รายจ่าย']] as const).map(([value, label]) => <button key={value} className={typeFilter === value ? 'active' : ''} type="button" onClick={() => { setTypeFilter(value); setPage(1); }}>{label}</button>)}
          </div>
          <label className="cl-search"><Search size={17}/><span className="sr-only">ค้นหารายการ</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ค้นหารายการ หมวดหมู่ หรือผู้เกี่ยวข้อง" /></label>
          <div className="cl-date-range"><CalendarDays size={17}/><label><span className="sr-only">ตั้งแต่วันที่</span><input type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><span>ถึง</span><label><span className="sr-only">ถึงวันที่</span><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label></div>
        </div>
        <div className="cl-table-wrap"><table className="cl-table"><thead><tr><th>วันที่</th><th>รายการ</th><th>หมวดหมู่</th><th>ผู้เกี่ยวข้อง</th><th>ช่องทาง</th><th className="align-right">จำนวนเงิน</th></tr></thead>
          <tbody>{pagedEntries.map((entry) => <tr key={entry.id}>
            <td className="cl-date">{dateLabel(entry.transactionDate)}</td>
            <td><div className="cl-entry-title"><span className={`cl-entry-icon ${entry.type.toLowerCase()}`}>{entry.type === 'INCOME' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</span><span><strong>{entry.title}</strong><small>{entry.source === 'LOAN' ? 'จากรายการสินเชื่อ' : entry.reference ? `เลขอ้างอิง ${entry.reference}` : 'บันทึกเอง'}</small></span></div></td>
            <td><span className="cl-category">{entry.category}</span></td><td>{entry.party || <span className="cl-muted">—</span>}</td>
            <td className="cl-muted">{entry.method === 'BANK_TRANSFER' ? 'โอนเงิน' : entry.method === 'CARD' ? 'บัตร' : entry.method === 'OTHER' ? 'อื่นๆ' : 'เงินสด'}</td>
            <td className={`align-right cl-amount ${entry.type === 'INCOME' ? 'positive' : 'negative'}`}>{entry.type === 'INCOME' ? '+' : '−'}{currency(entry.amount)}</td>
          </tr>)}
          {!loading && visibleEntries.length === 0 && <tr><td colSpan={6}><div className="cl-empty"><span><FileText size={23}/></span><strong>{query || typeFilter !== 'ALL' ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการในช่วงนี้'}</strong><p>{query || typeFilter !== 'ALL' ? 'ลองเปลี่ยนคำค้นหรือเลือกประเภทรายการอื่น' : 'เริ่มบันทึกรายรับหรือรายจ่ายเพื่อดูสรุปบัญชีของบริษัท'}</p>{!query && typeFilter === 'ALL' && <button className="cl-button primary" type="button" onClick={() => { setDraft(freshDraft()); setFormOpen(true); }}><Plus size={16}/> เพิ่มรายการแรก</button>}</div></td></tr>}
          {loading && <tr><td colSpan={6}><div className="cl-loading"><span className="cl-spinner"/> กำลังโหลดรายการ…</div></td></tr>}
          </tbody></table></div>
        <footer className="cl-table-footer">
          <span>แสดง {visibleEntries.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, visibleEntries.length)} จาก {visibleEntries.length} รายการ · หน้าละ {PAGE_SIZE} รายการ</span>
          <nav className="cl-pagination" aria-label="เปลี่ยนหน้ารายการ">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1 || loading}><ChevronLeft size={15}/> ก่อนหน้า</button>
            <span aria-live="polite">หน้า {currentPage} / {pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount || loading}>ถัดไป <ChevronRight size={15}/></button>
          </nav>
        </footer>
      </section>
      <p className="cl-footnote"><FileText size={14}/> รายการรับชำระและจ่ายเงินกู้ดึงจากระบบสินเชื่ออัตโนมัติ ไม่ต้องบันทึกซ้ำ · จำนวนเงินจัดเก็บทศนิยม 2 ตำแหน่ง</p>
    </div>

    {formOpen && <div className="cl-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
      <section className="cl-drawer" role="dialog" aria-modal="true" aria-labelledby="cl-form-title">
        <header className="cl-drawer-head"><div><span className="cl-eyebrow">บันทึกธุรกรรม</span><h2 id="cl-form-title">เพิ่มรายการรับ–จ่าย</h2></div><button type="button" className="cl-close" aria-label="ปิดหน้าต่าง" onClick={() => setFormOpen(false)} disabled={saving}><X size={19}/></button></header>
        <form className="cl-form" onSubmit={saveEntry}>
          <div className="cl-drawer-body">
            <fieldset className="cl-type-toggle"><legend>ประเภทรายการ</legend><label className={draft.type === 'INCOME' ? 'selected income' : ''}><input type="radio" name="type" value="INCOME" checked={draft.type === 'INCOME'} onChange={() => setDraft({ ...draft, type: 'INCOME', categoryId: '' })}/><ArrowDownLeft size={17}/> รายรับ</label><label className={draft.type === 'EXPENSE' ? 'selected expense' : ''}><input type="radio" name="type" value="EXPENSE" checked={draft.type === 'EXPENSE'} onChange={() => setDraft({ ...draft, type: 'EXPENSE', categoryId: '' })}/><ArrowUpRight size={17}/> รายจ่าย</label></fieldset>
            <div className="cl-form-grid"><label className="cl-field full"><span>ชื่อรายการ <b>*</b></span><input autoFocus maxLength={120} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={draft.type === 'INCOME' ? 'เช่น รับชำระค่าบริการ' : 'เช่น ค่าอุปกรณ์สำนักงาน'} /></label>
              <label className="cl-field"><span className="cl-field-heading">หมวดหมู่ <b>*</b><Link href="/admin/company-finance-categories" target="_blank">จัดการหมวดหมู่</Link></span><select required disabled={categoriesLoading || categories.length === 0} value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">{categoriesLoading ? 'กำลังโหลด…' : categories.length ? 'เลือกหมวดหมู่' : 'ยังไม่มีหมวดหมู่ที่เปิดใช้'}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="cl-field"><span>วันที่ <b>*</b></span><input required type="date" max={today()} value={draft.transactionDate} onChange={(event) => setDraft({ ...draft, transactionDate: event.target.value })} /></label>
              <label className="cl-field"><span>จำนวนเงิน (บาท) <b>*</b></span><div className="cl-money-input"><span>฿</span><input required inputMode="decimal" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0.00" /></div></label>
              <label className="cl-field"><span>ช่องทาง</span><select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value })}><option value="CASH">เงินสด</option><option value="BANK_TRANSFER">โอนเงิน</option><option value="CARD">บัตร</option><option value="OTHER">อื่นๆ</option></select></label>
              <label className="cl-field"><span>ผู้เกี่ยวข้อง</span><input maxLength={120} value={draft.party} onChange={(event) => setDraft({ ...draft, party: event.target.value })} placeholder="ชื่อลูกค้า / ร้านค้า / คู่ค้า" /></label>
              <label className="cl-field"><span>เลขอ้างอิง</span><input maxLength={100} value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="เลขที่ใบเสร็จหรือเอกสาร" /></label>
              <label className="cl-field full"><span>หมายเหตุ</span><textarea rows={3} maxLength={1000} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>
            </div>
          </div>
          <footer className="cl-drawer-foot"><button className="cl-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>ยกเลิก</button><button className="cl-button primary" type="submit" disabled={saving || !amountSatang || !draft.categoryId}>{saving ? 'กำลังบันทึก…' : <><Check size={17}/> บันทึกรายการ</>}</button></footer>
        </form>
      </section>
    </div>}
  </main>;
}
