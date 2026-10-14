'use client';

import { useTrackedFetch } from "@/components/ui/ToastProvider";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Landmark, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { workspaceStyles as styles } from '@/components/ui/workspace-styles';
import type { Bank } from '@/lib/banking-types';

const buttonClass = 'inline-flex h-10 w-24 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#d7d9d0] bg-[#faf9f5] text-xs disabled:opacity-50';
const fields = [
  { key: 'bankCode', label: 'รหัสธนาคาร', max: 3 },
  { key: 'bankShort', label: 'ชื่อย่อ', max: 30 },
  { key: 'bankNameTH', label: 'ชื่อธนาคารภาษาไทย', max: 200 },
  { key: 'bankNameEN', label: 'ชื่อธนาคารภาษาอังกฤษ', max: 200 },
] as const;
type Editor = { mode: 'create' | 'edit' | 'delete'; bank?: Bank };

function BankEditor({ editor, onClose, onSaved }: { editor: Editor; onClose: () => void; onSaved: (message: string) => void }) {
  const trackedFetch = useTrackedFetch();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deleting = editor.mode === 'delete';
  const title = deleting ? 'ลบธนาคาร' : editor.mode === 'edit' ? 'แก้ไขธนาคาร' : 'เพิ่มธนาคาร';
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const response = await trackedFetch(editor.bank ? `/api/banking/${encodeURIComponent(editor.bank.id)}` : '/api/banking', {
        method: deleting ? 'DELETE' : editor.mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: deleting ? undefined : JSON.stringify(data),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'บันทึกไม่สำเร็จ');
      onSaved(deleting ? 'ลบธนาคารแล้ว' : 'บันทึกข้อมูลแล้ว');
    } catch (err) { setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="bank-editor-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[min(560px,calc(100%_-_32px))] overflow-y-auto rounded-2xl border border-[#d7d9d0] bg-[#faf9f5] p-6 backdrop:bg-black/40">
    <h2 id="bank-editor-title" className="mb-5 text-xl font-medium">{title}</h2>
    <form onSubmit={submit}>
      {deleting ? <p>ยืนยันลบ {editor.bank?.bankCode} — {editor.bank?.bankNameTH}?</p> : <div className="grid gap-4">
        {fields.map(({ key, label, max }) => <label key={key} className="text-sm">{label}
          <input name={key} required maxLength={max} defaultValue={editor.bank?.[key] ?? ''} disabled={busy} pattern={key === 'bankCode' ? '[0-9]{3}' : undefined} inputMode={key === 'bankCode' ? 'numeric' : undefined} title={key === 'bankCode' ? 'ตัวเลข 3 หลัก เช่น 002' : undefined} className="mt-2 w-full rounded-xl border border-[#d7d9d0] bg-white px-3 py-2.5" />
        </label>)}
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className={`${buttonClass} w-32!`}>ยกเลิก</button>
        <button disabled={busy} className={`${buttonClass} w-32! text-white ${deleting ? 'bg-red-700!' : 'bg-[#355a4b]!'}`}>{busy ? 'กำลังบันทึก…' : deleting ? 'ยืนยันลบ' : 'บันทึก'}</button>
      </div>
    </form>
  </dialog>;
}

export default function BankingPage() {
  const trackedFetch = useTrackedFetch();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await trackedFetch('/api/banking', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error((await response.json()).error ?? 'โหลดข้อมูลไม่สำเร็จ');
        const data: Bank[] = await response.json();
        if (!controller.signal.aborted) { setBanks(data); setError(''); setLoadedRevision(revision); }
      } catch (err) { if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ'); setLoadedRevision(revision); } }
    }
    void load();
    return () => controller.abort();
  }, [revision, trackedFetch]);
  const items = banks.filter((bank) => fields.some(({ key }) => bank[key].toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())));
  const loading = loadedRevision !== revision;
  return <section className={styles.page}>
    <header className={`${styles.pageHeader} flex flex-wrap items-start justify-between gap-4`}>
      <div><p className={styles.eyebrow}>MASTER DATA / BANKING</p><h1 className="flex items-center gap-3"><Landmark size={28} aria-hidden="true" />ธนาคาร</h1><p className="text-sm text-[#626862]">จัดการรหัสธนาคาร ชื่อย่อ และชื่อภาษาไทยและอังกฤษ</p></div>
      <button className={`${buttonClass} w-36! bg-[#355a4b]! text-white`} onClick={() => { setNotice(''); setEditor({ mode: 'create' }); }}><Plus size={16} aria-hidden="true" />เพิ่มธนาคาร</button>
    </header>
    {notice && <p role="status" className="mb-4 text-sm text-[#355a4b]">{notice}</p>}
    <label className="mb-5 flex items-center gap-2 rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-3 py-2.5"><Search size={18} aria-hidden="true" /><span className="sr-only">ค้นหาธนาคาร</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="ค้นหารหัส ชื่อย่อ หรือชื่อธนาคาร" className="w-full bg-transparent text-sm" /></label>
    {error && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-red-700">{error}<button className={buttonClass} onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button></div>}
    <div className="overflow-hidden rounded-2xl border border-[#d7d9d0] bg-[#faf9f5]">
      <div className="flex justify-between border-b border-[#d7d9d0] px-5 py-4 text-sm"><h2>รายชื่อธนาคาร</h2><span>{items.length} / {banks.length} รายการ</span></div>
      <div className="overflow-x-auto"><table aria-busy={loading} className="w-full min-w-[900px] text-left text-sm">
        <caption className="sr-only">รายชื่อธนาคารจากฐานข้อมูล</caption>
        <thead className="bg-[#eeece5] text-xs text-[#626862]"><tr>{[...fields.map((field) => field.label), 'จัดการ'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#d7d9d0]">
          {loading ? <tr><td colSpan={5} className="p-6 text-center">กำลังโหลด…</td></tr> : error ? <tr><td colSpan={5} className="p-6 text-center">ไม่สามารถโหลดข้อมูลได้</td></tr> : !items.length ? <tr><td colSpan={5} className="p-6 text-center">ไม่พบข้อมูลธนาคาร</td></tr> : items.map((bank) => <tr key={bank.id} className="hover:bg-[#f0f2eb]">
            <th scope="row" className="px-5 py-4 font-mono text-[#355a4b]">{bank.bankCode}</th>
            <td className="px-5 py-4">{bank.bankShort}</td><td className="px-5 py-4">{bank.bankNameTH}</td><td lang="en" className="px-5 py-4 text-[#626862]">{bank.bankNameEN}</td>
            <td className="px-5 py-4"><div className="flex gap-2"><button aria-label={`แก้ไข ${bank.bankNameTH}`} className={buttonClass} onClick={() => { setNotice(''); setEditor({ mode: 'edit', bank }); }}><Pencil size={14} aria-hidden="true" />แก้ไข</button><button aria-label={`ลบ ${bank.bankNameTH}`} className={`${buttonClass} text-red-700`} onClick={() => { setNotice(''); setEditor({ mode: 'delete', bank }); }}><Trash2 size={14} aria-hidden="true" />ลบ</button></div></td>
          </tr>)}
        </tbody>
      </table></div>
    </div>
    {editor && <BankEditor editor={editor} onClose={() => setEditor(null)} onSaved={(message) => { setEditor(null); setNotice(message); setQ(''); setRevision((value) => value + 1); }} />}
  </section>;
}
