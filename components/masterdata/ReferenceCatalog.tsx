'use client';

import Link from 'next/link';
import { useToast, useTrackedFetch } from '@/components/ui/ToastProvider';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Boxes, ChevronLeft, ChevronRight, ExternalLink, Ruler, ScrollText, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { workspaceStyles as styles } from '@/components/ui/workspace-styles';
import CatalogEditor, { type CatalogEditState } from './CatalogEditor';
import type { CatalogKind, CatalogResult } from '@/lib/reference-catalog-types';

const definitions = {
  classifiers: {
    title: 'ลักษณนาม', label: 'THAI CLASSIFIERS',
    description: 'ลักษณนามสำหรับสินค้า วัสดุ สิ่งของ และงาน พร้อมตัวอย่างการใช้',
    placeholder: 'ค้นหาลักษณนามหรือสิ่งของ เช่น หลัง, เส้น, เชือก',
    standard: 'ภาษาไทย', sourceName: 'แนวทางลักษณนาม — สำนักงานราชบัณฑิตยสภา',
    sourceUrl: 'https://www.orst.go.th/iwfm_table.asp?a=36&i=0040002104011001%2F63ERK0729009',
    note: 'ชุดเริ่มต้นลักษณนามที่ใช้ทั่วไป รหัส CL หมวดหมู่ คำอธิบายอังกฤษ และตัวอย่างจัดทำสำหรับระบบ เลือกลักษณนามตามสิ่งของและบริบทการใช้ โดยอ้างอิงแนวทางของสำนักงานราชบัณฑิตยสภา',
    otherHref: '/admin/unit', otherLabel: 'ดูหน่วยนับ',
  },
  units: {
    title: 'หน่วยนับ', label: 'UNITS OF MEASURE',
    description: 'หน่วยวัด หน่วยนับ และบรรจุภัณฑ์ สำหรับใช้อ้างอิงในรายการสินค้าและวัสดุ',
    placeholder: 'ค้นหารหัส ชื่อหน่วย หรือสัญลักษณ์ เช่น KGM, กิโลกรัม, kg',
    standard: 'UN/ECE', sourceName: 'UN/ECE Rec. 20 / 21 ผ่าน Peppol',
    sourceUrl: 'https://docs.peppol.eu/poacc/billing/3.0/codelist/UNECERec20/',
    note: 'ชุดหน่วยที่คัดเลือกจาก UN/ECE ชื่อไทย หมวดหมู่ และตัวย่อสำหรับแสดงผลจัดทำเพิ่มเติม บรรจุภัณฑ์ เช่น ถุง กล่อง และม้วน ไม่มีอัตราแปลงคงที่',
    otherHref: '/admin/material', otherLabel: 'ดูรายการวัสดุ',
  },
  materials: {
    title: 'วัสดุ', label: 'MATERIALS CATALOG',
    description: 'รายการอ้างอิงวัสดุก่อสร้างและตกแต่ง พร้อมรหัส CPV และหน่วยแนะนำ',
    placeholder: 'ค้นหารหัส CPV หรือชื่อวัสดุ เช่น 44111200, ปูน, cement',
    standard: 'CPV 2008', sourceName: 'Common Procurement Vocabulary — TED',
    sourceUrl: 'https://docs.ted.europa.eu/eforms/latest/reference/code-lists/cpv.html',
    note: 'รายการวัสดุที่คัดเลือกจาก CPV ชื่อไทย หมวดหมู่ และหน่วยแนะนำจัดทำเพิ่มเติม หน่วยใช้งานจริงให้เลือกตามสินค้าและเงื่อนไขการซื้อขาย',
    otherHref: '/admin/unit', otherLabel: 'ดูหน่วยนับ',
  },
};

const fieldClass = 'mt-2 w-full rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 py-2.5 text-sm';
const buttonClass = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 text-xs leading-none [&_svg]:shrink-0 transition-colors hover:bg-[var(--ws-soft,#e9ede3)] disabled:opacity-40 disabled:cursor-not-allowed';

export default function ReferenceCatalog({ kind }: { kind: CatalogKind }) {
  const trackedFetch = useTrackedFetch();
  const definition = definitions[kind];
  const isUnits = kind === 'units';
  const isClassifiers = kind === 'classifiers';
  const Icon = isClassifiers ? ScrollText : isUnits ? Ruler : Boxes;
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editor, setEditor] = useState<CatalogEditState | null>(null);
  const notify = useToast();
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState<{ key: string; data: CatalogResult } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const requestKey = `/api/${kind}?${new URLSearchParams({ q, category, page: String(page), pageSize: String(pageSize), refresh: String(revision) })}`;
  const result = response?.data;
  const error = failure?.key === requestKey ? failure.message : '';
  const loading = response?.key !== requestKey && !error;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await trackedFetch(requestKey, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
        }
        const data: CatalogResult = await res.json();
        if (!controller.signal.aborted) setResponse({ key: requestKey, data });
      } catch (err) {
        if (!controller.signal.aborted) setFailure({ key: requestKey, message: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อได้' });
      }
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [requestKey, trackedFetch]);

  function reset() { setQ(''); setCategory(''); setPage(1); setRevision((value) => value + 1); }
  const current = result?.page ?? 1;
  const start = result?.total ? (current - 1) * result.pageSize + 1 : 0;
  const end = result ? Math.min(current * result.pageSize, result.total) : 0;

  function saved(mode: CatalogEditState['mode'], code: string) {
    setEditor(null); setRevision((value) => value + 1);
    notify({ status: 'success', message: mode === 'delete' ? 'ลบข้อมูลแล้ว' : mode === 'create' ? 'เพิ่มข้อมูลแล้ว' : 'บันทึกการแก้ไขแล้ว' });
    if (mode !== 'delete') { setQ(code); setCategory(''); setPage(1); }
  }

  return <section className={styles.page}>
    <header className={`${styles.pageHeader} flex flex-wrap items-start justify-between gap-4`}>
      <div>
        <p className={styles.eyebrow}>MASTER DATA / {definition.label}</p>
        <h1 className="flex items-center gap-3"><Icon size={28} aria-hidden="true" />{definition.title}</h1>
        <p className="max-w-xl text-[13px] text-[#626862]">{definition.description}</p>
      </div>
      <div className="flex flex-wrap gap-2"><button className={`${buttonClass} w-36 bg-[var(--ws-accent-soft,#355a4b)]! text-white`} onClick={() => { setEditor({ mode: 'create' }); }}><Plus size={16} aria-hidden="true" />เพิ่ม{definition.title}</button>
      <Link href={definition.otherHref} className={`${buttonClass} w-36`}>{definition.otherLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    </header>

    <div className="mb-6 grid grid-cols-3 gap-3 max-[440px]:grid-cols-1">
      <div className={styles.stat}><span>รายการในฐานข้อมูล</span><strong>{result?.totalRecords.toLocaleString('th-TH') ?? '—'}</strong><small>{isClassifiers ? 'ลักษณนามพร้อมตัวอย่าง' : isUnits ? 'หน่วยที่พร้อมเรียกใช้' : 'รายการวัสดุอ้างอิง'}</small></div>
      <div className={styles.stat}><span>หมวดหมู่</span><strong>{result?.categories.length ?? '—'}</strong><small>จัดกลุ่มเพื่อค้นหาได้ง่าย</small></div>
      <div className={styles.stat}><span>{isClassifiers ? 'การใช้งาน' : 'มาตรฐานอ้างอิง'}</span><strong className="text-[22px]!">{definition.standard}</strong><small>{isClassifiers ? 'เลือกตามสิ่งของและบริบท' : isUnits ? 'รหัสหน่วยและบรรจุภัณฑ์' : 'รหัสจัดประเภท 8 หลัก'}</small></div>
    </div>

    <div className="mb-5 rounded-2xl border border-[#ddded5] bg-[var(--ws-soft,#eeece5)] p-5">
      <div className="grid gap-4 min-[1100px]:grid-cols-[2fr_1fr]">
        <label className="text-xs text-[#626862]">ค้นหาข้อมูล
          <div className="relative"><Search size={16} aria-hidden="true" className="absolute left-3 top-5" />
            <input className={`${fieldClass} pl-10`} type="search" placeholder={definition.placeholder} maxLength={120} value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
          </div>
        </label>
        <label className="text-xs text-[#626862]">หมวดหมู่
          <select className={fieldClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="">ทุกหมวดหมู่</option>
            {result?.categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span role="status" className="text-xs text-[#626862]">{loading ? 'กำลังโหลดข้อมูล…' : error ? 'โหลดข้อมูลไม่สำเร็จ' : `พบ ${(result?.total ?? 0).toLocaleString('th-TH')} รายการ`}</span>
        <button className={buttonClass} onClick={reset}>ล้างตัวกรอง</button>
      </div>
    </div>

    {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
      <p>{error}</p><button className={`${buttonClass} mt-3`} onClick={() => setRevision((value) => value + 1)}>ลองใหม่</button>
    </div> : <div className="overflow-hidden rounded-2xl border border-[#ddded5] bg-[var(--ws-surface,#faf9f5)]" aria-busy={loading}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[660px] text-left text-sm">
          <caption className="sr-only">รายการ{definition.title}จากฐานข้อมูล</caption>
          <thead className="bg-[var(--ws-soft,#e9e8df)] text-xs text-[#626862]"><tr>
            {[isClassifiers ? 'รหัส' : isUnits ? 'รหัสหน่วย' : 'รหัสวัสดุ', isClassifiers ? 'ลักษณนาม' : isUnits ? 'ชื่อหน่วย' : 'ชื่อวัสดุ', 'หมวดหมู่', isClassifiers ? 'ตัวอย่างการใช้' : isUnits ? 'สัญลักษณ์ / ตัวย่อ' : 'หน่วยแนะนำ', ...(isUnits ? ['มาตรฐาน'] : []), 'จัดการ'].map((label) => <th scope="col" key={label} className="px-5 py-4 font-medium whitespace-nowrap">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#e5e5dc]">
            {loading ? <tr><td colSpan={isUnits ? 6 : 5} className="p-12 text-center text-[#626862]">กำลังโหลดข้อมูล…</td></tr> : !result?.items.length ? <tr><td colSpan={isUnits ? 6 : 5} className="p-12 text-center text-[#626862]">ไม่พบข้อมูล ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</td></tr> : result.items.map((item) => <tr key={item.code} className="hover:bg-[var(--ws-soft,#f0f0e8)]">
              <td className="px-5 py-4 align-top"><span className="inline-block rounded-md bg-[var(--ws-soft,#e5ece3)] px-2.5 py-1 font-mono text-xs font-semibold text-[#355a4b]">{item.code}</span></td>
              <td className="px-5 py-4"><span className="font-medium">{item.nameTh}</span><span className="mt-1 block text-xs text-[#73796f]">{item.nameEn}</span></td>
              <td className="px-5 py-4 text-xs text-[#626862]">{item.category}</td>
              <td className="px-5 py-4">{isClassifiers ? <span className="text-xs leading-relaxed text-[#626862]">{item.examples}</span> : isUnits ? <span className="font-mono">{item.symbol}</span> : item.recommendedUnit ? <><span>{item.recommendedUnit.nameTh}</span><span className="mt-1 block font-mono text-xs text-[#73796f]">{item.recommendedUnit.code}</span></> : <span className="text-xs text-[#73796f]">เลือกตามสินค้า</span>}</td>
              {isUnits ? <td className="px-5 py-4 text-xs text-[#73796f] whitespace-nowrap">{item.standard}</td> : null}
              <td className="px-5 py-4"><div className="flex gap-2">
                <button className={`${buttonClass} w-24`} aria-label={`แก้ไข ${item.nameTh}`} onClick={() => { setEditor({ mode: 'edit', item }); }}><Pencil size={14} aria-hidden="true" />แก้ไข</button>
                <button className={`${buttonClass} w-24 text-red-700`} aria-label={`ลบ ${item.nameTh}`} onClick={() => { setEditor({ mode: 'delete', item }); }}><Trash2 size={14} aria-hidden="true" />ลบ</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ddded5] px-5 py-4 text-xs text-[#626862]">
        <label>แสดง <select aria-label="จำนวนรายการต่อหน้า" className="mx-2 rounded-lg border border-[#d7d9d0] bg-transparent p-1.5" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select>รายการ / หน้า</label>
        <span>{loading ? 'กำลังโหลด…' : `${start}–${end} จาก ${result?.total ?? 0}`}</span>
        <nav aria-label="การแบ่งหน้า" className="flex items-center gap-3">
          <button aria-label="หน้าก่อนหน้า" className={`${buttonClass} w-10 px-0!`} disabled={loading || !result || current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <span>หน้า {current} / {result?.totalPages ?? 1}</span>
          <button aria-label="หน้าถัดไป" className={`${buttonClass} w-10 px-0!`} disabled={loading || !result || current >= result.totalPages} onClick={() => setPage(current + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
        </nav>
      </div>
    </div>}

    <aside className="mt-5 rounded-xl border border-[#ddded5] p-4 text-xs leading-relaxed text-[#626862]">
      <a className="inline-flex items-center gap-1.5 font-medium underline! underline-offset-4" href={definition.sourceUrl} target="_blank" rel="noreferrer">{definition.sourceName}<ExternalLink size={12} aria-hidden="true" /><span className="sr-only">เปิดในแท็บใหม่</span></a>
      <p className="mt-2!">{definition.note}</p>
      <p className="mt-2! text-[11px]">นำเข้าชุดอ้างอิง 13 ตุลาคม 2026</p>
    </aside>
    {editor ? <CatalogEditor kind={kind} state={editor} categories={result?.categories ?? []} onClose={() => setEditor(null)} onDone={saved} /> : null}
  </section>;
}
