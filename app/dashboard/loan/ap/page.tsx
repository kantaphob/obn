'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, Check, ChevronDown, RefreshCw, Search, Upload, X } from 'lucide-react';
import '../lending-ui.css';
import './ap.css';

type ReservedContract = {
  id: string;
  debtorId: string;
  contractNumber: string;
  status: string;
  principal: number;
  interestAmount: number;
  interestRate: number;
  interestRateBasis: string;
  interestMode: string;
  repayType: string;
  installmentMonths: number | null;
  periodDays: number | null;
  netDisbursed: number;
  startDate: string;
  dueDate: string | null;
  updatedAt: string;
  createdAt: string;
  disbursement?: { id: string; amount: number; paidAt: string; method: string; reference: string | null } | null;
  schedules: {
    id: string;
    periodNo: number;
    dueDate: string;
    amount: number;
    principalAmount: number;
    interestAmount: number;
    status: string;
  }[];
  debtor?: {
    borrowersCode: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
  };
};

type OutstandingContract = {
  id: string;
  debtorId: string;
  contractNumber: string;
  status: string;
  balance: { total: number };
};

const baht = (satang: number) => new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', maximumFractionDigits: 2,
}).format(satang / 100);

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value))
  : '—';

function borrowerName(row: ReservedContract) {
  const borrower = row.debtor;
  if (!borrower) return 'ไม่พบข้อมูลผู้กู้';
  return [borrower.firstName, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname || 'ไม่ระบุชื่อ';
}

function repaymentPlan(row: ReservedContract) {
  if (row.repayType === 'INSTALLMENT') return `ผ่อนชำระ ${row.installmentMonths ?? '—'} เดือน`;
  if (row.repayType === 'INTEREST_ONLY') return `จ่ายดอกเบี้ย${row.periodDays ? ` ทุก ${row.periodDays} วัน` : 'ตามรอบ'} แล้วคืนเงินต้น`;
  return 'ชำระครั้งเดียวตามกำหนด';
}

function interestHandling(row: ReservedContract) {
  return row.interestMode === 'UPFRONT' ? 'หักดอกเบี้ยก่อนจ่าย' : 'ไม่หักดอกเบี้ยล่วงหน้า';
}

export default function AP() {
  const [contracts, setContracts] = useState<ReservedContract[]>([]);
  const [outstandingContracts, setOutstandingContracts] = useState<OutstandingContract[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedContract, setSelectedContract] = useState<ReservedContract | null>(null);
  const [cancellingContract, setCancellingContract] = useState<ReservedContract | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()));
  const [paymentTime, setPaymentTime] = useState(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const [reference, setReference] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [acknowledgedOldContract, setAcknowledgedOldContract] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const [interestModeDraft, setInterestModeDraft] = useState<'UPFRONT' | 'ON_SCHEDULE'>('ON_SCHEDULE');
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [termsMessage, setTermsMessage] = useState('');

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [response, balanceResponse] = await Promise.all([
        fetch('/api/contracts/list', { cache: 'no-store' }),
        fetch('/api/repayments', { cache: 'no-store' }),
      ]);
      const [data, balanceData] = await Promise.all([response.json(), balanceResponse.json()]);
      if (!response.ok) throw new Error(data.error || 'โหลดรายการจองไม่สำเร็จ');
      if (!balanceResponse.ok) throw new Error(balanceData.error || 'ตรวจสอบสัญญาเดิมไม่สำเร็จ');
      setContracts(Array.isArray(data) ? data.filter((row: ReservedContract) => ['RESERVED', 'READY'].includes(row.status) && !row.disbursement) : []);
      setOutstandingContracts(Array.isArray(balanceData) ? balanceData.filter((row: OutstandingContract) => ['ACTIVE', 'OVERDUE'].includes(row.status) && row.balance?.total > 0) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการจองไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadContracts(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadContracts]);

  const visibleContracts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('th-TH');
    if (!term) return contracts;
    return contracts.filter(row =>
      `${row.contractNumber} ${row.debtor?.borrowersCode || ''} ${borrowerName(row)}`
        .toLocaleLowerCase('th-TH')
        .includes(term),
    );
  }, [contracts, query]);

  const totalPrincipal = visibleContracts.reduce((sum, row) => sum + row.principal, 0);
  const payableCount = visibleContracts.filter(row => row.status === 'READY').length;
  const previousOutstanding = selectedContract ? outstandingContracts.filter(row =>
    row.debtorId === selectedContract.debtorId
      && row.id !== selectedContract.id,
  ) : [];

  function openContract(row: ReservedContract) {
    setSelectedContract(row);
    setInterestModeDraft(row.interestMode === 'UPFRONT' ? 'UPFRONT' : 'ON_SCHEDULE');
    setEditingTerms(false);
    setSavingTerms(false);
    setTermsError('');
    setTermsMessage('');
    setPaymentDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()));
    setPaymentMethod('BANK_TRANSFER');
    setReference('');
    setEvidenceFile(null);
    setAcknowledgedOldContract(false);
    setError('');
    setMessage('');
  }

  async function saveContractTerms() {
    if (!selectedContract || savingTerms) return;
    setSavingTerms(true);
    setTermsError('');
    setTermsMessage('');
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(selectedContract.id)}/terms`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestMode: interestModeDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกเงื่อนไขสัญญาไม่สำเร็จ');
      const updated = data as ReservedContract;
      setContracts(current => current.map(row => row.id === updated.id ? updated : row));
      setSelectedContract(updated);
      setInterestModeDraft(updated.interestMode === 'UPFRONT' ? 'UPFRONT' : 'ON_SCHEDULE');
      setEditingTerms(false);
      setTermsMessage('บันทึกเงื่อนไขใหม่ลงในสัญญาแล้ว และปรับยอดจ่ายสุทธิกับกำหนดชำระแล้ว');
    } catch (cause) {
      setTermsError(cause instanceof Error ? cause.message : 'บันทึกเงื่อนไขสัญญาไม่สำเร็จ');
    } finally {
      setSavingTerms(false);
    }
  }

  async function submitPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedContract || selectedContract.status !== 'READY' || paying) return;
    if (previousOutstanding.length > 0 && !acknowledgedOldContract) {
      setError('กรุณาตรวจสอบและรับทราบสัญญาเดิมที่ยังมียอดค้างก่อน');
      return;
    }
    if (!reference.trim() && !evidenceFile) {
      setError('กรุณาระบุเลขอ้างอิงหรือแนบสลิปอย่างน้อยหนึ่งอย่าง');
      return;
    }
    setPaying(true);
    setError('');
    const form = new FormData();
    form.set('paidAt', `${paymentDate}T${paymentTime}`);
    form.set('method', paymentMethod);
    form.set('reference', reference.trim());
    if (evidenceFile) form.set('file', evidenceFile);
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(selectedContract.id)}/disburse`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกการจ่ายไม่สำเร็จ');
      setSelectedContract(null);
      setMessage(`บันทึกการจ่ายสัญญา ${data.contractNumber} แล้ว ย้ายไปสัญญาปกติและพร้อมรับชำระ`);
      await loadContracts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกการจ่ายไม่สำเร็จ');
    } finally {
      setPaying(false);
    }
  }

  async function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancellingContract || cancelling) return;
    setCancelling(true);
    setCancellationError('');
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(cancellingContract.id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ยกเลิกสัญญาไม่สำเร็จ');
      setCancellingContract(null);
      setCancellationReason('');
      setMessage(`ยกเลิกสัญญา ${data.contractNumber} แล้ว และบันทึกเหตุผลไว้ในประวัติสัญญา`);
      await loadContracts();
    } catch (cause) {
      setCancellationError(cause instanceof Error ? cause.message : 'ยกเลิกสัญญาไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  }

  return <main className="lx-page ap-page">
    {cancellingContract && <div className="ap-modal-backdrop ap-cancel-backdrop">
      <section className="ap-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="ap-cancel-title">
        <header className="ap-modal-head">
          <div><span className="ap-eyebrow">บันทึกการยกเลิก</span><h2 id="ap-cancel-title">ยกเลิกสัญญา {cancellingContract.contractNumber}</h2></div>
          <button className="lx-icon-btn" type="button" aria-label="ปิด" disabled={cancelling} onClick={() => { setCancellingContract(null); setCancellationError(''); }}> <X size={20} /></button>
        </header>
        <form className="ap-cancel-form" onSubmit={submitCancellation}>
          <div className="ap-cancel-contract"><span>ผู้กู้</span><strong>{borrowerName(cancellingContract)}</strong><span>ยอดเงินต้น</span><strong>{baht(cancellingContract.principal)}</strong></div>
          <p className="ap-not-ready-notice">สัญญาจะถูกทำเครื่องหมายว่ายกเลิกและจะไม่แสดงในรายการจ่ายเงิน ข้อมูลสัญญาจะยังเก็บไว้ตรวจสอบย้อนหลัง</p>
          <label className="lx-field"><span>เหตุผลการยกเลิก <b className="lx-req">*</b></span><textarea required minLength={5} maxLength={500} rows={3} value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} placeholder="เช่น ผู้กู้แจ้งยกเลิกก่อนวันเริ่มสัญญา" /></label>
          {cancellationError && <p className="lx-notice error" role="alert">{cancellationError}</p>}
          <footer className="ap-modal-actions"><button className="lx-btn" type="button" disabled={cancelling} onClick={() => { setCancellingContract(null); setCancellationError(''); }}>กลับ</button><button className="lx-btn danger" type="submit" disabled={cancelling || cancellationReason.trim().length < 5}>{cancelling ? 'กำลังบันทึก…' : 'ยืนยันยกเลิกสัญญา'}</button></footer>
        </form>
      </section>
    </div>}
    {selectedContract && <div className="ap-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !paying && !savingTerms) setSelectedContract(null); }}>
      <section className="ap-payout-modal" role="dialog" aria-modal="true" aria-labelledby="ap-payout-title">
        <header className="ap-modal-head">
          <div><span className="ap-eyebrow">{selectedContract.status === 'READY' ? 'ยืนยันการจ่ายเงิน' : 'รายละเอียดสัญญาจอง'}</span><h2 id="ap-payout-title">{selectedContract.status === 'READY' ? 'จ่ายเงินให้ผู้กู้' : 'สัญญายังไม่ถึงกำหนดจ่าย'}</h2></div>
          <button className="lx-icon-btn" type="button" aria-label="ปิด" disabled={paying || savingTerms} onClick={() => setSelectedContract(null)}><X size={20} /></button>
        </header>
        <form className="ap-payout-form" onSubmit={submitPayout}>
          <div className="ap-payout-contract"><div><span>สัญญา</span><strong>{selectedContract.contractNumber}</strong></div><div><span>ผู้กู้</span><strong>{borrowerName(selectedContract)}</strong></div><div><span>ยอดจ่ายสุทธิ</span><strong>{baht(selectedContract.netDisbursed)}</strong></div></div>
          <details className="ap-contract-terms" open>
            <summary className="ap-contract-terms-summary">
              <h3>เงื่อนไขดอกเบี้ยและกำหนดชำระ</h3>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="ap-contract-terms-content">
              <div className="ap-terms-grid">
                <div><span>รูปแบบชำระ</span><strong>{repaymentPlan(selectedContract)}</strong></div>
                <div><span>วิธีคิดดอกเบี้ย</span><strong>{interestHandling(selectedContract)}</strong><small>{selectedContract.interestRate}%{selectedContract.interestRateBasis === 'MONTHLY_FLAT' ? ' ต่อเดือน' : ' ตลอดสัญญา'} · {baht(selectedContract.interestAmount)}</small></div>
                {selectedContract.interestMode === 'UPFRONT' && <div className="ap-terms-callout"><span>หักดอกเบี้ยจากยอดก่อนจ่าย</span><strong>{baht(selectedContract.interestAmount)}</strong></div>}
                {selectedContract.repayType === 'INTEREST_ONLY' && selectedContract.periodDays && <div><span>รอบชำระดอกเบี้ย</span><strong>ทุก {selectedContract.periodDays} วัน</strong></div>}
              </div>
              <div className="ap-schedule-heading"><strong>กำหนดชำระตามสัญญา</strong><span>วันครบกำหนด {dateLabel(selectedContract.dueDate)}</span></div>
              {selectedContract.schedules?.length ? <ol className="ap-schedule-list">{selectedContract.schedules.map(schedule => <li key={schedule.id}>
                <span><b>{selectedContract.repayType === 'INSTALLMENT' ? `งวด ${schedule.periodNo}` : selectedContract.interestMode === 'UPFRONT' ? 'คืนเงินต้น' : 'เงินต้นและดอกเบี้ย'}</b><small>{dateLabel(schedule.dueDate)}{schedule.interestAmount > 0 ? ` · ดอกเบี้ย ${baht(schedule.interestAmount)}` : ''}</small></span>
                <strong>{baht(schedule.amount)}</strong>
              </li>)}</ol> : <p className="ap-no-schedule">{selectedContract.repayType === 'INSTALLMENT'
                ? 'วันครบกำหนดงวดสุดท้าย ' + dateLabel(selectedContract.dueDate)
                : `วันครบกำหนด ${dateLabel(selectedContract.dueDate)} · ${selectedContract.interestMode === 'UPFRONT' ? 'คืนเงินต้น' : 'ยอดเงินต้นและดอกเบี้ย'} ${baht(selectedContract.principal + (selectedContract.interestMode === 'UPFRONT' ? 0 : selectedContract.interestAmount))}`}</p>}
            </div>
          </details>
          <section className="ap-terms-editor" aria-label="แก้ไขเงื่อนไขสัญญาก่อนจ่าย">
            {!editingTerms ? <button className="lx-btn sm" type="button" onClick={() => { setInterestModeDraft(selectedContract.interestMode === 'UPFRONT' ? 'UPFRONT' : 'ON_SCHEDULE'); setTermsError(''); setTermsMessage(''); setEditingTerms(true); }}>แก้ไขเงื่อนไขสัญญาก่อนจ่าย</button> : <>
              <h3>แก้ไขวิธีคิดดอกเบี้ย</h3>
              <p>การเปลี่ยนนี้จะบันทึกลงในสัญญา และปรับยอดจ่ายสุทธิกับยอดที่ต้องชำระตามกำหนด</p>
              <div className="ap-interest-mode-options">
                <label><input type="radio" name="ap-interest-mode" checked={interestModeDraft === 'ON_SCHEDULE'} onChange={() => setInterestModeDraft('ON_SCHEDULE')} /><span><strong>ไม่หักดอกเบี้ยล่วงหน้า</strong><small>จ่ายเงินต้นเต็มจำนวน และชำระเงินต้นพร้อมดอกเบี้ยตามกำหนด</small></span></label>
                <label><input type="radio" name="ap-interest-mode" checked={interestModeDraft === 'UPFRONT'} onChange={() => setInterestModeDraft('UPFRONT')} disabled={selectedContract.interestAmount > selectedContract.principal} /><span><strong>หักดอกเบี้ยก่อนจ่าย</strong><small>หัก {baht(selectedContract.interestAmount)} จากเงินที่จ่ายให้ผู้กู้ และชำระคืนเงินต้นตามกำหนด</small></span></label>
              </div>
              <div className="ap-terms-preview"><span>ยอดจ่ายสุทธิใหม่</span><strong>{baht(interestModeDraft === 'UPFRONT' ? selectedContract.principal - selectedContract.interestAmount : selectedContract.principal)}</strong><small>ยอดชำระตามกำหนด {baht(selectedContract.principal + (interestModeDraft === 'UPFRONT' ? 0 : selectedContract.interestAmount))}</small></div>
              {termsError && <p className="lx-notice error" role="alert">{termsError}</p>}
              <div className="ap-terms-edit-actions"><button className="lx-btn sm" type="button" disabled={savingTerms} onClick={() => setEditingTerms(false)}>ยกเลิก</button><button className="lx-btn primary sm" type="button" disabled={savingTerms || interestModeDraft === selectedContract.interestMode} onClick={() => void saveContractTerms()}>{savingTerms ? 'กำลังบันทึก…' : 'บันทึกเงื่อนไขในสัญญา'}</button></div>
            </>}
            {termsMessage && <p className="ap-terms-saved" role="status">{termsMessage}</p>}
          </section>
          {selectedContract.status === 'READY' ? <>
            <p className="ap-payout-hint">เมื่อลงบันทึก ระบบจะเปลี่ยนสัญญาเป็นกำลังดำเนินการและเพิ่มรายการจ่ายในบัญชีสินเชื่อ</p>
            {previousOutstanding.length > 0 && <div className="ap-old-contract-warning" role="alert">
              <strong>ผู้กู้รายนี้มีสัญญาเดิมที่ยังมียอดค้าง</strong>
              <span>กรุณาตรวจสอบการชำระสัญญาเดิมก่อนจ่ายสัญญาใหม่นี้</span>
              <ul>{previousOutstanding.map(row => <li key={row.id}><span>{row.contractNumber} · {row.status === 'OVERDUE' ? 'ค้างชำระ' : 'กำลังดำเนินการ'}</span><strong>{baht(row.balance.total)}</strong></li>)}</ul>
              <label><input type="checkbox" checked={acknowledgedOldContract} onChange={event => setAcknowledgedOldContract(event.target.checked)} /> ตรวจสอบสัญญาเดิมและรับทราบยอดค้างแล้ว</label>
            </div>}
            {error && <p className="lx-notice error" role="alert">{error}</p>}
            <div className="ap-payout-fields">
              <label className="lx-field"><span>วันที่จ่าย</span><input type="date" value={paymentDate} max={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())} onChange={event => setPaymentDate(event.target.value)} required /></label>
              <label className="lx-field"><span>เวลาจ่าย</span><input type="time" value={paymentTime} max={paymentDate === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()) : undefined} onChange={event => setPaymentTime(event.target.value)} required /></label>
              <label className="lx-field"><span>ช่องทางจ่าย</span><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as 'CASH' | 'BANK_TRANSFER')}><option value="BANK_TRANSFER">โอนเงิน</option><option value="CASH">เงินสด</option></select></label>
              <label className="lx-field ap-reference-field"><span>เลขอ้างอิง / เลขสลิป <small>กรอกหรือแนบไฟล์อย่างใดอย่างหนึ่ง</small></span><input maxLength={100} value={reference} onChange={event => setReference(event.target.value)} placeholder="เช่น เลขอ้างอิงธนาคาร" /></label>
              <label className="ap-upload-field"><span>แนบสลิปหรือหลักฐาน <small>JPG, PNG, WebP หรือ PDF ไม่เกิน 10 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setEvidenceFile(event.target.files?.[0] || null)} /><span className="lx-btn sm"><Upload size={15} />{evidenceFile ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์'}</span>{evidenceFile && <small className="ap-file-name">{evidenceFile.name}</small>}</label>
            </div>
            <footer className="ap-modal-actions"><button className="lx-btn" type="button" disabled={paying || savingTerms} onClick={() => setSelectedContract(null)}>ยกเลิก</button><button className="lx-btn primary" type="submit" disabled={paying || savingTerms}>{paying ? <><RefreshCw size={15} className="lx-spin" /> กำลังบันทึก…</> : <><Check size={16} /> ยืนยันบันทึกการจ่าย</>}</button></footer>
          </> : <>
            <p className="ap-not-ready-notice">เลือกดูสัญญานี้ได้แล้ว เมื่อถึงกำหนดจ่าย ปุ่มจ่ายเงินจะเปิดให้ระบุวันที่ ช่องทางจ่าย และเลขอ้างอิงหรือแนบสลิป</p>
            <footer className="ap-modal-actions"><button className="lx-btn" type="button" disabled={savingTerms} onClick={() => setSelectedContract(null)}>ปิด</button></footer>
          </>}
        </form>
      </section>
    </div>}
    <div className="lx-wrap">
      <header className="lx-head ap-head">
        <div>
          <div className="ap-eyebrow"><CalendarClock size={15} aria-hidden="true" /> สินเชื่อ</div>
          <h1>รายการจองล่วงหน้า</h1>
          <p>ติดตามสัญญาที่จองไว้และจ่ายเงินเมื่อถึงวันเริ่มสัญญา</p>
        </div>
        <button className="lx-btn" type="button" onClick={() => void loadContracts()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'lx-spin' : ''} aria-hidden="true" /> รีเฟรช
        </button>
      </header>

      {error && !selectedContract && <p className="lx-notice error" role="alert">{error}</p>}
      {message && <p className="lx-notice ap-success" role="status"><Check size={16} />{message}</p>}

      <section className="ap-summary" aria-label="สรุปรายการจองล่วงหน้า">
        <article className="ap-summary-card">
          <span>จำนวนสัญญาที่จอง</span>
          <strong>{loading ? '—' : visibleContracts.length.toLocaleString('th-TH')} <small>สัญญา</small></strong>
          <p>{query ? 'จำนวนรายการที่ตรงกับคำค้น' : `พร้อมจ่าย ${payableCount.toLocaleString('th-TH')} สัญญา`}</p>
        </article>
        <article className="ap-summary-card ap-summary-total">
          <span>ยอดเงินต้นตามสัญญา</span>
          <strong>{loading ? '—' : baht(totalPrincipal)}</strong>
          <p>{query ? 'ยอดรวมรายการที่ค้นหา' : 'ยอดรวมสัญญาที่จองล่วงหน้า'}</p>
        </article>
      </section>

      <section className="lx-panel ap-list-panel">
        <div className="ap-list-heading">
          <div><h2>สัญญาจองและรอจ่าย</h2><p>ค้นหาด้วยเลขที่สัญญา รหัสผู้กู้ หรือชื่อผู้กู้</p></div>
          <label className="lx-search ap-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">ค้นหาเลขสัญญา รหัสผู้กู้ หรือชื่อผู้กู้</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา / รหัสผู้กู้ / ชื่อ" />
          </label>
        </div>

        {loading ? <div className="ap-state" role="status">กำลังโหลดรายการจอง…</div>
          : visibleContracts.length === 0 ? <div className="ap-state">
            <span className="ap-empty-icon"><CalendarClock size={22} aria-hidden="true" /></span>
            <strong>{query ? 'ไม่พบสัญญาที่ตรงกับคำค้น' : 'ไม่มีสัญญาจองหรือรอจ่าย'}</strong>
            <span>{query ? 'ลองค้นหาด้วยเลขสัญญา รหัสผู้กู้ หรือชื่อผู้กู้' : 'สัญญาที่จองไว้หรือถึงกำหนดจ่ายจะแสดงที่นี่'}</span>
          </div> : <div className="lx-table-wrap ap-table-wrap">
            <table className="lx-table ap-table">
              <thead><tr><th>เลขสัญญา</th><th>ผู้กู้</th><th className="ap-amount-col">ยอดเงินต้น</th><th>วันเริ่มสัญญา</th><th>ครบกำหนด</th><th>สถานะ</th><th><span className="sr-only">การจัดการ</span></th></tr></thead>
              <tbody>{visibleContracts.map(row => <tr key={row.id}>
                <td><strong className="ap-contract-number">{row.contractNumber || '—'}</strong><small>แก้ไข {dateLabel(row.updatedAt)}</small></td>
                <td><strong>{borrowerName(row)}</strong><small>{row.debtor?.borrowersCode || '—'}</small></td>
                <td className="ap-money">{baht(row.principal)}</td>
                <td>{dateLabel(row.startDate)}</td>
                <td>{dateLabel(row.dueDate)}</td>
                <td><span className={`lx-contract-status ${row.status === 'READY' ? 'is-ready' : 'is-reserved'}`}>{row.status === 'READY' ? 'ถึงกำหนดจ่าย' : 'จองสัญญา'}</span></td>
                <td className="ap-action-cell"><div className="ap-row-actions">{row.status === 'READY' ? <button className="lx-btn primary sm" type="button" onClick={() => openContract(row)}>จ่ายเงินให้</button> : <button className="lx-btn sm" type="button" onClick={() => openContract(row)}>เลือกสัญญา</button>}<button className="lx-btn danger sm" type="button" onClick={() => { setCancellationReason(''); setCancellationError(''); setCancellingContract(row); }}>ยกเลิกสัญญา</button></div></td>
              </tr>)}</tbody>
            </table>
          </div>}
        {!loading && visibleContracts.length > 0 && <div className="ap-table-foot">แสดง {visibleContracts.length.toLocaleString('th-TH')} จาก {contracts.length.toLocaleString('th-TH')} สัญญา</div>}
      </section>
    </div>
  </main>;
}
