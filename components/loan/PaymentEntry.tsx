'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useToast, useTrackedFetch } from '@/components/ui/ToastProvider';
import { CalendarDays, Check, ChevronDown, Clock3, RefreshCw, Search, Wallet } from 'lucide-react';
import { allocateRepayment } from '@/lib/loan-balance';
import LoanReceipt from '@/components/loan/LoanReceipt';
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
    receiptBranch: { name: string; companyName: string; taxId: string; address: string; phone: string } | null;
    debtor: {
        borrowersCode: string;
        firstName: string;
        lastName: string | null;
        nickname: string | null;
        address: string | null;
        houseNumber: string | null;
    };
};
const baht = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(n / 100);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const currentTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value));
export default function PaymentEntry({ initialBorrowerCode = '', initialContractId = '', onSaved, onClose }: {
  initialBorrowerCode?: string;
  initialContractId?: string;
  onSaved: () => void;
  onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const initialized = useRef(false);
    const trackedFetch = useTrackedFetch();
    const notify = useToast();
    useEffect(() => {
      const element = dialog.current;
      element?.showModal();
      return () => element?.close();
    }, []);
    const [contracts, setContracts] = useState<Contract[]>([]), [selected, setSelected] = useState(''), [query, setQuery] = useState(initialBorrowerCode);
    const [paidAt, setPaidAt] = useState(today), [paidTime, setPaidTime] = useState(currentTime), [amount, setAmount] = useState(''), [method, setMethod] = useState('CASH'), [note, setNote] = useState(''), [evidence, setEvidence] = useState('');
    const [waivePenalty, setWaivePenalty] = useState(false);
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [preview, setPreview] = useState<Receipt | null>(null), [receiptContract, setReceiptContract] = useState<Contract | null>(null);
    const busy = useRef(false), key = useRef(''), lastPayload = useRef(''), generation = useRef(0);
    const load = useCallback(async () => { const version = ++generation.current; try {
        const res = await trackedFetch(`/api/repayments?date=${paidAt}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'โหลดรายการไม่สำเร็จ');
        if (version === generation.current) {
            setContracts(data);
            if (!initialized.current && (initialBorrowerCode || initialContractId)) {
              const initial = (data as Contract[]).find(item => ['ACTIVE', 'OVERDUE'].includes(item.status) && (initialContractId ? item.id === initialContractId : item.debtor.borrowersCode === initialBorrowerCode));
              if (initial) { initialized.current = true; setSelected(initial.id); setWaivePenalty(initial.lateFeeWaived); }
            }
        }
    }
    catch (e) {
        if (version === generation.current)
            setError(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
    }
    finally {
        if (version === generation.current)
            setLoading(false);
    } }, [paidAt, trackedFetch, initialBorrowerCode, initialContractId]);
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
        if (contract) body.append('contractId', contract.id);
        else throw new Error('กรุณาเลือกสัญญาก่อนแนบหลักฐาน');
        const res = await trackedFetch('/api/repayments/evidence', { method: 'POST', body });
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
        const payload = { contractId: contract.id, paidAt: `${paidAt}T${paidTime}`, amount: cents, method, note, evidenceUrl: evidence || null, waivePenalty };
        const fingerprint = JSON.stringify(payload);
        if (!key.current || lastPayload.current !== fingerprint) {
            key.current = crypto.randomUUID();
            lastPayload.current = fingerprint;
        }
        try {
            const res = await trackedFetch('/api/repayments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestKey: key.current }) });
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
            notify({ status: 'success', message: 'บันทึกการรับชำระแล้ว' });
            onSaved();
            setLoading(true);
            await load();
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ';
            setError(message);
            notify({ status: 'error', message });
        }
        finally {
            busy.current = false;
            setSaving(false);
        }
    }
 return <dialog data-payment-entry ref={dialog} aria-labelledby="payment-entry-title" className="fixed inset-0 m-auto max-h-[92dvh] w-[min(1050px,calc(100vw-24px))] overflow-y-auto rounded-[24px] border border-[#e6dcf1] bg-[var(--ws-surface,#fdfbff)] p-0 text-[#3a2850] shadow-[0_20px_80px_#0004] backdrop:bg-black/40" onCancel={event => { event.preventDefault(); if (!saving && !uploading) onClose(); }}><div className="loan-theme"><section className="loan-payment-page min-h-0!"><header className="payment-header"><div><span className="payment-eyebrow"><Wallet size={15}/> LOAN PAYMENTS</span><h1 id="payment-entry-title">รับชำระตามสัญญา</h1><p>ค้นหาสัญญาที่ยังไม่ปิด ตรวจยอด และบันทึกการรับเงินในขั้นตอนเดียว</p></div><div className="payment-header-actions"><button type="button" disabled={saving || uploading} aria-label="ปิดหน้าต่างรับชำระ" onClick={onClose}><X size={18}/> ปิด</button><button type="button" disabled={loading || saving} onClick={() => { setLoading(true); setError(''); void load(); }}><RefreshCw size={16}/> โหลดใหม่</button></div></header>
 {error && <p className="loan-payment-error" role="alert">{error}</p>}{message && <p className="loan-payment-success" role="status"><Check size={17}/>{message}</p>}
 <section className="loan-payment-card payment-picker"><div className="payment-step"><span>1</span><div><h2>ค้นหาและเลือกสัญญา</h2><p>แสดงเฉพาะสัญญาที่กำลังดำเนินการหรือเกินกำหนด</p></div><strong>{loading ? '…' : `${openContracts.length.toLocaleString('th-TH')} สัญญา`}</strong></div><div className="payment-picker-fields"><label className="payment-search"><span>ค้นหาผู้กู้หรือเลขสัญญา</span><div><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="พิมพ์เลขสัญญา ชื่อ หรือรหัสผู้กู้" /></div></label><label className="payment-select"><span>สัญญาที่ยังไม่ปิด</span><div><select value={selected} disabled={saving || loading || filteredContracts.length === 0} onChange={e => { const nextId = e.target.value; setSelected(nextId); setWaivePenalty(contracts.find(c => c.id === nextId)?.lateFeeWaived ?? false); setAmount(''); setEvidence(''); setNote(''); setPreview(null); setReceiptContract(null); setMessage(''); }}><option value="">{loading ? 'กำลังโหลดสัญญา…' : openContracts.length === 0 ? 'ไม่มีสัญญาที่ยังไม่ปิด' : filteredContracts.length === 0 ? 'ไม่พบสัญญาที่ตรงกับคำค้น' : 'เลือกสัญญาเพื่อบันทึกรับชำระ'}</option>{filteredContracts.map(c => <option value={c.id} key={c.id}>{c.contractNumber} · {c.debtor.borrowersCode} · {[c.debtor.firstName, c.debtor.lastName].filter(Boolean).join(' ') || c.debtor.nickname || 'ไม่ระบุชื่อ'}{c.status === 'OVERDUE' ? ' · เกินกำหนด' : ''}</option>)}</select><ChevronDown size={18}/></div></label></div>{!loading && openContracts.length === 0 && !error && <p className="payment-empty-note">ยังไม่มีสัญญาที่รับชำระได้ กรุณาตรวจสอบหรือ <Link href="/dashboard/loan/contracts">สร้างสัญญาใหม่</Link></p>}</section>
 {loading && <p className="payment-loading" role="status">กำลังคำนวณยอดตามวันที่รับชำระ…</p>}
 {contract && paymentBalance && <><section className="loan-payment-card payment-contract"><div className="payment-contract-heading"><div><span className="payment-section-label">สัญญาที่เลือก</span><h2>{contract.contractNumber}</h2><p>{contract.debtor.borrowersCode} <span>·</span> {[contract.debtor.firstName, contract.debtor.lastName].filter(Boolean).join(' ') || contract.debtor.nickname || 'ไม่ระบุชื่อ'}</p></div><span className={`payment-status ${contract.status === 'OVERDUE' ? 'overdue' : contract.status === 'CLOSED' ? 'closed' : ''}`}>{contract.status === 'OVERDUE' ? 'เกินกำหนด' : contract.status === 'CLOSED' ? 'ปิดยอดแล้ว' : 'กำลังดำเนินการ'}</span></div><div className="payment-contract-meta"><span><CalendarDays size={15}/> ครบกำหนด {contract.dueDate ? dateLabel(contract.dueDate) : '—'}</span><span><Clock3 size={15}/> {waivePenalty ? 'ยกเว้นค่าปรับ' : `ค่าปรับ ${baht(contract.lateFeePerDay)} / วัน`}</span></div><div className="loan-payment-totals"><article><span>เงินต้นคงเหลือ</span><strong>{baht(paymentBalance.principal)}</strong></article><article><span>ดอกเบี้ยค้าง</span><strong>{baht(paymentBalance.interest)}</strong></article><article><span>ยอดเพิ่มหลังครบกำหนด</span><strong>{baht(paymentBalance.penalty)}</strong></article><article className="payment-total-due"><span>ยอดคงเหลือรวม</span><strong>{baht(paymentBalance.total)}</strong></article></div></section>
 {['ACTIVE', 'OVERDUE'].includes(contract.status) && <section className="loan-payment-card payment-form-card"><div className="payment-step"><span>2</span><div><h2>บันทึกรับชำระเงิน</h2><p>กรอกจำนวนเงินที่ได้รับ ระบบจะแบ่งตัดยอดให้อัตโนมัติ</p></div></div><fieldset disabled={saving || uploading}><div className="loan-payment-grid"><label><span>วันที่รับชำระ</span><input type="date" value={paidAt} max={today()} onChange={e => { setLoading(true); setPaidAt(e.target.value || today()); }}/></label><label><span>เวลารับชำระ</span><input type="time" required max={paidAt === today() ? currentTime() : undefined} value={paidTime} onChange={e => setPaidTime(e.target.value || currentTime())}/></label><label className="payment-amount-field"><span>จำนวนเงินที่รับ (บาท)</span><div><span>฿</span><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"/></div></label><label><span>ช่องทางรับชำระ</span><select value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">เงินสด</option><option value="BANK_TRANSFER">โอนเงิน</option></select></label><label><span>หลักฐาน (ไม่บังคับ)</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/>{evidence && <a href={evidence} target="_blank" rel="noreferrer">ดูหลักฐานที่แนบ</a>}</label></div><label className="payment-note-field"><span>หมายเหตุ (ถ้ามี)</span><textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับรายการรับชำระ"/></label><label className="payment-waiver"><input type="checkbox" checked={waivePenalty} disabled={contract.lateFeeWaived} onChange={e => setWaivePenalty(e.target.checked)}/><span className="payment-waiver-copy"><strong>ยกเว้นค่าปรับล่าช้าสำหรับสัญญานี้</strong><small>{contract.lateFeeWaived ? 'สัญญานี้ตั้งยกเว้นค่าปรับไว้แล้ว' : 'เมื่อเลือก ระบบจะไม่คำนวณค่าปรับแม้เลยกำหนด รวมถึงการคำนวณครั้งถัดไป'}</small></span></label></fieldset>
 {split && !loading && <p className="loan-payment-breakdown">ตัดดอก {baht(split.interestPaid)} · ตัดยอดเพิ่ม {baht(split.penaltyPaid)} · ตัดเงินต้น {baht(split.principalPaid)}<br />คงเหลือหลังรับชำระ {baht(split.totalRemaining)}</p>}
 {cents > paymentBalance.total && <p role="alert">ยอดรับชำระเกินยอดคงเหลือ</p>}
 <button type="button" className="primary-button payment-save-button" disabled={!split || saving || uploading || loading} onClick={() => void save()}>{saving ? 'กำลังบันทึก…' : uploading ? 'กำลังแนบหลักฐาน…' : 'ยืนยันบันทึกรับชำระ'}</button></section>}
 </>}
 {preview && receiptContract && <LoanReceipt receipt={{ ...preview, timeRecorded: true }} contractNumber={receiptContract.contractNumber} borrowerCode={receiptContract.debtor.borrowersCode} borrowerName={[receiptContract.debtor.firstName, receiptContract.debtor.lastName].filter(Boolean).join(' ') || receiptContract.debtor.nickname || 'ไม่ระบุชื่อ'} borrowerAddress={receiptContract.debtor.address} borrowerHouseNumber={receiptContract.debtor.houseNumber} branch={receiptContract.receiptBranch} onClose={() => { setPreview(null); setReceiptContract(null); }}/ >}
 </section></div></dialog>;
}
