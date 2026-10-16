'use client';

import { useTrackedFetch } from "@/components/ui/ToastProvider";

import { useEffect, useState } from 'react';
import { MapPin, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { workspaceStyles as styles } from '@/components/ui/workspace-styles';
import type { PostcodeResult } from '@/lib/postcode-types';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 py-2.5 text-sm disabled:opacity-50';
const buttonClass = 'rounded-lg border border-[#d7d9d0] bg-[var(--ws-surface,#faf9f5)] px-3 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed';

export default function Postcode() {
  const trackedFetch = useTrackedFetch();
  const [q, setQ] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [result, setResult] = useState<PostcodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, provinceId, districtId, page: String(page), pageSize: String(pageSize) });
        const response = await trackedFetch(`/api/postcodes?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'โหลดข้อมูลไม่สำเร็จ');
        setResult(data);
        setError('');
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [q, provinceId, districtId, page, pageSize, retry, trackedFetch]);

  function changing() { setLoading(true); setError(''); setPage(1); }
  function reset() { changing(); setQ(''); setProvinceId(''); setDistrictId(''); setRetry((value) => value + 1); }

  return <section className={styles.page}>
    <header className={styles.pageHeader}>
      <p className={styles.eyebrow}>MASTER DATA / POSTCODE</p>
      <h1 className="flex items-center gap-3"><MapPin aria-hidden="true" size={28} />รหัสไปรษณีย์</h1>
      <p>ค้นหารหัสไปรษณีย์ ตำบล / แขวง อำเภอ / เขต และจังหวัด</p>
    </header>

    <div className="mb-6 rounded-2xl border border-[#ddded5] bg-[var(--ws-soft,#eeece5)] p-5">
      <div className="grid gap-4 min-[1100px]:grid-cols-[2fr_1fr_1fr]">
        <label className="text-xs text-[#626862]">ค้นหาข้อมูล
          <div className="relative"><Search aria-hidden="true" size={17} className="absolute left-3 top-5 text-[#626862]" />
            <input type="search" value={q} maxLength={120} placeholder="รหัสไปรษณีย์ หรือชื่อพื้นที่" className={`${fieldClass} pl-10`} onChange={(e) => { changing(); setQ(e.target.value); }} />
          </div>
        </label>
        <label className="text-xs text-[#626862]">จังหวัด
          <select className={fieldClass} value={provinceId} onChange={(e) => { changing(); setProvinceId(e.target.value); setDistrictId(''); }}>
            <option value="">ทุกจังหวัด</option>
            {result?.provinces.map((province) => <option key={province.id} value={province.id}>{province.nameTh}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#626862]">อำเภอ / เขต
          <select className={fieldClass} value={districtId} disabled={!provinceId || loading} onChange={(e) => { changing(); setDistrictId(e.target.value); }}>
            <option value="">{provinceId ? 'ทุกอำเภอ / เขต' : 'เลือกจังหวัดก่อน'}</option>
            {result?.districts.map((district) => <option key={district.id} value={district.id}>{district.nameTh}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[#626862]" role="status">{loading ? 'กำลังโหลดข้อมูล…' : error ? 'โหลดข้อมูลไม่สำเร็จ' : `พบ ${(result?.total ?? 0).toLocaleString('th-TH')} รายการ`}</span>
        <button className={buttonClass} onClick={reset}>ล้างตัวกรอง</button>
      </div>
    </div>

    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
      <p>{error}</p><button className={`${buttonClass} mt-3`} onClick={() => { setLoading(true); setError(''); setRetry((value) => value + 1); }}>ลองใหม่</button>
    </div> : <div className="overflow-hidden rounded-2xl border border-[#ddded5] bg-[var(--ws-surface,#faf9f5)]" aria-busy={loading}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[630px] text-left text-sm">
          <caption className="sr-only">รหัสไปรษณีย์แยกตามตำบล อำเภอ และจังหวัด</caption>
          <thead className="bg-[var(--ws-soft,#e9e8df)] text-xs text-[#626862]"><tr>
            {['รหัสไปรษณีย์', 'ตำบล / แขวง', 'อำเภอ / เขต', 'จังหวัด'].map((label) => <th scope="col" key={label} className="px-5 py-4 font-medium">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#e5e5dc]">
            {loading ? <tr><td colSpan={4} className="p-12 text-center text-[#626862]">กำลังโหลดข้อมูล…</td></tr> : !result?.items.length ? <tr><td colSpan={4} className="p-12 text-center text-[#626862]">ไม่พบข้อมูล ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</td></tr> : result.items.map((item) => <tr key={item.id} className="hover:bg-[var(--ws-soft,#f0f0e8)]">
              <td className="px-5 py-4"><span className="rounded-md bg-[var(--ws-soft,#e5ece3)] px-2.5 py-1 font-mono font-semibold text-[#355a4b]">{item.postcode || 'ไม่ระบุ'}</span></td>
              <td className="px-5 py-4">{item.nameTh}{item.nameEn && <span className="block text-xs text-[#73796f]">{item.nameEn}</span>}</td>
              <td className="px-5 py-4">{item.district.nameTh}</td>
              <td className="px-5 py-4">{item.district.province.nameTh}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ddded5] px-5 py-4 text-xs text-[#626862]">
        <label>แสดง <select aria-label="จำนวนรายการต่อหน้า" className="mx-2 rounded border border-[#d7d9d0] bg-transparent p-1.5" value={pageSize} onChange={(e) => { changing(); setPageSize(Number(e.target.value)); }}>{[25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select>รายการ / หน้า</label>
        <nav aria-label="การแบ่งหน้า" className="flex items-center gap-3">
          <button aria-label="หน้าก่อนหน้า" className={buttonClass} disabled={loading || !result || result.page <= 1} onClick={() => { setLoading(true); setPage(result!.page - 1); }}><ChevronLeft size={16} /></button>
          <span>หน้า {result?.page ?? 1} / {result?.totalPages ?? 1}</span>
          <button aria-label="หน้าถัดไป" className={buttonClass} disabled={loading || !result || result.page >= result.totalPages} onClick={() => { setLoading(true); setPage(result!.page + 1); }}><ChevronRight size={16} /></button>
        </nav>
      </div>
    </div>}
    <p className="mt-4! text-xs text-[#73796f]">ข้อมูลจากชุดข้อมูลที่นำเข้า ตำบลที่ไม่มีรหัสไปรษณีย์จะแสดง “ไม่ระบุ”</p>
  </section>;
}
