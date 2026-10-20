'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Clock3, FileCheck2, RefreshCw, Search, Upload } from 'lucide-react';
import '../lending-ui.css';
import './approvals.css';

type ContractRow = {
  id: string;
  contractNumber: string;
  status: string;
  principal: number;
  startDate: string;
  dueDate: string | null;
  updatedAt: string;
  signatureMode: string;
  debtor?: {
    borrowersCode: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
  };
};

type QueueFilter = 'ACTION' | 'AWAITING_DOCUMENT' | 'READY' | 'ALL';

const statusLabels: Record<string, string> = {
  DRAFT: 'ร่าง',
  RESERVED: 'จองสัญญา',
  AWAITING_DOCUMENT: 'รอเอกสารลงนาม',
  READY: 'พร้อมจ่ายเงิน',
  ACTIVE: 'กำลังดำเนินการ',
  OVERDUE: 'เกินกำหนดชำระ',
  CLOSED: 'ปิดสัญญา',
};

const statusClasses: Record<string, string> = {
  AWAITING_DOCUMENT: 'is-waiting',
  RESERVED: 'is-reserved',
  READY: 'is-ready',
  ACTIVE: 'is-active',
  OVERDUE: 'is-overdue',
  CLOSED: 'is-closed',
};

const baht = (satang: number) => new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', maximumFractionDigits: 2,
}).format(satang / 100);

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value))
  : '—';

function borrowerName(row: ContractRow) {
  const borrower = row.debtor;
  if (!borrower) return 'ไม่พบข้อมูลผู้กู้';
  return [borrower.firstName, borrower.lastName].filter(Boolean).join(' ') || borrower.nickname || 'ไม่ระบุชื่อ';
}

export default function Approvals() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('ACTION');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef('');

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/contracts/list', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดรายการสัญญาไม่สำเร็จ');
      setContracts(Array.isArray(data) ? data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการสัญญาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadContracts(); }, 0); return () => window.clearTimeout(timer); }, [loadContracts]);

  const counts = useMemo(() => ({
    awaiting: contracts.filter(row => row.status === 'AWAITING_DOCUMENT').length,
    ready: contracts.filter(row => row.status === 'READY').length,
    active: contracts.filter(row => ['ACTIVE', 'OVERDUE'].includes(row.status)).length,
  }), [contracts]);

  const visibleContracts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('th-TH');
    return contracts.filter(row => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'ACTION' && ['AWAITING_DOCUMENT', 'READY'].includes(row.status))
        || row.status === filter;
      const matchesQuery = !term || `${row.contractNumber} ${row.debtor?.borrowersCode || ''} ${borrowerName(row)}`
        .toLocaleLowerCase('th-TH').includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [contracts, filter, query]);

  async function uploadSignedDocument(file?: File) {
    const id = uploadTarget.current;
    uploadTarget.current = '';
    if (!file || !id) return;
    setUploadingId(id);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/contracts/${encodeURIComponent(id)}/signed-document`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'แนบเอกสารไม่สำเร็จ');
      setMessage('แนบเอกสารที่ลงนามแล้ว และย้ายสัญญาไปสถานะพร้อมจ่ายเงิน');
      await loadContracts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'แนบเอกสารไม่สำเร็จ');
    } finally {
      setUploadingId('');
    }
  }

  const tabs: { key: QueueFilter; label: string; count: number }[] = [
    { key: 'ACTION', label: 'ต้องดำเนินการ', count: counts.awaiting + counts.ready },
    { key: 'AWAITING_DOCUMENT', label: 'รอเอกสารลงนาม', count: counts.awaiting },
    { key: 'READY', label: 'พร้อมจ่ายเงิน', count: counts.ready },
    { key: 'ALL', label: 'สัญญาทั้งหมด', count: contracts.length },
  ];

  return <main className="lx-page approvals-page">
    <div className="lx-wrap">
      <header className="lx-head approvals-head">
        <div>
          <div className="approvals-eyebrow"><FileCheck2 size={15} /> สินเชื่อ</div>
          <h1>พิจารณาสัญญา</h1>
          <p>ตรวจเอกสารที่ลงนามแล้วและติดตามสัญญาที่พร้อมจ่ายเงิน</p>
        </div>
        <div className="approvals-head-actions">
          <button className="lx-btn" type="button" onClick={() => void loadContracts()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'lx-spin' : ''} /> รีเฟรช
          </button>
          <Link className="lx-btn primary" href="/dashboard/loan/contracts">ดูสัญญาทั้งหมด <ArrowUpRight size={16} /></Link>
        </div>
      </header>

      <section className="approvals-summary" aria-label="สรุปสถานะสัญญา">
        <article className="approvals-summary-card pending">
          <span className="approvals-summary-icon"><Clock3 size={18} /></span>
          <div><span>รอเอกสารลงนาม</span><strong>{counts.awaiting}</strong><small>ต้องแนบสำเนาสัญญาที่ลงนามแล้ว</small></div>
        </article>
        <article className="approvals-summary-card ready">
          <span className="approvals-summary-icon"><Check size={18} /></span>
          <div><span>พร้อมจ่ายเงิน</span><strong>{counts.ready}</strong><small>เอกสารครบและตรวจสอบแล้ว</small></div>
        </article>
        <article className="approvals-summary-card active">
          <span className="approvals-summary-icon"><FileCheck2 size={18} /></span>
          <div><span>จ่ายเงินแล้ว</span><strong>{counts.active}</strong><small>กำลังดำเนินการหรือเกินกำหนด</small></div>
        </article>
      </section>

      {error && <p className="lx-notice error" role="alert">{error}</p>}
      {message && <p className="lx-notice approvals-success" role="status">{message}</p>}

      <section className="lx-panel approvals-list-panel">
        <div className="approvals-list-heading">
          <div><h2>รายการสัญญา</h2><p>เลือกสัญญาเพื่อจัดการขั้นตอนถัดไป</p></div>
          <label className="approvals-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">ค้นหาเลขสัญญาหรือผู้กู้</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา / รหัสผู้กู้ / ชื่อ" />
          </label>
        </div>
        <div className="approvals-tabs" role="tablist" aria-label="กรองสัญญาตามสถานะ">
          {tabs.map(tab => <button key={tab.key} type="button" role="tab" aria-selected={filter === tab.key}
            className={filter === tab.key ? 'selected' : ''} onClick={() => setFilter(tab.key)}>
            {tab.label}<span>{tab.count}</span>
          </button>)}
        </div>

        <input ref={fileInput} className="approvals-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={event => { void uploadSignedDocument(event.target.files?.[0]); event.target.value = ''; }} />

        {loading ? <div className="approvals-state" role="status">กำลังโหลดรายการสัญญา…</div>
          : visibleContracts.length === 0 ? <div className="approvals-state">
            <span className="approvals-empty-icon"><FileCheck2 size={22} /></span>
            <strong>{query ? 'ไม่พบสัญญาที่ตรงกับคำค้น' : filter === 'ACTION' ? 'ไม่มีสัญญาที่ต้องดำเนินการ' : 'ไม่พบสัญญาในสถานะนี้'}</strong>
            <span>{query ? 'ลองค้นหาด้วยเลขสัญญา รหัสผู้กู้ หรือชื่อผู้กู้' : 'รายการสัญญาจะปรากฏที่นี่เมื่อมีข้อมูล'}</span>
          </div> : <div className="approvals-table-wrap">
            <table className="lx-table approvals-table">
              <thead><tr><th>เลขสัญญา</th><th>ผู้กู้</th><th>เงินต้น</th><th>เริ่มสัญญา / ครบกำหนด</th><th>สถานะ</th><th><span className="sr-only">การจัดการ</span></th></tr></thead>
              <tbody>{visibleContracts.map(row => <tr key={row.id}>
                <td><strong className="approvals-contract-number">{row.contractNumber || '—'}</strong><small>แก้ไข {dateLabel(row.updatedAt)}</small></td>
                <td><strong>{borrowerName(row)}</strong><small>{row.debtor?.borrowersCode || '—'}</small></td>
                <td className="approvals-money">{baht(row.principal)}</td>
                <td><span>{dateLabel(row.startDate)}</span><small>ครบกำหนด {dateLabel(row.dueDate)}</small></td>
                <td><span className={`lx-contract-status ${statusClasses[row.status] || 'is-draft'}`}>{statusLabels[row.status] || row.status}</span></td>
                <td className="approvals-action-cell">{row.status === 'AWAITING_DOCUMENT' && row.signatureMode === 'PRINT'
                  ? <button className="lx-btn sm approvals-upload" type="button" disabled={!!uploadingId}
                    onClick={() => { uploadTarget.current = row.id; fileInput.current?.click(); }}>
                    <Upload size={15} /> {uploadingId === row.id ? 'กำลังแนบ…' : 'แนบเอกสาร'}
                  </button>
                  : row.status === 'READY'
                    ? <Link className="lx-btn sm" href="/dashboard/loan/contracts">ดูสัญญา</Link>
                    : <span className="approvals-no-action">—</span>}
                </td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>
      <p className="approvals-footnote">รองรับไฟล์ JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 10 MB</p>
    </div>
  </main>;
}
