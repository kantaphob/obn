'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useToast, useTrackedFetch } from '@/components/ui/ToastProvider';
import type { CatalogItem, CatalogKind, CatalogResult } from '@/lib/reference-catalog-types';

export type CatalogEditState = { mode: 'create' | 'edit' | 'delete'; item?: CatalogItem };
const inputClass = 'mt-1.5 w-full rounded-lg border border-[#d7d9d0] bg-white px-3 py-2.5 text-sm disabled:bg-[var(--ws-soft,#eeece5)]';
const buttonClass = 'inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-[#d7d9d0] px-4 text-xs leading-none disabled:opacity-50';
const names = { units: 'หน่วยนับ', materials: 'วัสดุ', classifiers: 'ลักษณนาม' };

export default function CatalogEditor({ kind, state, categories, onClose, onDone }: {
  kind: CatalogKind;
  state: CatalogEditState;
  categories: string[];
  onClose: () => void;
  onDone: (mode: CatalogEditState['mode'], code: string) => void;
}) {
  const trackedFetch = useTrackedFetch();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const item = state.item;
  const [form, setForm] = useState<Record<string, string>>({ code: item?.code ?? '', nameTh: item?.nameTh ?? '', nameEn: item?.nameEn ?? '', category: item?.category ?? '', symbol: item?.symbol ?? '', standard: item?.standard ?? 'กำหนดเอง', examples: item?.examples ?? '', recommendedUnitCode: item?.recommendedUnit?.code ?? '' });
  const [saving, setSaving] = useState(false);
  const notify = useToast();
  const [units, setUnits] = useState<CatalogItem[]>([]);
  const [unitsError, setUnitsError] = useState('');
  const [unitsReady, setUnitsReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const deleting = state.mode === 'delete';
  const title = `${deleting ? 'ลบ' : state.mode === 'edit' ? 'แก้ไข' : 'เพิ่ม'}${names[kind]}`;

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (kind !== 'materials' || deleting) return;
    const controller = new AbortController();
    async function load() {
      try {
        const options: CatalogItem[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const response = await trackedFetch(`/api/units?pageSize=100&page=${page}`, { signal: controller.signal, cache: 'no-store' });
          if (!response.ok) throw new Error('โหลดหน่วยนับไม่สำเร็จ');
          const result: CatalogResult = await response.json();
          options.push(...result.items);
          totalPages = result.totalPages;
          page++;
        } while (page <= totalPages);
        if (!controller.signal.aborted) { setUnits(options); setUnitsReady(true); setUnitsError(''); }
      } catch {
        if (!controller.signal.aborted) setUnitsError('โหลดหน่วยนับไม่สำเร็จ กรุณาลองใหม่');
      }
    }
    void load();
    return () => controller.abort();
  }, [kind, deleting, retry, trackedFetch]);

  function change(key: string, value: string) { setForm((previous) => ({ ...previous, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, string | null> = { code: form.code.trim(), nameTh: form.nameTh, nameEn: form.nameEn, category: form.category };
      if (kind === 'units') { payload.symbol = form.symbol; payload.standard = form.standard; }
      if (kind === 'classifiers') payload.examples = form.examples;
      if (kind === 'materials') payload.recommendedUnitCode = form.recommendedUnitCode || null;
      const url = state.mode === 'create' ? `/api/${kind}` : `/api/${kind}/${encodeURIComponent(item!.code)}`;
      const response = await trackedFetch(url, { method: deleting ? 'DELETE' : state.mode === 'create' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, ...(deleting ? {} : { body: JSON.stringify(payload) }) });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
      }
      onDone(state.mode, deleting ? item!.code : form.code.trim());
    } catch (err) { notify({ status: 'error', message: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ' }); setSaving(false); }
  }

  const fields = [
    { key: 'code', label: 'รหัส', max: 32, required: true },
    { key: 'nameTh', label: kind === 'classifiers' ? 'ลักษณนาม' : 'ชื่อภาษาไทย', max: 120, required: true },
    { key: 'nameEn', label: 'ชื่อ / คำอธิบายภาษาอังกฤษ', max: 160, required: false },
    { key: 'category', label: 'หมวดหมู่', max: 100, required: true },
    ...(kind === 'units' ? [{ key: 'symbol', label: 'สัญลักษณ์ / ตัวย่อ', max: 40, required: true }, { key: 'standard', label: 'มาตรฐาน / ประเภทหน่วย', max: 80, required: false }] : []),
  ];

  return <dialog ref={dialog} aria-labelledby={`${id}-title`} className="fixed inset-0 m-auto w-[min(560px,calc(100%_-_32px))] max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] p-6 text-[#272b29] shadow-xl backdrop:bg-black/40" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id={`${id}-title`} className="text-xl font-medium">{title}</h2><button type="button" aria-label="ปิดฟอร์ม" disabled={saving} onClick={onClose} className={`${buttonClass} w-10 px-0!`}>×</button></div>
    <form onSubmit={submit}>
      {deleting ? <p className="mb-5 leading-relaxed">ยืนยันลบ “{item?.nameTh}” ({item?.code})? ข้อมูลจะถูกลบออกจากฐานข้อมูล</p> : <fieldset disabled={saving} className="grid gap-4">
        {fields.map((field) => <label key={field.key} className="text-xs text-[#626862]">{field.label}{field.required ? ' *' : ''}
          <input className={inputClass} name={field.key} value={form[field.key]} required={field.required} maxLength={field.max} disabled={field.key === 'code' && state.mode === 'edit'} pattern={field.key === 'code' ? '[A-Z0-9][A-Z0-9_-]{0,31}' : undefined} list={field.key === 'category' ? `${id}-categories` : undefined} onChange={(event) => change(field.key, field.key === 'code' ? event.target.value.toUpperCase() : event.target.value)} />
        </label>)}
        <datalist id={`${id}-categories`}>{categories.map((category) => <option key={category} value={category} />)}</datalist>
        <p className="text-xs text-[#626862]">{state.mode === 'edit' ? 'รหัสรายการคงเดิมเพื่อรักษาการอ้างอิง' : 'รหัสใช้ตัวอักษรอังกฤษพิมพ์ใหญ่ ตัวเลข - และ _ เช่น MAT001, UNIT01 หรือ CL046'}</p>
        {kind === 'classifiers' ? <label className="text-xs text-[#626862]">ตัวอย่างการใช้ *<textarea className={inputClass} name="examples" rows={3} maxLength={1000} required value={form.examples} placeholder="เชือก 2 เส้น; ด้าย 3 เส้น" onChange={(event) => change('examples', event.target.value)} /></label> : null}
        {kind === 'materials' ? <label className="text-xs text-[#626862]">หน่วยแนะนำ
          <select className={inputClass} value={form.recommendedUnitCode} disabled={!unitsReady} onChange={(event) => change('recommendedUnitCode', event.target.value)}><option value="">{unitsReady ? 'เลือกตามสินค้า / ไม่ระบุ' : 'กำลังโหลดหน่วย…'}</option>{units.map((unit) => <option key={unit.code} value={unit.code}>{unit.nameTh} ({unit.code} / {unit.symbol})</option>)}</select>
        </label> : null}
      </fieldset>}
      {unitsError && !deleting ? <div role="alert" className="mt-4 text-sm text-red-700">{unitsError}<button type="button" className={`${buttonClass} ml-2`} onClick={() => setRetry((value) => value + 1)}>ลองใหม่</button></div> : null}
      <div className="mt-6 flex justify-end gap-3"><button type="button" className={`${buttonClass} w-32`} disabled={saving} onClick={onClose}>ยกเลิก</button><button type="submit" disabled={saving || (!deleting && kind === 'materials' && !unitsReady)} className={`${buttonClass} w-32 ${deleting ? 'bg-red-700 text-white' : 'bg-[var(--ws-accent-soft,#355a4b)] text-white'}`}>{saving ? 'กำลังบันทึก…' : deleting ? 'ยืนยันลบ' : 'บันทึก'}</button></div>
    </form>
  </dialog>;
}
