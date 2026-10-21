'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDownRight, ArrowUpRight, Landmark, Plus, RefreshCw, X } from 'lucide-react';
import { ownedSatang } from '@/lib/wealth-assets';

type Asset = { currentValue: number; ownershipBps: number; category: string };
type Liability = {
  id: string;
  liabilityCode: string;
  name: string;
  category: string;
  term: 'SHORT_TERM' | 'LONG_TERM';
  lender: string;
  originalAmount: number;
  outstandingAmount: number;
  nextDueDate: string | null;
};
type Draft = {
  name: string;
  category: string;
  term: 'SHORT_TERM' | 'LONG_TERM';
  lender: string;
  originalAmount: string;
  outstandingAmount: string;
  interestRate: string;
  startDate: string;
  nextDueDate: string;
  notes: string;
};

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(new Date(value)) : 'ไม่ระบุวันครบกำหนด';
const categories = [
  { value: 'LOAN', label: 'เงินกู้' },
  { value: 'MORTGAGE', label: 'หนี้บ้าน / อาคาร' },
  { value: 'VEHICLE_FINANCE', label: 'ไฟแนนซ์รถ' },
  { value: 'CREDIT_CARD', label: 'บัตรเครดิต' },
  { value: 'PAYABLE', label: 'เจ้าหนี้' },
  { value: 'OTHER', label: 'หนี้สินอื่น' },
];
const categoryLabel = (value: string) => categories.find((category) => category.value === value)?.label ?? 'หนี้สินอื่น';
const termLabel = (value: Liability['term']) => value === 'LONG_TERM' ? 'หนี้สินระยะยาว' : 'หนี้สินระยะสั้น';
const assetGroups = [
  { label: 'สินทรัพย์สภาพคล่อง', categories: ['CASH'] },
  { label: 'สินทรัพย์เพื่อการลงทุน', categories: ['GOLD', 'STOCK', 'FUND'] },
  { label: 'สินทรัพย์มีค่า (ระยะยาว)', categories: ['PROPERTY', 'LAND', 'VEHICLE', 'EQUIPMENT', 'OTHER'] },
] as const;
const initialDraft = (): Draft => ({ name: '', category: 'LOAN', term: 'LONG_TERM', lender: '', originalAmount: '', outstandingAmount: '', interestRate: '', startDate: '', nextDueDate: '', notes: '' });

export default function WealthNetWorth() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [balanceTarget, setBalanceTarget] = useState<Liability | null>(null);
  const [balanceDraft, setBalanceDraft] = useState({ outstandingAmount: '', balanceDate: today(), note: '', term: 'SHORT_TERM' as Liability['term'] });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assetResponse, liabilityResponse] = await Promise.all([
        fetch('/api/wealth/assets', { cache: 'no-store' }),
        fetch('/api/wealth/liabilities', { cache: 'no-store' }),
      ]);
      const [assetData, liabilityData] = await Promise.all([assetResponse.json(), liabilityResponse.json()]);
      if (!assetResponse.ok) throw new Error(assetData.error || 'โหลดข้อมูลสินทรัพย์ไม่สำเร็จ');
      if (!liabilityResponse.ok) throw new Error(liabilityData.error || 'โหลดข้อมูลหนี้สินไม่สำเร็จ');
      setAssets(assetData.assets as Asset[]);
      setLiabilities(liabilityData.liabilities as Liability[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูล Net Worth ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const totals = useMemo(() => {
    const assetsValue = assets.reduce((sum, asset) => sum + ownedSatang(asset.currentValue, asset.ownershipBps), 0);
    const debtValue = liabilities.reduce((sum, liability) => sum + liability.outstandingAmount, 0);
    return { assetsValue, debtValue, netWorth: assetsValue - debtValue };
  }, [assets, liabilities]);
  const assetBreakdown = useMemo(() => assetGroups.map((group) => {
    const value = assets.filter((asset) => (group.categories as readonly string[]).includes(asset.category))
      .reduce((sum, asset) => sum + ownedSatang(asset.currentValue, asset.ownershipBps), 0);
    return { ...group, value, percent: totals.assetsValue ? value / totals.assetsValue * 100 : 0 };
  }), [assets, totals.assetsValue]);
  const liabilityBreakdown = useMemo(() => (['SHORT_TERM', 'LONG_TERM'] as const).map((term) => {
    const value = liabilities.filter((liability) => liability.term === term)
      .reduce((sum, liability) => sum + liability.outstandingAmount, 0);
    return { term, label: termLabel(term), value, percent: totals.debtValue ? value / totals.debtValue * 100 : 0 };
  }), [liabilities, totals.debtValue]);

  async function createLiability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/wealth/liabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, balanceDate: today() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกหนี้สินไม่สำเร็จ');
      setShowCreate(false);
      setDraft(initialDraft());
      setNotice(`เพิ่มรายการหนี้สิน ${data.liabilityCode} แล้ว`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกหนี้สินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function updateBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!balanceTarget || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/wealth/liabilities/${encodeURIComponent(balanceTarget.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(balanceDraft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'อัปเดตยอดหนี้ไม่สำเร็จ');
      setBalanceTarget(null);
      setNotice(`อัปเดตยอดคงเหลือ ${balanceTarget.name} แล้ว`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปเดตยอดหนี้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby="wealth-net-worth-title" className="mb-6 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_8px_30px_#315b4910] sm:p-6">
    <header className="mb-4"><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">OBN WEALTH · NET WORTH</p><h2 id="wealth-net-worth-title" className="mt-1 text-xl font-semibold text-slate-800">มูลค่าสุทธิของ OBN</h2><p className="mt-1 text-xs text-slate-500">มูลค่าสินทรัพย์ตามสัดส่วนถือครอง หักยอดหนี้สินคงเหลือ · สำหรับติดตามเพื่อการบริหาร</p></header>

    {error && <div role="alert" className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}<button type="button" aria-label="ปิดข้อความผิดพลาด" onClick={() => setError('')}><X size={15} /></button></div>}
    {notice && <div role="status" className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}<button type="button" aria-label="ปิดข้อความแจ้งผล" onClick={() => setNotice('')}><X size={15} /></button></div>}

    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <article className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><ArrowUpRight size={16} /> สินทรัพย์รวม</div><strong className="mt-2 block text-xl font-semibold tabular-nums text-teal-900">{loading ? 'กำลังโหลด…' : money(totals.assetsValue)}</strong></article>
      <article className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><ArrowDownRight size={16} /> หนี้สินคงเหลือ</div><strong className="mt-2 block text-xl font-semibold tabular-nums text-amber-900">{loading ? 'กำลังโหลด…' : money(totals.debtValue)}</strong></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Landmark size={16} /> Net Worth โดยประมาณ</div><strong className={`mt-2 block text-xl font-semibold tabular-nums ${totals.netWorth < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{loading ? 'กำลังโหลด…' : money(totals.netWorth)}</strong></article>
    </div>

    <div className="mb-5 grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="wealth-assets-summary" className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
        <header className="flex items-center justify-between gap-3 bg-blue-700 px-4 py-3 text-white"><h3 id="wealth-assets-summary" className="text-sm font-semibold">1. สินทรัพย์</h3><span className="text-right text-xs">รวม {loading ? '…' : money(totals.assetsValue)} <span className="ml-1 opacity-80">100%</span></span></header>
        <div className="divide-y divide-slate-100">
          {assetBreakdown.map((group) => <div key={group.label} className="flex items-center justify-between gap-3 bg-blue-50/70 px-4 py-3 text-xs"><span className="font-medium text-slate-700">{group.label}</span><span className="text-right tabular-nums text-slate-800">{loading ? '…' : money(group.value)} <span className="ml-2 inline-block min-w-12 text-slate-500">{group.percent.toFixed(2)}%</span></span></div>)}
        </div>
      </section>
      <section aria-labelledby="wealth-liabilities-summary" className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
        <header className="flex items-center justify-between gap-3 bg-orange-500 px-4 py-3 text-white"><h3 id="wealth-liabilities-summary" className="text-sm font-semibold">2. หนี้สิน</h3><span className="text-right text-xs">รวม {loading ? '…' : money(totals.debtValue)} <span className="ml-1 opacity-80">100%</span></span></header>
        <div className="divide-y divide-slate-100">
          {liabilityBreakdown.map((group) => <div key={group.term} className="flex items-center justify-between gap-3 bg-orange-50/80 px-4 py-3 text-xs"><span className="font-medium text-slate-700">{group.label}</span><span className="text-right tabular-nums text-slate-800">{loading ? '…' : money(group.value)} <span className="ml-2 inline-block min-w-12 text-slate-500">{group.percent.toFixed(2)}%</span></span></div>)}
        </div>
      </section>
      <section aria-label="คำนวณมูลค่าสุทธิ" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-emerald-900">Net Worth · ความมั่งคั่งสุทธิ</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600"><span>สินทรัพย์ {loading ? '…' : money(totals.assetsValue)}</span><span aria-hidden="true">−</span><span>หนี้สิน {loading ? '…' : money(totals.debtValue)}</span><strong className="ml-1 text-base tabular-nums text-emerald-900">= {loading ? '…' : money(totals.netWorth)}</strong></div>
      </section>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h3 className="text-sm font-semibold text-slate-800">หนี้สินและภาระผูกพัน</h3><p className="mt-0.5 text-[11px] text-slate-500">ยอดคงเหลือจะถูกแยกจากสินทรัพย์ และมีประวัติทุกครั้งที่อัปเดต</p></div><button type="button" onClick={() => { setError(''); setDraft(initialDraft()); setShowCreate(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-800 px-3 text-xs font-semibold text-white hover:bg-teal-900"><Plus size={15} /> เพิ่มหนี้สิน</button></div>
      {loading ? <div role="status" className="p-7 text-center text-sm text-slate-500">กำลังโหลดหนี้สิน…</div> : liabilities.length === 0 ? <div className="p-7 text-center"><p className="text-sm font-medium text-slate-700">ยังไม่มีรายการหนี้สิน</p><p className="mt-1 text-xs text-slate-500">เพิ่มยอดหนี้บ้าน รถ เงินกู้ หรือเจ้าหนี้ เพื่อคำนวณ Net Worth ให้ครบถ้วน</p></div> : <div className="divide-y divide-slate-100">{liabilities.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-[180px] flex-1"><p className="text-sm font-semibold text-slate-800">{item.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{item.liabilityCode} · {categoryLabel(item.category)} · {termLabel(item.term)}{item.lender ? ` · ${item.lender}` : ''}</p><p className="mt-0.5 text-[10px] text-slate-400">ครบกำหนด {dateLabel(item.nextDueDate)}</p></div><div className="text-right"><strong className="block text-sm tabular-nums text-amber-800">{money(item.outstandingAmount)}</strong><span className="text-[10px] text-slate-400">จากยอดตั้งต้น {money(item.originalAmount)}</span></div><button type="button" onClick={() => { setBalanceTarget(item); setBalanceDraft({ outstandingAmount: (item.outstandingAmount / 100).toFixed(2), balanceDate: today(), note: '', term: item.term }); }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[10px] font-medium text-slate-600 hover:border-teal-300 hover:text-teal-800"><RefreshCw size={12} /> อัปเดตยอด</button></article>)}</div>}
    </div>

    {showCreate && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowCreate(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="wealth-liability-create-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">OBN WEALTH · LIABILITIES</p><h3 id="wealth-liability-create-title" className="mt-1 text-lg font-semibold text-slate-800">เพิ่มหนี้สิน</h3><p className="mt-1 text-xs text-slate-500">บันทึกยอดหนี้แยกจากมูลค่าสินทรัพย์ของ OBN Co., Ltd.</p></div><button type="button" aria-label="ปิด" onClick={() => setShowCreate(false)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><X size={17} /></button></header>
        <form onSubmit={createLiability} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">ชื่อหนี้สิน<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="เช่น สินเชื่ออาคารสำนักงานใหญ่" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ประเภท<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600">{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-slate-600">ระยะเวลาหนี้<select value={draft.term} onChange={(event) => setDraft({ ...draft, term: event.target.value as Liability['term'] })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600"><option value="SHORT_TERM">หนี้สินระยะสั้น (ครบกำหนดภายใน 1 ปี)</option><option value="LONG_TERM">หนี้สินระยะยาว (เกิน 1 ปี)</option></select></label>
          <label className="grid gap-1 text-xs text-slate-600">เจ้าหนี้ / ผู้ให้กู้<input maxLength={160} value={draft.lender} onChange={(event) => setDraft({ ...draft, lender: event.target.value })} placeholder="ชื่อธนาคารหรือคู่ค้า" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ยอดหนี้ตั้งต้น (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.originalAmount} onChange={(event) => setDraft({ ...draft, originalAmount: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ยอดคงเหลือปัจจุบัน (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={draft.outstandingAmount} onChange={(event) => setDraft({ ...draft, outstandingAmount: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">ดอกเบี้ยต่อปี (%)<input inputMode="decimal" pattern="[0-9]{1,3}(?:\.[0-9]{1,2})?" value={draft.interestRate} onChange={(event) => setDraft({ ...draft, interestRate: event.target.value })} placeholder="ถ้ามี" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">วันที่เริ่มหนี้<input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600">วันครบกำหนดถัดไป<input type="date" value={draft.nextDueDate} onChange={(event) => setDraft({ ...draft, nextDueDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">หมายเหตุ<input maxLength={2000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="รายละเอียดเพิ่มเติม" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-600">ยกเลิก</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-teal-800 px-5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกหนี้สิน'}</button></div>
        </form>
      </section>
    </div>}

    {balanceTarget && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setBalanceTarget(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="wealth-liability-balance-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-semibold tracking-[2px] text-teal-700">บันทึกประวัติยอดหนี้</p><h3 id="wealth-liability-balance-title" className="mt-1 text-lg font-semibold text-slate-800">{balanceTarget.name}</h3></div><button type="button" aria-label="ปิด" onClick={() => setBalanceTarget(null)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><X size={17} /></button></header>
        <form onSubmit={updateBalance} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">ระยะเวลาหนี้<select value={balanceDraft.term} onChange={(event) => setBalanceDraft({ ...balanceDraft, term: event.target.value as Liability['term'] })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600"><option value="SHORT_TERM">หนี้สินระยะสั้น (ครบกำหนดภายใน 1 ปี)</option><option value="LONG_TERM">หนี้สินระยะยาว (เกิน 1 ปี)</option></select></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">ยอดหนี้คงเหลือ (บาท)<input required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={balanceDraft.outstandingAmount} onChange={(event) => setBalanceDraft({ ...balanceDraft, outstandingAmount: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">วันที่ยอดคงเหลือ<input required type="date" value={balanceDraft.balanceDate} onChange={(event) => setBalanceDraft({ ...balanceDraft, balanceDate: event.target.value })} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <label className="grid gap-1 text-xs text-slate-600 sm:col-span-2">หมายเหตุ<input maxLength={500} value={balanceDraft.note} onChange={(event) => setBalanceDraft({ ...balanceDraft, note: event.target.value })} placeholder="เช่น ชำระงวดเดือนนี้" className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-600" /></label>
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" disabled={saving} onClick={() => setBalanceTarget(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-600">ยกเลิก</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-teal-800 px-5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก…' : 'บันทึกยอดคงเหลือ'}</button></div>
        </form>
      </section>
    </div>}
  </section>;
}
