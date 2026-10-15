'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Activity, Check, Clock3, FileText, Plus, RefreshCw, Search, UserRound } from 'lucide-react';
import '../lending-ui.css';
import './logs.css';

type Borrower = {
  id: string;
  borrowersCode: string;
  prefixTH: string | null;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
};
type Contract = { id: string; contractNumber: string; status: string };
type LoanLog = {
  id: string;
  userId: string;
  borrowerId: string;
  contractId: string | null;
  targetId: string | null;
  type: string;
  action: string;
  note: string | null;
  beforeData: string | null;
  afterData: string | null;
  createdAt: string;
  borrower: Borrower | null;
  contract: { id: string; contractNumber: string } | null;
};

const borrowerName = (borrower: Borrower) => [borrower.prefixTH, borrower.firstName, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname || 'ไม่ระบุชื่อ';
const dateTimeLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const statusLabel: Record<string, string> = { DRAFT: 'ร่าง', READY: 'พร้อมดำเนินการ', AWAITING_DOCUMENT: 'รอเอกสาร', RESERVED: 'จองสัญญา', ACTIVE: 'กำลังผ่อน', OVERDUE: 'ค้างชำระ', CLOSED: 'ปิดสัญญา' };
const typeLabel: Record<string, string> = { BORROWER: 'ผู้กู้', CONTRACT: 'สัญญา', PAYMENT: 'รายการจ่าย', REPAYMENT: 'รายการรับชำระ', MANUAL: 'บันทึกทั่วไป' };
const actionLabel: Record<string, string> = { CREATE: 'เพิ่ม', UPDATE: 'แก้ไข', DELETE: 'ลบ' };
const fieldLabel: Record<string, string> = { borrowersCode: 'รหัสผู้กู้', prefixTH: 'คำนำหน้า', firstName: 'ชื่อ', lastName: 'นามสกุล', nickname: 'ชื่อเล่น', phone: 'โทรศัพท์', status: 'สถานะ', contractNumber: 'เลขสัญญา', principal: 'เงินต้น (สตางค์)', interestRate: 'อัตราดอกเบี้ย', interestAmount: 'ดอกเบี้ย (สตางค์)', netDisbursed: 'ยอดจ่ายสุทธิ (สตางค์)', repayType: 'รูปแบบชำระ', interestMode: 'รูปแบบดอกเบี้ย', installmentMonths: 'จำนวนงวด', periodDays: 'จำนวนวันต่อรอบ', startDate: 'วันเริ่มสัญญา', dueDate: 'วันครบกำหนด', lateFeePerDay: 'ค่าปรับต่อวัน (สตางค์)', lateFeeWaived: 'ยกเว้นค่าปรับ', amount: 'ยอดเงิน (สตางค์)', paidAt: 'วันที่ทำรายการ', method: 'ช่องทาง', receiptNumber: 'เลขที่ใบรับเงิน', interestPaid: 'ดอกเบี้ยที่รับ', penaltyPaid: 'ค่าปรับที่รับ', principalPaid: 'เงินต้นที่รับ' };

function snapshotDiff(beforeData: string | null, afterData: string | null) {
  const parse = (value: string | null): Record<string, unknown> => {
    if (!value) return {};
    try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; }
    catch { return {}; }
  };
  const before = parse(beforeData);
  const after = parse(afterData);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .map(key => ({ key, before: before[key], after: after[key] }));
}

function snapshotValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'string' && statusLabel[value]) return statusLabel[value];
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return dateTimeLabel(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.text();
  let data: unknown;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(response.ok ? fallback : `${fallback} (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `${fallback} (HTTP ${response.status})`;
    throw new Error(message);
  }
  if (data === null) throw new Error(fallback);
  return data as T;
}

export default function LoanLogsPage() {
  const [logs, setLogs] = useState<LoanLog[]>([]);
  const [logQuery, setLogQuery] = useState('');
  const [borrowerQuery, setBorrowerQuery] = useState('');
  const [borrowerOptions, setBorrowerOptions] = useState<Borrower[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractId, setContractId] = useState('');
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/loan-logs', { cache: 'no-store' });
      setLogs(await responseJson<LoanLog[]>(response, 'โหลดบันทึกไม่สำเร็จ'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดบันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadLogs(); }, 0); return () => window.clearTimeout(timer); }, [loadLogs]);

  useEffect(() => {
    if (selectedBorrower || borrowerQuery.trim().length < 2) { setBorrowerOptions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/loan-logs/borrowers?q=${encodeURIComponent(borrowerQuery.trim())}`, { cache: 'no-store', signal: controller.signal });
        if (response.ok) setBorrowerOptions(await responseJson<Borrower[]>(response, 'ค้นหาผู้กู้ไม่สำเร็จ'));
      } catch { /* Search results can be retried by editing the query. */ }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [borrowerQuery, selectedBorrower]);

  useEffect(() => {
    if (!selectedBorrower) { setContracts([]); setContractId(''); return; }
    const controller = new AbortController();
    const loadContracts = async () => {
      try {
        const response = await fetch(`/api/loan-logs/contracts?borrowerId=${encodeURIComponent(selectedBorrower.id)}`, { cache: 'no-store', signal: controller.signal });
        if (response.ok) setContracts(await responseJson<Contract[]>(response, 'โหลดสัญญาไม่สำเร็จ'));
      } catch { /* Contract selection is optional. */ }
    };
    void loadContracts();
    return () => controller.abort();
  }, [selectedBorrower]);

  const filteredLogs = useMemo(() => {
    const query = logQuery.trim().toLocaleLowerCase('th');
    if (!query) return logs;
    return logs.filter(log => [log.action, log.note, log.borrower?.borrowersCode, log.borrower && borrowerName(log.borrower), log.contract?.contractNumber].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(query));
  }, [logQuery, logs]);

  async function saveLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBorrower) { setError('กรุณาเลือกผู้กู้'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/loan-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowerId: selectedBorrower.id, contractId: contractId || null, action, note }),
      });
      await responseJson<LoanLog>(response, 'บันทึกไม่สำเร็จ');
      setAction('');
      setNote('');
      setContractId('');
      setSuccess('บันทึกการทำงานแล้ว');
      await loadLogs();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return <main className="lx-page loan-logs-page"><div className="lx-wrap">
    <div className="lx-crumb"><Link href="/dashboard/loan">ปล่อยสินเชื่อ</Link><span>/</span><span>บันทึกการทำงาน</span></div>
    <header className="lx-head loan-logs-head"><div><span className="loan-logs-kicker"><Activity size={15} aria-hidden="true"/> WORK LOG</span><h1>บันทึกการทำงาน</h1><p>เก็บประวัติการติดตามและการดำเนินงานของผู้กู้ไว้ในที่เดียว</p></div><button className="lx-btn" type="button" onClick={() => void loadLogs()} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>โหลดใหม่</button></header>

    <section className="loan-log-compose lx-panel" aria-labelledby="loan-log-compose-title">
      <div className="loan-log-compose-title"><span><Plus size={18} aria-hidden="true"/></span><div><h2 id="loan-log-compose-title">เพิ่มบันทึกใหม่</h2><p>ระบุผู้กู้และสรุปสิ่งที่ดำเนินการ</p></div></div>
      <form onSubmit={saveLog}>
        <div className="loan-log-form-grid">
          <div className="loan-log-field loan-log-borrower-field"><label htmlFor="loan-log-borrower">ผู้กู้ <b>*</b></label>{selectedBorrower ? <div className="loan-log-selected-borrower"><span className="loan-log-avatar"><UserRound size={17} aria-hidden="true"/></span><span><strong>{borrowerName(selectedBorrower)}</strong><small>{selectedBorrower.borrowersCode}</small></span><button type="button" onClick={() => { setSelectedBorrower(null); setBorrowerQuery(''); }} aria-label="เปลี่ยนผู้กู้">เปลี่ยน</button></div> : <><div className="loan-log-search"><Search size={16} aria-hidden="true"/><input id="loan-log-borrower" value={borrowerQuery} onChange={event => setBorrowerQuery(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสผู้กู้" autoComplete="off" /></div>{borrowerOptions.length > 0 && <div className="loan-log-borrower-options" role="listbox" aria-label="ผลการค้นหาผู้กู้">{borrowerOptions.map(borrower => <button type="button" role="option" aria-selected="false" key={borrower.id} onClick={() => { setSelectedBorrower(borrower); setBorrowerQuery(''); setBorrowerOptions([]); }}><strong>{borrowerName(borrower)}</strong><small>{borrower.borrowersCode}{borrower.nickname ? ` · ${borrower.nickname}` : ''}</small></button>)}</div>}{borrowerQuery.trim().length > 0 && borrowerQuery.trim().length < 2 && <small className="loan-log-field-hint">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</small>}</>}</div>
          <div className="loan-log-field"><label htmlFor="loan-log-contract">สัญญาที่เกี่ยวข้อง</label><select id="loan-log-contract" value={contractId} onChange={event => setContractId(event.target.value)} disabled={!selectedBorrower || contracts.length === 0}><option value="">ไม่ระบุสัญญา</option>{contracts.map(contract => <option value={contract.id} key={contract.id}>{contract.contractNumber} · {statusLabel[contract.status] || contract.status}</option>)}</select><small className="loan-log-field-hint">เลือกได้เมื่อบันทึกเกี่ยวข้องกับสัญญาใดสัญญาหนึ่ง</small></div>
          <div className="loan-log-field"><label htmlFor="loan-log-action">การทำงาน <b>*</b></label><input id="loan-log-action" value={action} onChange={event => setAction(event.target.value)} placeholder="เช่น โทรติดตาม, นัดชำระ, รับเอกสาร" maxLength={100} required /></div>
          <div className="loan-log-field loan-log-note-field"><label htmlFor="loan-log-note">รายละเอียดเพิ่มเติม</label><textarea id="loan-log-note" value={note} onChange={event => setNote(event.target.value)} placeholder="สรุปผลการติดต่อหรือรายละเอียดที่ควรทราบ" rows={3} maxLength={2000}/><small className="loan-log-field-hint">ไม่เกิน 2,000 ตัวอักษร</small></div>
        </div>
        {(error || success) && <p className={`loan-log-message ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>{error ? error : <><Check size={15} aria-hidden="true"/>{success}</>}</p>}
        <div className="loan-log-form-footer"><span><b>*</b> จำเป็นต้องกรอก</span><button className="lx-btn primary" type="submit" disabled={saving || !selectedBorrower || !action.trim()}><Plus size={16} aria-hidden="true"/>{saving ? 'กำลังบันทึก…' : 'บันทึกการทำงาน'}</button></div>
      </form>
    </section>

    <section className="loan-log-history lx-panel" aria-labelledby="loan-log-history-title">
      <div className="loan-log-history-head"><div><h2 id="loan-log-history-title">ประวัติการทำงาน</h2><p>แสดงรายการล่าสุดไม่เกิน 200 รายการ</p></div><label className="loan-log-history-search"><Search size={16} aria-hidden="true"/><span className="sr-only">ค้นหาประวัติ</span><input value={logQuery} onChange={event => setLogQuery(event.target.value)} placeholder="ค้นหาชื่อผู้กู้ การทำงาน หรือสัญญา" /></label></div>
      <div className="loan-log-count">{loading ? 'กำลังโหลด…' : `${filteredLogs.length.toLocaleString('th-TH')} รายการ`}</div>
      {error && !success && <p className="loan-log-message is-error" role="alert">{error}</p>}
      {loading ? <div className="loan-log-empty"><RefreshCw size={20} aria-hidden="true"/><span>กำลังโหลดประวัติ…</span></div> : filteredLogs.length === 0 ? <div className="loan-log-empty"><FileText size={24} aria-hidden="true"/><strong>{logs.length ? 'ไม่พบรายการที่ตรงกับคำค้น' : 'ยังไม่มีบันทึกการทำงาน'}</strong><span>{logs.length ? 'ลองค้นหาด้วยชื่อผู้กู้ การทำงาน หรือเลขสัญญาอื่น' : 'บันทึกแรกของคุณจะแสดงที่นี่'}</span></div> : <div className="loan-log-list">{filteredLogs.map(log => { const changes = snapshotDiff(log.beforeData, log.afterData); return <article className="loan-log-entry" key={log.id}><span className="loan-log-entry-icon"><Activity size={17} aria-hidden="true"/></span><div className="loan-log-entry-body"><div className="loan-log-entry-top"><div><strong>{actionLabel[log.action] || log.action} · {typeLabel[log.type] || log.type}</strong><span className="loan-log-entry-borrower">{log.borrower ? `${log.borrower.borrowersCode} · ${borrowerName(log.borrower)}` : `ผู้กู้ ${log.borrowerId}`}</span></div><time dateTime={log.createdAt}><Clock3 size={14} aria-hidden="true"/>{dateTimeLabel(log.createdAt)}</time></div>{log.note && <p>{log.note}</p>}<div className="loan-log-entry-meta"><span>ผู้บันทึก: {log.userId || 'guest'}</span>{log.contract ? <span><FileText size={13} aria-hidden="true"/>สัญญา {log.contract.contractNumber}</span> : <span>ไม่ระบุสัญญา</span>}</div>{changes.length > 0 && <details className="loan-log-change-details"><summary>ดูข้อมูลก่อนและหลัง</summary><div className="loan-log-change-list">{changes.slice(0, 12).map(change => <div className="loan-log-change-row" key={change.key}><strong>{fieldLabel[change.key] || change.key}</strong><span>{snapshotValue(change.before)}</span><span>{snapshotValue(change.after)}</span></div>)}{changes.length > 12 && <small>แสดง 12 ช่องแรก</small>}</div><div className="loan-log-change-legend"><span>ก่อน</span><span>หลัง</span></div></details>}</div></article>; })}</div>}
    </section>
  </div></main>;
}
