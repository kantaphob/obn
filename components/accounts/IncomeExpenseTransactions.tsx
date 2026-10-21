'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, Check, CircleAlert, FileText, Plus, RefreshCw, Search, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import type { BusinessSystem } from '@/lib/company-system';
import { calculateCompanyLedgerTax } from '@/lib/company-ledger-tax';

type LedgerType = 'INCOME' | 'EXPENSE';
export type IncomeExpenseTransactionsProps = { type?: LedgerType; system?: BusinessSystem; allowTypeSwitch?: boolean; backHref?: string; pageTitle?: string; pageDescription?: string };
type SettlementStatus = "PAID" | "PENDING_APPROVAL" | "APPROVED" | "PENDING_RECEIPT" | "PENDING_PAYMENT";
type Entry = { id: string; type: LedgerType; title: string; category: string; amount: number; baseAmount: number | null; vatRateBps: number | null; vatAmount: number | null; whtRateBps: number | null; whtAmount: number | null; transactionDate: string; documentNumber: string | null; companyCode: string | null; branchCode: string | null; party: string; method: string; reference: string; note: string; settlementStatus: SettlementStatus; approvalRequired: boolean };
type Company = { companycode: string; nameTH: string | null; nameEN: string | null; status: string };
type Branch = { companycode: string; branchcode: string; nameTH: string | null; nameEN: string | null; status: string };
type Category = { id: string; name: string; direction: LedgerType; isActive: boolean; code: string };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const timeNow = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

async function readApiResponse(response: Response): Promise<Record<string, unknown> & { error?: string }> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(response.ok ? 'เซิร์ฟเวอร์ไม่ได้ส่งข้อมูลกลับมา กรุณาลองใหม่' : `เซิร์ฟเวอร์ตอบกลับข้อผิดพลาด (HTTP ${response.status})`);
  }
  try {
    return JSON.parse(body) as Record<string, unknown> & { error?: string };
  } catch {
    throw new Error(response.ok ? 'รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาลองใหม่' : `เซิร์ฟเวอร์ตอบกลับข้อผิดพลาด (HTTP ${response.status})`);
  }
}

export default function IncomeExpenseTransactions({ type: initialType = "INCOME", system, allowTypeSwitch = true, backHref, pageTitle, pageDescription }: IncomeExpenseTransactionsProps) {
  const [type, setType] = useState<LedgerType>(initialType);
  const isReceipt = type === 'INCOME';
  const title = isReceipt ? 'รายการรับเงิน' : 'รายการจ่ายเงิน';
  const supportsApproval = system === 'NETFLIX' || system === 'YOUTUBE';
  const scopeLabel = system ? ({ LOAN: 'Loan', CONSTRUCTION: 'Construction', BUILDIN: 'Build-In', AGRICULTURE: 'Agriculture', YOUTUBE: 'YouTube', NETFLIX: 'Netflix' } satisfies Record<BusinessSystem, string>)[system] : 'บัญชีกลาง';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [systemBranchCompanyCodes, setSystemBranchCompanyCodes] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companyCode, setCompanyCode] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState('7');
  const [whtEnabled, setWhtEnabled] = useState(false);
  const [whtRate, setWhtRate] = useState('3');
  const [query, setQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [settlement, setSettlement] = useState<"PAID" | "PAYABLE" | "RECEIVABLE">(system === "NETFLIX" && initialType === "INCOME" ? "RECEIVABLE" : "PAID");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (system === 'NETFLIX' && type === 'EXPENSE') {
        const scheduleResponse = await fetch('/api/netflix/subscription-charges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const scheduleData = await readApiResponse(scheduleResponse);
        if (!scheduleResponse.ok) throw new Error(scheduleData.error || 'เตรียมรายการค่าสมาชิก Netflix ไม่สำเร็จ');
      }
      const response = await fetch(`/api/accounts/transactions?type=${type}${system ? `&system=${system}` : ''}`, { cache: 'no-store' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'โหลดรายการไม่สำเร็จ');
      setEntries(data.entries as Entry[]);
      const activeCompanies = (data.companies as Company[]).filter((company) => company.status === 'ACTIVE');
      setCompanies(activeCompanies);
      const defaultCompanyCode = activeCompanies.some((company) => company.companycode === companyCode) ? companyCode : activeCompanies[0]?.companycode ?? '';
      const activeBranches = (data.branches as Branch[]).filter((branch) => branch.status === 'ACTIVE');
      const scopedBranchCompanyCodes = (data.systemBranchCompanyCodes as string[] | undefined) ?? [];
      setCompanyCode(defaultCompanyCode);
      setBranches(activeBranches);
      setSystemBranchCompanyCodes(scopedBranchCompanyCodes);
      setBranchCode((current) => current === defaultCompanyCode || activeBranches.some((branch) => branch.companycode === defaultCompanyCode && branch.branchcode === current)
        ? current
        : scopedBranchCompanyCodes.includes(defaultCompanyCode)
          ? activeBranches.find((branch) => branch.companycode === defaultCompanyCode)?.branchcode ?? ''
          : defaultCompanyCode);
      setCategories(data.categories as Category[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [companyCode, system, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th-TH');
    return entries.filter((entry) => (filterCompany === 'ALL' || entry.companyCode === filterCompany)
      && (!needle || `${entry.title} ${entry.category} ${entry.party} ${entry.reference} ${entry.companyCode}`.toLocaleLowerCase('th-TH').includes(needle)));
  }, [entries, filterCompany, query]);
  const total = visibleEntries.filter((entry) => entry.settlementStatus === "PAID").reduce((sum, entry) => sum + entry.amount, 0);
  const outstandingTotal = visibleEntries.filter((entry) => entry.settlementStatus !== "PAID").reduce((sum, entry) => sum + entry.amount, 0);
  const amountSatang = /^\d+(\.\d{1,2})?$/.test(amountInput) ? Math.round(Number(amountInput) * 100) : 0;
  const parseRate = (value: string) => /^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 100
    ? Math.round(Number(value) * 100)
    : null;
  const vatRateBps = vatEnabled ? parseRate(vatRate) : null;
  const whtRateBps = type === 'EXPENSE' && whtEnabled ? parseRate(whtRate) : null;
  const validTaxRates = (!vatEnabled || vatRateBps !== null) && (!(type === 'EXPENSE' && whtEnabled) || whtRateBps !== null);
  const tax = amountSatang > 0 && validTaxRates ? calculateCompanyLedgerTax(type, amountSatang, vatRateBps, whtRateBps) : null;

  async function save(formData: FormData) {
    if (saving || !tax || !validTaxRates) return;
    setSaving(true); setError(''); setNotice('');
    const payload = {
      type,
      title: String(formData.get('title') ?? '').trim(),
      categoryId,
      companyCode,
      branchCode,
      transactionDate: String(formData.get('date') ?? ''),
      transactionTime: String(formData.get('time') ?? ''),
      amount: amountSatang,
      vatRateBps,
      whtRateBps,
      party: String(formData.get('party') ?? ''),
      method: String(formData.get('method') ?? 'CASH'),
      reference: String(formData.get('reference') ?? ''),
      note: String(formData.get('note') ?? ''),
      settlement: supportsApproval ? settlement : 'PAID',
      approvalRequired: supportsApproval && approvalRequired,
      confirmed: supportsApproval && confirmed,
    };
    try {
      const response = await fetch(`/api/accounts/transactions?type=${type}${system ? `&system=${system}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'บันทึกรายการไม่สำเร็จ');
      setFormOpen(false); setNotice(`บันทึกรายการ ${data.documentNumber ?? ''} เรียบร้อยแล้ว`); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกรายการไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  async function transition(entry: Entry, action: 'approve' | 'pay' | 'receive') {
    if (!system) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/accounts/transactions/${entry.id}?system=${system}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'เปลี่ยนสถานะรายการไม่สำเร็จ');
      setNotice(action === 'approve' ? 'อนุมัติรายการแล้ว · รอบันทึกการจ่ายเงินจริง' : action === 'receive' ? 'ยืนยันรับเงินจริงแล้ว' : 'บันทึกจ่ายเงินจริงแล้ว');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'เปลี่ยนสถานะรายการไม่สำเร็จ'); }
  }

  const companyName = (code: string | null) => {
    const company = companies.find((item) => item.companycode === code);
    return company?.nameTH || company?.nameEN || code || (system === 'YOUTUBE' ? 'YouTube' : system === 'NETFLIX' ? 'Netflix' : 'ไม่ระบุบริษัท');
  };
  const hasSystemBranchScope = systemBranchCompanyCodes.includes(companyCode);
  const selectCompany = (nextCompanyCode: string) => {
    setCompanyCode(nextCompanyCode);
    setBranchCode(systemBranchCompanyCodes.includes(nextCompanyCode)
      ? branches.find((branch) => branch.companycode === nextCompanyCode)?.branchcode ?? ''
      : nextCompanyCode);
  };

  return <main className="mx-auto max-w-[1440px] px-4 py-6 text-[#26352d] sm:px-6 lg:px-8">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#89968e]">{scopeLabel} / {isReceipt ? 'รับเงิน' : 'จ่ายเงิน'}</div>
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>{backHref && <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#708077] hover:text-[#365d43]"><ArrowLeft size={14} />กลับสมุดบัญชี YouTube</Link>}<h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{pageTitle ?? (system ? `บัญชีรับ–จ่าย ${scopeLabel}` : `${title}บริษัท`)}</h1><p className="mt-1.5 text-sm text-[#78857d]">{pageDescription ?? (system ? `แสดงและบันทึกรายการของบริษัทในระบบ ${scopeLabel} เท่านั้น` : `บันทึก${isReceipt ? 'เงินรับ' : 'เงินจ่าย'}ของบริษัทที่เลือกในบัญชีกลาง`)}</p></div>
      <button type="button" disabled={companies.length === 0} onClick={() => { setError(''); setCategoryId(''); setConfirmed(false); setSettlement(system === 'NETFLIX' && isReceipt ? 'RECEIVABLE' : 'PAID'); setApprovalRequired(true); setAmountInput(''); setVatEnabled(false); setVatRate('7'); setWhtEnabled(false); setWhtRate('3'); setFormOpen(true); }} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${isReceipt ? 'bg-[#56886b] hover:bg-[#44765a]' : 'bg-[#b87563] hover:bg-[#a36352]'}`}>
        <Plus size={16} aria-hidden="true" />{system === 'NETFLIX' && isReceipt ? 'สร้างรายการเรียกเก็บ' : isReceipt ? 'บันทึกรับเงิน' : 'บันทึกจ่ายเงิน'}
      </button>
    </header>

    {system && !loading && companies.length === 0 && <div role="status" className="mb-4 rounded-lg border border-[#eee4cc] bg-[#fffaf0] px-4 py-3 text-xs text-[#806c43]">ยังไม่มีบริษัทที่ใช้งานอยู่ซึ่งผูกกับระบบ {scopeLabel} กรุณาตรวจสอบข้อมูลบริษัทก่อนบันทึกรายการ</div>}

    {allowTypeSwitch && <div className="mb-4 inline-flex rounded-lg border border-[#e5eae6] bg-white p-1"><button type="button" onClick={() => { setType('INCOME'); setSettlement('PAID'); setConfirmed(false); }} className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-medium ${isReceipt ? 'bg-[#edf5ef] text-[#4f8561]' : 'text-[#78857d]'}`}><ArrowDownLeft size={15} />รับเงิน</button><button type="button" onClick={() => { setType('EXPENSE'); setSettlement('PAID'); setConfirmed(false); }} className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-medium ${!isReceipt ? 'bg-[#fbf0ed] text-[#b56f5f]' : 'text-[#78857d]'}`}><ArrowUpRight size={15} />จ่ายเงิน</button></div>}

    {error && !formOpen && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#f1d7d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a65345]"><span className="flex items-center gap-2"><CircleAlert size={16} />{error}</span><button type="button" aria-label="ลองอีกครั้ง" onClick={() => void load()}><RefreshCw size={15} /></button></div>}
    {notice && <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-[#dcebe0] bg-[#f3f8f4] px-4 py-3 text-xs text-[#4e7959]"><Check size={16} />{notice}<button type="button" className="ml-auto" aria-label="ปิด" onClick={() => setNotice('')}><X size={15} /></button></div>}

    {formOpen && <div className={'cf-overlay'} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
      <section className={'cf-drawer'} role="dialog" aria-modal="true" aria-labelledby="central-finance-form-title">
        <header className={'cf-drawerHeader'}><div><span className={'cf-eyebrow'}>บันทึกธุรกรรม</span><h2 id="central-finance-form-title">เพิ่มรายการรับ–จ่าย</h2></div><button type="button" className={'cf-close'} aria-label="ปิดหน้าต่าง" onClick={() => setFormOpen(false)} disabled={saving}><X size={19} /></button></header>
        <form id="central-finance-form" className={'cf-form'} onSubmit={(event) => { event.preventDefault(); void save(new FormData(event.currentTarget)); }}>
          <div className={'cf-drawerBody'}>
            {error && <div role="alert" className={'cf-formError'}><CircleAlert size={16} />{error}</div>}
            <section className={'cf-stepPanel'}>
              <div className={'cf-stepIntro'}><h3>เลือกรับหรือจ่าย</h3><p>เลือกรายการให้ตรงกับเงินที่เข้าหรือออกจากบริษัท</p></div>
              <div className={'cf-typeToggle'} role="group" aria-label="ประเภทรายการ">
                <button type="button" aria-pressed={isReceipt} onClick={() => { setType('INCOME'); setCategoryId(''); setSettlement(system === 'NETFLIX' ? 'RECEIVABLE' : 'PAID'); setConfirmed(false); setWhtEnabled(false); }} className={isReceipt ? 'cf-selectedIncome' : ''}><ArrowDownLeft size={17} />รับเงิน</button>
                <button type="button" aria-pressed={!isReceipt} onClick={() => { setType('EXPENSE'); setCategoryId(''); setSettlement('PAID'); setConfirmed(false); }} className={!isReceipt ? 'cf-selectedExpense' : ''}><ArrowUpRight size={17} />จ่ายเงิน</button>
              </div>
            </section>
            <section className={'cf-revealSection'}>
              <div className={'cf-stepIntro'}><h3>เลือกบริษัทสำนักงานใหญ่</h3><p>รายการนี้จะถูกบันทึกในบัญชีของบริษัทที่เลือก</p></div>
              <div className={'cf-companyOptions'} role="group" aria-label="เลือกบริษัทสำนักงานใหญ่">
                {companies.map((company) => <button key={company.companycode} type="button" aria-pressed={companyCode === company.companycode} onClick={() => selectCompany(company.companycode)} className={`${'cf-companyOption'} ${companyCode === company.companycode ? 'cf-selectedCompany' : ''}`}>
                  <span className={'cf-companyMark'}>{company.nameTH?.slice(0, 1) || company.nameEN?.slice(0, 1) || 'บ'}</span><span className={'cf-companyText'}><strong>{company.nameTH || company.nameEN || company.companycode}</strong><small>สำนักงานใหญ่ · {company.companycode}</small></span><i>{companyCode === company.companycode && <Check size={16} />}</i>
                </button>)}
                {!companies.length && <p className={'cf-stepError'}>ไม่พบบริษัทที่เปิดใช้งาน</p>}
              </div>
            </section>
            {companyCode && <section className={'cf-revealSection'}>
              <label className={'cf-field'}><span>สถานที่ทำรายการ <b>*</b></span><select required value={branchCode} onChange={(event) => setBranchCode(event.target.value)}><option value="">เลือกสถานที่ทำรายการ</option>{!hasSystemBranchScope && <option value={companyCode}>สำนักงานใหญ่ · {companyCode}</option>}{branches.filter((branch) => branch.companycode === companyCode && (!hasSystemBranchScope || branch.branchcode !== companyCode)).map((branch) => <option key={branch.branchcode} value={branch.branchcode}>{branch.nameTH || branch.nameEN || branch.branchcode} · {branch.branchcode}</option>)}</select></label>
            </section>}
            {companyCode && branchCode && <section className={'cf-revealSection'}>
              <div className={'cf-stepIntro'}><span>รายละเอียดรายการ</span><h3>{isReceipt ? 'รับเงิน' : 'จ่ายเงิน'} · {companies.find((company) => company.companycode === companyCode)?.nameTH || companies.find((company) => company.companycode === companyCode)?.nameEN || companyCode} · {branchCode === companyCode ? 'สำนักงานใหญ่' : `สาขา ${branchCode}`}</h3><p>กรอกรายละเอียดธุรกรรม ยอดภาษีจะคำนวณให้อัตโนมัติ</p></div>
              {system === 'NETFLIX' && isReceipt && <div className={'cf-fieldFull'}><span className={'cf-fieldLegend'}>สถานะการเก็บเงิน</span><div className={'cf-typeToggle'}><button type="button" onClick={() => { setSettlement('RECEIVABLE'); setConfirmed(false); }} className={settlement === 'RECEIVABLE' ? 'cf-selectedIncome' : ''}>สร้างรายการเรียกเก็บ</button><button type="button" onClick={() => { setSettlement('PAID'); setConfirmed(false); }} className={settlement === 'PAID' ? 'cf-selectedIncome' : ''}>รับเงินจริงแล้ว</button></div></div>}
              {supportsApproval && !isReceipt && <div className={'cf-fieldFull'}><span className={'cf-fieldLegend'}>สถานะการจ่าย</span><div className={'cf-typeToggle'}><button type="button" onClick={() => { setSettlement('PAID'); setConfirmed(false); }} className={settlement === 'PAID' ? 'cf-selectedExpense' : ''}>จ่ายแล้ว</button><button type="button" onClick={() => { setSettlement('PAYABLE'); setConfirmed(false); }} className={settlement === 'PAYABLE' ? 'cf-selectedExpense' : ''}>สร้างหนี้รอจ่าย</button></div></div>}
              <div className={'cf-formGrid'}>
                <label className={'cf-field'}><span>หมวดหมู่ <b>*</b> · <Link href="/admin/company-finance-categories" target="_blank" className="font-normal text-[#42684f] underline underline-offset-2">จัดการหมวดหมู่</Link></span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{categories.length ? 'เลือกหมวดหมู่' : 'ยังไม่มีหมวดหมู่ที่เปิดใช้'}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className={'cf-field'}><span>ชื่อรายการ <b>*</b></span><input required name="title" maxLength={120} placeholder={isReceipt ? 'เช่น รับชำระค่าบริการ' : 'เช่น ค่าอุปกรณ์สำนักงาน'} /></label>
                <label className={`${'cf-field'} ${'cf-fieldFull'}`}><span>จำนวนเงินก่อน VAT/WHT (บาท) <b>*</b></span><div className={'cf-moneyInput'}><span>฿</span><input required name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amountInput} onChange={(event) => setAmountInput(event.target.value)} placeholder="0.00" /></div></label>
                <div className={`${'cf-field'} ${'cf-fieldFull'}`}><span>ภาษีที่เกี่ยวข้อง</span><div className={'cf-taxOptions'}>
                  <div className={`${'cf-taxCard'} ${vatEnabled ? 'cf-taxCardActive' : ''}`}><label className={'cf-taxToggle'}><input type="checkbox" checked={vatEnabled} onChange={(event) => setVatEnabled(event.target.checked)} /><span><strong>คิด VAT</strong><small>บวกภาษีเพิ่มจากยอดฐาน</small></span></label>{vatEnabled && <label className={'cf-taxRate'}><span>อัตรา VAT</span><span className={'cf-percentInput'}><input aria-label="อัตรา VAT เปอร์เซ็นต์" inputMode="decimal" value={vatRate} onChange={(event) => setVatRate(event.target.value)} /><span>%</span></span></label>}</div>
                  {!isReceipt && <div className={`${'cf-taxCard'} ${whtEnabled ? 'cf-taxCardActive' : ''}`}><label className={'cf-taxToggle'}><input type="checkbox" checked={whtEnabled} onChange={(event) => setWhtEnabled(event.target.checked)} /><span><strong>หักภาษี ณ ที่จ่าย (WHT)</strong><small>หักจากยอดที่จ่ายจริง</small></span></label>{whtEnabled && <label className={'cf-taxRate'}><span>อัตรา WHT</span><span className={'cf-percentInput'}><input aria-label="อัตรา WHT เปอร์เซ็นต์" inputMode="decimal" value={whtRate} onChange={(event) => setWhtRate(event.target.value)} /><span>%</span></span></label>}</div>}
                </div></div>
                <div className={'cf-taxSummary'}><span>ยอดฐาน {money(amountSatang)}</span>{vatEnabled && <span>+ VAT {vatRateBps === null ? '—' : `${(vatRateBps / 100).toFixed(2)}%`} {money(tax?.vatAmount ?? 0)}</span>}{!isReceipt && whtEnabled && <span>− WHT {whtRateBps === null ? '—' : `${(whtRateBps / 100).toFixed(2)}%`} {money(tax?.whtAmount ?? 0)}</span>}<strong>ยอด{isReceipt ? 'รับ' : 'จ่าย'}สุทธิ {money(tax?.amount ?? 0)}</strong></div>
                <label className={'cf-field'}><span>{supportsApproval && settlement !== 'PAID' ? (settlement === 'RECEIVABLE' ? 'กำหนดรับเงิน' : 'กำหนดจ่าย') : 'วันที่'} <b>*</b></span><input required name="date" type="date" max={settlement !== 'PAID' && supportsApproval ? undefined : today()} defaultValue={today()} /></label>
                <label className={'cf-field'}><span>เวลา <b>*</b></span><input required name="time" type="time" defaultValue={timeNow()} /></label>
                <label className={'cf-field'}><span>ช่องทาง</span><select name="method" defaultValue="CASH"><option value="CASH">เงินสด</option><option value="BANK_TRANSFER">โอนเงิน</option><option value="CARD">บัตร</option><option value="OTHER">อื่น ๆ</option></select></label>
                <label className={'cf-field'}><span>ผู้เกี่ยวข้อง</span><input name="party" maxLength={120} placeholder="ชื่อลูกค้า / ร้านค้า / คู่ค้า" /></label>
                <label className={`${'cf-field'} ${'cf-fieldFull'}`}><span>เลขที่อ้างอิง</span><input name="reference" maxLength={100} placeholder="เลขที่ใบเสร็จหรือเอกสาร" /></label>
                <label className={`${'cf-field'} ${'cf-fieldFull'}`}><span>หมายเหตุ</span><textarea name="note" rows={3} maxLength={1000} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>
                {supportsApproval && !isReceipt && settlement === 'PAYABLE' && <label className={`${'cf-checkField'} ${'cf-fieldFull'}`}><input type="checkbox" checked={approvalRequired} onChange={(event) => setApprovalRequired(event.target.checked)} />ต้องอนุมัติก่อนจ่าย</label>}
                {supportsApproval && settlement === 'PAID' && <label className={`${'cf-checkField'} ${'cf-fieldFull'}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />ยืนยันว่า{isReceipt ? 'ได้รับเงินแล้ว' : 'จ่ายเงินแล้ว'}</label>}
              </div>
              {categories.length === 0 && <p className={'cf-stepError'}>ยังไม่มีหมวดหมู่{isReceipt ? 'รับ' : 'จ่าย'}ที่เปิดใช้งาน กรุณาเพิ่มหมวดหมู่บัญชีกลางก่อน</p>}
            </section>}
          </div>
          <footer className={'cf-drawerFooter'}><button type="button" onClick={() => setFormOpen(false)} disabled={saving}>ยกเลิก</button><button type="submit" disabled={saving || !companyCode || !branchCode || !categoryId || !tax || !validTaxRates || (supportsApproval && settlement === 'PAID' && !confirmed)}>{saving ? 'กำลังบันทึก…' : supportsApproval && settlement === 'PAYABLE' ? 'สร้างรายการเจ้าหนี้' : system === 'NETFLIX' && settlement === 'RECEIVABLE' ? 'สร้างรายการเรียกเก็บ' : <><Check size={16} />บันทึกรายการ</>}</button></footer>
        </form>
      </section>
    </div>}

    <section className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae6] bg-white px-3 text-xs text-[#89948d]"><Search size={15} /><span className="sr-only">ค้นหา</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารายการ บริษัท หรือเลขอ้างอิง" className="min-w-0 flex-1 bg-transparent text-xs text-[#46544a] outline-none" /></label>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae6] bg-white px-3 text-[11px] text-[#78857d]">บริษัท<select aria-label="กรองตามบริษัท" value={filterCompany} onChange={(event) => setFilterCompany(event.target.value)} className="max-w-[190px] bg-transparent text-xs font-medium text-[#46554b] outline-none"><option value="ALL">ทุกบริษัทที่มีสิทธิ์</option>{companies.map((company) => <option key={company.companycode} value={company.companycode}>{company.nameTH || company.nameEN || company.companycode}</option>)}</select></label>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae6] bg-white px-3 text-[11px] text-[#78857d]"><CalendarDays size={15} /><span>รายการ</span><strong className="text-[#46554b]">{visibleEntries.length}</strong></div>
    </section>
    <section className="overflow-hidden rounded-xl border border-[#e7ece8] bg-white shadow-[0_1px_2px_#22382a08]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1ee] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#354239]">ประวัติ{title}</h2><p className="mt-1 text-[10px] text-[#98a29b]">แสดงเฉพาะรายการ{isReceipt ? 'รับ' : 'จ่าย'}ของ {scopeLabel} ที่คุณมีสิทธิ์เข้าถึง</p></div><div className="flex flex-wrap items-center justify-end gap-4 text-right"><div><small className="block text-[10px] text-[#98a29b]">รวมที่รับ/จ่ายแล้ว</small><strong className={`mt-0.5 block text-sm ${isReceipt ? 'text-[#4f8561]' : 'text-[#b56f5f]'}`}>{money(total)}</strong></div>{supportsApproval && <div><small className="block text-[10px] text-[#98a29b]">{isReceipt ? 'ลูกหนี้ค้างรับ' : 'เจ้าหนี้ค้างจ่าย'}</small><strong className={`mt-0.5 block text-sm ${isReceipt ? 'text-[#99651b]' : 'text-[#b56f5f]'}`}>{money(outstandingTotal)}</strong></div>}</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="h-10 bg-[#fafbfa] text-[10px] text-[#8d9891]"><th className="px-5">วันที่ / กำหนด</th><th>รายการ</th><th>บริษัท</th><th>หมวดหมู่</th>{supportsApproval && <th>สถานะ</th>}<th className="text-right">จำนวนเงิน</th><th className="px-5">เลขที่</th>{supportsApproval && (!isReceipt || system === 'NETFLIX') && <th className="px-5">ดำเนินการ</th>}</tr></thead><tbody className="divide-y divide-[#f0f2f0]">
        {visibleEntries.map((entry) => <tr key={entry.id} className="h-[60px] text-xs hover:bg-[#fcfdfc]"><td className="whitespace-nowrap px-5 text-[#758179]">{dateLabel(entry.transactionDate)}</td><td><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-md ${isReceipt ? 'bg-[#edf5ef] text-[#5b8968]' : 'bg-[#fbf0ed] text-[#b97564]'}`}>{isReceipt ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><span className="max-w-[260px]"><strong className="block truncate font-medium text-[#3c4a40]">{entry.title}</strong><small className="mt-1 block truncate text-[10px] text-[#98a29b]">{entry.party || entry.reference || '—'}</small></span></div></td><td className="text-[#68766d]">{companyName(entry.companyCode)}{entry.branchCode ? ` · ${entry.branchCode === entry.companyCode ? 'สำนักงานใหญ่' : entry.branchCode}` : ''}</td><td className="text-[#7f8b83]">{entry.category}</td>{supportsApproval && <td><span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[10px] ${entry.settlementStatus === 'PAID' ? 'bg-[#edf5ef] text-[#4f8561]' : entry.settlementStatus === 'PENDING_APPROVAL' ? 'bg-[#fff7e8] text-[#946000]' : entry.settlementStatus === 'PENDING_RECEIPT' || entry.settlementStatus === 'PENDING_PAYMENT' ? 'bg-[#fff4e7] text-[#99651b]' : 'bg-[#edf2ff] text-[#425a9b]'}`}>{entry.settlementStatus === 'PAID' ? (isReceipt ? 'รับแล้ว' : 'จ่ายแล้ว') : entry.settlementStatus === 'PENDING_APPROVAL' ? 'รออนุมัติ' : entry.settlementStatus === 'PENDING_RECEIPT' ? 'รอรับเงินจริง' : entry.settlementStatus === 'PENDING_PAYMENT' ? 'รอตัดบัตร / ยืนยันจ่าย' : 'อนุมัติแล้ว · รอจ่าย'}</span></td>}<td className={`whitespace-nowrap text-right font-semibold tabular-nums ${isReceipt ? 'text-[#4f8561]' : 'text-[#b56f5f]'}`}><span>{isReceipt ? '+' : '−'}{money(entry.amount)}</span>{(entry.vatRateBps !== null || entry.whtRateBps !== null) && <small className="mt-1 block text-[9px] font-normal text-[#929d96]">ฐาน {money(entry.baseAmount ?? entry.amount)}{entry.vatAmount !== null ? ` · VAT ${money(entry.vatAmount)}` : ''}{entry.whtAmount !== null ? ` · WHT −${money(entry.whtAmount)}` : ''}</small>}</td><td className="whitespace-nowrap px-5 text-[10px] text-[#929d96]">{entry.documentNumber || '—'}</td>{supportsApproval && (!isReceipt || system === 'NETFLIX') && <td className="px-5">{entry.settlementStatus === 'PENDING_APPROVAL' ? <button type="button" onClick={() => void transition(entry, 'approve')} className="whitespace-nowrap rounded-lg bg-[#365d43] px-3 py-2 text-[10px] font-semibold text-white">อนุมัติ</button> : entry.settlementStatus === 'APPROVED' || entry.settlementStatus === 'PENDING_PAYMENT' ? <button type="button" onClick={() => void transition(entry, 'pay')} className="whitespace-nowrap rounded-lg bg-[#b87563] px-3 py-2 text-[10px] font-semibold text-white">ยืนยันจ่ายเงินจริง</button> : entry.settlementStatus === 'PENDING_RECEIPT' ? <button type="button" onClick={() => void transition(entry, 'receive')} className="whitespace-nowrap rounded-lg bg-[#56886b] px-3 py-2 text-[10px] font-semibold text-white">ยืนยันรับเงินจริง</button> : <span className="text-[10px] text-[#98a29b]">—</span>}</td>}</tr>)}
        {!loading && visibleEntries.length === 0 && <tr><td colSpan={supportsApproval ? (isReceipt ? (system === 'NETFLIX' ? 8 : 7) : 8) : 6} className="px-5 py-12 text-center"><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-[#f1f5f2] text-[#72917b]"><FileText size={18} /></span><strong className="block text-xs font-semibold text-[#536158]">{query ? 'ไม่พบรายการที่ค้นหา' : `ยังไม่มี${title}ใน ${scopeLabel}`}</strong><p className="mt-1 text-[11px] text-[#929d96]">{query ? 'ลองเปลี่ยนคำค้นหา' : isReceipt ? 'สร้างรายการเรียกเก็บก่อน แล้วกดยืนยันเมื่อได้รับเงินจริง' : 'รายการค่าสมาชิกรายเดือนจะสร้างจากกลุ่ม Netflix ที่กำหนดราคาและวันตัดชำระไว้'}</p></td></tr>}
        {loading && <tr><td colSpan={supportsApproval ? (isReceipt ? (system === 'NETFLIX' ? 8 : 7) : 8) : 6} className="px-5 py-10 text-center text-xs text-[#8d9891]">กำลังโหลดรายการ…</td></tr>}
      </tbody></table></div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1ee] bg-[#fafbfa] px-5 py-3 text-[10px] text-[#929d96]"><span className="inline-flex items-center gap-1.5">{isReceipt ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{title} · {scopeLabel}</span><span className="inline-flex items-center gap-1.5"><Wallet size={13} />{visibleEntries.length} รายการ</span></footer>
    </section>
  </main>;
}
