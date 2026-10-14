'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Download, RefreshCw, Phone, MessageCircle } from 'lucide-react';
import '../lending-ui.css';
import './overdue.css';

type OverdueContract = {
  id: string;
  contractNumber: string;
  dueDate: string | null;
  principal: number;
  balance: { total: number; overdueDays: number };
  debtor: {
    borrowersCode: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
    phone: string;
    line: string | null;
  };
};

type PeriodFilter = 'ALL' | 'WEEK' | 'MONTH' | 'OLDER';
const baht = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value / 100);
const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value))
  : '—';
const borrowerName = (row: OverdueContract) => [row.debtor.firstName, row.debtor.lastName].filter(Boolean).join(' ') || row.debtor.nickname || '—';

function csvCell(value: string | number) {
  const safe = String(value).replace(/[\r\n]+/g, ' ').replace(/^([\s]*[=+@\-])/, "'$1");
  return `"${safe.replaceAll('"', '""')}"`;
}

export default function OverduePage() {
  const [rows, setRows] = useState<OverdueContract[]>([]);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/contracts/overdue', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดรายการเกินกำหนดไม่สำเร็จ');
      setRows(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการเกินกำหนดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('th');
    return rows.filter(row => {
      const searchable = [row.contractNumber, row.debtor.borrowersCode, borrowerName(row), row.debtor.nickname, row.debtor.phone, row.debtor.line]
        .filter(Boolean).join(' ').toLocaleLowerCase('th');
      const matchesQuery = !term || searchable.includes(term);
      const days = row.balance.overdueDays;
      const matchesPeriod = period === 'ALL' || (period === 'WEEK' && days <= 7) || (period === 'MONTH' && days > 7 && days <= 30) || (period === 'OLDER' && days > 30);
      return matchesQuery && matchesPeriod;
    });
  }, [period, query, rows]);

  const totalOutstanding = filtered.reduce((sum, row) => sum + row.balance.total, 0);

  function exportCsv() {
    const header = ['เลขสัญญา', 'รหัสผู้กู้', 'ชื่อผู้กู้', 'โทรศัพท์', 'LINE', 'วันครบกำหนด', 'เกินกำหนด (วัน)', 'ยอดคงเหลือ (บาท)'];
    const content = [header, ...filtered.map(row => [row.contractNumber, row.debtor.borrowersCode, borrowerName(row), row.debtor.phone, row.debtor.line || '', dateLabel(row.dueDate), row.balance.overdueDays, (row.balance.total / 100).toFixed(2)])]
      .map(line => line.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `overdue-loans-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="lx-page overdue-page"><div className="lx-wrap">
    <div className="lx-crumb"><Link href="/dashboard/loan">ปล่อยสินเชื่อ</Link><span>/</span><span>ติดตามหนี้</span></div>
    <header className="lx-head overdue-head"><div><h1>ค้างชำระ</h1><p>รายงานสัญญาที่เกินกำหนด พร้อมข้อมูลสำหรับติดต่อลูกหนี้</p></div><div className="overdue-actions"><button className="lx-btn" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>โหลดใหม่</button><button className="lx-btn primary" type="button" onClick={exportCsv} disabled={loading || filtered.length === 0}><Download size={16} aria-hidden="true"/>ส่งออกรายงาน CSV</button></div></header>

    <section className="overdue-summary" aria-label="สรุปรายการค้างชำระ">
      <article><span>สัญญาเกินกำหนด</span><strong>{loading ? '—' : rows.length.toLocaleString('th-TH')} <small>สัญญา</small></strong></article>
      <article><span>ยอดคงเหลือตามผลค้นหา</span><strong>{loading ? '—' : baht(totalOutstanding)}</strong></article>
      <article><span>เกินกำหนดมากที่สุด</span><strong>{loading || rows.length === 0 ? '—' : `${Math.max(...rows.map(row => row.balance.overdueDays)).toLocaleString('th-TH')} <small>วัน</small>`}</strong></article>
    </section>

    <section className="lx-panel overdue-report">
      <div className="overdue-toolbar">
        <label className="overdue-search"><Search size={18} aria-hidden="true"/><span className="sr-only">ค้นหาสัญญา ผู้กู้ หรือข้อมูลติดต่อ</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา ชื่อ รหัส โทรศัพท์ หรือ LINE" /></label>
        <label className="overdue-period"><span>ระยะเวลาเกินกำหนด</span><select value={period} onChange={event => setPeriod(event.target.value as PeriodFilter)}><option value="ALL">ทุกช่วงเวลา</option><option value="WEEK">1–7 วัน</option><option value="MONTH">8–30 วัน</option><option value="OLDER">มากกว่า 30 วัน</option></select></label>
        <span className="overdue-result-count">{loading ? 'กำลังโหลด…' : `${filtered.length.toLocaleString('th-TH')} รายการ`}</span>
      </div>
      {error && <p className="overdue-error" role="alert">{error}</p>}
      <div className="overdue-table-wrap"><table className="overdue-table"><thead><tr><th>สัญญา / ผู้กู้</th><th>ข้อมูลติดต่อ</th><th>ครบกำหนด</th><th>เกินกำหนด</th><th className="amount-col">ยอดคงเหลือ</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.id}>
          <td><strong>{row.contractNumber}</strong><span>{row.debtor.borrowersCode} · {borrowerName(row)}</span></td>
          <td><div className="overdue-contact"><a href={`tel:${row.debtor.phone}`}><Phone size={14} aria-hidden="true"/>{row.debtor.phone || 'ไม่มีเบอร์โทร'}</a>{row.debtor.line && <span><MessageCircle size={14} aria-hidden="true"/>LINE: {row.debtor.line}</span>}</div></td>
          <td>{dateLabel(row.dueDate)}</td><td><span className="overdue-days">{row.balance.overdueDays.toLocaleString('th-TH')} วัน</span></td><td className="amount-col"><strong>{baht(row.balance.total)}</strong></td>
        </tr>)}
      </tbody></table>
      {!loading && !error && filtered.length === 0 && <div className="overdue-empty"><strong>{rows.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีสัญญาเกินกำหนด'}</strong><span>{rows.length ? 'ลองเปลี่ยนคำค้นหาหรือช่วงเวลา' : 'สัญญาที่เลยวันครบกำหนดและมียอดคงเหลือจะแสดงที่นี่'}</span></div>}
      </div>
    </section>
  </div></main>;
}
