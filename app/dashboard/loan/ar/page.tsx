'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarDays, Clock3, FileText, RefreshCw, Search, UsersRound, Wallet } from 'lucide-react';
import '../lending-ui.css';
import './ar.css';

type Contract = {
  id: string;
  contractNumber: string;
  status: string;
  principal: number;
  startDate: string;
  dueDate: string | null;
  interestRate: number;
  interestRateBasis: string;
  balance: { principal: number; interest: number; penalty: number; total: number; overdueDays: number };
  debtor: { id: string; borrowersCode: string; firstName: string; lastName: string | null; nickname: string | null };
};

type AgingBucket = 'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_PLUS' | 'UNSPECIFIED';
const currency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'ไม่กำหนด';
const fullName = (row: Contract['debtor']) => [row.firstName, row.lastName].filter(Boolean).join(' ') || row.nickname || 'ไม่ระบุชื่อ';
const bangkokDay = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
const dateOnlyOrdinal = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const actualOverdueDays = (dueDate: string | null) => {
  if (!dueDate) return 0;
  const dueDay = bangkokDay(new Date(dueDate));
  return Math.max(0, Math.floor((dateOnlyOrdinal(bangkokDay(new Date())) - dateOnlyOrdinal(dueDay)) / 86_400_000));
};
const creditTermDays = (startDate: string, dueDate: string | null) => {
  if (!dueDate) return null;
  return Math.max(0, Math.floor((dateOnlyOrdinal(bangkokDay(new Date(dueDate))) - dateOnlyOrdinal(bangkokDay(new Date(startDate)))) / 86_400_000));
};
const agingBucket = (dueDate: string | null, days: number): AgingBucket => !dueDate ? 'UNSPECIFIED' : days <= 0 ? 'CURRENT' : days <= 30 ? 'DAYS_1_30' : days <= 60 ? 'DAYS_31_60' : 'DAYS_61_PLUS';
const agingLabel = (dueDate: string | null, days: number) => {
  if (!dueDate) return 'ไม่กำหนดวันชำระ';
  if (days > 0) return `เกินกำหนด ${days.toLocaleString('th-TH')} วัน`;
  return bangkokDay(new Date(dueDate)) === bangkokDay(new Date()) ? 'ครบกำหนดวันนี้' : 'ยังไม่ถึงกำหนด';
};

export default function ARPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [query, setQuery] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/contracts/ar', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดข้อมูลลูกหนี้ไม่สำเร็จ');
      setContracts(data.filter((contract: Contract) => ['ACTIVE', 'OVERDUE'].includes(contract.status) && contract.balance.total > 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลลูกหนี้ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const borrowers = useMemo(() => {
    const unique = new Map<string, Contract['debtor']>();
    contracts.forEach(row => unique.set(row.debtor.id, row.debtor));
    return [...unique.values()].sort((a, b) => fullName(a).localeCompare(fullName(b), 'th'));
  }, [contracts]);

  const matchingBorrowers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('th-TH');
    return borrowers.filter(row => !term || `${fullName(row)} ${row.borrowersCode}`.toLocaleLowerCase('th-TH').includes(term));
  }, [borrowers, query]);

  const filtered = useMemo(() => contracts.filter(row => !borrowerId || row.debtor.id === borrowerId), [borrowerId, contracts]);
  const visibleBorrowerCount = new Set(filtered.map(row => row.debtor.id)).size;
  const totals = useMemo(() => {
    const initial = { total: 0, overdue: 0, current: 0, buckets: { CURRENT: 0, DAYS_1_30: 0, DAYS_31_60: 0, DAYS_61_PLUS: 0, UNSPECIFIED: 0 } as Record<AgingBucket, number> };
    filtered.forEach(row => {
      const days = actualOverdueDays(row.dueDate);
      initial.total += row.balance.total;
      initial.buckets[agingBucket(row.dueDate, days)] += row.balance.total;
      if (days > 0) initial.overdue += row.balance.total;
      else if (row.dueDate) initial.current += row.balance.total;
    });
    return initial;
  }, [filtered]);
  const maxBucket = Math.max(1, ...Object.values(totals.buckets));

  return <main className="lx-page ar-page"><div className="lx-wrap">
    <div className="lx-crumb"><Link href="/dashboard/loan">ปล่อยสินเชื่อ</Link><span>/</span><span>ลูกหนี้การค้า</span></div>
    <header className="lx-head ar-head"><div><span className="ar-eyebrow"><Wallet size={15} aria-hidden="true"/> ACCOUNTS RECEIVABLE</span><h1>ลูกหนี้การค้า (AR)</h1><p>ติดตามยอดคงค้าง กำหนดชำระ และอายุหนี้ของลูกหนี้แต่ละราย</p></div><button className="lx-btn" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>โหลดข้อมูล</button></header>

    {error && <p className="lx-notice error ar-error" role="alert"><AlertCircle size={17} aria-hidden="true"/>{error}</p>}

    <section className="ar-summary" aria-label="สรุปลูกหนี้การค้า">
      <article className="ar-summary-primary"><span>ยอดลูกหนี้คงค้างรวม</span><strong>{loading ? '—' : currency(totals.total)}</strong><small>ยอดเงินต้น ดอกเบี้ย และยอดเพิ่มที่ยังไม่ได้รับชำระ</small></article>
      <article><span><Clock3 size={15} aria-hidden="true"/> เลยกำหนดชำระ</span><strong className="ar-amount-overdue">{loading ? '—' : currency(totals.overdue)}</strong><small>ยอดที่มีวันเกินกำหนดแล้ว</small></article>
      <article><span><CalendarDays size={15} aria-hidden="true"/> ยังไม่ถึงกำหนด</span><strong>{loading ? '—' : currency(totals.current)}</strong><small>ยอดที่ยังอยู่ภายในกำหนดชำระ</small></article>
      <article><span><UsersRound size={15} aria-hidden="true"/> ลูกหนี้ที่มียอดค้าง</span><strong>{loading ? '—' : visibleBorrowerCount.toLocaleString('th-TH')} <small>ราย</small></strong><small>นับเฉพาะสัญญาที่ยังมียอดคงเหลือ</small></article>
    </section>

    <section className="ar-aging lx-panel" aria-label="รายงานอายุหนี้">
      <div className="ar-section-heading"><div><h2>อายุหนี้ (AR Aging)</h2><p>แบ่งตามจำนวนวันที่เกินกำหนดชำระ</p></div><span>{loading ? '—' : `${filtered.length.toLocaleString('th-TH')} สัญญา`}</span></div>
      <div className="ar-aging-grid">
        {([
          ['CURRENT', 'ยังไม่ถึงกำหนด', 'กำหนดชำระวันนี้หรือภายหลัง'],
          ['DAYS_1_30', '1–30 วัน', 'เริ่มติดตามการชำระ'],
          ['DAYS_31_60', '31–60 วัน', 'ควรติดตามใกล้ชิด'],
          ['DAYS_61_PLUS', 'มากกว่า 60 วัน', 'มีความเสี่ยงในการเรียกเก็บ'],
          ['UNSPECIFIED', 'ไม่กำหนดวัน', 'ตรวจสอบวันครบกำหนดในสัญญา'],
        ] as [AgingBucket, string, string][]).map(([key, label, caption]) => <article key={key}>
          <div><span>{label}</span><strong>{loading ? '—' : currency(totals.buckets[key])}</strong></div><small>{caption}</small>
          <div className="ar-meter" aria-hidden="true"><span className="w-[var(--bucket-width)]!" style={{ "--bucket-width": `${loading ? 0 : totals.buckets[key] / maxBucket * 100}%` } as CSSProperties}/></div>
        </article>)}
      </div>
    </section>

    <section className="ar-report lx-panel">
      <div className="ar-section-heading ar-report-heading"><div><h2>รายการลูกหนี้</h2><p>เลือกชื่อลูกหนี้เพื่อดูสัญญาและยอดคงค้างรายสัญญา</p></div></div>
      <div className="ar-toolbar">
        <label className="ar-search"><span>ค้นหาชื่อลูกหนี้</span><div><Search size={17} aria-hidden="true"/><input value={query} onChange={event => { setQuery(event.target.value); setBorrowerId(''); }} placeholder="พิมพ์ชื่อ นามสกุล หรือรหัสลูกหนี้" /></div></label>
        <label className="ar-select"><span>เลือกลูกหนี้</span><select value={borrowerId} onChange={event => setBorrowerId(event.target.value)} disabled={loading || matchingBorrowers.length === 0}><option value="">ลูกหนี้ทั้งหมด ({borrowers.length.toLocaleString('th-TH')} ราย)</option>{matchingBorrowers.map(row => <option value={row.id} key={row.id}>{fullName(row)} · {row.borrowersCode}</option>)}</select></label>
        <span className="ar-result-count">{loading ? 'กำลังโหลด…' : `${filtered.length.toLocaleString('th-TH')} สัญญา`}</span>
      </div>
      <div className="ar-table-wrap"><table className="ar-table"><thead><tr><th>ลูกหนี้</th><th>เลขที่สัญญา</th><th>วันที่เริ่มสัญญา</th><th>ครบกำหนด</th><th>เครดิต</th><th>สถานะอายุหนี้</th><th className="ar-money">ยอดคงค้าง</th></tr></thead><tbody>
        {filtered.map(row => { const days = actualOverdueDays(row.dueDate); const termDays = creditTermDays(row.startDate, row.dueDate); return <tr key={row.id}><td><strong>{fullName(row.debtor)}</strong><span>{row.debtor.borrowersCode}</span></td><td><strong>{row.contractNumber}</strong><span>สินเชื่อ · {row.interestRate}% {row.interestRateBasis === 'MONTHLY_FLAT' ? 'ต่อเดือน' : 'ต่อสัญญา'}</span></td><td>{dateLabel(row.startDate)}</td><td>{dateLabel(row.dueDate)}</td><td>{termDays === null ? '—' : `${termDays.toLocaleString('th-TH')} วัน`}</td><td><span className={`ar-aging-badge ${days > 0 ? 'late' : ''}`}>{agingLabel(row.dueDate, days)}</span></td><td className="ar-money"><strong>{currency(row.balance.total)}</strong><span>ต้น {currency(row.balance.principal)} · ดอก/ยอดเพิ่ม {currency(row.balance.interest + row.balance.penalty)}</span></td></tr>; })}
      </tbody></table>
      {!loading && !error && filtered.length === 0 && <div className="ar-empty"><FileText size={25} aria-hidden="true"/><strong>{contracts.length ? 'ไม่พบลูกหนี้ที่ตรงกับการค้นหา' : 'ยังไม่มีลูกหนี้คงค้าง'}</strong><span>{contracts.length ? 'ลองค้นหาด้วยชื่อหรือล้างตัวเลือกลูกหนี้' : 'สัญญาที่ยังมียอดคงเหลือจะแสดงที่นี่'}</span></div>}
      </div>
      <div className="ar-footnotes"><p><strong>เงื่อนไขเครดิต:</strong> ระบบแสดงวันเริ่มสัญญาและวันครบกำหนดตามข้อมูลสัญญา ระยะเวลาเครดิตคำนวณจากสองวันดังกล่าว</p><p><strong>ลูกหนี้สุทธิ:</strong> ยังไม่มีข้อมูลค่าเผื่อหนี้สงสัยจะสูญในระบบ ยอดข้างต้นจึงเป็นยอดคงค้างก่อนหักค่าเผื่อ</p></div>
    </section>
  </div></main>;
}
