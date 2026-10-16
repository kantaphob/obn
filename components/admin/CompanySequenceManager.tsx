'use client';

import CompanyAddressFields from './CompanyAddressFields';
import OwnerAddressFields from './OwnerAddressFields';
import { useTrackedFetch } from '@/components/ui/ToastProvider';
import { Building2, ImagePlus, MapPin, Pencil, Plus, Search, Store, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from 'react';

type Status = 'ACTIVE' | 'INACTIVE';
type CompanyOwner = {
  ownerNationalId?: string | null; ownerPrefix?: string | null; ownerFirstName?: string | null; ownerLastName?: string | null;
  ownerPhone?: string | null; ownerEmail?: string | null; ownerAddress?: string | null;
  ownerDocumentUrl?: string | null; ownerDocumentName?: string | null;
  ownerProvince?: string | null; ownerDistrict?: string | null; ownerSubdistrict?: string | null;
  ownerPostcode?: string | null;
  ownerMoo?: string | null; ownerSoi?: string | null; ownerRoad?: string | null;
  ownerProvinceId?: number | null; ownerDistrictId?: number | null; ownerSubdistrictId?: number | null;
};
type Company = {
  owner?: CompanyOwner | null;
  houseNo: string | null; moo: string | null; soi: string | null; road: string | null;
  provinceId: string | null; districtId: string | null; subdistrictId: string | null;
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

type FieldKey =
  | 'ownerNationalId' | 'ownerPrefix'
  | 'ownerFirstName' | 'ownerLastName' | 'ownerPhone' | 'ownerEmail'
  | 'nameEN' | 'TaxIdentificationNumber' | 'address' | 'postcode'
  | 'phone' | 'email' | 'aboutus' | 'companyoverview';
type FieldDef = { key: FieldKey; label: string; max: number; wide?: boolean; type?: string; textarea?: boolean };

const ownerFields: FieldDef[] = [
  { key: 'ownerNationalId', label: 'เลขประจำตัวประชาชนเจ้าของ', max: 13, wide: true },
  { key: 'ownerPrefix', label: 'คำนำหน้า', max: 40 },
  { key: 'ownerFirstName', label: 'ชื่อเจ้าของ', max: 200 },
  { key: 'ownerLastName', label: 'นามสกุลเจ้าของ', max: 200, wide: true },
  { key: 'ownerPhone', label: 'เบอร์โทรเจ้าของ', max: 40, type: 'tel' },
  { key: 'ownerEmail', label: 'อีเมลเจ้าของ', max: 200, type: 'email' },
];
const infoFields: FieldDef[] = [
  { key: 'nameEN', label: 'ชื่อภาษาอังกฤษ', max: 200 },
  { key: 'TaxIdentificationNumber', label: 'เลขประจำตัวผู้เสียภาษี', max: 32 },
  { key: 'phone', label: 'เบอร์โทรศัพท์', max: 40 },
  { key: 'email', label: 'อีเมล', max: 200, type: 'email' },
];
const textFields: FieldDef[] = [
  { key: 'aboutus', label: 'เกี่ยวกับเรา', max: 5000, wide: true, textarea: true },
  { key: 'companyoverview', label: 'ภาพรวมบริษัท', max: 5000, wide: true, textarea: true },
];

/* ---------- design tokens ---------- */
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5c4a]';
const btn = `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const btnPrimary = `${btn} bg-[var(--ws-accent-soft,#1f5c4a)] text-white hover:bg-[var(--ws-accent-soft,#184a3c)]`;
const btnSecondary = `${btn} border border-[#d5dbd8] bg-white text-[#1d2b27] hover:bg-[var(--ws-soft,#f3f5f4)]`;
const btnDanger = `${btn} bg-[#b42318] text-white hover:bg-[#912018]`;
const btnDangerGhost = `${btn} border border-[#f1c9c5] bg-white text-[#b42318] hover:bg-[#fdf3f2]`;
const iconBtn = `inline-flex size-9 items-center justify-center rounded-lg text-[#5b6b66] transition-colors hover:bg-[var(--ws-soft,#eaf0ed)] hover:text-[#1f5c4a] ${focus}`;
const fieldClass =
  'mt-1.5 w-full rounded-lg border border-[#d5dbd8] bg-white px-3 py-2.5 text-sm text-[#1d2b27] placeholder:text-[#8a9792] focus:border-[#1f5c4a] focus:outline-2 focus:outline-[#1f5c4a]/25 disabled:bg-[var(--ws-soft,#f3f5f4)] read-only:bg-[var(--ws-soft,#f3f5f4)] read-only:text-[#5b6b66]';
const labelClass = 'block text-sm font-medium text-[#1d2b27]';

function displayName(item: { nameTH: string | null; nameEN: string | null }) {
  return item.nameTH || item.nameEN || 'ยังไม่ได้ระบุชื่อ';
}

function Logo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const style = { "--logo-size": `${size}px` } as CSSProperties;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="size-[var(--logo-size)] shrink-0 rounded-lg border border-[#dfe4e1] bg-white object-contain p-1" />;
  }
  return (
    <span aria-hidden="true" style={style} className="size-[var(--logo-size)] grid shrink-0 place-items-center rounded-lg bg-[var(--ws-soft,#e3ede9)] text-sm font-semibold text-[#1f5c4a]">
      {name.trim().charAt(0) || '?'}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-[var(--ws-soft,#e3f2ea)] text-[#1f5c4a]' : 'bg-[var(--ws-soft,#eef0ef)] text-[#6b7773]'}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${active ? 'bg-[var(--ws-accent-soft,#2e9a6f)]' : 'bg-[#9aa5a1]'}`} />
      {active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-[#e6ebe8] pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#1d2b27]">{title}</h3>
        {hint && <p className="text-xs text-[#6b7773]">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
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
  const [ownerDocumentUrl, setOwnerDocumentUrl] = useState(item?.owner?.ownerDocumentUrl ?? '');
  const [ownerDocumentName, setOwnerDocumentName] = useState(item?.owner?.ownerDocumentName ?? '');
  const [ownerDocument, setOwnerDocument] = useState<File | null>(null);
  const [logo, setLogo] = useState(item?.logo ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const isBranch = kind === 'branches';
  const isEditing = Boolean(item);
  const noun = isBranch ? 'สาขา' : 'บริษัท';
  const title = deleteMode ? `ลบ${noun}` : `${isEditing ? 'แก้ไข' : 'เพิ่ม'}${noun}`;
  const editingCompany = item as Company | null;
  const editingBranch = item as Branch | null;
  const shownLogo = logoFile ? preview : logo;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (!item && deleteMode)) return;
    const form = event.currentTarget;
    if (!deleteMode && form.querySelector('[data-address-pending="true"]')) { setError('กรุณารอข้อมูลที่อยู่โหลดสำเร็จก่อนบันทึก'); return; }
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      if (!deleteMode) {
        let savedLogo = logo;
        if (logoFile) {
          const upload = new FormData();
          upload.set('file', logoFile);
          upload.set('entityCode', String(data[isBranch ? 'branchcode' : 'companycode'] ?? ''));
          const uploadResponse = await trackedFetch('/api/company-logos', { method: 'POST', body: upload });
          const result = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(result.error ?? 'อัปโหลดโลโก้ไม่สำเร็จ');
          savedLogo = result.url;
          setLogo(savedLogo);
          setLogoFile(null);
          setPreview('');
        }
        data.logo = savedLogo;
        if (!isBranch) {
          let documentUrl = ownerDocumentUrl;
          let documentName = ownerDocumentName;
          if (ownerDocument) {
            const upload = new FormData(); upload.set('file', ownerDocument); upload.set('entityCode', String(data.companycode ?? ''));
            const response = await trackedFetch('/api/company-owner-documents', { method: 'POST', body: upload });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? 'อัปโหลดเอกสารไม่สำเร็จ');
            documentUrl = result.url; documentName = ownerDocument.name;
            setOwnerDocumentUrl(documentUrl); setOwnerDocumentName(documentName); setOwnerDocument(null);
          }
          data.ownerDocumentUrl = documentUrl; data.ownerDocumentName = documentName;
        }
      }
      const endpoint = isBranch ? '/api/branch-sequences' : '/api/company-sequences';
      const url = item ? `${endpoint}/${encodeURIComponent(item.id)}` : endpoint;
      const response = await trackedFetch(url, {
        method: deleteMode ? 'DELETE' : item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: deleteMode ? undefined : JSON.stringify(data),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'บันทึกข้อมูลไม่สำเร็จ');
      onSaved(deleteMode ? `ลบ${noun}แล้ว` : 'บันทึกข้อมูลแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  function renderField(field: FieldDef) {
    const span = field.wide ? 'sm:col-span-2' : '';
    const initialValue = field.key.startsWith('owner') ? (item as Company | null)?.owner?.[field.key as keyof CompanyOwner] : (item as unknown as Record<string, unknown> | null)?.[field.key];
    if (field.key === 'ownerPrefix') return <label key={field.key} className={labelClass}>{field.label}
      <select name={field.key} defaultValue={initialValue ?? ''} disabled={busy} className={fieldClass}>
        <option value="">เลือกคำนำหน้า</option><option>นาย</option><option>นาง</option><option>นางสาว</option><option>ดร.</option><option>อื่น ๆ</option>
      </select>
    </label>;
    return (
      <label key={field.key} className={`${labelClass} ${span}`}>
        {field.label}
        {field.textarea
          ? <textarea name={field.key} maxLength={field.max} defaultValue={initialValue ?? ''} disabled={busy} rows={3} className={`${fieldClass} resize-y`} />
          : <input name={field.key} type={field.type ?? 'text'} maxLength={field.max} defaultValue={initialValue ?? ''} disabled={busy} className={fieldClass} />}
      </label>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#12201b]/45 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <section
        role="dialog" aria-modal="true" aria-labelledby="company-editor-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e6ebe8] px-6 py-5">
          <div>
            <h2 id="company-editor-title" className="text-lg font-semibold text-[#1d2b27]">{title}</h2>
            {!deleteMode && <p className="mt-0.5 text-sm text-[#6b7773]">รหัสต้องเป็นตัวเลข 5 หลัก</p>}
          </div>
          <button type="button" className={iconBtn} aria-label="ปิด" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {deleteMode ? (
              <div className="flex gap-4 rounded-xl border border-[#f1c9c5] bg-[#fdf3f2] p-4 text-sm text-[#7a1f17]">
                <Trash2 size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p>
                    ต้องการลบ{noun} <strong>{isBranch ? editingBranch?.branchcode : editingCompany?.companycode} {displayName(item ?? { nameTH: null, nameEN: null })}</strong> ใช่หรือไม่
                  </p>
                  {!isBranch && Boolean(editingCompany?._count?.branches) && (
                    <p className="mt-2 font-medium">สาขาใต้บริษัทนี้ {editingCompany?._count?.branches} แห่งจะถูกลบไปด้วย</p>
                  )}
                  <p className="mt-2 text-[#9b4a43]">การลบไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
            ) : (
              <>
                <Section title="ข้อมูลหลัก">
                  {isBranch && (
                    <label className={`${labelClass} sm:col-span-2`}>บริษัทแม่
                      <select name="companycode" required defaultValue={editingBranch?.companycode ?? ''} disabled={busy} className={fieldClass}>
                        <option value="" disabled>เลือกบริษัท</option>
                        {companies.map((company) => <option key={company.id} value={company.companycode}>{company.companycode} {displayName(company)}</option>)}
                      </select>
                    </label>
                  )}
                  <label className={labelClass}>{isBranch ? 'รหัสสาขา' : 'รหัสบริษัท'}
                    <input
                      name={isBranch ? 'branchcode' : 'companycode'} required maxLength={5} minLength={5}
                      pattern="[0-9]{5}" inputMode="numeric" title="กรอกตัวเลข 5 หลัก" placeholder="00000"
                      defaultValue={isBranch ? editingBranch?.branchcode ?? '' : editingCompany?.companycode ?? ''}
                      readOnly={busy || Boolean(item)} className={`${fieldClass} font-mono tabular-nums`}
                    />
                  </label>
                  <label className={labelClass}>สถานะ
                    <select name="status" defaultValue={item?.status ?? 'ACTIVE'} disabled={busy} className={fieldClass}>
                      <option value="ACTIVE">ใช้งาน</option><option value="INACTIVE">ไม่ใช้งาน</option>
                    </select>
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>ชื่อภาษาไทย
                    <input name="nameTH" required maxLength={200} defaultValue={item?.nameTH ?? ''} disabled={busy} className={fieldClass} />
                  </label>
                </Section>

                {!isBranch && <Section title="ข้อมูลเจ้าของบริษัทและเอกสาร" hint="ชื่อ–นามสกุล ข้อมูลติดต่อ และเอกสารยืนยันความเป็นเจ้าของ (ไม่บังคับ)">
                  {ownerFields.map(renderField)}
                  <OwnerAddressFields item={(item as Company | null)?.owner ?? null} disabled={busy} fieldClass={fieldClass} labelClass={labelClass} />
                  <label className={`${labelClass} sm:col-span-2`}>เอกสารยืนยันความเป็นเจ้าของ
                    <input type="file" disabled={busy} accept="application/pdf,image/png,image/jpeg,image/webp" className={fieldClass} onChange={(event) => {
                      const file = event.target.files?.[0]; if (!file) return;
                      if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024 || file.name.length > 200) { setError('เลือก PDF, PNG, JPG หรือ WebP ไม่เกิน 10 MB ชื่อไฟล์ไม่เกิน 200 ตัวอักษร'); event.target.value = ''; return; }
                      setError(''); setOwnerDocument(file);
                    }} />
                    <span className="mt-2 block text-xs text-[#6b7773]">PDF, PNG, JPG หรือ WebP ไม่เกิน 10 MB อัปโหลดเมื่อกดบันทึก</span>
                  </label>
                  {(ownerDocument || ownerDocumentUrl) && <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                    {ownerDocument ? <span className="text-sm">ไฟล์ที่เลือก: {ownerDocument.name}</span> : <a href={ownerDocumentUrl} target="_blank" rel="noreferrer" className="text-sm text-[#1f5c4a] underline">เปิดเอกสาร: {ownerDocumentName || 'เอกสารเจ้าของ'}</a>}
                    <button type="button" disabled={busy} className={btnSecondary} onClick={() => { setOwnerDocument(null); setOwnerDocumentUrl(''); setOwnerDocumentName(''); }}>นำเอกสารออก</button>
                  </div>}
                </Section>}

                <Section title="โลโก้" hint="PNG, JPG หรือ WebP ไม่เกิน 5 MB">
                  <div className="flex items-center gap-4 sm:col-span-2">
                    {shownLogo
                      ? <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={shownLogo} alt="ตัวอย่างโลโก้" className="size-20 shrink-0 rounded-xl border border-[#dfe4e1] bg-white object-contain p-2" />
                        </>
                      : <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-xl border border-dashed border-[#c5cdc9] bg-[var(--ws-soft,#f6f8f7)] text-[#8a9792]"><ImagePlus size={24} /></span>}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={`${btnSecondary} cursor-pointer has-[:disabled]:opacity-50`}>
                        <ImagePlus size={16} aria-hidden="true" />{shownLogo ? 'เปลี่ยนโลโก้' : 'เลือกไฟล์'}
                        <input
                          id="company-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
                              setError('รองรับ PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB');
                              event.target.value = '';
                              return;
                            }
                            setError(''); setLogoFile(file); setPreview(URL.createObjectURL(file));
                          }}
                        />
                      </label>
                      {shownLogo && (
                        <button type="button" className={btnSecondary} disabled={busy} onClick={() => {
                          setLogo(''); setLogoFile(null); setPreview('');
                          const input = document.getElementById('company-logo') as HTMLInputElement | null;
                          if (input) input.value = '';
                        }}>นำโลโก้ออก</button>
                      )}
                    </div>
                  </div>
                </Section>

                <Section title="ข้อมูลติดต่อและภาษี">{infoFields.map(renderField)}</Section>
                <Section title="ที่อยู่"><CompanyAddressFields item={item} disabled={busy} fieldClass={fieldClass} labelClass={labelClass} /></Section>
                <Section title="รายละเอียดเพิ่มเติม">{textFields.map(renderField)}</Section>
              </>
            )}
          </div>

          <footer className="border-t border-[#e6ebe8] bg-[var(--ws-surface,#f9faf9)] px-6 py-4">
            {error && <p role="alert" className="mb-3 rounded-lg bg-[#fdf3f2] px-3 py-2 text-sm text-[#b42318]">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {!deleteMode && isEditing && (
                  <button type="button" disabled={busy} onClick={() => setDeleteMode(true)} className={btnDangerGhost}>
                    <Trash2 size={16} aria-hidden="true" />ลบ
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {deleteMode && <button type="button" disabled={busy} onClick={() => setDeleteMode(false)} className={btnSecondary}>ย้อนกลับ</button>}
                <button type="button" disabled={busy} onClick={onClose} className={btnSecondary}>ยกเลิก</button>
                {deleteMode
                  ? <button className={btnDanger} disabled={busy}>{busy ? 'กำลังลบ…' : `ลบ${noun}`}</button>
                  : <button className={btnPrimary} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>}
              </div>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function CompanySequenceManager({ kind }: Props) {
  const trackedFetch = useTrackedFetch();
  const isBranch = kind === 'branches';
  const noun = isBranch ? 'สาขา' : 'บริษัท';
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
      (item as Company).owner?.ownerFirstName, (item as Company).owner?.ownerLastName, (item as Company).owner?.ownerPhone, (item as Company).owner?.ownerEmail,
      item.address,
      isBranch ? displayName((item as Branch).company) : '',
    ].some((value) => value?.toLocaleLowerCase().includes(normalized)));
  }, [items, isBranch, query]);
  const loading = loadedRevision !== revision;
  const allBranches = companies.reduce((total, company) => total + (company._count?.branches ?? 0), 0);

  const openEditor = (item: RecordItem | null, del = false) => {
    setNotice(''); setEditorDelete(del); setEditor(item);
  };

  const headings = [
    isBranch ? 'รหัสสาขา' : 'รหัสบริษัท',
    isBranch ? 'บริษัทแม่' : 'ชื่อบริษัท',
    'เลขผู้เสียภาษี', 'ที่อยู่', 'เบอร์โทร', 'สถานะ',
  ];

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 bg-[var(--ws-soft,#f3f5f4)] p-4 text-[#1d2b27] sm:p-8">
      {/* ---------- header ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl bg-[var(--ws-accent-soft,#1f5c4a)] text-white">
            {isBranch ? <Store size={24} /> : <Building2 size={24} />}
          </span>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{noun}</h1>
            <p className="text-sm text-[#5b6b66]">{isBranch ? 'จัดการสาขาภายใต้บริษัทแม่' : 'จัดการข้อมูลบริษัทและรหัสบริษัท'}</p>
          </div>
        </div>
        <button className={btnPrimary} disabled={isBranch && companies.length === 0} onClick={() => openEditor(null)}>
          <Plus size={16} aria-hidden="true" />เพิ่ม{noun}
        </button>
      </header>

      {/* ---------- summary ---------- */}
      <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-[#5b6b66]">
        <div className="flex items-baseline gap-2"><dt>บริษัท</dt><dd className="text-xl font-semibold tabular-nums text-[#1d2b27]">{companies.length}</dd><span>แห่ง</span></div>
        <div className="flex items-baseline gap-2"><dt>สาขา</dt><dd className="text-xl font-semibold tabular-nums text-[#1d2b27]">{allBranches}</dd><span>แห่ง</span></div>
        {isBranch && (
          <Link href="/admin/companies" className={`inline-flex items-center gap-1.5 rounded text-[#1f5c4a] underline underline-offset-4 ${focus}`}>
            <Building2 size={15} aria-hidden="true" />จัดการบริษัทแม่
          </Link>
        )}
      </dl>

      {notice && <p role="status" className="rounded-lg border border-[#bfe0cf] bg-[var(--ws-soft,#e3f2ea)] px-4 py-2.5 text-sm text-[#1f5c4a]">{notice}</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f1c9c5] bg-[#fdf3f2] px-4 py-2.5 text-sm text-[#b42318]">
          {error}
          <button className={`${btnSecondary} h-8 px-3`} onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button>
        </div>
      )}

      {/* ---------- table ---------- */}
      <div className="overflow-hidden rounded-xl border border-[#dfe4e1] bg-white shadow-[0_1px_2px_rgba(18,32,27,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ebe8] px-4 py-3">
          <label className="flex w-full items-center gap-2 rounded-lg border border-[#d5dbd8] bg-[var(--ws-surface,#f9faf9)] px-3 focus-within:border-[#1f5c4a] focus-within:bg-white focus-within:outline-2 focus-within:outline-[#1f5c4a]/25 sm:w-96">
            <Search size={16} className="text-[#8a9792]" aria-hidden="true" />
            <span className="sr-only">ค้นหา{noun}</span>
            <input
              value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={`ค้นหารหัส ชื่อ เลขผู้เสียภาษี หรือเบอร์โทร${isBranch ? ' / บริษัทแม่' : ''}`}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-[#8a9792]"
            />
          </label>
          <span className="text-sm tabular-nums text-[#5b6b66]">แสดง {filteredItems.length} จาก {items.length} รายการ</span>
        </div>

        <div className="overflow-x-auto">
          <table aria-busy={loading} className="w-full min-w-[920px] text-left text-sm">
            <caption className="sr-only">รายการ{noun}จากฐานข้อมูล</caption>
            <thead className="bg-[var(--ws-soft,#f6f8f7)] text-xs text-[#5b6b66]">
              <tr>
                {headings.map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}
                <th scope="col" className="px-4 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#5b6b66]">กำลังโหลด…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#5b6b66]">ไม่สามารถโหลดข้อมูลได้</td></tr>
              ) : !filteredItems.length ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#5b6b66]">
                  {query ? `ไม่พบ${noun}ที่ตรงกับ “${query}”` : `ยังไม่มีข้อมูล${noun} กด “เพิ่ม${noun}” เพื่อเริ่มต้น`}
                </td></tr>
              ) : filteredItems.map((item) => {
                const code = isBranch ? (item as Branch).branchcode : (item as Company).companycode;
                const mainName = isBranch ? displayName((item as Branch).company) : displayName(item);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--ws-surface,#f6f9f7)]">
                    <th scope="row" className="whitespace-nowrap px-4 py-3.5 font-mono font-medium tabular-nums text-[#1f5c4a]">{code}</th>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Logo src={isBranch ? null : item.logo} name={mainName} />
                        {isBranch ? (
                          <div>
                            <span className="block font-medium">{displayName(item)}</span>
                            <small className="text-[#5b6b66]">{mainName} <span className="font-mono tabular-nums">({item.companycode})</span></small>
                          </div>
                        ) : (
                          <div>
                            <span className="block font-medium">{displayName(item)}</span>
                            {item.nameEN && <small lang="en" className="text-[#5b6b66]">{item.nameEN}</small>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums">{item.TaxIdentificationNumber || '—'}</td>
                    <td className="max-w-[260px] px-4 py-3.5">
                      <span className="line-clamp-2">{item.address || '—'}</span>
                      {item.postcode && <small className="text-[#5b6b66]">{item.postcode}</small>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums">{item.phone || '—'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button aria-label={`แก้ไข ${code}`} title="แก้ไข" className={iconBtn} onClick={() => openEditor(item)}><Pencil size={16} aria-hidden="true" /></button>
                        <button aria-label={`ลบ ${code}`} title="ลบ" className={`${iconBtn} hover:!bg-[#fdf3f2] hover:!text-[#b42318]`} onClick={() => openEditor(item, true)}><Trash2 size={16} aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isBranch && companies.length === 0 && !loading && (
        <div className="flex items-center gap-2 text-sm text-[#5b6b66]">
          <MapPin size={16} aria-hidden="true" />เพิ่มบริษัทก่อน แล้วจึงเพิ่มสาขาได้
          <Link className={`rounded text-[#1f5c4a] underline underline-offset-4 ${focus}`} href="/admin/companies">ไปหน้าบริษัท</Link>
        </div>
      )}

      {editor !== undefined && (
        <Editor
          kind={kind} companies={companies} item={editor} initialDelete={editorDelete}
          onClose={() => setEditor(undefined)}
          onSaved={(message) => { setEditor(undefined); setNotice(message); setQuery(''); setRevision((value) => value + 1); }}
        />
      )}
    </section>
  );
}
