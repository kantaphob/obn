'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Archive, ArchiveRestore, Check, CirclePlus, LockKeyhole, Pencil, Tag, X } from 'lucide-react';
import './finance-categories.css';

type Direction = 'INCOME' | 'EXPENSE';
type Category = { id: string; code: string; direction: Direction; name: string; isSystem: boolean; isActive: boolean };
type Editor = { id?: string; direction: Direction; name: string };

const directionName: Record<Direction, string> = { INCOME: 'รับ', EXPENSE: 'จ่าย' };

export default function CompanyFinanceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'ALL' | Direction>('ALL');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/company-finance-categories', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดหมวดหมู่ไม่สำเร็จ');
      setCategories(data);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดหมวดหมู่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const visible = useMemo(() => categories.filter((category) => filter === 'ALL' || category.direction === filter), [categories, filter]);
  const activeCount = categories.filter((category) => category.isActive).length;
  const incomeCount = categories.filter((category) => category.direction === 'INCOME' && category.isActive).length;
  const expenseCount = categories.filter((category) => category.direction === 'EXPENSE' && category.isActive).length;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editor.id ? `/api/company-finance-categories/${editor.id}` : '/api/company-finance-categories', {
        method: editor.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor.id ? { name: editor.name } : editor),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกหมวดหมู่ไม่สำเร็จ');
      setEditor(null);
      setNotice(editor.id ? 'แก้ไขหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกหมวดหมู่ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(category: Category) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/company-finance-categories/${category.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'เปลี่ยนสถานะไม่สำเร็จ');
      setNotice(category.isActive ? 'นำหมวดหมู่ออกจากตัวเลือกแล้ว ประวัติเดิมยังอยู่ครบ' : 'เปิดใช้หมวดหมู่อีกครั้งแล้ว');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return <main className="finance-categories-page">
    <div className="fc-wrap">
      <div className="fc-breadcrumb"><span>จัดการบริษัท</span><span>/</span><strong>หมวดหมู่รับ–จ่าย</strong></div>
      <header className="fc-header">
        <div><span className="fc-eyebrow"><Tag size={15}/> COMPANY FINANCE SETTINGS</span><h1>หมวดหมู่รับ–จ่าย</h1><p>จัดการหมวดหมู่ชุดเดียวสำหรับบัญชีบริษัทและรายการจากระบบสัญญา</p></div>
        <button className="fc-button primary" type="button" onClick={() => setEditor({ direction: 'EXPENSE', name: '' })}><CirclePlus size={18}/> เพิ่มหมวดหมู่</button>
      </header>

      {error && <div className="fc-alert error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="ปิด"><X size={16}/></button></div>}
      {notice && <div className="fc-alert success" role="status"><Check size={16}/>{notice}<button type="button" onClick={() => setNotice('')} aria-label="ปิด"><X size={16}/></button></div>}

      <section className="fc-stats" aria-label="สรุปหมวดหมู่">
        <article><span className="fc-stat-icon all"><Tag size={17}/></span><div><small>หมวดหมู่ที่เปิดใช้</small><strong>{activeCount}</strong></div></article>
        <article><span className="fc-stat-icon income"><ArrowDownLeft size={17}/></span><div><small>หมวดหมู่รับ</small><strong>{incomeCount}</strong></div></article>
        <article><span className="fc-stat-icon expense"><ArrowUpRight size={17}/></span><div><small>หมวดหมู่จ่าย</small><strong>{expenseCount}</strong></div></article>
      </section>

      <section className="fc-panel">
        <div className="fc-toolbar"><div className="fc-tabs" role="group" aria-label="กรองหมวดหมู่">
          {([['ALL', 'ทั้งหมด'], ['INCOME', 'รับ'], ['EXPENSE', 'จ่าย']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} type="button" onClick={() => setFilter(value)}>{label}</button>)}
        </div><span>{visible.length} หมวดหมู่</span></div>
        <div className="fc-table-wrap"><table className="fc-table"><thead><tr><th>หมวดหมู่</th><th>ประเภท</th><th>การใช้งาน</th><th>แหล่งที่มา</th><th className="fc-action-head">จัดการ</th></tr></thead>
          <tbody>{visible.map((category) => <tr key={category.id} className={!category.isActive ? 'inactive' : ''}>
            <td><div className="fc-name"><span className={`fc-type-icon ${category.direction.toLowerCase()}`}>{category.direction === 'INCOME' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</span><div><strong>{category.name}</strong><small>{category.code}</small></div></div></td>
            <td><span className={`fc-direction ${category.direction.toLowerCase()}`}>{directionName[category.direction]}</span></td>
            <td><span className={`fc-status ${category.isActive ? 'active' : 'inactive'}`}><i/> {category.isActive ? 'เปิดใช้' : 'เก็บไว้'}</span></td>
            <td>{category.isSystem ? <span className="fc-source system"><LockKeyhole size={13}/> ระบบสัญญา</span> : <span className="fc-source">บริษัท</span>}</td>
            <td><div className="fc-actions">{category.isSystem ? <span className="fc-locked">ใช้กับรายการสัญญา</span> : <><button type="button" className="fc-icon-button" aria-label={`แก้ไข ${category.name}`} disabled={busy} onClick={() => setEditor({ id: category.id, direction: category.direction, name: category.name })}><Pencil size={15}/></button><button type="button" className="fc-icon-button" aria-label={category.isActive ? `เก็บ ${category.name}` : `เปิดใช้ ${category.name}`} disabled={busy} onClick={() => void setActive(category)}>{category.isActive ? <Archive size={15}/> : <ArchiveRestore size={15}/>}</button></>}</div></td>
          </tr>)}
          {!loading && visible.length === 0 && <tr><td colSpan={5}><div className="fc-empty"><Tag size={22}/><strong>ยังไม่มีหมวดหมู่</strong><span>เพิ่มหมวดหมู่รับหรือจ่ายเพื่อใช้ในบัญชีบริษัท</span></div></td></tr>}
          {loading && <tr><td colSpan={5}><div className="fc-empty">กำลังโหลดหมวดหมู่…</div></td></tr>}
          </tbody></table></div>
      </section>
      <p className="fc-note"><LockKeyhole size={14}/> หมวดหมู่ระบบสัญญาเชื่อมกับรายการรับชำระ เงินต้น ดอกเบี้ย ค่าปรับ และเงินจ่ายกู้ จึงล็อกชื่อไว้เพื่อให้ข้อมูลสอดคล้องกัน ส่วนหมวดหมู่บริษัทสามารถแก้ชื่อหรือเก็บออกจากตัวเลือกได้</p>
    </div>

    {editor && <div className="fc-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditor(null); }}>
      <section className="fc-dialog" role="dialog" aria-modal="true" aria-labelledby="fc-dialog-title">
        <header><div><span className="fc-eyebrow">หมวดหมู่บริษัท</span><h2 id="fc-dialog-title">{editor.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</h2></div><button type="button" className="fc-icon-button" aria-label="ปิด" onClick={() => setEditor(null)} disabled={busy}><X size={18}/></button></header>
        <form onSubmit={save}>
          <div className="fc-dialog-body"><fieldset className="fc-type-picker"><legend>ประเภทรายการ</legend><label className={editor.direction === 'INCOME' ? 'selected income' : ''}><input type="radio" name="category-direction" disabled={Boolean(editor.id)} checked={editor.direction === 'INCOME'} onChange={() => setEditor({ ...editor, direction: 'INCOME' })}/><ArrowDownLeft size={17}/> รับ</label><label className={editor.direction === 'EXPENSE' ? 'selected expense' : ''}><input type="radio" name="category-direction" disabled={Boolean(editor.id)} checked={editor.direction === 'EXPENSE'} onChange={() => setEditor({ ...editor, direction: 'EXPENSE' })}/><ArrowUpRight size={17}/> จ่าย</label></fieldset>
            <label className="fc-field"><span>ชื่อหมวดหมู่ <b>*</b></span><input required autoFocus maxLength={80} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder={editor.direction === 'INCOME' ? 'เช่น ค่าบริการ' : 'เช่น ค่าอุปกรณ์'} /></label>
          </div>
          <footer><button type="button" className="fc-button" onClick={() => setEditor(null)} disabled={busy}>ยกเลิก</button><button className="fc-button primary" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : <><Check size={16}/> บันทึก</>}</button></footer>
        </form>
      </section>
    </div>}
  </main>;
}
