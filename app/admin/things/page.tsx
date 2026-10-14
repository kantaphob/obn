'use client';

import { useTrackedFetch } from "@/components/ui/ToastProvider";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Package, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { workspaceStyles as styles } from '@/components/ui/workspace-styles';

type Thing = { id: string; title: string; category: string; description: string; status: string };
type Editor = { mode: 'create' | 'edit' | 'delete'; item?: Thing };
const buttonClass = 'inline-flex h-10 w-24 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#d7d9d0] bg-[#faf9f5] text-xs disabled:opacity-50';
const fieldClass = 'mt-2 w-full rounded-xl border border-[#d7d9d0] bg-white px-3 py-2.5 text-sm';

function ThingEditor({ editor, onClose, onSaved }: { editor: Editor; onClose: () => void; onSaved: (message: string) => void }) {
  const trackedFetch = useTrackedFetch();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deleting = editor.mode === 'delete';
  const title = deleting ? 'ลบรายการ' : editor.mode === 'edit' ? 'แก้ไขรายการ' : 'เพิ่มสิ่งของและสินค้า';
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const response = await trackedFetch(editor.item ? `/api/entries/${encodeURIComponent(editor.item.id)}` : '/api/entries', {
        method: deleting ? 'DELETE' : editor.mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: deleting ? undefined : JSON.stringify(data),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
      }
      onSaved(deleting ? 'ลบรายการแล้ว' : 'บันทึกข้อมูลแล้ว');
    } catch (err) { setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="thing-editor-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[min(560px,calc(100%_-_32px))] overflow-y-auto rounded-2xl border border-[#d7d9d0] bg-[#faf9f5] p-6 backdrop:bg-black/40">
    <h2 id="thing-editor-title" className="mb-5 text-xl font-medium">{title}</h2>
    <form onSubmit={submit}>
      {deleting ? <p>ยืนยันลบ “{editor.item?.title}”?</p> : <fieldset disabled={busy} className="grid gap-4">
        <label className="text-sm">ชื่อสิ่งของหรือสินค้า<input name="title" required maxLength={120} defaultValue={editor.item?.title ?? ''} className={fieldClass} /></label>
        <label className="text-sm">หมวดหมู่<input name="category" required maxLength={60} defaultValue={editor.item?.category ?? 'ทั่วไป'} className={fieldClass} /></label>
        <label className="text-sm">รายละเอียด<textarea name="description" maxLength={1000} rows={4} defaultValue={editor.item?.description ?? ''} className={fieldClass} /></label>
        <label className="text-sm">สถานะ<select name="status" defaultValue={editor.item?.status ?? 'ACTIVE'} className={fieldClass}><option value="ACTIVE">ใช้งาน</option><option value="ARCHIVED">เก็บถาวร</option></select></label>
      </fieldset>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className={`${buttonClass} w-32!`}>ยกเลิก</button>
        <button disabled={busy} className={`${buttonClass} w-32! text-white ${deleting ? 'bg-red-700!' : 'bg-[#355a4b]!'}`}>{busy ? 'กำลังบันทึก…' : deleting ? 'ยืนยันลบ' : 'บันทึก'}</button>
      </div>
    </form>
  </dialog>;
}

export default function ThingsPage() {
  const trackedFetch = useTrackedFetch();
  const [items, setItems] = useState<Thing[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await trackedFetch('/api/entries', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? 'โหลดข้อมูลไม่สำเร็จ');
        }
        const data: Thing[] = await response.json();
        if (!controller.signal.aborted) { setItems(data); setError(''); setLoadedRevision(revision); }
      } catch (err) { if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ'); setLoadedRevision(revision); } }
    }
    void load();
    return () => controller.abort();
  }, [revision, trackedFetch]);
  const query = q.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => (status === 'ALL' || item.status === status) && [item.title, item.category, item.description].some((value) => value.toLocaleLowerCase().includes(query)));
  const loading = loadedRevision !== revision;
  return <section className={styles.page}>
    <header className={`${styles.pageHeader} flex flex-wrap items-start justify-between gap-4`}>
      <div><p className={styles.eyebrow}>MASTER DATA / THINGS</p><h1 className="flex items-center gap-3"><Package size={28} aria-hidden="true" />สิ่งของและสินค้า</h1><p className="text-sm text-[#626862]">จัดการชื่อรายการ หมวดหมู่ รายละเอียด และสถานะ</p></div>
      <button className={`${buttonClass} w-36! bg-[#355a4b]! text-white`} onClick={() => { setNotice(''); setEditor({ mode: 'create' }); }}><Plus size={16} aria-hidden="true" />เพิ่มรายการ</button>
    </header>
    {notice && <p role="status" className="mb-4 text-sm text-[#355a4b]">{notice}</p>}
    <div className="mb-5 flex flex-wrap gap-3">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-3 py-2.5"><Search size={18} aria-hidden="true" /><span className="sr-only">ค้นหาสิ่งของและสินค้า</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="ค้นหาชื่อ หมวดหมู่ หรือรายละเอียด" className="min-w-0 w-full bg-transparent text-sm" /></label>
      <label><span className="sr-only">กรองสถานะ</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-3 text-sm"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE">ใช้งาน</option><option value="ARCHIVED">เก็บถาวร</option></select></label>
    </div>
    {error && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-red-700">{error}<button className={buttonClass} onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button></div>}
    <div className="overflow-hidden rounded-2xl border border-[#d7d9d0] bg-[#faf9f5]">
      <div className="flex justify-between border-b border-[#d7d9d0] px-5 py-4 text-sm"><h2>รายการสิ่งของและสินค้า</h2><span>{filtered.length} / {items.length} รายการ</span></div>
      <div className="overflow-x-auto"><table aria-busy={loading} className="w-full min-w-[800px] text-left text-sm">
        <caption className="sr-only">รายการสิ่งของและสินค้าจากฐานข้อมูล</caption>
        <thead className="bg-[#eeece5] text-xs text-[#626862]"><tr>{['ชื่อรายการ', 'หมวดหมู่', 'รายละเอียด', 'สถานะ', 'จัดการ'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#d7d9d0]">
          {loading ? <tr><td colSpan={5} className="p-6 text-center">กำลังโหลด…</td></tr> : error ? <tr><td colSpan={5} className="p-6 text-center">ไม่สามารถโหลดข้อมูลได้</td></tr> : !filtered.length ? <tr><td colSpan={5} className="p-6 text-center">{items.length ? 'ไม่พบรายการตามคำค้นหาหรือสถานะ' : 'ยังไม่มีข้อมูล กดเพิ่มรายการเพื่อเริ่มต้น'}</td></tr> : filtered.map((item) => <tr key={item.id} className="hover:bg-[#f0f2eb]">
            <th scope="row" className="px-5 py-4 font-medium text-[#355a4b]">{item.title}</th><td className="px-5 py-4">{item.category}</td><td className="max-w-sm whitespace-pre-wrap break-words px-5 py-4 text-[#626862]">{item.description || '—'}</td><td className="whitespace-nowrap px-5 py-4">{item.status === 'ACTIVE' ? 'ใช้งาน' : 'เก็บถาวร'}</td>
            <td className="px-5 py-4"><div className="flex gap-2"><button aria-label={`แก้ไข ${item.title}`} className={buttonClass} onClick={() => { setNotice(''); setEditor({ mode: 'edit', item }); }}><Pencil size={14} aria-hidden="true" />แก้ไข</button><button aria-label={`ลบ ${item.title}`} className={`${buttonClass} text-red-700`} onClick={() => { setNotice(''); setEditor({ mode: 'delete', item }); }}><Trash2 size={14} aria-hidden="true" />ลบ</button></div></td>
          </tr>)}
        </tbody>
      </table></div>
    </div>
    {editor && <ThingEditor editor={editor} onClose={() => setEditor(null)} onSaved={(message) => { setEditor(null); setNotice(message); setQ(''); setStatus('ALL'); setRevision((value) => value + 1); }} />}
  </section>;
}
