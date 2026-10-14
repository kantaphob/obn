'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, Check, RefreshCw, Search, Upload, X } from 'lucide-react';
import '../lending-ui.css';
import './ap.css';

type ReservedContract = {
  id: string;
  debtorId: string;
  contractNumber: string;
  status: string;
  principal: number;
  netDisbursed: number;
  startDate: string;
  dueDate: string | null;
  updatedAt: string;
  createdAt: string;
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

export default function AP() {
  const [contracts, setContracts] = useState<ReservedContract[]>([]);
  const [outstandingContracts, setOutstandingContracts] = useState<OutstandingContract[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedContract, setSelectedContract] = useState<ReservedContract | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()));
  const [reference, setReference] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [acknowledgedOldContract, setAcknowledgedOldContract] = useState(false);

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
      setContracts(Array.isArray(data) ? data.filter((row: ReservedContract) => ['RESERVED', 'READY'].includes(row.status)) : []);
      setOutstandingContracts(Array.isArray(balanceData) ? balanceData.filter((row: OutstandingContract) => ['ACTIVE', 'OVERDUE'].includes(row.status) && row.balance?.total > 0) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการจองไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContracts(); }, [loadContracts]);

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

  function openPayout(row: ReservedContract) {
    setSelectedContract(row);
    setPaymentDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()));
    setPaymentMethod('BANK_TRANSFER');
    setReference('');
    setEvidenceFile(null);
    setAcknowledgedOldContract(false);
    setError('');
    setMessage('');
  }

  async function submitPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedContract || paying) return;
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
    form.set('paidAt', paymentDate);
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

  return <main className="lx-page ap-page">
    {selectedContract && <div className="ap-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !paying) setSelectedContract(null); }}>
      <section className="ap-payout-modal" role="dialog" aria-modal="true" aria-labelledby="ap-payout-title">
        <header className="ap-modal-head">
          <div><span className="ap-eyebrow">ยืนยันการจ่ายเงิน</span><h2 id="ap-payout-title">จ่ายเงินให้ผู้กู้</h2></div>
          <button className="lx-icon-btn" type="button" aria-label="ปิด" disabled={paying} onClick={() => setSelectedContract(null)}><X size={20} /></button>
        </header>
        <form className="ap-payout-form" onSubmit={submitPayout}>
          <div className="ap-payout-contract"><div><span>สัญญา</span><strong>{selectedContract.contractNumber}</strong></div><div><span>ผู้กู้</span><strong>{borrowerName(selectedContract)}</strong></div><div><span>ยอดจ่ายสุทธิ</span><strong>{baht(selectedContract.netDisbursed)}</strong></div></div>
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
            <label className="lx-field"><span>ช่องทางจ่าย</span><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as 'CASH' | 'BANK_TRANSFER')}><option value="BANK_TRANSFER">โอนเงิน</option><option value="CASH">เงินสด</option></select></label>
            <label className="lx-field ap-reference-field"><span>เลขอ้างอิง / เลขสลิป <small>กรอกหรือแนบไฟล์อย่างใดอย่างหนึ่ง</small></span><input maxLength={100} value={reference} onChange={event => setReference(event.target.value)} placeholder="เช่น เลขอ้างอิงธนาคาร" /></label>
            <label className="ap-upload-field"><span>แนบสลิปหรือหลักฐาน <small>JPG, PNG, WebP หรือ PDF ไม่เกิน 10 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setEvidenceFile(event.target.files?.[0] || null)} /><span className="lx-btn sm"><Upload size={15} />{evidenceFile ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์'}</span>{evidenceFile && <small className="ap-file-name">{evidenceFile.name}</small>}</label>
          </div>
          <footer className="ap-modal-actions"><button className="lx-btn" type="button" disabled={paying} onClick={() => setSelectedContract(null)}>ยกเลิก</button><button className="lx-btn primary" type="submit" disabled={paying}>{paying ? <><RefreshCw size={15} className="lx-spin" /> กำลังบันทึก…</> : <><Check size={16} /> ยืนยันบันทึกการจ่าย</>}</button></footer>
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
                <td className="ap-action-cell">{row.status === 'READY' ? <button className="lx-btn primary sm" type="button" onClick={() => openPayout(row)}>จ่ายเงินให้</button> : <span className="ap-action-note">รอวันเริ่ม</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        {!loading && visibleContracts.length > 0 && <div className="ap-table-foot">แสดง {visibleContracts.length.toLocaleString('th-TH')} จาก {contracts.length.toLocaleString('th-TH')} สัญญา</div>}
      </section>
    </div>
  </main>;
}
