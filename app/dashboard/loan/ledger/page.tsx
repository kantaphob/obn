'use client';

import LoanActionButton from "@/components/loan/LoanActionButton";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, FileText, Paperclip, Plus, Search, Upload, Wallet, X } from 'lucide-react';
import { summarizeCompanyLedgerRows } from '@/lib/company-ledger-summary';
import { matchesBusinessSystem } from '@/lib/company-system';
import './ledger.css';

type LedgerType = 'INCOME' | 'EXPENSE';
type LedgerEntry = {
  id: string;
  type: LedgerType;
  title: string;
  category: string;
  financeCategoryId: string | null;
  amount: number;
  baseAmount: number | null;
  vatRateBps: number | null;
  vatAmount: number | null;
  whtRateBps: number | null;
  whtAmount: number | null;
  transactionDate: string;
  timeRecorded: boolean;
  documentNumber: string | null;
  companyCode: string | null;
  branchCode: string | null;
  party: string;
  method: string;
  reference: string;
  note: string;
  attachmentUrl: string | null;
  source: 'MANUAL' | 'LOAN';
};
type Draft = { type: LedgerType; title: string; categoryId: string; amount: string; vatEnabled: boolean; vatRate: string; whtEnabled: boolean; whtRate: string; transactionDate: string; transactionTime: string; party: string; method: string; reference: string; note: string };
type FinanceCategory = { id: string; code: string; direction: LedgerType; name: string; isActive: boolean };
type LedgerCompany = { companycode: string; nameTH: string | null; nameEN: string | null; status: string };
type LedgerBranch = { companycode: string; branchcode: string; nameTH: string | null; nameEN: string | null; status: string };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const currentTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const bangkokDate = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const PAGE_SIZE = 25;
const currency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const timeValue = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const timeLabel = (entry: LedgerEntry) => !entry.timeRecorded
  ? 'ไม่ระบุเวลา'
  : new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(entry.transactionDate));
const isSystemLoanEntry = (entry: LedgerEntry) => entry.id.startsWith('loan-') || entry.id.startsWith('repayment-');
const freshDraft = (type: LedgerType = 'EXPENSE'): Draft => ({ type, title: '', categoryId: '', amount: '', vatEnabled: false, vatRate: '7', whtEnabled: false, whtRate: '3', transactionDate: today(), transactionTime: currentTime(), party: '', method: 'CASH', reference: '', note: '' });

export default function Ledger() {
  const router = useRouter();
  const requestedEditId = useRef<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [closingBalance, setClosingBalance] = useState(0);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [companies, setCompanies] = useState<LedgerCompany[]>([]);
  const [branches, setBranches] = useState<LedgerBranch[]>([]);
  const [companyCode, setCompanyCode] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [numberingOptionsLoading, setNumberingOptionsLoading] = useState(true);
  // Start with the full ledger so historical opening balance/imports are included.
  // Users can narrow the transaction period with the date controls at any time.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LedgerType>('ALL');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft>(freshDraft());
  const [formOpen, setFormOpen] = useState(false);
  const [entryTypeChosen, setEntryTypeChosen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Load the full ledger through the selected end date so the closing cash balance
      // carries forward capital and earlier transactions outside the visible date range.
      const params = new URLSearchParams({ to, source: 'LOAN' });
      const response = await fetch(`/api/company-ledger?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดบัญชีไม่สำเร็จ');
      const editId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('edit');
      const throughDate = data.filter((entry: LedgerEntry) => editId || !from || bangkokDate(entry.transactionDate) >= from);
      setEntries(throughDate);
      setClosingBalance(summarizeCompanyLedgerRows(data).net);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดบัญชีไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const openEditEntry = useCallback((entry: LedgerEntry) => {
    const matchingCategory = financeCategories.find(category => category.id === entry.financeCategoryId)
      ?? financeCategories.find(category => category.direction === entry.type && category.name === entry.category);
    setEditingEntry(entry);
    setAttachmentFile(null);
    setDraft({
      type: entry.type,
      title: entry.title,
      categoryId: matchingCategory?.id ?? '',
      amount: ((entry.baseAmount ?? entry.amount) / 100).toFixed(2),
      vatEnabled: entry.vatRateBps !== null,
      vatRate: entry.vatRateBps === null ? '7' : (entry.vatRateBps / 100).toFixed(2).replace(/\.00$/, ''),
      whtEnabled: entry.whtRateBps !== null,
      whtRate: entry.whtRateBps === null ? '3' : (entry.whtRateBps / 100).toFixed(2).replace(/\.00$/, ''),
      transactionDate: bangkokDate(entry.transactionDate),
      transactionTime: entry.timeRecorded ? timeValue(entry.transactionDate) : '',
      party: entry.party,
      method: entry.method,
      reference: entry.reference,
      note: entry.note,
    });
    setError('');
    setFormOpen(true);
  }, [financeCategories]);
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId || loading || categoriesLoading || requestedEditId.current === editId) return;
    requestedEditId.current = editId;
    const entry = entries.find((candidate) => candidate.id === editId && !isSystemLoanEntry(candidate));
    if (!entry) {
      router.replace('/dashboard/loan/ledger', { scroll: false });
      return;
    }
    startTransition(() => openEditEntry(entry));
    router.replace('/dashboard/loan/ledger', { scroll: false });
  }, [categoriesLoading, entries, loading, openEditEntry, router]);
  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch('/api/company-finance-categories', { cache: 'no-store' });
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

  const loadNumberingCompanies = useCallback(async () => {
    setNumberingOptionsLoading(true);
    try {
      const response = await fetch('/api/company-sequences?system=LOAN', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดสำนักงานใหญ่ไม่สำเร็จ');
      const activeCompanies = (data as LedgerCompany[]).filter(company => company.status === 'ACTIVE');
      setCompanies(activeCompanies);
      setCompanyCode(current => activeCompanies.some(company => company.companycode === current)
        ? current
        : activeCompanies.find(company => /obn/i.test(`${company.nameEN ?? ''} ${company.nameTH ?? ''}`))?.companycode ?? activeCompanies[0]?.companycode ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดสำนักงานใหญ่ไม่สำเร็จ');
    } finally {
      setNumberingOptionsLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNumberingCompanies(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNumberingCompanies]);

  const loadNumberingBranches = useCallback(async () => {
    if (!companyCode) { setBranches([]); setBranchCode(''); return; }
    setNumberingOptionsLoading(true);
    try {
      const response = await fetch(`/api/branch-sequences?companycode=${encodeURIComponent(companyCode)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดสาขาไม่สำเร็จ');
      const activeBranches = (data as LedgerBranch[]).filter(branch => branch.status === 'ACTIVE');
      const systemBranches = activeBranches.filter(branch => matchesBusinessSystem('LOAN', branch.nameTH, branch.nameEN));
      const company = companies.find(item => item.companycode === companyCode);
      const allowedBranches = systemBranches.length ? systemBranches : company && matchesBusinessSystem('LOAN', company.nameTH, company.nameEN) ? activeBranches : [];
      setBranches(allowedBranches);
      setBranchCode(current => allowedBranches.some(branch => branch.branchcode === current)
        ? current
        : systemBranches[0]?.branchcode ?? (company && matchesBusinessSystem('LOAN', company.nameTH, company.nameEN) ? companyCode : ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดสาขาไม่สำเร็จ');
      setBranches([]);
      setBranchCode('');
    } finally {
      setNumberingOptionsLoading(false);
    }
  }, [companies, companyCode]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNumberingBranches(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNumberingBranches]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th-TH');
    return entries.filter((entry) => (typeFilter === 'ALL' || entry.type === typeFilter)
      && (!needle || `${entry.title} ${entry.category} ${entry.party} ${entry.reference} ${entry.note} ${entry.documentNumber ?? ''} ${entry.companyCode ?? ''} ${entry.branchCode ?? ''}`.toLocaleLowerCase('th-TH').includes(needle)));
  }, [entries, query, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = useMemo(() => visibleEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visibleEntries, currentPage]);
  const totals = useMemo(() => summarizeCompanyLedgerRows(entries), [entries]);
  const sourceLabel = 'สินเชื่อ/เงินทุน';
  const categories = financeCategories.filter((category) => (category.code.startsWith('LOAN_') || category.code.startsWith('LEGACY_')) && category.direction === draft.type && (category.isActive || category.id === draft.categoryId));
  const amountSatang = /^\d+(\.\d{1,2})?$/.test(draft.amount) ? Math.round(Number(draft.amount) * 100) : 0;
  const vatRateBps = draft.vatEnabled && /^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(draft.vatRate) && Number(draft.vatRate) > 0 && Number(draft.vatRate) <= 100 ? Math.round(Number(draft.vatRate) * 100) : null;
  const whtRateBps = draft.type === 'EXPENSE' && draft.whtEnabled && /^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(draft.whtRate) && Number(draft.whtRate) > 0 && Number(draft.whtRate) <= 100 ? Math.round(Number(draft.whtRate) * 100) : null;
  const vatAmountSatang = vatRateBps === null ? 0 : Math.round(amountSatang * vatRateBps / 10000);
  const whtAmountSatang = whtRateBps === null ? 0 : Math.round(amountSatang * whtRateBps / 10000);
  const transactionSatang = amountSatang + vatAmountSatang - whtAmountSatang;
  const validTaxRates = (!draft.vatEnabled || vatRateBps !== null) && (!draft.whtEnabled || draft.type !== 'EXPENSE' || whtRateBps !== null);
  const fixedDocumentYear = editingEntry?.documentNumber
    ? Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date(editingEntry.transactionDate)))
    : null;
  const transactionDateMin = fixedDocumentYear ? `${fixedDocumentYear}-01-01` : undefined;
  const transactionDateMax = fixedDocumentYear && fixedDocumentYear < Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date()))
    ? `${fixedDocumentYear}-12-31`
    : today();

  function openNewEntry() {
    setEditingEntry(null);
    setAttachmentFile(null);
    setDraft(freshDraft());
    setEntryTypeChosen(false);
    setCompanyCode('');
    setBranchCode('');
    setFormOpen(true);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !amountSatang || !validTaxRates || transactionSatang <= 0) return;
    if (attachmentFile && (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(attachmentFile.type) || attachmentFile.size < 1 || attachmentFile.size > 10 * 1024 * 1024)) {
      setError('สลิปต้องเป็น JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 10 MB');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editingEntry ? `/api/company-ledger/${encodeURIComponent(editingEntry.id)}` : '/api/company-ledger', {
        method: editingEntry ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, amount: amountSatang, vatRateBps, whtRateBps, ...(!editingEntry ? { companyCode, branchCode } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (editingEntry ? 'แก้ไขรายการไม่สำเร็จ' : 'บันทึกรายการไม่สำเร็จ'));
      let attachmentWarning = '';
      if (attachmentFile) {
        const formData = new FormData();
        formData.set('file', attachmentFile);
        try {
          const uploadResponse = await fetch(`/api/company-ledger/${encodeURIComponent(data.id)}/attachment`, { method: 'POST', body: formData });
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(uploadData.error || 'แนบสลิปไม่สำเร็จ');
        } catch (cause) {
          attachmentWarning = cause instanceof Error ? `บันทึกรายการแล้ว แต่แนบสลิปไม่สำเร็จ: ${cause.message}` : 'บันทึกรายการแล้ว แต่แนบสลิปไม่สำเร็จ';
        }
      }
      setDraft(freshDraft());
      setAttachmentFile(null);
      setEditingEntry(null);
      setFormOpen(false);
      setNotice(attachmentWarning || (editingEntry ? `แก้ไขรายการ ${data.documentNumber ?? editingEntry.title} เรียบร้อยแล้ว` : data.documentNumber ? `บันทึกรายการ ${data.documentNumber} เรียบร้อยแล้ว` : 'บันทึกรายการเรียบร้อยแล้ว'));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (editingEntry ? 'แก้ไขรายการไม่สำเร็จ' : 'บันทึกรายการไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const link = document.createElement('a');
    link.href = `/api/company-ledger/export?${new URLSearchParams({ from, to, source: 'LOAN' })}`;
    link.download = 'company-ledger.csv';
    document.body.append(link);
    link.click();
    link.remove();
  }

  return <main className="company-ledger-page">
    <div className="company-ledger-wrap">
      <div className="cl-breadcrumb"><span>จัดการบริษัท</span><span aria-hidden="true">/</span><strong>บัญชีรับ–จ่าย</strong></div>
      <header className="cl-header">
        <div><div className="cl-eyebrow"><CircleDollarSign size={15}/> LOAN FINANCE</div><h1>บัญชีรับ–จ่าย Loan</h1><p>แสดงรายการสินเชื่อและหมวดเงินทุนของ Loan เท่านั้น</p></div>
        <div className="cl-header-actions"><button className="cl-button" type="button" onClick={exportCsv}><ArrowDownToLine size={17}/> ส่งออก CSV</button><button className="cl-button primary" type="button" onClick={openNewEntry}><Plus size={18}/> เพิ่มรายการ</button></div>
      </header>

      {error && <div className="cl-alert error" role="alert"><X size={17}/>{error}<button type="button" aria-label="ปิด" onClick={() => setError('')}><X size={16}/></button></div>}
      {notice && <div className="cl-alert success" role="status"><Check size={17}/>{notice}<button type="button" aria-label="ปิด" onClick={() => setNotice('')}><X size={16}/></button></div>}

      <section className="cl-summary" aria-label="สรุปบัญชี">
        <article className="cl-summary-card"><div className="cl-summary-label"><span className="cl-summary-icon income"><ArrowDownLeft size={18}/></span><span>รายรับ{sourceLabel}ในช่วงที่เลือก</span></div><strong className="positive">{currency(totals.income)}</strong><small>{entries.filter((entry) => entry.type === 'INCOME').length} รายการ · ไม่รวมตัวกรองรายการ</small></article>
        <article className="cl-summary-card"><div className="cl-summary-label"><span className="cl-summary-icon expense"><ArrowUpRight size={18}/></span><span>รายจ่าย{sourceLabel}ในช่วงที่เลือก</span></div><strong className="negative">{currency(totals.expense)}</strong><small>{entries.filter((entry) => entry.type === 'EXPENSE').length} รายการ · ไม่รวมตัวกรองรายการ</small></article>
        <article className="cl-summary-card period-net"><div className="cl-summary-label"><span className="cl-summary-icon net"><CircleDollarSign size={18}/></span><span>สุทธิ{sourceLabel}ในช่วงที่เลือก</span></div><strong className={totals.net < 0 ? 'negative' : 'positive'}>{currency(totals.net)}</strong><small>รายรับลบรายจ่ายตามช่วงวันที่เลือก</small></article>
        <article className="cl-summary-card balance"><div className="cl-summary-label"><span className="cl-summary-icon net"><Wallet size={18}/></span><span>ยอดสะสม{sourceLabel} ณ {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${to}T12:00:00+07:00`))}</span></div><strong className={closingBalance < 0 ? 'negative' : ''}>{currency(closingBalance)}</strong><small>สะสมจากรายการ Loan ตั้งแต่รายการแรกถึงวันที่เลือก</small></article>
      </section>

      <section className="cl-panel">
        <div className="cl-toolbar">
          <div className="cl-tabs" role="group" aria-label="กรองประเภทรายการ">
            {([['ALL', 'ทั้งหมด'], ['INCOME', 'รายรับ'], ['EXPENSE', 'รายจ่าย']] as const).map(([value, label]) => <button key={value} className={typeFilter === value ? 'active' : ''} type="button" onClick={() => { setTypeFilter(value); setPage(1); }}>{label}</button>)}
          </div>
          <label className="cl-search"><Search size={17}/><span className="sr-only">ค้นหารายการ</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ค้นหารายการ หมวดหมู่ หรือผู้เกี่ยวข้อง" /></label>
          <div className="cl-date-range"><CalendarDays size={17}/><label><span className="sr-only">ตั้งแต่วันที่</span><input type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><span>{from ? 'ถึง' : 'ตั้งแต่รายการแรก · ถึง'}</span><label><span className="sr-only">ถึงวันที่</span><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label></div>
        </div>
        <div className="cl-table-wrap"><table className="cl-table"><thead><tr><th>วันที่</th><th>รายการ</th><th>หมวดหมู่</th><th>ผู้เกี่ยวข้อง</th><th>ช่องทาง</th><th className="align-right">จำนวนเงิน</th><th>จัดการ</th></tr></thead>
          <tbody>{pagedEntries.map((entry) => <tr key={entry.id}>
            <td className="cl-date"><span>{dateLabel(entry.transactionDate)}</span><small>{timeLabel(entry)}</small></td>
            <td><div className="cl-entry-title"><span className={`cl-entry-icon ${entry.type.toLowerCase()}`}>{entry.type === 'INCOME' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</span><span><strong>{entry.title}</strong><small>{isSystemLoanEntry(entry) ? 'จากรายการสินเชื่อ' : entry.reference ? `รายการ Loan · เลขอ้างอิง ${entry.reference}` : 'รายการ Loan · บันทึกเอง'}</small>{entry.documentNumber && <><small className="cl-document-number">เลขที่ใบรับ/จ่าย {entry.documentNumber}</small><small className="cl-document-number">สำนักงานใหญ่ {entry.companyCode} · {entry.branchCode === entry.companyCode ? 'ทำรายการที่สำนักงานใหญ่' : `สาขา ${entry.branchCode}`}</small></>}{entry.attachmentUrl && <small className="cl-document-number"><a href={entry.attachmentUrl} target="_blank" rel="noreferrer"><Paperclip size={12}/> ดูสลิป/หลักฐาน</a></small>}</span></div></td>
            <td><span className="cl-category">{entry.category}</span></td><td>{entry.party || <span className="cl-muted">—</span>}</td>
            <td className="cl-muted">{entry.method === 'BANK_TRANSFER' ? 'โอนเงิน' : entry.method === 'CARD' ? 'บัตร' : entry.method === 'OTHER' ? 'อื่นๆ' : 'เงินสด'}</td>
            <td className={`align-right cl-amount ${entry.type === 'INCOME' ? 'positive' : 'negative'}`}><span>{entry.type === 'INCOME' ? '+' : '−'}{currency(entry.amount)}</span>{!isSystemLoanEntry(entry) && (entry.vatRateBps !== null || entry.whtRateBps !== null) && <small className="cl-tax-breakdown">ฐาน {currency(entry.baseAmount ?? entry.amount)}{entry.vatRateBps !== null ? ` · VAT ${currency(entry.vatAmount ?? 0)}` : ''}{entry.whtRateBps !== null ? ` · WHT −${currency(entry.whtAmount ?? 0)}` : ''}</small>}</td>
            <td>{!isSystemLoanEntry(entry) ? <div className="cl-row-actions"><LoanActionButton action="edit" className="edit" aria-label={`แก้ไข ${entry.title}`} onClick={() => openEditEntry(entry)}>แก้ไข</LoanActionButton><Link className="cl-button" href="/dashboard/loan/accounting">กลับรายการ</Link></div> : <span className="cl-muted">ระบบ</span>}</td>
          </tr>)}
            {!loading && visibleEntries.length === 0 && <tr><td colSpan={7}><div className="cl-empty"><span><FileText size={23}/></span><strong>{query || typeFilter !== 'ALL' ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการ Loan ในช่วงวันที่เลือก'}</strong><p>{query || typeFilter !== 'ALL' ? 'ลองเปลี่ยนคำค้นหรือเลือกประเภทรายการอื่น' : 'รายการจากระบบสินเชื่อและหมวดเงินทุน Loan จะแสดงที่นี่'}</p>{!query && typeFilter === 'ALL' && <button className="cl-button primary" type="button" onClick={openNewEntry}><Plus size={16}/> เพิ่มรายการ Loan</button>}</div></td></tr>}
          {loading && <tr><td colSpan={7}><div className="cl-loading"><span className="cl-spinner"/> กำลังโหลดรายการ…</div></td></tr>}
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

    {formOpen && <div className="cl-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setFormOpen(false); setEditingEntry(null); } }}>
      <section className="cl-drawer" role="dialog" aria-modal="true" aria-labelledby="cl-form-title">
        <header className="cl-drawer-head"><div><span className="cl-eyebrow">{editingEntry ? 'แก้ไขใบรับ/จ่าย' : 'บันทึกธุรกรรม'}</span><h2 id="cl-form-title">{editingEntry ? 'แก้ไขรายการรับ–จ่าย' : 'เพิ่มรายการรับ–จ่าย'}</h2></div><button type="button" className="cl-close" aria-label="ปิดหน้าต่าง" onClick={() => { setFormOpen(false); setEditingEntry(null); }} disabled={saving}><X size={19}/></button></header>
        <form className="cl-form" onSubmit={saveEntry}>
          <div className="cl-drawer-body">
            <section className="cl-step-panel">
              {!editingEntry && <>
                <div className="cl-step-intro"><h3>เลือกรับหรือจ่าย</h3><p>เลือกรายการให้ตรงกับเงินที่เข้าหรือออกจากบริษัท</p></div>
                <fieldset className="cl-type-toggle"><legend className="sr-only">ประเภทรายการ</legend>
                <label className={(editingEntry || entryTypeChosen) && draft.type === 'INCOME' ? 'selected income' : ''}><input type="radio" name="type" value="INCOME" checked={(editingEntry || entryTypeChosen) && draft.type === 'INCOME'} onChange={() => { setEntryTypeChosen(true); setDraft({ ...draft, type: 'INCOME', categoryId: '', whtEnabled: false }); }}/><ArrowDownLeft size={18}/> รับเงิน</label>
                <label className={(editingEntry || entryTypeChosen) && draft.type === 'EXPENSE' ? 'selected expense' : ''}><input type="radio" name="type" value="EXPENSE" checked={(editingEntry || entryTypeChosen) && draft.type === 'EXPENSE'} onChange={() => { setEntryTypeChosen(true); setDraft({ ...draft, type: 'EXPENSE', categoryId: '' }); }}/><ArrowUpRight size={18}/> จ่ายเงิน</label>
              </fieldset>
              </>}
            </section>

            {!editingEntry && entryTypeChosen && <section className="cl-step-panel cl-reveal-section">
              <div className="cl-step-intro"><h3>เลือกบริษัทสำนักงานใหญ่</h3><p>รายการนี้จะถูกบันทึกในบัญชีของบริษัทที่เลือก</p></div>
              <div className="cl-company-options" role="group" aria-label="เลือกบริษัทสำนักงานใหญ่">
                {companies.map(company => <button key={company.companycode} type="button" className={`cl-company-option ${companyCode === company.companycode ? 'selected' : ''}`} onClick={() => { if (companyCode !== company.companycode) { setCompanyCode(company.companycode); setBranchCode(''); } }} aria-pressed={companyCode === company.companycode}>
                  <span className="cl-company-option-mark">{company.nameTH?.slice(0, 1) || company.nameEN?.slice(0, 1) || 'บ'}</span><span><strong>{company.nameTH || company.nameEN || company.companycode}</strong><small>สำนักงานใหญ่ · {company.companycode}</small></span><i aria-hidden="true">{companyCode === company.companycode ? <Check size={16}/> : null}</i>
                </button>)}
                {!numberingOptionsLoading && companies.length === 0 && <p className="cl-step-error">ไม่พบบริษัทที่เปิดใช้งาน กรุณาตรวจสอบทะเบียนบริษัท</p>}
              </div>
            </section>}

            {!editingEntry && entryTypeChosen && companyCode && <section className="cl-reveal-section">
              <label className="cl-field cl-branch-select"><span>สถานที่ทำรายการ <b>*</b></span><select required disabled={numberingOptionsLoading} value={branchCode} onChange={(event) => setBranchCode(event.target.value)}><option value="">{numberingOptionsLoading ? 'กำลังโหลดสถานที่…' : 'เลือกสถานที่ทำรายการ'}</option>{!branches.some(branch => matchesBusinessSystem('LOAN', branch.nameTH, branch.nameEN)) && <option value={companyCode}>สำนักงานใหญ่ · {companyCode}</option>}{branches.map(branch => <option key={branch.branchcode} value={branch.branchcode}>{branch.nameTH || branch.nameEN || branch.branchcode} · {branch.branchcode}</option>)}</select></label>
              {companyCode && !numberingOptionsLoading && branches.length === 0 && <p className="cl-step-error">บริษัทนี้ยังไม่มีสาขาที่เปิดใช้งาน แต่สามารถเลือกทำรายการที่สำนักงานใหญ่ได้</p>}
            </section>}

            {(editingEntry || (entryTypeChosen && companyCode && branchCode)) && <section className="cl-reveal-section">
              <div className="cl-step-intro"><span>{editingEntry ? 'แก้ไขรายการ' : 'รายละเอียดรายการ'}</span><h3>{editingEntry ? 'รายละเอียดรายการ' : `${draft.type === 'INCOME' ? 'รับเงิน' : 'จ่ายเงิน'} · ${companies.find(company => company.companycode === companyCode)?.nameTH || companies.find(company => company.companycode === companyCode)?.nameEN || companyCode} · ${branchCode === companyCode ? 'สำนักงานใหญ่' : `สาขา ${branchCode}`}`}</h3><p>{editingEntry ? 'ปรับข้อมูลแล้วบันทึกการเปลี่ยนแปลง' : 'กรอกรายละเอียดธุรกรรม ยอดภาษีจะคำนวณให้อัตโนมัติ'}</p></div>
              {editingEntry && <fieldset className="cl-type-toggle"><legend>ประเภทรายการ</legend><label className={draft.type === 'INCOME' ? 'selected income' : ''}><input type="radio" name="edit-type" value="INCOME" checked={draft.type === 'INCOME'} onChange={() => setDraft({ ...draft, type: 'INCOME', categoryId: '', whtEnabled: false })}/><ArrowDownLeft size={17}/> รายรับ</label><label className={draft.type === 'EXPENSE' ? 'selected expense' : ''}><input type="radio" name="edit-type" value="EXPENSE" checked={draft.type === 'EXPENSE'} onChange={() => setDraft({ ...draft, type: 'EXPENSE', categoryId: '' })}/><ArrowUpRight size={17}/> รายจ่าย</label></fieldset>}
              <div className="cl-form-grid">
                {editingEntry && <div className="cl-field full cl-edit-number"><span>เลขที่ใบรับ/จ่าย</span><strong>{editingEntry.documentNumber || 'รายการเดิมยังไม่มีเลขที่อัตโนมัติ'}</strong>{editingEntry.documentNumber && <small>สำนักงานใหญ่ {editingEntry.companyCode} · {editingEntry.branchCode === editingEntry.companyCode ? 'ทำรายการที่สำนักงานใหญ่' : `สาขา ${editingEntry.branchCode}`} · เลขที่นี้จะคงเดิม</small>}</div>}
                <label className="cl-field"><span className="cl-field-heading">หมวดหมู่ <b>*</b><Link href="/admin/company-finance-categories" target="_blank">จัดการหมวดหมู่</Link></span><select autoFocus={!editingEntry} required disabled={categoriesLoading || categories.length === 0} value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">{categoriesLoading ? 'กำลังโหลด…' : categories.length ? 'เลือกหมวดหมู่' : 'ยังไม่มีหมวดหมู่ที่เปิดใช้'}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="cl-field"><span>ชื่อรายการ <b>*</b></span><input maxLength={120} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={draft.type === 'INCOME' ? 'เช่น รับชำระค่าบริการ' : 'เช่น ค่าอุปกรณ์สำนักงาน'} /></label>
                <label className="cl-field full"><span>จำนวนเงินก่อน VAT/WHT (บาท) <b>*</b></span><div className="cl-money-input"><span>฿</span><input required inputMode="decimal" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0.00" /></div></label>
                <div className="cl-field full"><span>ภาษีที่เกี่ยวข้อง</span><div className="cl-tax-options">
                  <div className={`cl-tax-card ${draft.vatEnabled ? 'active' : ''}`}><label className="cl-tax-toggle"><input type="checkbox" checked={draft.vatEnabled} onChange={(event) => setDraft({ ...draft, vatEnabled: event.target.checked })}/><span><strong>คิด VAT</strong><small>บวกภาษีเพิ่มจากยอดฐาน</small></span></label>{draft.vatEnabled && <label className="cl-tax-rate"><span>อัตรา VAT</span><span className="cl-percent-input"><input aria-label="อัตรา VAT เปอร์เซ็นต์" required inputMode="decimal" pattern="(?:[0-9]{1,2}|100)(?:\.[0-9]{1,2})?" value={draft.vatRate} onChange={(event) => setDraft({ ...draft, vatRate: event.target.value })}/><span>%</span></span></label>}</div>
                  {draft.type === 'EXPENSE' && <div className={`cl-tax-card ${draft.whtEnabled ? 'active' : ''}`}><label className="cl-tax-toggle"><input type="checkbox" checked={draft.whtEnabled} onChange={(event) => setDraft({ ...draft, whtEnabled: event.target.checked })}/><span><strong>หักภาษี ณ ที่จ่าย (WHT)</strong><small>หักจากยอดที่จ่ายจริง</small></span></label>{draft.whtEnabled && <label className="cl-tax-rate"><span>อัตรา WHT</span><span className="cl-percent-input"><input aria-label="อัตรา WHT เปอร์เซ็นต์" required inputMode="decimal" pattern="(?:[0-9]{1,2}|100)(?:\.[0-9]{1,2})?" value={draft.whtRate} onChange={(event) => setDraft({ ...draft, whtRate: event.target.value })}/><span>%</span></span></label>}</div>}
                </div></div>
                <div className="cl-tax-summary" aria-live="polite"><span>ยอดฐาน {currency(amountSatang)}</span>{draft.vatEnabled && <span>+ VAT {vatRateBps === null ? '—' : `${(vatRateBps / 100).toFixed(2)}%`} {currency(vatAmountSatang)}</span>}{draft.type === 'EXPENSE' && draft.whtEnabled && <span>− WHT {whtRateBps === null ? '—' : `${(whtRateBps / 100).toFixed(2)}%`} {currency(whtAmountSatang)}</span>}<strong>ยอด{draft.type === 'INCOME' ? 'รับ' : 'จ่าย'}สุทธิ {currency(transactionSatang)}</strong></div>
                <label className="cl-field"><span>วันที่ <b>*</b></span><input required type="date" min={editingEntry?.documentNumber ? transactionDateMin : undefined} max={transactionDateMax} value={draft.transactionDate} onChange={(event) => setDraft({ ...draft, transactionDate: event.target.value })} /></label>
                <label className="cl-field"><span>เวลา <b>*</b></span><input required type="time" step="60" max={draft.transactionDate === today() ? currentTime() : undefined} value={draft.transactionTime} onChange={(event) => setDraft({ ...draft, transactionTime: event.target.value })} /></label>
                <label className="cl-field"><span>ช่องทาง</span><select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value })}><option value="CASH">เงินสด</option><option value="BANK_TRANSFER">โอนเงิน</option><option value="CARD">บัตร</option><option value="OTHER">อื่นๆ</option></select></label>
                <label className="cl-field"><span>ผู้เกี่ยวข้อง</span><input maxLength={120} value={draft.party} onChange={(event) => setDraft({ ...draft, party: event.target.value })} placeholder="ชื่อลูกค้า / ร้านค้า / คู่ค้า" /></label>
                <label className="cl-field full"><span>เลขอ้างอิง</span><input maxLength={100} value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="เลขที่ใบเสร็จหรือเอกสาร" /></label>
                <div className="cl-field full"><span>สลิปเงิน / หลักฐานการรับ–จ่าย</span>
                  {editingEntry?.attachmentUrl && <a className="cl-attachment-link" href={editingEntry.attachmentUrl} target="_blank" rel="noreferrer"><Paperclip size={15}/> เปิดดูสลิปที่แนบไว้</a>}
                  <label className="cl-attachment-picker"><Upload size={17}/><span>{attachmentFile ? attachmentFile.name : editingEntry?.attachmentUrl ? 'เลือกไฟล์ใหม่เพื่อแทนที่สลิปเดิม' : 'เลือกไฟล์สลิปหรือหลักฐาน'}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} /></label>
                  <small className="cl-attachment-help">รองรับ JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 10 MB</small>
                </div>
                <label className="cl-field full"><span>หมายเหตุ</span><textarea rows={3} maxLength={1000} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>
              </div>
            </section>}
          </div>
          <footer className="cl-drawer-foot">
            <button className="cl-button" type="button" onClick={() => { setFormOpen(false); setEditingEntry(null); }} disabled={saving}>ยกเลิก</button>
            <button className="cl-button primary" type="submit" disabled={saving || !amountSatang || !validTaxRates || transactionSatang <= 0 || !draft.categoryId || !draft.title.trim() || !draft.transactionTime || (!editingEntry && (!entryTypeChosen || !companyCode || !branchCode || numberingOptionsLoading))}>{saving ? 'กำลังบันทึก…' : <><Check size={17}/>{editingEntry ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}</>}</button>
          </footer>
        </form>
      </section>
    </div>}

  </main>;
}
