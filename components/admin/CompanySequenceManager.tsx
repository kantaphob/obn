'use client';

import { useTrackedFetch } from '@/components/ui/ToastProvider';
import { Building2, MapPin, Pencil, Plus, Search, Store, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { workspaceStyles as styles } from '@/components/ui/workspace-styles';

type Status = 'ACTIVE' | 'INACTIVE';
type Company = {
  id: string;
  companycode: string;
  logo: string | null;
  nameTH: string | null;
  nameEN: string | null;
  TaxIdentificationNumber: string | null;
  aboutus: string | null;
  companyoverview: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  status: Status;
  _count?: { branches: number };
};
type Branch = Omit<Company, 'companycode' | '_count'> & {
  companycode: string;
  branchcode: string;
  company: { nameTH: string | null; nameEN: string | null };
};
type RecordItem = Company | Branch;
type Props = { kind: 'companies' | 'branches' };

const optionalFields = [
  { key: 'nameEN', label: 'ชื่อภาษาอังกฤษ', max: 200 },
  { key: 'TaxIdentificationNumber', label: 'เลขประจำตัวผู้เสียภาษี', max: 32 },
  { key: 'address', label: 'ที่อยู่', max: 1000, wide: true },
  { key: 'postcode', label: 'รหัสไปรษณีย์', max: 10 },
  { key: 'phone', label: 'เบอร์โทรศัพท์', max: 40 },
  { key: 'email', label: 'อีเมล', max: 200, type: 'email' },
  { key: 'logo', label: 'URL โลโก้', max: 1000, wide: true },
  { key: 'aboutus', label: 'เกี่ยวกับเรา', max: 5000, wide: true, textarea: true },
  { key: 'companyoverview', label: 'ภาพรวมบริษัท', max: 5000, wide: true, textarea: true },
] as const;

const buttonClass = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-4 text-xs disabled:opacity-50';
const fieldClass = 'mt-2 w-full rounded-xl border border-[#d7d9d0] bg-white px-3 py-2.5 text-sm';

function displayName(item: { nameTH: string | null; nameEN: string | null }) {
  return item.nameTH || item.nameEN || 'ยังไม่ได้ระบุชื่อ';
}

function Editor({
  kind, companies, item, initialDelete, onClose, onSaved,
}: {
  kind: Props['kind']; companies: Company[]; item: RecordItem | null;
  initialDelete: boolean;
  onClose: () => void; onSaved: (message: string) => void;
}) {
  const trackedFetch = useTrackedFetch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteMode, setDeleteMode] = useState(initialDelete);
  const isBranch = kind === 'branches';
  const isEditing = Boolean(item);
  const title = deleteMode ? `ลบ${isBranch ? 'สาขา' : 'บริษัท'}` : `${isEditing ? 'แก้ไข' : 'เพิ่ม'}${isBranch ? 'สาขา' : 'บริษัท'}`;
  const editingCompany = item as Company | null;
  const editingBranch = item as Branch | null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !item && deleteMode) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      const endpoint = isBranch ? '/api/branch-sequences' : '/api/company-sequences';
      const url = item ? `${endpoint}/${encodeURIComponent(item.id)}` : endpoint;
      const response = await trackedFetch(url, {
        method: deleteMode ? 'DELETE' : item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: deleteMode ? undefined : JSON.stringify(data),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'บันทึกข้อมูลไม่สำเร็จ');
      onSaved(deleteMode ? `ลบ${isBranch ? 'สาขา' : 'บริษัท'}แล้ว` : 'บันทึกข้อมูลแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return <div className="borrower-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="company-editor-title" className="borrower-modal borrower-crud-modal" style={{ width: 'min(820px,100%)' }}>
      <header className="borrower-modal-header">
        <div><p className="borrowers-eyebrow">MASTER DATA / {isBranch ? 'BRANCH' : 'COMPANY'}</p><h2 id="company-editor-title">{title}</h2><p>รหัสต้องเป็นตัวเลข 5 หลัก</p></div>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={onClose}>×</button>
      </header>
      <form className="borrower-form" onSubmit={submit}>
        {deleteMode ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ยืนยันลบ{isBranch ? 'สาขา' : 'บริษัท'} <strong>{isBranch ? editingBranch?.branchcode : editingCompany?.companycode} — {displayName(item ?? { nameTH: null, nameEN: null })}</strong>?
          {!isBranch && Boolean(editingCompany?._count?.branches) && <p className="mt-2">สาขาใต้บริษัทนี้ {editingCompany?._count?.branches} แห่งจะถูกลบตามไปด้วย</p>}
        </div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isBranch && <label className="compact-field sm:col-span-2">บริษัทแม่
            <select name="companycode" required defaultValue={editingBranch?.companycode ?? ''} disabled={busy} className={fieldClass}>
              <option value="" disabled>เลือกบริษัท</option>
              {companies.map((company) => <option key={company.id} value={company.companycode}>{company.companycode} · {displayName(company)}</option>)}
            </select>
          </label>}
          <label className="compact-field">{isBranch ? 'รหัสสาขา' : 'รหัสบริษัท'}
            <input name={isBranch ? 'branchcode' : 'companycode'} required maxLength={5} minLength={5} pattern="[0-9]{5}" inputMode="numeric" title="กรอกตัวเลข 5 หลัก" defaultValue={isBranch ? editingBranch?.branchcode ?? '' : editingCompany?.companycode ?? ''} readOnly={busy || Boolean(item)} className={fieldClass} />
          </label>
          <label className="compact-field">ชื่อภาษาไทย
            <input name="nameTH" required maxLength={200} defaultValue={item?.nameTH ?? ''} disabled={busy} className={fieldClass} />
          </label>
          {optionalFields.map((field) => <label key={field.key} className={`compact-field ${'wide' in field && field.wide ? 'sm:col-span-2' : ''}`}>
            {field.label}
            {'textarea' in field && field.textarea
              ? <textarea name={field.key} maxLength={field.max} defaultValue={item?.[field.key] ?? ''} disabled={busy} rows={3} className={`${fieldClass} resize-y`} />
              : <input name={field.key} type={'type' in field ? field.type : 'text'} maxLength={field.max} defaultValue={item?.[field.key] ?? ''} disabled={busy} className={fieldClass} />}
          </label>)}
          <label className="compact-field">สถานะ
            <select name="status" defaultValue={item?.status ?? 'ACTIVE'} disabled={busy} className={fieldClass}>
              <option value="ACTIVE">ใช้งาน</option><option value="INACTIVE">ไม่ใช้งาน</option>
            </select>
          </label>
        </div>}
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <footer className="borrower-modal-footer">
          <span>ข้อมูลจะถูกบันทึกลงฐานข้อมูล</span>
          <div>
            {deleteMode && <button type="button" disabled={busy} onClick={() => setDeleteMode(false)} className={buttonClass}>ย้อนกลับ</button>}
            <button type="button" disabled={busy} onClick={onClose} className={buttonClass}>ยกเลิก</button>
            {deleteMode
              ? <button className={`${buttonClass} border-red-700 bg-red-700 text-white`} disabled={busy}>{busy ? 'กำลังลบ…' : 'ยืนยันลบ'}</button>
              : <><button type="button" disabled={busy || !item} onClick={() => setDeleteMode(true)} className={`${buttonClass} text-red-700`}>ลบ</button><button className={`${buttonClass} border-[#355a4b] bg-[#355a4b] text-white`} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}
          </div>
        </footer>
      </form>
    </section>
  </div>;
}

export default function CompanySequenceManager({ kind }: Props) {
  const trackedFetch = useTrackedFetch();
  const isBranch = kind === 'branches';
  const [companies, setCompanies] = useState<Company[]>([]);
  const [items, setItems] = useState<RecordItem[]>([]);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<RecordItem | null | undefined>(undefined);
  const [editorDelete, setEditorDelete] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [companiesResponse, itemsResponse] = await Promise.all([
          trackedFetch('/api/company-sequences', { cache: 'no-store', signal: controller.signal }),
          trackedFetch(isBranch ? '/api/branch-sequences' : '/api/company-sequences', { cache: 'no-store', signal: controller.signal }),
        ]);
        if (!companiesResponse.ok || !itemsResponse.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
        const companyData: Company[] = await companiesResponse.json();
        const itemData: RecordItem[] = await itemsResponse.json();
        if (!controller.signal.aborted) {
          setCompanies(companyData);
          setItems(itemData);
          setError('');
          setLoadedRevision(revision);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ');
          setLoadedRevision(revision);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [isBranch, revision, trackedFetch]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [
      isBranch ? (item as Branch).branchcode : (item as Company).companycode,
      item.nameTH,
      item.nameEN,
      item.TaxIdentificationNumber,
      item.phone,
      item.address,
      isBranch ? displayName((item as Branch).company) : '',
    ].some((value) => value?.toLocaleLowerCase().includes(normalized)));
  }, [items, isBranch, query]);
  const loading = loadedRevision !== revision;
  const allBranches = companies.reduce((total, company) => total + (company._count?.branches ?? 0), 0);

  return <section className={styles.page}>
    <header className={`${styles.pageHeader} flex flex-wrap items-start justify-between gap-4`}>
      <div><p className={styles.eyebrow}>MASTER DATA / {isBranch ? 'BRANCHES' : 'COMPANIES'}</p>
        <h1 className="flex items-center gap-3">{isBranch ? <Store size={28} aria-hidden="true" /> : <Building2 size={28} aria-hidden="true" />}{isBranch ? 'สาขา' : 'บริษัท'}</h1>
        <p className="text-sm text-[#626862]">{isBranch ? 'จัดการสาขาภายใต้บริษัทหลัก' : 'จัดการข้อมูลบริษัทและรหัสบริษัท'}</p>
      </div>
      <button className={`${buttonClass} bg-[#355a4b] text-white`} disabled={isBranch && companies.length === 0} onClick={() => { setNotice(''); setEditorDelete(false); setEditor(null); }}><Plus size={16} aria-hidden="true" />เพิ่ม{isBranch ? 'สาขา' : 'บริษัท'}</button>
    </header>
    <div className="mb-5 flex flex-wrap gap-3 text-sm text-[#626862]">
      <span className="rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-4 py-2">บริษัท {companies.length} แห่ง</span>
      <span className="rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-4 py-2">สาขา {allBranches} แห่ง</span>
      {isBranch && <Link href="/admin/companies" className="inline-flex items-center gap-2 px-2 text-[#355a4b] underline"><Building2 size={15} />จัดการบริษัทแม่</Link>}
    </div>
    {notice && <p role="status" className="mb-4 text-sm text-[#355a4b]">{notice}</p>}
    <label className="mb-5 flex items-center gap-2 rounded-xl border border-[#d7d9d0] bg-[#faf9f5] px-3 py-2.5"><Search size={18} aria-hidden="true" /><span className="sr-only">ค้นหา{isBranch ? 'สาขา' : 'บริษัท'}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`ค้นหารหัส ชื่อ เลขผู้เสียภาษี หรือเบอร์โทร${isBranch ? ' / บริษัทแม่' : ''}`} className="w-full bg-transparent text-sm" /></label>
    {error && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-red-700">{error}<button className={buttonClass} onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button></div>}
    <div className="overflow-hidden rounded-2xl border border-[#d7d9d0] bg-[#faf9f5]">
      <div className="flex justify-between border-b border-[#d7d9d0] px-5 py-4 text-sm"><h2>รายการ{isBranch ? 'สาขา' : 'บริษัท'}</h2><span>{filteredItems.length} / {items.length} รายการ</span></div>
      <div className="overflow-x-auto"><table aria-busy={loading} className="w-full min-w-[900px] text-left text-sm">
        <caption className="sr-only">รายการ{isBranch ? 'สาขา' : 'บริษัท'}จากฐานข้อมูล</caption>
        <thead className="bg-[#eeece5] text-xs text-[#626862]"><tr>{[isBranch ? 'รหัสสาขา' : 'รหัสบริษัท', ...(isBranch ? ['บริษัทแม่'] : ['ชื่อบริษัท']), 'เลขผู้เสียภาษี', 'ที่อยู่', 'เบอร์โทร', 'สถานะ', 'จัดการ'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#d7d9d0]">
          {loading ? <tr><td colSpan={7} className="p-6 text-center">กำลังโหลด…</td></tr>
            : error ? <tr><td colSpan={7} className="p-6 text-center">ไม่สามารถโหลดข้อมูลได้</td></tr>
              : !filteredItems.length ? <tr><td colSpan={7} className="p-6 text-center">ไม่พบข้อมูล{isBranch ? 'สาขา' : 'บริษัท'}</td></tr>
                : filteredItems.map((item) => {
                  const code = isBranch ? (item as Branch).branchcode : (item as Company).companycode;
                  return <tr key={item.id} className="hover:bg-[#f0f2eb]">
                    <th scope="row" className="px-5 py-4 font-mono text-[#355a4b]">{code}</th>
                    <td className="px-5 py-4">{isBranch ? <><span className="block">{displayName((item as Branch).company)}</span><small className="text-[#626862]">{item.companycode}</small></> : <><span className="block">{displayName(item)}</span>{item.nameEN && <small lang="en" className="text-[#626862]">{item.nameEN}</small>}</>}</td>
                    <td className="px-5 py-4">{item.TaxIdentificationNumber || '—'}</td>
                    <td className="max-w-[260px] px-5 py-4"><span className="line-clamp-2">{item.address || '—'}</span>{item.postcode && <small className="text-[#626862]">{item.postcode}</small>}</td>
                    <td className="whitespace-nowrap px-5 py-4">{item.phone || '—'}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${item.status === 'ACTIVE' ? 'bg-[#e8f3eb] text-[#355a4b]' : 'bg-[#f0eee8] text-[#77756e]'}`}>{item.status === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'}</span></td>
                    <td className="px-5 py-4"><div className="flex gap-2"><button aria-label={`แก้ไข ${code}`} className={buttonClass} onClick={() => { setNotice(''); setEditorDelete(false); setEditor(item); }}><Pencil size={14} aria-hidden="true" />แก้ไข</button><button aria-label={`ลบ ${code}`} className={`${buttonClass} text-red-700`} onClick={() => { setNotice(''); setEditorDelete(true); setEditor(item); }}><Trash2 size={14} aria-hidden="true" />ลบ</button></div></td>
                  </tr>;
                })}
        </tbody>
      </table></div>
    </div>
    {isBranch && companies.length === 0 && !loading && <div className="mt-4 flex items-center gap-2 text-sm text-[#626862]"><MapPin size={16} />เพิ่มบริษัทก่อน แล้วจึงเพิ่มสาขาได้ <Link className="text-[#355a4b] underline" href="/admin/companies">ไปหน้าบริษัท</Link></div>}
    {editor !== undefined && <Editor kind={kind} companies={companies} item={editor} initialDelete={editorDelete} onClose={() => setEditor(undefined)} onSaved={(message) => { setEditor(undefined); setNotice(message); setQuery(''); setRevision((value) => value + 1); }} />}
  </section>;
}
