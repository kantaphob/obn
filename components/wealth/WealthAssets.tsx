'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Building2, ChartNoAxesCombined, CircleDollarSign, Plus, RefreshCw, X } from 'lucide-react';
import { WEALTH_ASSET_CATEGORIES, ownedSatang, type WealthAssetCategory } from '@/lib/wealth-assets';

type Asset = {
  id: string;
  assetCode: string;
  companyCode: string;
  branchCode: string;
  name: string;
  category: string;
  sourceDocumentNo: string;
  acquisitionDate: string | null;
  acquisitionCost: number;
  currentValue: number;
  accumulatedDep: number;
  accumulatedImpairment: number;
  ownershipBps: number;
  valuationDate: string | null;
  valuationSource: string | null;
  details: Record<string, string>;
  notes: string;
  valuations: Array<{ id: string; value: number; valuationDate: string; source: string | null; note: string }>;
};

type AssetDraft = {
  name: string;
  category: WealthAssetCategory;
  branchCode: string;
  acquisitionMethod: string;
  acquisitionDate: string;
  readyForUseDate: string;
  purchasePrice: string;
  directCosts: string;
  recoverableVat: string;
  nonRecoverableVat: string;
  supplierName: string;
  supplierTaxId: string;
  sourceDocumentNo: string;
  residualValue: string;
  usefulLifeMonths: string;
  depreciationMethod: string;
  depreciationStart: string;
  accumulatedDep: string;
  accumulatedImpairment: string;
  taxCost: string;
  taxUsefulLifeMonths: string;
  taxDepMethod: string;
  taxAccumulatedDep: string;
  currentValue: string;
  ownershipPercentage: string;
  valuationDate: string;
  valuationSource: string;
  valuationNote: string;
  notes: string;
  details: Record<string, string>;
};

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(value / 100);
const inputToSatang = (value: string) => {
  const [whole, fraction = ''] = value.trim().split('.');
  return /^\d+$/.test(whole || '') && /^\d{0,2}$/.test(fraction) ? Number(whole) * 100 + Number(fraction.padEnd(2, '0')) : 0;
};
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value)) : 'ไม่ระบุ';
const categoryLabel = (category: string) => WEALTH_ASSET_CATEGORIES.find((item) => item.value === category)?.label ?? 'สินทรัพย์อื่น';

const detailFields: Record<WealthAssetCategory, Array<{ key: string; label: string; placeholder: string }>> = {
  CASH: [{ key: 'bankName', label: 'ธนาคาร', placeholder: 'ชื่อธนาคาร (ถ้ามี)' }, { key: 'accountName', label: 'ชื่อบัญชี', placeholder: 'ชื่อบัญชี (ไม่ต้องระบุเลขบัญชี)' }],
  GOLD: [{ key: 'provider', label: 'ผู้ให้บริการ', placeholder: 'เช่น ร้านทองหรือแอปออมทอง' }, { key: 'weight', label: 'น้ำหนักทอง', placeholder: 'เช่น 2.5' }, { key: 'unit', label: 'หน่วย', placeholder: 'กรัม / บาททองคำ' }, { key: 'purity', label: 'ความบริสุทธิ์', placeholder: 'เช่น 96.5%' }],
  STOCK: [{ key: 'symbol', label: 'ชื่อย่อหลักทรัพย์', placeholder: 'เช่น PTT' }, { key: 'quantity', label: 'จำนวนหุ้น', placeholder: 'จำนวนหุ้น' }, { key: 'broker', label: 'โบรกเกอร์/พอร์ต', placeholder: 'ชื่อโบรกเกอร์หรือพอร์ต' }],
  FUND: [{ key: 'symbol', label: 'รหัสกองทุน', placeholder: 'ชื่อหรือรหัสกองทุน' }, { key: 'quantity', label: 'จำนวนหน่วย', placeholder: 'จำนวนหน่วยลงทุน' }, { key: 'broker', label: 'บริษัทจัดการ/พอร์ต', placeholder: 'ชื่อบริษัทจัดการหรือพอร์ต' }],
  PROPERTY: [{ key: 'location', label: 'ที่ตั้ง', placeholder: 'ที่ตั้งทรัพย์สิน' }, { key: 'titleNumber', label: 'เลขโฉนด/เอกสารสิทธิ์', placeholder: 'เลขที่เอกสาร (ถ้ามี)' }, { key: 'area', label: 'พื้นที่', placeholder: 'เช่น 120 ตร.ม.' }],
  LAND: [{ key: 'location', label: 'ที่ตั้ง', placeholder: 'ที่ตั้งที่ดิน' }, { key: 'titleNumber', label: 'เลขโฉนด', placeholder: 'เลขที่โฉนด' }, { key: 'area', label: 'เนื้อที่', placeholder: 'เช่น 2 ไร่ 1 งาน' }],
  VEHICLE: [{ key: 'brand', label: 'ยี่ห้อ', placeholder: 'ยี่ห้อรถ' }, { key: 'model', label: 'รุ่น', placeholder: 'รุ่นรถ' }, { key: 'year', label: 'ปีรถ', placeholder: 'ปีที่ผลิต' }, { key: 'plateNumber', label: 'ทะเบียนรถ', placeholder: 'ทะเบียนรถ' }, { key: 'serialNumber', label: 'เลขตัวถัง / VIN', placeholder: 'เลขประจำตัวรถ' }],
  EQUIPMENT: [{ key: 'brand', label: 'ยี่ห้อ', placeholder: 'ยี่ห้ออุปกรณ์' }, { key: 'model', label: 'รุ่น', placeholder: 'รุ่น' }, { key: 'serialNumber', label: 'Serial Number', placeholder: 'หมายเลขเครื่อง/อุปกรณ์' }],
  OTHER: [{ key: 'description', label: 'รายละเอียด', placeholder: 'ข้อมูลเพิ่มเติมของทรัพย์สิน' }],
};

function emptyDraft(): AssetDraft {
  return { name: '', category: 'CASH', branchCode: '', acquisitionMethod: 'PURCHASE', acquisitionDate: '', readyForUseDate: '', purchasePrice: '0', directCosts: '0', recoverableVat: '0', nonRecoverableVat: '0', supplierName: '', supplierTaxId: '', sourceDocumentNo: '', residualValue: '0', usefulLifeMonths: '', depreciationMethod: 'NONE', depreciationStart: '', accumulatedDep: '0', accumulatedImpairment: '0', taxCost: '', taxUsefulLifeMonths: '', taxDepMethod: '', taxAccumulatedDep: '', currentValue: '0', ownershipPercentage: '100', valuationDate: today(), valuationSource: 'ประเมินโดยผู้ใช้', valuationNote: '', notes: '', details: {} };
}

type Location = { branchCode: string; label: string };

export default function WealthAssets({ compact = false }: { compact?: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const locationLabels = useMemo(() => new Map(locations.map((location) => [location.branchCode, location.label])), [locations]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(emptyDraft);
  const [valuationAsset, setValuationAsset] = useState<Asset | null>(null);
  const [valuationDraft, setValuationDraft] = useState({ currentValue: '', valuationDate: today(), valuationSource: '', valuationNote: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/wealth/assets', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'โหลดทะเบียนทรัพย์สินไม่สำเร็จ');
      setAssets(data.assets as Asset[]);
      setLocations((data.locations ?? []) as Location[]);
      if (data.company?.companycode) setDraft((current) => current.branchCode ? current : { ...current, branchCode: data.company.companycode });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดทะเบียนทรัพย์สินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const totals = useMemo(() => assets.reduce((sum, asset) => ({
    cost: sum.cost + ownedSatang(asset.acquisitionCost, asset.ownershipBps),
    value: sum.value + ownedSatang(asset.currentValue, asset.ownershipBps),
    bookValue: sum.bookValue + ownedSatang(asset.acquisitionCost - asset.accumulatedDep - asset.accumulatedImpairment, asset.ownershipBps),
  }), { cost: 0, value: 0, bookValue: 0 }), [assets]);

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/wealth/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกทรัพย์สินไม่สำเร็จ');
      setShowCreate(false);
      setDraft(emptyDraft());
      setNotice(`เพิ่มทรัพย์สิน ${data.assetCode} แล้ว`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกทรัพย์สินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function saveValuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valuationAsset || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/wealth/assets/${encodeURIComponent(valuationAsset.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valuationDraft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกมูลค่าประเมินไม่สำเร็จ');
      setValuationAsset(null);
      setNotice(`อัปเดตมูลค่า ${valuationAsset.name} แล้ว`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกมูลค่าประเมินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  function startValuation(asset: Asset) {
    setValuationAsset(asset);
    setValuationDraft({ currentValue: (asset.currentValue / 100).toFixed(2), valuationDate: today(), valuationSource: asset.valuationSource || 'ประเมินโดยผู้ใช้', valuationNote: '' });
  }

  const shownAssets = compact ? assets.slice(0, 5) : assets;
  const acquisitionCostPreview = inputToSatang(draft.purchasePrice) + inputToSatang(draft.directCosts) + inputToSatang(draft.nonRecoverableVat);
  const hasDepreciationSettings = ['PROPERTY', 'VEHICLE', 'EQUIPMENT', 'OTHER'].includes(draft.category);

  return <section aria-labelledby={compact ? 'wealth-holdings-title' : 'wealth-assets-title'} className={compact ? 'mb-6 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_8px_30px_#315b4910] sm:p-6' : 'mx-auto w-full max-w-6xl px-4 py-8 sm:px-6'}>
    <header className={`flex flex-wrap items-start justify-between gap-3 ${compact ? 'mb-4' : 'mb-6'}`}>
      <div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">OBN WEALTH · ASSET REGISTRY</p><h2 id={compact ? 'wealth-holdings-title' : 'wealth-assets-title'} className={`mt-1 font-semibold text-slate-800 ${compact ? 'text-xl' : 'text-2xl'}`}>{compact ? 'ทรัพย์สินถือครอง' : 'ทะเบียนทรัพย์สิน OBN'}</h2><p className="mt-1 text-xs text-slate-500">บันทึกทรัพย์สินของ OBN Co., Ltd. แยกต้นทุนจากมูลค่าปัจจุบัน</p></div>
      <div className="flex flex-wrap gap-2">
        {!compact && <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-600 hover:bg-white">กลับ Dashboard</Link>}
        {compact && <Link href="/dashboard/wealth/assets" className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-white">ดูทั้งหมด <ArrowUpRight size={14} /></Link>}
        <button type="button" onClick={() => { setError(''); setDraft(emptyDraft()); setShowCreate(true); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-800 px-4 text-xs font-semibold text-white hover:bg-teal-900"><Plus size={16} /> เพิ่มทรัพย์สิน</button>
      </div>
    </header>

    {error && <div role="alert" className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}<button type="button" aria-label="ปิดข้อความผิดพลาด" onClick={() => setError('')}><X size={15} /></button></div>}
    {notice && <div role="status" className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}<button type="button" aria-label="ปิดข้อความแจ้งผล" onClick={() => setNotice('')}><X size={15} /></button></div>}

    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <article className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><CircleDollarSign size={16} /> มูลค่าทรัพย์สินตามสัดส่วนถือครอง</div><strong className="mt-2 block text-2xl font-semibold tabular-nums text-teal-900">{loading ? 'กำลังโหลด…' : money(totals.value)}</strong></article>
      <article className="rounded-2xl border border-slate-100 bg-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><ChartNoAxesCombined size={16} /> มูลค่าตามบัญชีโดยประมาณ</div><strong className="mt-2 block text-2xl font-semibold tabular-nums text-slate-800">{loading ? 'กำลังโหลด…' : money(totals.bookValue)}</strong></article>
      <article className="rounded-2xl border border-slate-100 bg-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><ChartNoAxesCombined size={16} /> ราคาทุนตามสัดส่วนถือครอง</div><strong className="mt-2 block text-2xl font-semibold tabular-nums text-slate-800">{loading ? 'กำลังโหลด…' : money(totals.cost)}</strong></article>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading ? <div role="status" className="p-8 text-center text-sm text-slate-500">กำลังโหลดทรัพย์สิน…</div> : assets.length === 0 ? <div className="p-8 text-center"><span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-teal-50 text-teal-700"><Building2 size={21} /></span><h3 className="text-sm font-semibold text-slate-800">ยังไม่มีรายการทรัพย์สิน</h3><p className="mt-1 text-xs text-slate-500">เพิ่มเงินฝาก ออมทอง หุ้น กองทุน บ้าน รถ หรือที่ดินของ OBN</p><button type="button" onClick={() => setShowCreate(true)} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-teal-800 px-3 text-xs font-semibold text-white"><Plus size={15} /> เพิ่มทรัพย์สินรายการแรก</button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><caption className="sr-only">ทรัพย์สินของ OBN Co., Ltd.</caption><thead className="bg-slate-50 text-slate-500"><tr><th scope="col" className="px-4 py-3 text-left font-medium">ทรัพย์สิน</th><th scope="col" className="px-4 py-3 text-left font-medium">ประเภท</th><th scope="col" className="px-4 py-3 text-right font-medium">ต้นทุน</th><th scope="col" className="px-4 py-3 text-right font-medium">มูลค่าปัจจุบัน</th><th scope="col" className="px-4 py-3 text-right font-medium">ถือครอง</th><th scope="col" className="px-4 py-3 text-left font-medium">ประเมินล่าสุด</th><th scope="col" className="px-4 py-3 text-right font-medium">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{shownAssets.map((asset) => {
        const change = ownedSatang(asset.currentValue - asset.acquisitionCost, asset.ownershipBps);
        const detailText = Object.values(asset.details).filter(Boolean).slice(0, 2).join(' · ');
        return <tr key={asset.id}>
          <th scope="row" className="px-4 py-3 text-left"><span className="block font-semibold text-slate-800">{asset.name}</span><span className="mt-0.5 block text-[10px] text-slate-400">{asset.assetCode} · {locationLabels.get(asset.branchCode) || 'สำนักงานใหญ่'}{asset.sourceDocumentNo ? ` · เอกสาร ${asset.sourceDocumentNo}` : ''}{detailText ? ` · ${detailText}` : ''}</span></th>
          <td className="px-4 py-3 text-slate-600">{categoryLabel(asset.category)}</td>
          <td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(ownedSatang(asset.acquisitionCost, asset.ownershipBps))}</td>
          <td className="px-4 py-3 text-right tabular-nums"><span className="font-semibold text-slate-800">{money(ownedSatang(asset.currentValue, asset.ownershipBps))}</span><span className={`mt-0.5 flex items-center justify-end gap-0.5 text-[10px] ${change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{change >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{money(Math.abs(change))}</span></td>
          <td className="px-4 py-3 text-right tabular-nums text-slate-600">{(asset.ownershipBps / 100).toFixed(2)}%</td>
          <td className="px-4 py-3 text-slate-600">{dateLabel(asset.valuationDate)}<span className="mt-0.5 block text-[10px] text-slate-400">{asset.valuationSource || 'ไม่ระบุแหล่งราคา'}</span></td>
          <td className="px-4 py-3 text-right"><button type="button" onClick={() => startValuation(asset)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:border-teal-300 hover:text-teal-800"><RefreshCw size={12} /> อัปเดตมูลค่า</button></td>
        </tr>;
      })}</tbody></table></div>}
    </div>
    {compact && assets.length > shownAssets.length && <p className="mt-2 text-right text-[10px] text-slate-400">แสดง {shownAssets.length} จาก {assets.length} รายการ</p>}

    {showCreate && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowCreate(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="wealth-create-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">OBN WEALTH · ASSET ACCOUNTING</p><h3 id="wealth-create-title" className="mt-1 text-lg font-semibold text-slate-800">บันทึกทะเบียนทรัพย์สิน</h3><p className="mt-1 text-xs text-slate-500">ทะเบียนและข้อมูลประกอบบัญชีของ OBN Co., Ltd. ยังไม่สร้างรายการสมุดรายวันอัตโนมัติ</p></div><button type="button" aria-label="ปิด" onClick={() => setShowCreate(false)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><X size={17} /></button></header>
        <form onSubmit={createAsset} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><h4 className="text-xs font-semibold text-slate-700">ข้อมูลและสถานที่ถือครอง</h4></div>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">ชื่อทรัพย์สิน<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="เช่น เครื่องปรับอากาศชั้น 2 หรือบ้านพักบริษัท" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ประเภท<select required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as WealthAssetCategory, details: {}, depreciationMethod: 'NONE' })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600">{WEALTH_ASSET_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-slate-600">สำนักงานใหญ่ / สาขา<select value={draft.branchCode} onChange={(event) => setDraft({ ...draft, branchCode: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600">{locations.map((location) => <option key={location.branchCode} value={location.branchCode}>{location.label}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-slate-600">วิธีได้มา<select value={draft.acquisitionMethod} onChange={(event) => setDraft({ ...draft, acquisitionMethod: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600"><option value="PURCHASE">ซื้อ</option><option value="SELF_CONSTRUCTED">สร้างเอง</option><option value="TRANSFER">รับโอน</option><option value="LEASE">เช่าซื้อ / สัญญาเช่า</option><option value="DONATION">รับบริจาค</option><option value="OPENING_BALANCE">ยอดยกมา</option></select></label>
          <label className="grid gap-1 text-xs text-slate-600">สัดส่วนกรรมสิทธิ์ (%)<input required inputMode="decimal" pattern="(?:[0-9]{1,2}|100)(?:\.[0-9]{1,2})?" value={draft.ownershipPercentage} onChange={(event) => setDraft({ ...draft, ownershipPercentage: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          {detailFields[draft.category].map((field) => <label key={field.key} className="grid gap-1 text-xs text-slate-600">{field.label}<input maxLength={160} value={draft.details[field.key] ?? ''} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, [field.key]: event.target.value } })} placeholder={field.placeholder} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>)}

          <div className="mt-2 border-t border-slate-100 pt-3 sm:col-span-2"><h4 className="text-xs font-semibold text-slate-700">วันที่และเอกสารได้มา</h4></div>
          <label className="grid gap-1 text-xs text-slate-600">วันที่ได้มา<input type="date" value={draft.acquisitionDate} onChange={(event) => setDraft({ ...draft, acquisitionDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">วันที่พร้อมใช้งาน<input type="date" value={draft.readyForUseDate} onChange={(event) => setDraft({ ...draft, readyForUseDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ผู้ขาย / คู่สัญญา<input maxLength={160} value={draft.supplierName} onChange={(event) => setDraft({ ...draft, supplierName: event.target.value })} placeholder="ชื่อผู้ขายหรือคู่สัญญา" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">เลขประจำตัวผู้เสียภาษี<input maxLength={20} value={draft.supplierTaxId} onChange={(event) => setDraft({ ...draft, supplierTaxId: event.target.value.replace(/\D/g, '').slice(0, 13) })} placeholder="13 หลัก (ถ้ามี)" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">เลขที่ใบกำกับภาษี / สัญญา / เอกสาร<input maxLength={100} value={draft.sourceDocumentNo} onChange={(event) => setDraft({ ...draft, sourceDocumentNo: event.target.value })} placeholder="เลขที่เอกสารต้นทาง" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>

          <div className="mt-2 border-t border-slate-100 pt-3 sm:col-span-2"><h4 className="text-xs font-semibold text-slate-700">ราคาทุนและภาษี</h4><p className="mt-1 text-[11px] text-slate-500">ต้นทุนรวม = ราคาซื้อ + ค่าใช้จ่ายที่เกี่ยวโดยตรง + ภาษีซื้อที่ขอคืนไม่ได้; ภาษีซื้อที่ขอคืนได้ไม่รวมในต้นทุน</p></div>
          <label className="grid gap-1 text-xs text-slate-600">ราคาซื้อ (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.purchasePrice} onChange={(event) => setDraft({ ...draft, purchasePrice: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ค่าใช้จ่ายเกี่ยวโดยตรง (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.directCosts} onChange={(event) => setDraft({ ...draft, directCosts: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ภาษีซื้อขอคืนได้ (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.recoverableVat} onChange={(event) => setDraft({ ...draft, recoverableVat: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ภาษีซื้อขอคืนไม่ได้ (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.nonRecoverableVat} onChange={(event) => setDraft({ ...draft, nonRecoverableVat: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">ราคาทุนตามข้อมูลที่กรอก: <strong className="tabular-nums text-slate-800">{money(acquisitionCostPreview)}</strong></div>

          {hasDepreciationSettings && <>
            <div className="mt-2 border-t border-slate-100 pt-3 sm:col-span-2"><h4 className="text-xs font-semibold text-slate-700">ค่าเสื่อมราคาทางบัญชี</h4><p className="mt-1 text-[11px] text-slate-500">กำหนดตามนโยบายบริษัท; ที่ดินหรือสินทรัพย์บางชนิดอาจไม่คิดค่าเสื่อม</p></div>
            <label className="grid gap-1 text-xs text-slate-600">วิธีคิดค่าเสื่อม<select value={draft.depreciationMethod} onChange={(event) => setDraft({ ...draft, depreciationMethod: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600"><option value="NONE">ยังไม่กำหนด / ไม่คิดค่าเสื่อม</option><option value="STRAIGHT_LINE">เส้นตรง</option><option value="DECLINING_BALANCE">ยอดลดลง</option><option value="UNITS_OF_PRODUCTION">ตามหน่วยผลิต</option></select></label>
            <label className="grid gap-1 text-xs text-slate-600">อายุใช้งาน (เดือน)<input type="number" min="1" max="1200" value={draft.usefulLifeMonths} onChange={(event) => setDraft({ ...draft, usefulLifeMonths: event.target.value })} placeholder="ตามนโยบายบัญชี" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">มูลค่าคงเหลือ (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.residualValue} onChange={(event) => setDraft({ ...draft, residualValue: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">วันที่เริ่มคิดค่าเสื่อม<input type="date" value={draft.depreciationStart} onChange={(event) => setDraft({ ...draft, depreciationStart: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">ค่าเสื่อมสะสมทางบัญชี (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.accumulatedDep} onChange={(event) => setDraft({ ...draft, accumulatedDep: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">ด้อยค่าสะสม (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.accumulatedImpairment} onChange={(event) => setDraft({ ...draft, accumulatedImpairment: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <div className="mt-2 border-t border-slate-100 pt-3 sm:col-span-2"><h4 className="text-xs font-semibold text-slate-700">ฐานภาษี (ถ้าทราบ)</h4><p className="mt-1 text-[11px] text-slate-500">เก็บแยกจากค่าเสื่อมทางบัญชี; ไม่กำหนดอัตราให้เอง</p></div>
            <label className="grid gap-1 text-xs text-slate-600">ต้นทุนทางภาษี (บาท)<input inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.taxCost} onChange={(event) => setDraft({ ...draft, taxCost: event.target.value })} placeholder="เว้นว่างหากยังไม่ทราบ" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">อายุใช้งานทางภาษี (เดือน)<input type="number" min="1" max="1200" value={draft.taxUsefulLifeMonths} onChange={(event) => setDraft({ ...draft, taxUsefulLifeMonths: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">วิธี/อัตราตามฐานภาษี<input maxLength={60} value={draft.taxDepMethod} onChange={(event) => setDraft({ ...draft, taxDepMethod: event.target.value })} placeholder="บันทึกตามนโยบายที่ผู้ทำบัญชียืนยัน" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
            <label className="grid gap-1 text-xs text-slate-600">ค่าเสื่อมสะสมทางภาษี (บาท)<input inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.taxAccumulatedDep} onChange={(event) => setDraft({ ...draft, taxAccumulatedDep: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          </>}

          <div className="mt-2 border-t border-slate-100 pt-3 sm:col-span-2"><h4 className="text-xs font-semibold text-slate-700">มูลค่าประเมินสำหรับ Net Worth</h4><p className="mt-1 text-[11px] text-slate-500">ราคาประเมินเก็บแยกจากราคาทุนและไม่ลงบัญชีโดยอัตโนมัติ</p></div>
          <label className="grid gap-1 text-xs text-slate-600">มูลค่าปัจจุบัน (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.currentValue} onChange={(event) => setDraft({ ...draft, currentValue: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">วันที่ประเมินล่าสุด<input required type="date" value={draft.valuationDate} onChange={(event) => setDraft({ ...draft, valuationDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">แหล่งที่มาของมูลค่า<input maxLength={120} value={draft.valuationSource} onChange={(event) => setDraft({ ...draft, valuationSource: event.target.value })} placeholder="เช่น ราคาตลาด / ใบประเมิน / ผู้ให้บริการ" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">หมายเหตุ<input maxLength={2000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="รายละเอียดเพิ่มเติม" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-600">ยกเลิก</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-teal-800 px-5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกทรัพย์สิน'}</button></div>
        </form>
      </section>
    </div>}

    {valuationAsset && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setValuationAsset(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="wealth-valuation-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">บันทึกประวัติประเมิน</p><h3 id="wealth-valuation-title" className="mt-1 text-lg font-semibold text-slate-800">{valuationAsset.name}</h3></div><button type="button" aria-label="ปิด" onClick={() => setValuationAsset(null)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><X size={17} /></button></header>
        <form onSubmit={saveValuation} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">มูลค่าปัจจุบัน (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={valuationDraft.currentValue} onChange={(event) => setValuationDraft({ ...valuationDraft, currentValue: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">วันที่ประเมิน<input required type="date" value={valuationDraft.valuationDate} onChange={(event) => setValuationDraft({ ...valuationDraft, valuationDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">แหล่งที่มา<input maxLength={120} value={valuationDraft.valuationSource} onChange={(event) => setValuationDraft({ ...valuationDraft, valuationSource: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">หมายเหตุ<input maxLength={500} value={valuationDraft.valuationNote} onChange={(event) => setValuationDraft({ ...valuationDraft, valuationNote: event.target.value })} placeholder="หลักฐานหรือหมายเหตุการประเมิน" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" disabled={saving} onClick={() => setValuationAsset(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-600">ยกเลิก</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-teal-800 px-5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกมูลค่า'}</button></div>
        </form>
      </section>
    </div>}
  </section>;
}
