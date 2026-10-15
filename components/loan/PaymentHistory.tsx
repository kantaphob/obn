'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Paperclip, RefreshCw, Search, UserRound, X, ChevronDown } from 'lucide-react';
import '@/app/dashboard/loan/payment-history/payment-history.css';
import { useTrackedFetch } from '@/components/ui/ToastProvider';
import LoanReceipt from '@/components/loan/LoanReceipt';
import { formatBorrowerCode } from '@/lib/borrower-code';

type Receipt = {
  id: string;
  receiptNumber: string;
  paidAt: string;
  timeRecorded: boolean;
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
  receiptBranch: { name: string; companyName: string; taxId: string; address: string; phone: string } | null;
  repayments: Receipt[];
  legacyPayments: LegacyPayment[];
  debtor: {
    borrowersCode: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
    address: string | null;
    houseNumber: string | null;
  };
};

type Entry = {
  id: string;
  contractNumber: string;
  date: string;
  timeRecorded: boolean;
  title: string;
  amount: number;
  receipt: Receipt | null;
  reference: string;
};

const TZ = 'Asia/Bangkok';
const baht = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value / 100);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, dateStyle: 'medium' }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const dayOf = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, day: 'numeric' }).format(new Date(value));
const monthShort = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, month: 'short' }).format(new Date(value));
const monthKey = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(new Date(value));
const monthTitle = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, month: 'long', year: 'numeric' }).format(new Date(value));
const borrowerName = (contract: Contract) =>
  [contract.debtor.firstName, contract.debtor.lastName].filter(Boolean).join(' ') || contract.debtor.nickname || 'ไม่ระบุชื่อ';

export default function PaymentHistory({ onReceivePayment, revision = 0 }: {
  onReceivePayment?: (borrowerCode: string, contractId?: string) => void;
  revision?: number;
}) {
  const trackedFetch = useTrackedFetch();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [openId, setOpenId] = useState('');
  const [preview, setPreview] = useState<{ receipt: Receipt; contract: Contract } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await trackedFetch(`/api/repayments?date=${today()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดประวัติไม่สำเร็จ');
      setContracts(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดประวัติไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [trackedFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const borrowers = useMemo(() => {
    const byCode = new Map<string, { sample: Contract; count: number }>();
    for (const contract of contracts) {
      const code = contract.debtor.borrowersCode;
      const found = byCode.get(code);
      if (found) found.count += 1;
      else byCode.set(code, { sample: contract, count: 1 });
    }
    return [...byCode.values()];
  }, [contracts]);

  const needle = query.trim().toLocaleLowerCase('th-TH');
  const filteredBorrowers = borrowers.filter(({ sample }) =>
    `${sample.debtor.borrowersCode} ${sample.debtor.firstName} ${sample.debtor.lastName || ''} ${sample.debtor.nickname || ''}`
      .toLocaleLowerCase('th-TH')
      .includes(needle),
  );

  const activeCode = selectedCode || filteredBorrowers[0]?.sample.debtor.borrowersCode || '';
  const selected = filteredBorrowers.find(({ sample }) => sample.debtor.borrowersCode === activeCode)?.sample;
  const borrowerContracts = contracts.filter(contract => contract.debtor.borrowersCode === activeCode);

  const entries = (() => {
    const list: Entry[] = borrowerContracts
      .filter((contract) => !contractFilter || contract.contractNumber === contractFilter)
      .flatMap((contract): Entry[] => [
        ...contract.repayments.map((receipt) => ({
          id: receipt.id,
          contractNumber: contract.contractNumber,
          date: receipt.paidAt,
          timeRecorded: receipt.timeRecorded,
          title: receipt.receiptNumber,
          amount: receipt.amount,
          receipt,
          reference: '',
        })),
        ...(contract.legacyPayments || []).map((entry) => ({
          id: entry.id,
          contractNumber: contract.contractNumber,
          date: entry.transactionDate,
          timeRecorded: false,
          title: entry.title,
          amount: entry.amount,
          receipt: null,
          reference: entry.reference || entry.note || '',
        })),
      ]);
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.id.localeCompare(b.id));
  })();

  const groups = (() => {
    const map = new Map<string, { label: string; total: number; items: Entry[] }>();
    for (const entry of entries) {
      const key = monthKey(entry.date);
      const group = map.get(key) ?? { label: monthTitle(entry.date), total: 0, items: [] };
      group.total += entry.amount;
      group.items.push(entry);
      map.set(key, group);
    }
    return [...map.entries()];
  })();

  const totalPaid = entries.reduce((sum, entry) => sum + entry.amount, 0);

  const pickBorrower = (code: string) => {
    setSelectedCode(code);
    setContractFilter('');
    setOpenId('');
    setPreview(null);
  };

  return (
    <section className="ph-page" aria-label="ประวัติการชำระ">
      <header className="ph-header">
        <div>
          <h1>รับชำระและประวัติ</h1>
          <p>ค้นหาผู้กู้ ดูประวัติรับชำระ และบันทึกรับเงินได้ในหน้าเดียว</p>
        </div>
        <div className="ph-actions">
          {onReceivePayment ? <button type="button" disabled={loading} className="ph-btn ph-btn-primary" onClick={() => onReceivePayment(selected?.debtor.borrowersCode || '', borrowerContracts.find(contract => contract.contractNumber === contractFilter)?.id)}>รับชำระ</button> : <Link href="/dashboard/loan/payments" className="ph-btn ph-btn-primary">รับชำระ</Link>}
          <button type="button" className="ph-btn" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={16} className={loading ? 'ph-spin' : ''} /> โหลดใหม่
          </button>
        </div>
      </header>

      {error && <p className="ph-error" role="alert">{error}</p>}

      <div className="ph-layout">
        {/* ซ้าย: รายชื่อผู้กู้ */}
        <aside className="ph-borrowers" aria-label="รายชื่อผู้กู้">
          <label className="ph-search">
            <Search size={17} aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedCode('');
                setContractFilter('');
                setOpenId('');
                setPreview(null);
              }}
              placeholder="ค้นหาชื่อหรือรหัสผู้กู้"
              aria-label="ค้นหาผู้กู้"
            />
          </label>
          <p className="ph-count">{loading ? 'กำลังโหลด…' : `${filteredBorrowers.length.toLocaleString('th-TH')} จาก ${borrowers.length.toLocaleString('th-TH')} ผู้กู้`}</p>
          <ul>
            {filteredBorrowers.map(({ sample, count }) => {
              const active = sample.debtor.borrowersCode === activeCode;
              return (
                <li key={sample.debtor.borrowersCode}>
                  <button type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => pickBorrower(sample.debtor.borrowersCode)}>
                    <span className="ph-avatar" aria-hidden>{(sample.debtor.firstName || '?').slice(0, 1)}</span>
                    <span className="ph-borrower-text">
                      <strong>{borrowerName(sample)}</strong>
                      <small>{formatBorrowerCode(sample.debtor.borrowersCode)} · {count} สัญญา</small>
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && filteredBorrowers.length === 0 && <li className="ph-none">ไม่พบผู้กู้ที่ตรงกับ “{query}”</li>}
          </ul>
        </aside>

        {/* ขวา: ประวัติ */}
        <section className="ph-detail">
          {!selected && (
            <div className="ph-empty">
              <UserRound size={34} aria-hidden />
              <h2>เลือกผู้กู้เพื่อดูประวัติ</h2>
              <p>เลือกชื่อจากรายการทางซ้าย แล้วรายการรับชำระทุกสัญญาจะแสดงที่นี่</p>
            </div>
          )}

          {selected && (
            <>
              <div className="ph-summary">
                <div className="ph-who">
                  <h2>{borrowerName(selected)}</h2>
                  <p>รหัส {formatBorrowerCode(selected.debtor.borrowersCode)}</p>
                </div>
                <dl>
                  <div><dt>รับชำระรวม</dt><dd>{baht(totalPaid)}</dd></div>
                  <div><dt>จำนวนรายการ</dt><dd>{entries.length.toLocaleString('th-TH')}</dd></div>
                  <div><dt>ชำระล่าสุด</dt><dd>{entries[0] ? dateLabel(entries[0].date) : '—'}</dd></div>
                </dl>
              </div>

              {borrowerContracts.length > 1 && (
                <div className="ph-chips" role="group" aria-label="กรองตามสัญญา">
                  <button type="button" className={!contractFilter ? 'is-active' : ''} onClick={() => setContractFilter('')}>ทุกสัญญา</button>
                  {borrowerContracts.map((contract) => (
                    <button
                      type="button"
                      key={contract.id}
                      className={contractFilter === contract.contractNumber ? 'is-active' : ''}
                      onClick={() => setContractFilter(contract.contractNumber)}
                    >
                      {contract.contractNumber}
                    </button>
                  ))}
                </div>
              )}

              {entries.length === 0 && <p className="ph-none-detail">ยังไม่มีรายการรับชำระ{contractFilter ? `ในสัญญา ${contractFilter}` : 'ของผู้กู้รายนี้'}</p>}

              {groups.map(([key, group]) => (
                <div className="ph-month" key={key}>
                  <div className="ph-month-head">
                    <h3>{group.label}</h3>
                    <span>{baht(group.total)}</span>
                  </div>
                  <ul className="ph-ledger">
                    {group.items.map((entry) => {
                      const rowKey = `${entry.contractNumber}-${entry.id}`;
                      const open = openId === rowKey;
                      const receipt = entry.receipt;
                      const parts = receipt
                        ? [
                            { key: 'interest', label: 'ดอกเบี้ย', value: receipt.interestPaid },
                            { key: 'penalty', label: 'ยอดเพิ่มหลังครบกำหนด', value: receipt.penaltyPaid },
                            { key: 'principal', label: 'เงินต้น', value: receipt.principalPaid },
                          ]
                        : [];
                      const sum = parts.reduce((s, p) => s + p.value, 0);
                      return (
                        <li key={rowKey} className={open ? 'is-open' : ''}>
                          <button
                            type="button"
                            className="ph-row"
                            aria-expanded={receipt ? open : undefined}
                            disabled={!receipt}
                            onClick={() => setOpenId(open ? '' : rowKey)}
                          >
                            <span className="ph-date"><b>{dayOf(entry.date)}</b>{monthShort(entry.date)}<small>{entry.timeRecorded ? timeLabel(entry.date) : 'ไม่ระบุเวลา'}</small></span>
                            <span className="ph-main">
                              <strong>{entry.title}</strong>
                              <small>สัญญา {entry.contractNumber}{!receipt && ` · ${entry.reference || 'รายการเดิม'}`}</small>
                              {receipt && sum > 0 && (
                                <span className="ph-bar" aria-hidden>
                                  {parts.map((p) => p.value > 0 && <i key={p.key} className={`ph-seg-${p.key}`} style={{ flexGrow: p.value }} />)}
                                </span>
                              )}
                            </span>
                            <span className="ph-amount">{baht(entry.amount)}</span>
                            {receipt ? <ChevronDown size={18} className="ph-chevron" aria-hidden /> : <span className="ph-chevron-space" />}
                          </button>

                          {receipt && open && (
                            <div className="ph-expand">
                              <ul className="ph-legend">
                                {parts.map((p) => (
                                  <li key={p.key}><i className={`ph-seg-${p.key}`} /><span>ตัด{p.label}</span><b>{baht(p.value)}</b></li>
                                ))}
                              </ul>
                              <p className="ph-remaining">ยอดคงเหลือทั้งหมดหลังชำระ <b>{baht(receipt.totalRemaining)}</b></p>
                              <div className="ph-row-actions">
                                <button type="button" className="ph-btn ph-btn-sm" onClick={() => setPreview({ receipt, contract: borrowerContracts.find((c) => c.contractNumber === entry.contractNumber)! })}>
                                  <FileText size={15} /> ดูใบรับชำระ
                                </button>
                                {receipt.evidenceUrl && (
                                  <a className="ph-btn ph-btn-sm" href={receipt.evidenceUrl} target="_blank" rel="noreferrer"><Paperclip size={15} /> ไฟล์แนบ</a>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </>
          )}
        </section>
      </div>

      {preview && (
        <div className="ph-modal" role="dialog" aria-modal="true" aria-label="ใบรับชำระเงิน" onClick={() => setPreview(null)}>
          <article className="ph-receipt" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="ph-close" aria-label="ปิด" onClick={() => setPreview(null)}><X size={18} /></button>
            <LoanReceipt
              receipt={preview.receipt}
              contractNumber={preview.contract.contractNumber}
              borrowerCode={preview.contract.debtor.borrowersCode}
              borrowerName={borrowerName(preview.contract)}
              borrowerAddress={preview.contract.debtor.address}
              borrowerHouseNumber={preview.contract.debtor.houseNumber}
              branch={preview.contract.receiptBranch}
              onClose={() => setPreview(null)}
            />
          </article>
        </div>
      )}
    </section>
  );
}
