'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, ChevronDown, Clock3, FileText, RefreshCw, Search, Wallet } from 'lucide-react';
import { allocateRepayment } from '@/lib/loan-balance';
type Balance = {
    principal: number;
    interest: number;
    penalty: number;
    total: number;
    chargedInterest: number;
    overdueDays: number;
};
type Receipt = {
    id: string;
    receiptNumber: string;
    paidAt: string;
    createdAt: string;
    amount: number;
    interestPaid: number;
    penaltyPaid: number;
    principalPaid: number;
    principalBefore: number;
    interestBefore: number;
    penaltyBefore: number;
    principalRemaining: number;
    interestRemaining: number;
    penaltyRemaining: number;
    totalRemaining: number;
    method: string;
    evidenceUrl: string | null;
    note: string | null;
};
type Contract = {
    lateFeePerDay: number;
    lateFeeWaived: boolean;
    id: string;
    contractNumber: string;
    status: string;
    principal: number;
    interestRate: number;
    interestMode: string;
    dueDate: string | null;
    balance: Balance;
    repayments: Receipt[];
    debtor: {
        borrowersCode: string;
        firstName: string;
        lastName: string | null;
        nickname: string | null;
    };
};
const baht = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(n / 100);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value));
export default function PaymentsPage() {
    const [contracts, setContracts] = useState<Contract[]>([]), [selected, setSelected] = useState(''), [query, setQuery] = useState('');
    const [paidAt, setPaidAt] = useState(today), [amount, setAmount] = useState(''), [method, setMethod] = useState('CASH'), [note, setNote] = useState(''), [evidence, setEvidence] = useState('');
    const [waivePenalty, setWaivePenalty] = useState(false);
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [preview, setPreview] = useState<Receipt | null>(null), [receiptContract, setReceiptContract] = useState<Contract | null>(null);
    const busy = useRef(false), key = useRef(''), lastPayload = useRef(''), generation = useRef(0);
    const load = useCallback(async () => { const version = ++generation.current; try {
        const res = await fetch(`/api/repayments?date=${paidAt}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'โหลดรายการไม่สำเร็จ');
        if (version === generation.current)
            setContracts(data);
    }
    catch (e) {
        if (version === generation.current)
            setError(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
    }
    finally {
        if (version === generation.current)
            setLoading(false);
    } }, [paidAt]);
    useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
    const contract = contracts.find(c => c.id === selected);
    const openContracts = contracts.filter(c => ['ACTIVE', 'OVERDUE'].includes(c.status));
    const filteredContracts = openContracts.filter(c => `${c.contractNumber} ${c.debtor.borrowersCode} ${c.debtor.firstName} ${c.debtor.lastName || ''} ${c.debtor.nickname || ''}`.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')));
    const paymentBalance = contract ? (waivePenalty ? { ...contract.balance, penalty: 0, total: contract.balance.total - contract.balance.penalty, overdueDays: 0 } : contract.balance) : null;
    const cents = /^\d+(\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;
    let split: ReturnType<typeof allocateRepayment> | null = null;
    if (paymentBalance && cents > 0 && cents <= paymentBalance.total)
        split = allocateRepayment(paymentBalance, cents);
    async function upload(file?: File) { if (!file)
        return; setUploading(true); setError(''); try {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/repayments/evidence', { method: 'POST', body });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        setEvidence(data.url);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'แนบหลักฐานไม่สำเร็จ');
    }
    finally {
        setUploading(false);
    } }
    async function save() {
        if (busy.current || !contract || !split || loading)
            return;
        busy.current = true;
        setSaving(true);
        setError('');
        setMessage('');
        const payload = { contractId: contract.id, paidAt, amount: cents, method, note, evidenceUrl: evidence || null, waivePenalty };
        const fingerprint = JSON.stringify(payload);
        if (!key.current || lastPayload.current !== fingerprint) {
            key.current = crypto.randomUUID();
            lastPayload.current = fingerprint;
        }
        try {
            const res = await fetch('/api/repayments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestKey: key.current }) });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error || 'บันทึกไม่สำเร็จ');
            setPreview(data);
            setReceiptContract(contract);
            setAmount('');
            setNote('');
            setEvidence('');
            key.current = '';
            lastPayload.current = '';
            setMessage(data.totalRemaining === 0 ? 'บันทึกและปิดยอดสัญญาแล้ว' : waivePenalty && !contract.lateFeeWaived ? 'บันทึกการชำระแล้ว และตั้งยกเว้นค่าปรับสำหรับสัญญานี้' : 'บันทึกการชำระแล้ว');
            setLoading(true);
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
        }
        finally {
            busy.current = false;
            setSaving(false);
        }
    }
 return <main className="loan-payment-page"><header className="payment-header"><div><span className="payment-eyebrow"><Wallet size={15}/> LOAN PAYMENTS</span><h1>รับชำระตามสัญญา</h1><p>ค้นหาสัญญาที่ยังไม่ปิด ตรวจยอด และบันทึกการรับเงินในขั้นตอนเดียว</p></div><div className="payment-header-actions"><Link href="/dashboard/loan/payment-history">ประวัติการชำระ</Link><button type="button" disabled={loading || saving} onClick={() => { setLoading(true); setError(''); void load(); }}><RefreshCw size={16}/> โหลดใหม่</button></div></header>
 {error && <p className="loan-payment-error" role="alert">{error}</p>}{message && <p className="loan-payment-success" role="status"><Check size={17}/>{message}</p>}
 <section className="loan-payment-card payment-picker"><div className="payment-step"><span>1</span><div><h2>ค้นหาและเลือกสัญญา</h2><p>แสดงเฉพาะสัญญาที่กำลังดำเนินการหรือเกินกำหนด</p></div><strong>{loading ? '…' : `${openContracts.length.toLocaleString('th-TH')} สัญญา`}</strong></div><div className="payment-picker-fields"><label className="payment-search"><span>ค้นหาผู้กู้หรือเลขสัญญา</span><div><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="พิมพ์เลขสัญญา ชื่อ หรือรหัสผู้กู้" /></div></label><label className="payment-select"><span>สัญญาที่ยังไม่ปิด</span><div><select value={selected} disabled={saving || loading || filteredContracts.length === 0} onChange={e => { const nextId = e.target.value; setSelected(nextId); setWaivePenalty(contracts.find(c => c.id === nextId)?.lateFeeWaived ?? false); setAmount(''); setEvidence(''); setNote(''); setPreview(null); setReceiptContract(null); setMessage(''); }}><option value="">{loading ? 'กำลังโหลดสัญญา…' : openContracts.length === 0 ? 'ไม่มีสัญญาที่ยังไม่ปิด' : filteredContracts.length === 0 ? 'ไม่พบสัญญาที่ตรงกับคำค้น' : 'เลือกสัญญาเพื่อบันทึกรับชำระ'}</option>{filteredContracts.map(c => <option value={c.id} key={c.id}>{c.contractNumber} · {c.debtor.borrowersCode} · {[c.debtor.firstName, c.debtor.lastName].filter(Boolean).join(' ') || c.debtor.nickname || 'ไม่ระบุชื่อ'}{c.status === 'OVERDUE' ? ' · เกินกำหนด' : ''}</option>)}</select><ChevronDown size={18}/></div></label></div>{!loading && openContracts.length === 0 && !error && <p className="payment-empty-note">ยังไม่มีสัญญาที่รับชำระได้ กรุณาตรวจสอบหรือ <Link href="/dashboard/loan/contract">สร้างสัญญาใหม่</Link></p>}</section>
 {loading && <p className="payment-loading" role="status">กำลังคำนวณยอดตามวันที่รับชำระ…</p>}
 {contract && paymentBalance && <><section className="loan-payment-card payment-contract"><div className="payment-contract-heading"><div><span className="payment-section-label">สัญญาที่เลือก</span><h2>{contract.contractNumber}</h2><p>{contract.debtor.borrowersCode} <span>·</span> {[contract.debtor.firstName, contract.debtor.lastName].filter(Boolean).join(' ') || contract.debtor.nickname || 'ไม่ระบุชื่อ'}</p></div><span className={`payment-status ${contract.status === 'OVERDUE' ? 'overdue' : contract.status === 'CLOSED' ? 'closed' : ''}`}>{contract.status === 'OVERDUE' ? 'เกินกำหนด' : contract.status === 'CLOSED' ? 'ปิดยอดแล้ว' : 'กำลังดำเนินการ'}</span></div><div className="payment-contract-meta"><span><CalendarDays size={15}/> ครบกำหนด {contract.dueDate ? dateLabel(contract.dueDate) : '—'}</span><span><Clock3 size={15}/> {waivePenalty ? 'ยกเว้นค่าปรับ' : `ค่าปรับ ${baht(contract.lateFeePerDay)} / วัน`}</span></div><div className="loan-payment-totals"><article><span>เงินต้นคงเหลือ</span><strong>{baht(paymentBalance.principal)}</strong></article><article><span>ดอกเบี้ยค้าง</span><strong>{baht(paymentBalance.interest)}</strong></article><article><span>ยอดเพิ่มหลังครบกำหนด</span><strong>{baht(paymentBalance.penalty)}</strong></article><article className="payment-total-due"><span>ยอดคงเหลือรวม</span><strong>{baht(paymentBalance.total)}</strong></article></div></section>
 {['ACTIVE', 'OVERDUE'].includes(contract.status) && <section className="loan-payment-card payment-form-card"><div className="payment-step"><span>2</span><div><h2>บันทึกรับชำระเงิน</h2><p>กรอกจำนวนเงินที่ได้รับ ระบบจะแบ่งตัดยอดให้อัตโนมัติ</p></div></div><fieldset disabled={saving || uploading}><div className="loan-payment-grid"><label><span>วันที่รับชำระ</span><input type="date" value={paidAt} max={today()} onChange={e => { setLoading(true); setPaidAt(e.target.value || today()); }}/></label><label className="payment-amount-field"><span>จำนวนเงินที่รับ (บาท)</span><div><span>฿</span><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"/></div></label><label><span>ช่องทางรับชำระ</span><select value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">เงินสด</option><option value="BANK_TRANSFER">โอนเงิน</option></select></label><label><span>หลักฐาน (ไม่บังคับ)</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/>{evidence && <a href={evidence} target="_blank" rel="noreferrer">ดูหลักฐานที่แนบ</a>}</label></div><label className="payment-note-field"><span>หมายเหตุ (ถ้ามี)</span><textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับรายการรับชำระ"/></label><label className="payment-waiver"><input type="checkbox" checked={waivePenalty} disabled={contract.lateFeeWaived} onChange={e => setWaivePenalty(e.target.checked)}/><span className="payment-waiver-copy"><strong>ยกเว้นค่าปรับล่าช้าสำหรับสัญญานี้</strong><small>{contract.lateFeeWaived ? 'สัญญานี้ตั้งยกเว้นค่าปรับไว้แล้ว' : 'เมื่อเลือก ระบบจะไม่คำนวณค่าปรับแม้เลยกำหนด รวมถึงการคำนวณครั้งถัดไป'}</small></span></label></fieldset>
 {split && !loading && <p className="loan-payment-breakdown">ตัดดอก {baht(split.interestPaid)} · ตัดยอดเพิ่ม {baht(split.penaltyPaid)} · ตัดเงินต้น {baht(split.principalPaid)}<br />คงเหลือหลังรับชำระ {baht(split.totalRemaining)}</p>}
 {cents > paymentBalance.total && <p role="alert">ยอดรับชำระเกินยอดคงเหลือ</p>}
 <button type="button" className="primary-button payment-save-button" disabled={!split || saving || uploading || loading} onClick={() => void save()}>{saving ? 'กำลังบันทึก…' : uploading ? 'กำลังแนบหลักฐาน…' : 'ยืนยันบันทึกรับชำระ'}</button></section>}
 </>}
 {preview && receiptContract && <section className="loan-payment-receipt loan-payment-card"><h2>ใบรับชำระเงิน</h2><p>{preview.receiptNumber}</p><p>สัญญา {receiptContract.contractNumber} · ผู้กู้ {receiptContract.debtor.borrowersCode}</p><p>วันที่รับชำระ {dateLabel(preview.paidAt)} · {preview.method === 'CASH' ? 'เงินสด' : 'โอนเงิน'}</p><dl>{[['ยอดรับชำระ', preview.amount], ['ตัดดอกเบี้ย', preview.interestPaid], ['ตัดยอดเพิ่มหลังครบกำหนด', preview.penaltyPaid], ['ตัดเงินต้น', preview.principalPaid], ['เงินต้นคงเหลือ', preview.principalRemaining], ['ดอกเบี้ยคงเหลือ', preview.interestRemaining], ['ยอดเพิ่มคงเหลือ', preview.penaltyRemaining], ['ยอดคงเหลือทั้งหมด', preview.totalRemaining]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{baht(Number(value))}</dd></div>)}</dl><p>{preview.note}</p><p>บันทึกเมื่อ {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(preview.createdAt))}</p><div className="loan-receipt-actions"><button onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button onClick={() => { setPreview(null); setReceiptContract(null); }}>ปิดใบรับชำระ</button></div></section>}
 </main>;
}
