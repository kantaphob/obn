'use client';

import { useEffect, useState } from 'react';
import type { PostcodeResult } from '@/lib/postcode-types';

type Address = { houseNo?: string | null; moo?: string | null; soi?: string | null; road?: string | null; provinceId?: string | null; districtId?: string | null; subdistrictId?: string | null; address?: string | null; postcode?: string | null };
export default function CompanyAddressFields({ item, disabled, fieldClass, labelClass }: { item: Address | null; disabled: boolean; fieldClass: string; labelClass: string }) {
  const [houseNo, setHouseNo] = useState(item?.houseNo ?? '');
  const [moo, setMoo] = useState(item?.moo ?? '');
  const [soi, setSoi] = useState(item?.soi ?? '');
  const [road, setRoad] = useState(item?.road ?? '');
  const [provinceId, setProvinceId] = useState(item?.provinceId ?? '');
  const [districtId, setDistrictId] = useState(item?.districtId ?? '');
  const [subdistrictId, setSubdistrictId] = useState(item?.subdistrictId ?? '');
  const [postcode, setPostcode] = useState(item?.postcode ?? '');
  const [legacy, setLegacy] = useState(item?.provinceId || item?.houseNo || item?.soi || item?.road ? '' : item?.address ?? '');
  const [result, setResult] = useState<{ key: string; data: PostcodeResult } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const key = `${provinceId}/${districtId}/${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({ pageSize: '100', provinceId, districtId });
        const response = await fetch(`/api/postcodes?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('โหลดข้อมูลที่อยู่ไม่สำเร็จ');
        const data: PostcodeResult = await response.json();
        // Collect every page so districts with more than 100 subdistricts remain usable.
        if (districtId) for (let page = 2; page <= data.totalPages; page++) {
          params.set('page', String(page));
          const next = await fetch(`/api/postcodes?${params}`, { signal: controller.signal });
          if (!next.ok) throw new Error('โหลดข้อมูลตำบลไม่สำเร็จ');
          data.items.push(...(await next.json() as PostcodeResult).items);
        }
        if (!controller.signal.aborted) { setResult({ key, data }); setError(''); }
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ'); }
    }
    void load();
    return () => controller.abort();
  }, [provinceId, districtId, retry, key]);
  const data = result?.key === key ? result.data : null;
  const province = data?.provinces.find((row) => String(row.id) === provinceId);
  const district = data?.districts.find((row) => String(row.id) === districtId);
  const subdistrict = data?.items.find((row) => String(row.id) === subdistrictId);
  const address = data ? [legacy.trim(), houseNo.trim() && `เลขที่ ${houseNo.trim()}`, moo.trim() && `หมู่${moo.trim()}`, soi.trim() && `ซอย${soi.trim()}`, road.trim() && `ถนน${road.trim()}`, subdistrict && `${provinceId === '1' ? 'แขวง' : 'ตำบล'}${subdistrict.nameTh}`, district && `${provinceId === '1' ? 'เขต' : 'อำเภอ'}${district.nameTh}`, province && `จังหวัด${province.nameTh}`].filter(Boolean).join(' ') : item?.address ?? '';
  return <>
    <input type="hidden" name="address" value={address} data-address-pending={!data ? "true" : undefined} />
    <input type="hidden" name="provinceId" value={provinceId} /><input type="hidden" name="districtId" value={districtId} /><input type="hidden" name="subdistrictId" value={subdistrictId} />
    {([['houseNo', 'เลขที่', houseNo, setHouseNo], ['moo', 'หมู่', moo, setMoo], ['soi', 'ซอย', soi, setSoi], ['road', 'ถนน', road, setRoad]] as const).map(([name, label, value, setter]) => <label key={name} className={labelClass}>{label}<input name={name} value={value} onChange={(event) => setter(event.target.value)} disabled={disabled} maxLength={200} className={fieldClass} /></label>)}
    <label className={labelClass}>จังหวัด<select value={provinceId} disabled={disabled || !data} className={fieldClass} onChange={(event) => { setProvinceId(event.target.value); setDistrictId(''); setSubdistrictId(''); setPostcode(''); }}><option value="">เลือกจังหวัด</option>{data?.provinces.map((row) => <option key={row.id} value={row.id}>{row.nameTh}</option>)}</select></label>
    <label className={labelClass}>อำเภอ / เขต<select value={districtId} disabled={disabled || !data || !provinceId} className={fieldClass} onChange={(event) => { setDistrictId(event.target.value); setSubdistrictId(''); setPostcode(''); }}><option value="">เลือกอำเภอ / เขต</option>{data?.districts.map((row) => <option key={row.id} value={row.id}>{row.nameTh}</option>)}</select></label>
    <label className={labelClass}>ตำบล / แขวง<select value={subdistrictId} disabled={disabled || !data || !districtId} className={fieldClass} onChange={(event) => { setSubdistrictId(event.target.value); setPostcode(data?.items.find((row) => String(row.id) === event.target.value)?.postcode ?? ''); }}><option value="">เลือกตำบล / แขวง</option>{districtId && data?.items.map((row) => <option key={row.id} value={row.id}>{row.nameTh}</option>)}</select></label>
    <label className={labelClass}>รหัสไปรษณีย์<input name="postcode" value={postcode} onChange={(event) => setPostcode(event.target.value)} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} disabled={disabled} className={fieldClass} /><span className="text-xs text-[#6b7773]">เติมจากตำบลที่เลือก หากไม่มีข้อมูลสามารถกรอกเองได้</span></label>
    {legacy && <label className={`${labelClass} sm:col-span-2`}>ที่อยู่เดิม (ปรับหรือล้างเมื่อแยกลงช่องแล้ว)<textarea value={legacy} onChange={(event) => setLegacy(event.target.value)} disabled={disabled} className={fieldClass} /></label>}
    {!data && !error && <p role="status" className="text-sm">กำลังโหลดข้อมูลที่อยู่…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error} <button type="button" disabled={disabled} className="underline" onClick={() => { setError(''); setRetry((value) => value + 1); }}>ลองใหม่</button></p>}
  </>;
}
