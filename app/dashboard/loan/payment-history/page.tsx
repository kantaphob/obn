'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Clock3, FileText, RefreshCw, Search } from 'lucide-react';

type Receipt = {
  id: string;
  receiptNumber: string;
  paidAt: string;
  createdAt: string;
  amount: number;
  interestPaid: number;
  penaltyPaid: number;
  principalPaid: number;
  principalRemaining: number;
  interestRemaining: number;
  penaltyRemaining: number;
  totalRemaining: number;
  method: string;
  evidenceUrl: string | null;
  note: string | null;
};

type LegacyPayment = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  reference: string;
  note: string;
};

type Contract = {
  id: string;
  contractNumber: string;
  status: string;
  repayments: Receipt[];
  legacyPayments: LegacyPayment[];
  debtor: {
    borrowersCode: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
  };
};

type HistoryRow = {
  id: string;
  contractNumber: string;
  date: string;
  title: string;
  amount: number;
  interestPaid: number | null;
  penaltyPaid: number | null;
  principalPaid: number | null;
  totalRemaining: number | null;
  receipt: Receipt | null;
  reference: string;
};

const baht = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value / 100);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value));
const borrowerName = (contract: Contract) => [contract.debtor.firstName, contract.debtor.lastName].filter(Boolean).join(' ') || contract.debtor.nickname || 'ไม่ระบุชื่อ';

export default function PaymentHistoryPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [query, setQuery] = useState('');
  const [selectedBorrowerCode, setSelectedBorrowerCode] = useState('');
  const [preview, setPreview] = useState<Receipt | null>(null);
  const [receiptContract, setReceiptContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/repayments?date=${today()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดประวัติไม่สำเร็จ');
      setContracts(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดประวัติไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const borrowers = useMemo(() => {
    const byCode = new Map<string, Contract>();
    for (const contract of contracts) {
      if (!byCode.has(contract.debtor.borrowersCode)) byCode.set(contract.debtor.borrowersCode, contract);
    }
    return [...byCode.values()];
  }, [contracts]);
  const filteredBorrowers = borrowers.filter((contract) =>
    `${contract.debtor.borrowersCode} ${contract.debtor.firstName} ${contract.debtor.lastName || ''} ${contract.debtor.nickname || ''}`
      .toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')));
  const selectedBorrower = borrowers.find((contract) => contract.debtor.borrowersCode === selectedBorrowerCode);
  const borrowerContracts = contracts.filter((contract) => contract.debtor.borrowersCode === selectedBorrowerCode);
  const historyRows = useMemo(() => borrowerContracts.flatMap((contract): HistoryRow[] => [
    ...contract.repayments.map((receipt) => ({
      id: receipt.id,
      contractNumber: contract.contractNumber,
      date: receipt.paidAt,
      title: receipt.receiptNumber,
      amount: receipt.amount,
      interestPaid: receipt.interestPaid,
      penaltyPaid: receipt.penaltyPaid,
      principalPaid: receipt.principalPaid,
      totalRemaining: receipt.totalRemaining,
      receipt,
      reference: '',
    })),
    ...contract.legacyPayments.map((entry) => ({
      id: entry.id,
      contractNumber: contract.contractNumber,
      date: entry.transactionDate,
      title: entry.title,
      amount: entry.amount,
      interestPaid: null,
      penaltyPaid: null,
      principalPaid: null,
      totalRemaining: null,
      receipt: null,
      reference: entry.reference || entry.note || '',
    })),
  ]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [borrowerContracts]);

  return <main className="loan-payment-page loan-payment-history-page">
    <header className="payment-header">
      <div><span className="payment-eyebrow"><Clock3 size={15}/> LOAN PAYMENT HISTORY</span><h1>ประวัติการชำระ</h1><p>ค้นหาผู้กู้เพื่อดูรายการรับชำระทั้งหมดจากทุกสัญญา</p></div>
      <div className="payment-header-actions"><Link href="/dashboard/loan/payments">รับชำระ</Link><button type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={16}/> โหลดใหม่</button></div>
    </header>
    {error && <p className="loan-payment-error" role="alert">{error}</p>}
    <section className="loan-payment-card payment-archive-search">
      <div className="payment-step"><span className="payment-archive-icon"><Clock3 size={17}/></span><div><h2>ค้นหาผู้กู้</h2><p>ค้นหาด้วยชื่อหรือรหัสผู้กู้ แล้วเลือกผู้กู้เพื่อดูประวัติทุกสัญญา</p></div><strong>{loading ? '…' : `${borrowers.length.toLocaleString('th-TH')} ผู้กู้`}</strong></div>
      <div className="payment-picker-fields">
        <label className="payment-search"><span>ชื่อหรือรหัสผู้กู้</span><div><Search size={18}/><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedBorrowerCode(''); setPreview(null); setReceiptContract(null); }} placeholder="พิมพ์ชื่อ นามสกุล หรือรหัสผู้กู้" /></div></label>
        <label className="payment-select"><span>ผู้กู้ที่พบ</span><div><select value={selectedBorrowerCode} disabled={loading || filteredBorrowers.length === 0} onChange={(event) => { setSelectedBorrowerCode(event.target.value); setPreview(null); setReceiptContract(null); }}><option value="">{loading ? 'กำลังโหลดประวัติ…' : filteredBorrowers.length === 0 ? 'ไม่พบผู้กู้ที่ตรงกับคำค้น' : 'เลือกผู้กู้เพื่อดูประวัติ'}</option>{filteredBorrowers.map((item) => <option value={item.debtor.borrowersCode} key={item.debtor.borrowersCode}>{item.debtor.borrowersCode} · {borrowerName(item)}</option>)}</select><ChevronDown size={18}/></div></label>
      </div>
    </section>
    {selectedBorrower && <section className="loan-payment-card payment-history-card">
      <div className="payment-contract-heading"><div><span className="payment-section-label">ประวัติการชำระของผู้กู้</span><h2>{borrowerName(selectedBorrower)}</h2><p>{selectedBorrower.debtor.borrowersCode} <span>·</span> {borrowerContracts.length.toLocaleString('th-TH')} สัญญา</p></div></div>
      <div className="payment-archive-count">รายการรับชำระทั้งหมด {historyRows.length.toLocaleString('th-TH')} รายการ</div>
      {historyRows.length > 0 && <div className="loan-payment-history"><table><thead><tr><th>วันที่</th><th>สัญญา</th><th>รายการ / เลขที่ใบรับชำระ</th><th>ยอดรับชำระ</th><th>ตัดดอก</th><th>ตัดยอดเพิ่ม</th><th>ตัดเงินต้น</th><th>คงเหลือ</th><th>เอกสาร</th></tr></thead><tbody>{historyRows.map((row) => <tr key={`${row.contractNumber}-${row.id}`}><td>{dateLabel(row.date)}</td><td>{row.contractNumber}</td><td>{row.title}</td><td><strong>{baht(row.amount)}</strong></td><td>{row.interestPaid === null ? '—' : baht(row.interestPaid)}</td><td>{row.penaltyPaid === null ? '—' : baht(row.penaltyPaid)}</td><td>{row.principalPaid === null ? '—' : baht(row.principalPaid)}</td><td>{row.totalRemaining === null ? '—' : baht(row.totalRemaining)}</td><td>{row.receipt ? <><button type="button" onClick={() => { setPreview(row.receipt); setReceiptContract(borrowerContracts.find((contract) => contract.contractNumber === row.contractNumber) ?? null); }}><FileText size={15}/> ใบรับชำระ</button>{row.receipt.evidenceUrl && <a href={row.receipt.evidenceUrl} target="_blank" rel="noreferrer">ไฟล์แนบ</a>}</> : row.reference || 'รายการเดิม'}</td></tr>)}</tbody></table></div>}
      {historyRows.length === 0 && <p className="payment-history-empty">ไม่พบรายการรับชำระของผู้กู้รายนี้ในทุกสัญญา</p>}
    </section>}
    {preview && receiptContract && <section className="loan-payment-receipt loan-payment-card"><h2>ใบรับชำระเงิน</h2><p>{preview.receiptNumber}</p><p>สัญญา {receiptContract.contractNumber} · ผู้กู้ {receiptContract.debtor.borrowersCode}</p><p>วันที่รับชำระ {dateLabel(preview.paidAt)} · {preview.method === 'CASH' ? 'เงินสด' : 'โอนเงิน'}</p><dl>{[['ยอดรับชำระ', preview.amount], ['ตัดดอกเบี้ย', preview.interestPaid], ['ตัดยอดเพิ่มหลังครบกำหนด', preview.penaltyPaid], ['ตัดเงินต้น', preview.principalPaid], ['เงินต้นคงเหลือ', preview.principalRemaining], ['ดอกเบี้ยคงเหลือ', preview.interestRemaining], ['ยอดเพิ่มคงเหลือ', preview.penaltyRemaining], ['ยอดคงเหลือทั้งหมด', preview.totalRemaining]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{baht(Number(value))}</dd></div>)}</dl><p>{preview.note}</p><p>บันทึกเมื่อ {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(preview.createdAt))}</p><div className="loan-receipt-actions"><button type="button" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button type="button" onClick={() => setPreview(null)}>ปิดใบรับชำระ</button></div></section>}
  </main>;
}
