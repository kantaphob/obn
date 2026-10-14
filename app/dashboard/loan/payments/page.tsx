'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [preview, setPreview] = useState<Receipt | null>(null);
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
    const cents = /^\d+(\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;
    let split: ReturnType<typeof allocateRepayment> | null = null;
    if (contract && cents > 0 && cents <= contract.balance.total)
        split = allocateRepayment(contract.balance, cents);
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
        const payload = { contractId: contract.id, paidAt, amount: cents, method, note, evidenceUrl: evidence || null };
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
            setAmount('');
            setNote('');
            setEvidence('');
            key.current = '';
            lastPayload.current = '';
            setMessage(data.totalRemaining === 0 ? 'บันทึกและปิดยอดสัญญาแล้ว' : 'บันทึกการชำระแล้ว');
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
    return <main className="loan-payment-page"><header><div><h1>รับชำระและประวัติ</h1><p>ตัดดอกเบี้ย → ยอดเพิ่มหลังครบกำหนด → เงินต้น · เก็บหลักฐานและยอดคงเหลือทุกครั้ง</p></div><Link href="/dashboard/loan/contract">สร้างสัญญา</Link></header>
 {error && <p className="loan-payment-error" role="alert">{error}</p>}{message && <p className="loan-payment-success" role="status">{message}</p>}
 <section className="loan-payment-card"><label>ค้นหาสัญญาหรือผู้กู้<input value={query} onChange={e => setQuery(e.target.value)} placeholder="เลขสัญญา / bo000001 / ชื่อ"/></label><label>เลือกสัญญา<select value={selected} disabled={saving || loading || contracts.length === 0} onChange={e => { setSelected(e.target.value); setAmount(''); setEvidence(''); setNote(''); setPreview(null); setMessage(''); }}><option value="">{loading ? "กำลังโหลดสัญญา…" : contracts.length === 0 ? "ยังไม่มีสัญญาที่บันทึก" : "เลือกสัญญาเพื่อดูยอดและประวัติ"}</option>{contracts.filter(c => `${c.contractNumber} ${c.debtor.borrowersCode} ${c.debtor.firstName} ${c.debtor.lastName || ''} ${c.debtor.nickname || ''}`.toLowerCase().includes(query.trim().toLowerCase())).map(c => <option value={c.id} key={c.id}>{c.contractNumber} · {c.debtor.borrowersCode} · {c.debtor.firstName || c.debtor.nickname} {c.status === 'CLOSED' ? '(ปิดยอดแล้ว)' : ''}</option>)}</select></label><button type="button" disabled={loading || saving} onClick={() => {setLoading(true);setError("");void load();}}>โหลดรายการใหม่</button>{!loading && contracts.length === 0 && !error && <p role="status">ยังไม่มีสัญญาในระบบ กรุณาสร้างและบันทึกสัญญาก่อน เลขสัญญาที่แสดงล่วงหน้าในฟอร์มยังไม่ใช่สัญญาที่บันทึกแล้ว <Link href="/dashboard/loan/contract">สร้างสัญญา</Link></p>}</section>
 {loading && <p role="status">กำลังคำนวณยอด…</p>}
 {contract && <><section className="loan-payment-card"><h2>{contract.contractNumber} · {contract.debtor.borrowersCode}</h2><p>{contract.debtor.firstName} {contract.debtor.lastName} · {contract.status === 'CLOSED' ? 'ปิดยอดแล้ว' : contract.status} · ครบกำหนด {contract.dueDate ? dateLabel(contract.dueDate) : '—'}</p><div className="loan-payment-totals">{[['เงินต้นคงเหลือ', contract.balance.principal], ['ดอกเบี้ยค้าง', contract.balance.interest], ['ยอดเพิ่มหลังครบกำหนด', contract.balance.penalty], ['ยอดปิดทั้งหมด', contract.balance.total]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{baht(Number(value))}</strong></article>)}</div></section>
 {['ACTIVE', 'OVERDUE'].includes(contract.status) && <section className="loan-payment-card"><h2>บันทึกรับชำระ</h2><fieldset disabled={saving || uploading}><div className="loan-payment-grid"><label>วันที่รับชำระ<input type="date" value={paidAt} max={today()} onChange={e => { setLoading(true); setPaidAt(e.target.value || today()); }}/></label><label>จำนวนเงิน (บาท)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"/></label><label>ช่องทางรับชำระ<select value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">เงินสด</option><option value="BANK_TRANSFER">โอนเงิน</option></select></label><label>หลักฐาน (ไม่บังคับ)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/>{evidence && <a href={evidence} target="_blank" rel="noreferrer">ดูหลักฐานที่แนบ</a>}</label></div><label>หมายเหตุ<textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)}/></label></fieldset>
 {split && !loading && <p className="loan-payment-breakdown">ตัดดอก {baht(split.interestPaid)} · ตัดยอดเพิ่ม {baht(split.penaltyPaid)} · ตัดเงินต้น {baht(split.principalPaid)}<br />คงเหลือหลังรับชำระ {baht(split.totalRemaining)}</p>}
 {cents > contract.balance.total && <p role="alert">ยอดรับชำระเกินยอดคงเหลือ</p>}
 <button type="button" className="primary-button" disabled={!split || saving || uploading || loading} onClick={() => void save()}>{saving ? 'กำลังบันทึก…' : uploading ? 'กำลังแนบหลักฐาน…' : 'ยืนยันบันทึกรับชำระ'}</button></section>}
 <section className="loan-payment-card"><h2>ประวัติการชำระ ({contract.repayments.length})</h2><p>รายการที่บันทึกแล้วเก็บไว้เป็นหลักฐาน ไม่มีปุ่มแก้ไขหรือลบ</p><div className="loan-payment-history"><table><thead><tr><th>วันที่</th><th>รับชำระ</th><th>ตัดดอก</th><th>ตัดยอดเพิ่ม</th><th>ตัดต้น</th><th>คงเหลือ</th><th>หลักฐาน</th></tr></thead><tbody>{contract.repayments.map(r => <tr key={r.id}><td>{dateLabel(r.paidAt)}</td><td>{baht(r.amount)}</td><td>{baht(r.interestPaid)}</td><td>{baht(r.penaltyPaid)}</td><td>{baht(r.principalPaid)}</td><td>{baht(r.totalRemaining)}</td><td><button onClick={() => setPreview(r)}>ใบรับชำระ</button>{r.evidenceUrl && <a href={r.evidenceUrl} target="_blank" rel="noreferrer">ไฟล์แนบ</a>}</td></tr>)}</tbody></table>{contract.repayments.length === 0 && <p>ยังไม่มีรายการรับชำระ</p>}</div></section></>}
 {preview && <section className="loan-payment-receipt loan-payment-card"><h2>ใบรับชำระเงิน</h2><p>{preview.receiptNumber}</p><p>สัญญา {contract?.contractNumber} · ผู้กู้ {contract?.debtor.borrowersCode}</p><p>วันที่รับชำระ {dateLabel(preview.paidAt)} · {preview.method === 'CASH' ? 'เงินสด' : 'โอนเงิน'}</p><dl>{[['ยอดรับชำระ', preview.amount], ['ตัดดอกเบี้ย', preview.interestPaid], ['ตัดยอดเพิ่มหลังครบกำหนด', preview.penaltyPaid], ['ตัดเงินต้น', preview.principalPaid], ['เงินต้นคงเหลือ', preview.principalRemaining], ['ดอกเบี้ยคงเหลือ', preview.interestRemaining], ['ยอดเพิ่มคงเหลือ', preview.penaltyRemaining], ['ยอดคงเหลือทั้งหมด', preview.totalRemaining]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{baht(Number(value))}</dd></div>)}</dl><p>{preview.note}</p><p>บันทึกเมื่อ {new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(preview.createdAt))}</p><div className="loan-receipt-actions"><button onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button><button onClick={() => setPreview(null)}>ปิดใบรับชำระ</button></div></section>}
 </main>;
}
