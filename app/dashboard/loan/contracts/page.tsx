'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import ContractDocumentPreview from '@/components/loan/ContractDocumentPreview';
import ContractForm from '@/components/loan/ContractForm';
import ConfirmDelete from '@/components/ui/ConfirmDelete';
import { Trash2 } from 'lucide-react';
import { emptyDocumentSettings, type ContractDocumentSettings } from '@/lib/contract-document';
import '../lending-ui.css';

type Row = {
  contractType?: string;
  documentData?: string | null;
  signatureUrl?: string | null;
  witness1?: string | null;
  witness2?: string | null;
  guarantor?: string | null;
  id: string;
  contractNumber?: string;
  status: string;
  updatedAt: string;
  createdAt?: string;
  principal?: number;
  interestRate?: number;
  interestAmount?: number;
  interestMode?: 'UPFRONT' | 'ON_SCHEDULE';
  repayType?: 'INSTALLMENT' | 'INTEREST_ONLY' | 'LUMP_SUM';
  installmentMonths?: number | null;
  periodDays?: number | null;
  startDate?: string;
  dueDate?: string | null;
  lateFeePerDay?: number;
  lateFeeWaived?: boolean;
  disbursement?: { id: string; amount: number; paidAt: string; method: string; reference: string | null } | null;
  repayments?: { receiptNumber: string; amount: number; paidAt: string; interestPaid: number; penaltyPaid: number; principalPaid: number; receiptVerified: boolean }[];
  debtor?: { borrowersCode: string; firstName: string; nickname: string | null };
  borrower?: { borrowersCode: string; firstName: string; nickname: string | null };
  data?: { contract?: { principal?: string } };
};

type EditValues = { principal: string; interestRate: string; customInterestRate: string; repayType: string; interestMode: string; installmentMonths: string; periodDays: string; startDate: string; dueDate: string; lateFeePerDay: string; lateFeeWaived: boolean; reason: string; confirm: boolean };
const dateInput = (value?: string | null) => value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';
const standardRates = ['0', '5', '10', '15', '20', '25'];
const initialEdit = (row: Row): EditValues => ({ principal: String((row.principal || 0) / 100), interestRate: standardRates.includes(String(row.interestRate ?? 0)) ? String(row.interestRate ?? 0) : 'CUSTOM', customInterestRate: String(row.interestRate ?? 0), repayType: row.repayType || 'LUMP_SUM', interestMode: row.interestMode || 'ON_SCHEDULE', installmentMonths: row.installmentMonths ? String(row.installmentMonths) : '', periodDays: row.periodDays ? String(row.periodDays) : '', startDate: dateInput(row.startDate), dueDate: dateInput(row.dueDate), lateFeePerDay: String((row.lateFeePerDay ?? 5000) / 100), lateFeeWaived: row.lateFeeWaived ?? false, reason: '', confirm: false });

const statusLabels: Record<string, string> = {
  DRAFT: 'ร่าง', RESERVED: 'จองสัญญา', AWAITING_DOCUMENT: 'รอเอกสารลงนาม', READY: 'พร้อมจ่ายเงิน',
  ACTIVE: 'กำลังดำเนินการ', OVERDUE: 'เกินกำหนดชำระ', CLOSED: 'ปิดสัญญา',
};
const statusClasses: Record<string, string> = {
  DRAFT: 'is-draft', RESERVED: 'is-reserved', AWAITING_DOCUMENT: 'is-waiting', READY: 'is-ready',
  ACTIVE: 'is-active', OVERDUE: 'is-overdue', CLOSED: 'is-closed',
};
const newestFirst = (rows: Row[]) => [...rows].sort((a, b) => {
  const updated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (Number.isFinite(updated) && updated !== 0) return updated;
  const created = Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
  return Number.isFinite(created) && created !== 0 ? created : b.id.localeCompare(a.id);
});

export default function Contracts() {
  const [drafts, setDrafts] = useState<Row[]>([]);
  const [contracts, setContracts] = useState<Row[]>([]);
  const [contractStatusFilter, setContractStatusFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingDraft, setDeletingDraft] = useState('');
  const [confirmingDraft, setConfirmingDraft] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);
  const [editingContract, setEditingContract] = useState<Row | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editDialog = useRef<HTMLDialogElement>(null);
  const createDialog = useRef<HTMLDialogElement>(null);
  const previewDocument: ContractDocumentSettings | null = preview?.documentData
    ? { ...emptyDocumentSettings, ...JSON.parse(preview.documentData) }
    : null;
  const editSummary = editingContract && editValues ? (() => {
    const principal = Math.round(Number(editValues.principal || 0) * 100);
    const rate = Number(editValues.interestRate === 'CUSTOM' ? editValues.customInterestRate : editValues.interestRate) || 0;
    const months = editValues.repayType === 'INSTALLMENT' ? Number(editValues.installmentMonths) || 0 : 1;
    const interest = Math.round(principal * rate / 100 * months);
    const total = editValues.interestMode === 'UPFRONT' ? principal : principal + interest;
    const received = (editingContract.repayments || []).reduce((sum, receipt) => sum + receipt.amount, 0);
    return { interest, total, received, remaining: Math.max(0, total - received) };
  })() : null;
  const visibleContracts = [...contracts]
    .sort((a, b) => Date.parse(b.createdAt || b.updatedAt) - Date.parse(a.createdAt || a.updatedAt) || b.id.localeCompare(a.id))
    .filter(row => contractStatusFilter === 'ALL' || row.status === contractStatusFilter);

  const loadRows = useCallback(async () => {
    const responses = await Promise.all([
      fetch('/api/contracts/drafts', { cache: 'no-store' }),
      fetch('/api/contracts/list', { cache: 'no-store' }),
    ]);
    const data = await Promise.all(responses.map(response => response.json()));
    if (responses.some(response => !response.ok)) throw new Error('โหลดสัญญาไม่สำเร็จ');
    setDrafts(newestFirst(data[0]));
    setContracts(newestFirst(data[1]));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try { await loadRows(); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'โหลดไม่สำเร็จ'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [loadRows]);

  useEffect(() => {
    const dialog = createDialog.current;
    if (!dialog) return;
    if (creating && !dialog.open) dialog.showModal();
    if (!creating && dialog.open) dialog.close();
  }, [creating]);

  useEffect(() => {
    const dialog = editDialog.current;
    if (!dialog) return;
    if (editingContract && !dialog.open) dialog.showModal();
    if (!editingContract && dialog.open) dialog.close();
  }, [editingContract]);

  const date = (value: string) => new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));

  async function deleteDraft(row: Row) {
    if (deletingDraft) return;
    setDeletingDraft(row.id);
    setError('');
    try {
      const response = await fetch(`/api/contracts/drafts?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ลบร่างไม่สำเร็จ');
      setDrafts(current => current.filter(item => item.id !== row.id));
      setConfirmingDraft(null);
      try {
        const recovery = sessionStorage.getItem('loan-contract-draft-recovery');
        if (recovery && JSON.parse(recovery).id === row.id) sessionStorage.removeItem('loan-contract-draft-recovery');
      } catch { /* Ignore invalid browser recovery data. */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบร่างไม่สำเร็จ');
    } finally {
      setDeletingDraft('');
    }
  }

  async function saveContractEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingContract || !editValues || savingEdit) return;
    setSavingEdit(true); setError('');
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(editingContract.id)}/terms`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal: Math.round(Number(editValues.principal) * 100), interestRate: Number(editValues.interestRate === 'CUSTOM' ? editValues.customInterestRate : editValues.interestRate), repayType: editValues.repayType, interestMode: editValues.interestMode, installmentMonths: editValues.installmentMonths || null, periodDays: editValues.periodDays || null, startDate: editValues.startDate, dueDate: editValues.dueDate || null, lateFeePerDay: Math.round(Number(editValues.lateFeePerDay) * 100), lateFeeWaived: editValues.lateFeeWaived, reason: editValues.reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'แก้ไขสัญญาไม่สำเร็จ');
      setEditingContract(null); setEditValues(null);
      await loadRows();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'แก้ไขสัญญาไม่สำเร็จ'); }
    finally { setSavingEdit(false); }
  }

  function table(rows: Row[], draft: boolean) {
    return <div className="lx-table-wrap">
      <table className="lx-table">
        <thead><tr><th>เลขสัญญา</th><th>ผู้กู้</th><th>สถานะ</th><th>ยอดเงินต้น</th><th>แก้ไขล่าสุด</th><th>จัดการ</th></tr></thead>
        <tbody>{rows.map(row => {
          const borrower = row.borrower || row.debtor;
          const status = draft ? 'DRAFT' : row.status;
          return <tr key={row.id}>
            <td>{draft ? 'ร่าง (ยังไม่ออกเลขสัญญา)' : row.contractNumber}</td>
            <td>{borrower?.borrowersCode} · {borrower?.firstName || borrower?.nickname || '—'}</td>
            <td>
              <span className={`lx-contract-status ${row.disbursement ? 'is-active' : statusClasses[status] || 'is-draft'}`}>{row.disbursement ? 'จ่ายเงินแล้ว' : statusLabels[status] || status}</span>
              {row.disbursement && <small style={{ display: 'block', marginTop: 5, color: 'var(--lx-muted)', lineHeight: 1.5 }}>
                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(row.disbursement.amount / 100)} · {date(row.disbursement.paidAt)} · {row.disbursement.method === 'BANK_TRANSFER' ? 'โอนเงิน' : 'เงินสด'}
                {row.disbursement.reference ? <><br />อ้างอิง {row.disbursement.reference}</> : null}
              </small>}
            </td>
            <td>{draft ? row.data?.contract?.principal || '—' : new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format((row.principal || 0) / 100)}</td>
            <td>{date(row.updatedAt)}</td>
            <td><div className="lx-table-actions">
              {draft
                ? <button type="button" className="lx-btn sm" onClick={() => { setEditingDraftId(row.id); setCreating(true); }}>แก้ไขร่าง</button>
                : <><button type="button" className="lx-btn sm" onClick={() => { setEditingContract(row); setEditValues(initialEdit(row)); }}>แก้ไขสัญญา</button><Link className="lx-btn sm" href="/dashboard/loan/payments">ดูการชำระ</Link></>}
              {draft && <button type="button" className="lx-btn sm danger" disabled={!!deletingDraft} onClick={() => setConfirmingDraft(row)} aria-label={`ลบร่างของ ${borrower?.borrowersCode || 'ผู้กู้'}`} title="ลบร่าง">
                {deletingDraft === row.id ? 'กำลังลบ…' : <><Trash2 size={15} aria-hidden="true" /> ลบร่าง</>}
              </button>}
              {!draft && row.documentData && row.contractType !== 'NONE' && <button type="button" className="lx-btn sm" onClick={() => setPreview(row)}>เอกสาร A4</button>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
      {!rows.length && <p className="lx-empty">{draft ? 'ยังไม่มีร่าง' : 'ยังไม่มีสัญญาที่บันทึก'}</p>}
    </div>;
  }

  return <main className="lx-page">
    {confirmingDraft && <ConfirmDelete
      name={`ร่างสัญญาของ ${(confirmingDraft.borrower || confirmingDraft.debtor)?.borrowersCode || 'ผู้กู้'}`}
      busy={deletingDraft === confirmingDraft.id}
      onConfirm={() => void deleteDraft(confirmingDraft)}
      onCancel={() => { if (!deletingDraft) setConfirmingDraft(null); }}
    />}
    {preview && previewDocument && <ContractDocumentPreview
      draft={false}
      attachments={previewDocument.attachments}
      loanText={previewDocument.loanText}
      guaranteeText={previewDocument.guaranteeText || undefined}
      signers={[
        { role: 'ผู้ให้กู้', name: previewDocument.lenderName, signature: previewDocument.lenderSignature },
        { role: 'ผู้กู้', name: preview.debtor?.firstName || preview.debtor?.nickname || '', signature: preview.signatureUrl || '' },
        ...(preview.witness1 ? [{ role: 'พยานคนที่ 1', name: preview.witness1, signature: previewDocument.witness1Signature }] : []),
        ...(preview.witness2 ? [{ role: 'พยานคนที่ 2', name: preview.witness2, signature: previewDocument.witness2Signature }] : []),
        ...(preview.guarantor ? [{ role: 'ผู้ค้ำประกัน', name: preview.guarantor, signature: previewDocument.guarantorSignature }] : []),
      ]}
      onClose={() => setPreview(null)}
    />}
    <dialog ref={createDialog} className="contract-create-dialog" aria-label="สร้างสัญญากู้" onCancel={event => event.preventDefault()}>
      {creating && <ContractForm embedded draftId={editingDraftId || undefined} onClose={() => { setCreating(false); setEditingDraftId(null); }} onSaved={() => { void loadRows().catch(cause => setError(cause instanceof Error ? cause.message : 'โหลดสัญญาไม่สำเร็จ')); }} />}
    </dialog>
    <dialog ref={editDialog} className="contract-create-dialog" aria-label="แก้ไขสัญญากู้" onCancel={event => { event.preventDefault(); if (!savingEdit) { setEditingContract(null); setEditValues(null); } }}>
      {editingContract && editValues && <form className="contract-page" onSubmit={saveContractEdit}>
        <div className="contract-heading"><div><h1>แก้ไขสัญญา {editingContract.contractNumber}</h1><p>ระบบจะคำนวณการตัดชำระย้อนหลังใหม่ทั้งหมดตามเงื่อนไขนี้</p></div><button type="button" className="lx-btn" onClick={() => { if (!savingEdit) { setEditingContract(null); setEditValues(null); } }}>ปิด</button></div>
        <div className="lx-notice warn">การแก้ไขนี้จะอัปเดตการแบ่งเงินต้น ดอกเบี้ย และค่าปรับของใบรับชำระเก่าทุกรายการเป็นธุรกรรมเดียว เอกสารที่เซ็นแล้วจะเก็บเป็นหลักฐานเดิม</div>
        {editSummary && <div className="lx-grid c3" style={{ marginTop: 14 }}>
          <div className="lx-panel lx-panel-body"><small>ดอกเบี้ยตามเงื่อนไขใหม่</small><strong>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(editSummary.interest / 100)}</strong></div>
          <div className="lx-panel lx-panel-body"><small>รับชำระแล้วตามเลขใบเสร็จ</small><strong>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(editSummary.received / 100)}</strong></div>
          <div className="lx-panel lx-panel-body"><small>ยอดสัญญาคงเหลือโดยประมาณ (ก่อนค่าปรับ)</small><strong>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(editSummary.remaining / 100)}</strong></div>
        </div>}
        <div className="lx-panel lx-panel-body">
          <div className="lx-grid c2">
            <label className="lx-field"><span>เงินต้น (บาท)</span><input required min="0.01" step="0.01" type="number" value={editValues.principal} onChange={e => setEditValues({ ...editValues, principal: e.target.value })} /></label>
            <label className="lx-field"><span>อัตราดอกเบี้ย (%)</span><select value={editValues.interestRate} onChange={e => setEditValues({ ...editValues, interestRate: e.target.value })}><option value="0">0%</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="CUSTOM">กำหนดเอง</option></select></label>
          </div>
          {editValues.interestRate === 'CUSTOM' && <label className="lx-field" style={{ marginTop: 14 }}><span>อัตราดอกเบี้ยที่กำหนดเอง (%)</span><input required min="0" max="100" step="0.01" type="number" value={editValues.customInterestRate} onChange={e => setEditValues({ ...editValues, customInterestRate: e.target.value })} /></label>}
          <div className="lx-grid c2">
            <label className="lx-field"><span>รูปแบบชำระ</span><select value={editValues.repayType} onChange={e => setEditValues({ ...editValues, repayType: e.target.value, installmentMonths: e.target.value === 'INSTALLMENT' ? (editValues.installmentMonths || '1') : '' })}><option value="INSTALLMENT">ผ่อนชำระรายเดือน</option><option value="INTEREST_ONLY">ชำระดอกเบี้ยเป็นรอบ</option><option value="LUMP_SUM">ชำระตามสัญญา</option></select></label>
            <label className="lx-field"><span>วิธีคิดดอกเบี้ย</span><select value={editValues.interestMode} onChange={e => setEditValues({ ...editValues, interestMode: e.target.value })}><option value="ON_SCHEDULE">ไม่หักดอกเบี้ยก่อน</option><option value="UPFRONT">หักดอกเบี้ยก่อน</option></select></label>
          </div>
          <div className="lx-grid c2">
            {editValues.repayType === 'INSTALLMENT' && <label className="lx-field"><span>จำนวนเดือน</span><input required min="1" max="360" step="1" type="number" value={editValues.installmentMonths} onChange={e => setEditValues({ ...editValues, installmentMonths: e.target.value })} /></label>}
            {editValues.repayType === 'INTEREST_ONLY' && <label className="lx-field"><span>รอบชำระดอกเบี้ย (วัน)</span><input min="1" max="3650" step="1" type="number" value={editValues.periodDays} onChange={e => setEditValues({ ...editValues, periodDays: e.target.value })} /></label>}
            <label className="lx-field"><span>วันที่เริ่มสัญญา</span><input required type="date" value={editValues.startDate} onChange={e => setEditValues({ ...editValues, startDate: e.target.value })} /></label>
            <label className="lx-field"><span>วันครบกำหนด</span><input required={editValues.repayType !== 'INSTALLMENT'} type="date" value={editValues.dueDate} onChange={e => setEditValues({ ...editValues, dueDate: e.target.value })} /></label>
          </div>
          <div className="lx-grid c2">
            <label className="lx-field"><span>ค่าปรับต่อวัน (บาท)</span><input required min="0" step="0.01" type="number" value={editValues.lateFeePerDay} onChange={e => setEditValues({ ...editValues, lateFeePerDay: e.target.value })} /></label>
            <label className="lx-check"><input type="checkbox" checked={editValues.lateFeeWaived} onChange={e => setEditValues({ ...editValues, lateFeeWaived: e.target.checked })} /> ยกเว้นค่าปรับรายวัน</label>
          </div>
          <label className="lx-field" style={{ marginTop: 14 }}><span>เหตุผลที่แก้ไข <b className="lx-req">*</b></span><textarea required maxLength={500} rows={3} value={editValues.reason} onChange={e => setEditValues({ ...editValues, reason: e.target.value })} placeholder="เช่น แก้ยอดเงินและเงื่อนไขการตัดชำระ" /></label>
          <label className="lx-check" style={{ marginTop: 14 }}><input required type="checkbox" checked={editValues.confirm} onChange={e => setEditValues({ ...editValues, confirm: e.target.checked })} /> ยืนยันให้คำนวณรายการรับชำระย้อนหลังใหม่ทั้งหมด</label>
          <h2 className="lx-subhead">ตรวจสอบใบเสร็จรับชำระ</h2>
          {editingContract.repayments?.length ? <div className="lx-table-wrap"><table className="lx-table"><thead><tr><th>เลขที่ใบเสร็จ</th><th>วันที่รับชำระ</th><th>ยอดรับ</th><th>ผลตรวจรายการ</th></tr></thead><tbody>{editingContract.repayments.map(receipt => <tr key={receipt.receiptNumber}><td>{receipt.receiptNumber}</td><td>{new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(receipt.paidAt))}</td><td>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(receipt.amount / 100)}</td><td><span className={`lx-contract-status ${receipt.receiptVerified ? 'is-ready' : 'is-overdue'}`}>{receipt.receiptVerified ? 'ผูกรายการรับเงินแล้ว' : 'ไม่พบรายการรับเงินที่ตรงกัน'}</span></td></tr>)}</tbody></table></div> : <p className="lx-empty">ยังไม่มีใบเสร็จรับชำระที่ผูกกับสัญญานี้</p>}
        </div>
        <div className="lx-table-actions" style={{ justifyContent: 'flex-end', marginTop: 14 }}><button type="button" className="lx-btn" disabled={savingEdit} onClick={() => { setEditingContract(null); setEditValues(null); }}>ยกเลิก</button><button type="submit" className="lx-btn primary" disabled={savingEdit || !editValues.confirm}>{savingEdit ? 'กำลังคำนวณ…' : 'บันทึกและคำนวณย้อนหลัง'}</button></div>
      </form>}
    </dialog>
    <div className="lx-wrap">
      <header className="lx-head">
        <div><h1>สัญญากู้</h1><p>ร่างที่เก็บอัตโนมัติและสัญญาที่บันทึกแล้ว</p></div>
        <button type="button" className="lx-btn primary" onClick={() => { setEditingDraftId(null); setCreating(true); }}>สร้างสัญญา</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? <p>กำลังโหลด…</p> : <>
        <section className="lx-panel"><div className="lx-panel-head"><h2>ร่าง ({drafts.length})</h2></div>{table(drafts, true)}</section>
        <section className="lx-panel">
          <div className="lx-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h2>สัญญาที่บันทึก ({visibleContracts.length}{contractStatusFilter === 'ALL' ? '' : ` / ${contracts.length}`})</h2>
            <label className="lx-field" style={{ minWidth: 210 }}><span>กรองสถานะ</span><select value={contractStatusFilter} onChange={event => setContractStatusFilter(event.target.value)}><option value="ALL">ทุกสถานะ</option>{Object.entries(statusLabels).filter(([status]) => status !== 'DRAFT').map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
          </div>
          {table(visibleContracts, false)}
        </section>
      </>}
    </div>
  </main>;
}
