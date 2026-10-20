'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, FileText, RefreshCw, Search } from 'lucide-react';
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
type LoanLog = {
  id: string;
  userId: string;
  actorName: string;
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
  const [typeFilter, setTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const filteredLogs = useMemo(() => {
    const query = logQuery.trim().toLocaleLowerCase('th');
    return logs.filter(log => {
      const matchesQuery = !query || [log.action, log.note, log.actorName, log.borrower?.borrowersCode, log.borrower && borrowerName(log.borrower), log.contract?.contractNumber].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(query);
      return matchesQuery && (!typeFilter || log.type === typeFilter) && (!actionFilter || log.action === actionFilter);
    });
  }, [actionFilter, logQuery, logs, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const availableTypes = [...new Set(logs.map(log => log.type))];
  const availableActions = [...new Set(logs.map(log => log.action))];



  return <main className="lx-page loan-logs-page"><div className="lx-wrap">
    <div className="lx-crumb"><Link href="/dashboard/loan">ปล่อยสินเชื่อ</Link><span>/</span><span>บันทึกการทำงาน</span></div>
    <header className="lx-head loan-logs-head"><div><span className="loan-logs-kicker"><Activity size={15} aria-hidden="true"/> WORK LOG</span><h1>บันทึกการทำงาน</h1><p>ระบบบันทึกอัตโนมัติเมื่อเพิ่ม แก้ไข หรือลบข้อมูลสินเชื่อ</p></div><button className="lx-btn" type="button" onClick={() => void loadLogs()} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>โหลดใหม่</button></header>

    <section className="loan-log-history lx-panel" aria-labelledby="loan-log-history-title">
      <div className="loan-log-history-head"><div><h2 id="loan-log-history-title">ประวัติการทำงาน</h2><p>ค้นหาและกรองประวัติที่บันทึกโดยผู้ใช้</p></div><label className="loan-log-history-search"><Search size={16} aria-hidden="true"/><span className="sr-only">ค้นหาประวัติ</span><input value={logQuery} onChange={event => { setLogQuery(event.target.value); setPage(1); }} placeholder="ค้นหาผู้บันทึก ผู้กู้ การทำงาน หรือสัญญา" /></label></div>
      <div className="loan-log-filters"><label>ประเภท<select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1); }}><option value="">ทุกประเภท</option>{availableTypes.map(value => <option key={value} value={value}>{typeLabel[value] || value}</option>)}</select></label><label>การทำงาน<select value={actionFilter} onChange={event => { setActionFilter(event.target.value); setPage(1); }}><option value="">ทุกการทำงาน</option>{availableActions.map(value => <option key={value} value={value}>{actionLabel[value] || value}</option>)}</select></label><label>รายการต่อหน้า<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option></select></label><span className="loan-log-count">{loading ? 'กำลังโหลด…' : `${filteredLogs.length.toLocaleString('th-TH')} รายการ`}</span></div>
      {error && <p className="loan-log-message is-error" role="alert">{error}</p>}
      {loading ? <div className="loan-log-empty"><RefreshCw size={20} aria-hidden="true"/><span>กำลังโหลดประวัติ…</span></div> : filteredLogs.length === 0 ? <div className="loan-log-empty"><FileText size={24} aria-hidden="true"/><strong>{logs.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีบันทึกการทำงาน'}</strong><span>{logs.length ? 'ลองปรับคำค้นหรือเลือกตัวกรองอื่น' : 'บันทึกแรกของคุณจะแสดงที่นี่'}</span></div> : <><div className="loan-log-table-wrap"><table className="loan-log-table"><thead><tr><th>วันที่และเวลา</th><th>รายการ</th><th>ผู้กู้ / สัญญา</th><th>รายละเอียด</th><th>ผู้บันทึก</th></tr></thead><tbody>{pageLogs.map(log => { const changes = snapshotDiff(log.beforeData, log.afterData); return <tr key={log.id}><td><time dateTime={log.createdAt}>{dateTimeLabel(log.createdAt)}</time></td><td><span className={`loan-log-action-badge action-${log.action.toLowerCase()}`}>{actionLabel[log.action] || log.action}</span><small className="loan-log-type-label">{typeLabel[log.type] || log.type}</small></td><td><strong className="loan-log-table-borrower">{log.borrower ? `${log.borrower.borrowersCode} · ${borrowerName(log.borrower)}` : `ผู้กู้ ${log.borrowerId}`}</strong><small>{log.contract ? `สัญญา ${log.contract.contractNumber}` : 'ไม่ระบุสัญญา'}</small></td><td className="loan-log-table-note">{log.note || '—'}{changes.length > 0 && <details className="loan-log-change-details"><summary>ดูความเปลี่ยนแปลง ({changes.length})</summary><div className="loan-log-change-list">{changes.slice(0, 12).map(change => <div className="loan-log-change-row" key={change.key}><strong>{fieldLabel[change.key] || change.key}</strong><span>{snapshotValue(change.before)}</span><span>{snapshotValue(change.after)}</span></div>)}{changes.length > 12 && <small>แสดง 12 ช่องแรก</small>}</div><div className="loan-log-change-legend"><span>ก่อน</span><span>หลัง</span></div></details>}</td><td>{log.actorName || 'ไม่ระบุผู้ใช้'}</td></tr>; })}</tbody></table></div><div className="loan-log-pagination"><span>แสดง {((currentPage - 1) * pageSize + 1).toLocaleString('th-TH')}–{Math.min(currentPage * pageSize, filteredLogs.length).toLocaleString('th-TH')} จาก {filteredLogs.length.toLocaleString('th-TH')} รายการ</span><div><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage <= 1}>ย้อนกลับ</button><span>หน้า {currentPage} / {pageCount}</span><button type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount}>ถัดไป</button></div></div></>}
    </section>
  </div></main>;
}
