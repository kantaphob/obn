'use client';

import { useEffect, useState } from 'react';
import type { PostcodeResult } from '@/lib/postcode-types';

type OwnerAddress = {
  ownerAddress?: string | null;
  ownerProvince?: string | null;
  ownerDistrict?: string | null;
  ownerSubdistrict?: string | null;
  ownerPostcode?: string | null;
  ownerMoo?: string | null;
  ownerSoi?: string | null;
  ownerRoad?: string | null;
  ownerProvinceId?: number | null;
  ownerDistrictId?: number | null;
  ownerSubdistrictId?: number | null;
};

export default function OwnerAddressFields({
  item,
  disabled,
  fieldClass,
  labelClass,
}: {
  item: OwnerAddress | null;
  disabled: boolean;
  fieldClass: string;
  labelClass: string;
}) {
  const [provinces, setProvinces] = useState<PostcodeResult['provinces']>([]);
  const [districts, setDistricts] = useState<PostcodeResult['districts']>([]);
  const [subdistricts, setSubdistricts] = useState<PostcodeResult['items']>([]);
  const [provinceId, setProvinceId] = useState<string | null>(item ? item.ownerProvinceId != null ? String(item.ownerProvinceId) : null : '');
  const [districtId, setDistrictId] = useState<string | null>(item ? item.ownerDistrictId != null ? String(item.ownerDistrictId) : null : '');
  const [subdistrictId, setSubdistrictId] = useState<string | null>(item ? item.ownerSubdistrictId != null ? String(item.ownerSubdistrictId) : null : '');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const province = provinces.find((option) => String(option.id) === provinceId);
  const district = districts.find((option) => String(option.id) === districtId);
  const subdistrict = subdistricts.find((option) => String(option.id) === subdistrictId);

  useEffect(() => {
    if (provinceId !== null || !provinces.length) return;
    const legacyProvince = provinces.find((option) => option.nameTh === item?.ownerProvince);
    setProvinceId(legacyProvince ? String(legacyProvince.id) : '');
  }, [provinceId, provinces, item?.ownerProvince]);

  useEffect(() => {
    if (districtId !== null || !districts.length) return;
    const legacyDistrict = districts.find((option) => option.nameTh === item?.ownerDistrict);
    setDistrictId(legacyDistrict ? String(legacyDistrict.id) : '');
  }, [districtId, districts, item?.ownerDistrict]);

  useEffect(() => {
    if (subdistrictId !== null || !subdistricts.length) return;
    const legacySubdistrict = subdistricts.find((option) => option.nameTh === item?.ownerSubdistrict);
    setSubdistrictId(legacySubdistrict ? String(legacySubdistrict.id) : '');
  }, [subdistrictId, subdistricts, item?.ownerSubdistrict]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadProvinces() {
      try {
        const response = await fetch('/api/postcodes?pageSize=1', { signal: controller.signal });
        if (!response.ok) throw new Error('โหลดรายชื่อจังหวัดไม่สำเร็จ');
        const data: PostcodeResult = await response.json();
        if (!controller.signal.aborted) {
          setProvinces(data.provinces);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ');
      }
    }
    void loadProvinces();
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setDistricts([]);
    if (!provinceId) return () => controller.abort();

    async function loadDistricts() {
      try {
        const params = new URLSearchParams({ pageSize: '1', provinceId: String(provinceId) });
        const response = await fetch(`/api/postcodes?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('โหลดรายชื่ออำเภอไม่สำเร็จ');
        const data: PostcodeResult = await response.json();
        if (!controller.signal.aborted) {
          setDistricts(data.districts);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ');
      }
    }
    void loadDistricts();
    return () => controller.abort();
  }, [provinceId, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setSubdistricts([]);
    if (!provinceId || !districtId) return () => controller.abort();

    async function loadSubdistricts() {
      try {
        const params = new URLSearchParams({ pageSize: '100', provinceId: String(provinceId), districtId: String(districtId) });
        const response = await fetch(`/api/postcodes?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('โหลดรายชื่อตำบลไม่สำเร็จ');
        const data: PostcodeResult = await response.json();
        for (let page = 2; page <= data.totalPages; page++) {
          params.set('page', String(page));
          const next = await fetch(`/api/postcodes?${params}`, { signal: controller.signal });
          if (!next.ok) throw new Error('โหลดรายชื่อตำบลไม่สำเร็จ');
          data.items.push(...(await next.json() as PostcodeResult).items);
        }
        if (!controller.signal.aborted) {
          setSubdistricts(data.items);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ');
      }
    }
    void loadSubdistricts();
    return () => controller.abort();
  }, [provinceId, districtId, retry]);

  return <>
    <label className={labelClass}>
      ที่อยู่เจ้าของสำหรับทำสัญญาในนามบุคคล
      <input name="ownerAddress" maxLength={200} defaultValue={item?.ownerAddress ?? ''} disabled={disabled} className={fieldClass} />
    </label>
    <label className={labelClass}>หมู่<input name="ownerMoo" maxLength={100} defaultValue={item?.ownerMoo ?? ''} disabled={disabled} className={fieldClass} /></label>
    <label className={labelClass}>ซอย<input name="ownerSoi" maxLength={200} defaultValue={item?.ownerSoi ?? ''} disabled={disabled} className={fieldClass} /></label>
    <label className={labelClass}>ถนน<input name="ownerRoad" maxLength={200} defaultValue={item?.ownerRoad ?? ''} disabled={disabled} className={fieldClass} /></label>
    <input type="hidden" name="ownerProvince" value={provinceId === null ? item?.ownerProvince ?? '' : province?.nameTh ?? ''} />
    <input type="hidden" name="ownerDistrict" value={districtId === null ? item?.ownerDistrict ?? '' : district?.nameTh ?? ''} />
    <input type="hidden" name="ownerSubdistrict" value={subdistrictId === null ? item?.ownerSubdistrict ?? '' : subdistrict?.nameTh ?? ''} />
    <input type="hidden" name="ownerPostcode" value={subdistrict?.postcode ?? (subdistrictId === null ? item?.ownerPostcode ?? '' : '')} data-address-pending={subdistrictId && !subdistrict ? 'true' : undefined} />
    <label className={labelClass}>
      จังหวัด
      <select name="ownerProvinceId" value={provinceId ?? ''} disabled={disabled || provinceId === null || provinces.length === 0} className={fieldClass} onChange={(event) => {
        setProvinceId(event.target.value);
        setDistrictId('');
        setSubdistrictId('');
      }}>
        <option value="">เลือกจังหวัด</option>
        {provinces.map((option) => <option key={option.id} value={option.id}>{option.nameTh}</option>)}
      </select>
    </label>
    <label className={labelClass}>
      อำเภอ / เขต
      <select name="ownerDistrictId" value={districtId ?? ''} disabled={disabled || districtId === null || !provinceId || districts.length === 0} className={fieldClass} onChange={(event) => {
        setDistrictId(event.target.value);
        setSubdistrictId('');
      }}>
        <option value="">เลือกอำเภอ / เขต</option>
        {districts.map((option) => <option key={option.id} value={option.id}>{option.nameTh}</option>)}
      </select>
    </label>
    <label className={labelClass}>
      ตำบล / แขวง
      <select name="ownerSubdistrictId" value={subdistrictId ?? ''} disabled={disabled || subdistrictId === null || !districtId || subdistricts.length === 0} className={fieldClass} onChange={(event) => setSubdistrictId(event.target.value)}>
        <option value="">เลือกตำบล / แขวง</option>
        {subdistricts.map((option) => <option key={option.id} value={option.id}>{option.nameTh}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}{' '}<button type="button" disabled={disabled} className="underline" onClick={() => { setError(''); setRetry((value) => value + 1); }}>ลองใหม่</button></p>}
  </>;
}
