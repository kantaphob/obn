'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, Building2, CalendarDays,
  Check, ChevronDown, CircleAlert, Clock3, FileCheck2, Landmark, LockKeyhole,
  Receipt, Scale, ShieldCheck, Wallet,
} from 'lucide-react';

const companies = [
  { code: 'OBN', name: 'OBN Co., Ltd.', short: 'OBN', income: 1_200_000, expense: 600_000, balance: 2_460_000, color: '#4c8765' },
  { code: 'COMP-B', name: 'บริษัท บี จำกัด', short: 'บริษัท B', income: 850_000, expense: 480_000, balance: 1_570_000, color: '#6689b2' },
  { code: 'COMP-C', name: 'บริษัท ซี จำกัด', short: 'บริษัท C', income: 400_000, expense: 240_000, balance: 820_000, color: '#b28c55' },
];

const approvals = [
  { code: 'PAY-2025-0148', company: 'OBN Co., Ltd.', description: 'ค่าเช่าสำนักงาน เดือนมิถุนายน', amount: 48_000, age: 'รอ 2 ชม.', type: 'จ่าย' },
  { code: 'REC-2025-0086', company: 'บริษัท บี จำกัด', description: 'รับชำระค่าสินค้า · INV-24081', amount: 125_000, age: 'รอ 4 ชม.', type: 'รับ' },
  { code: 'TRF-2025-0012', company: 'OBN Co., Ltd. → บริษัท ซี จำกัด', description: 'โอนเงินระหว่างบริษัท', amount: 200_000, age: 'รอ 1 วัน', type: 'โอน' },
];

const banks = [
  { company: 'OBN Co., Ltd.', bank: 'ธนาคารกสิกรไทย', account: '•••• 4821', balance: 1_620_000 },
  { company: 'บริษัท บี จำกัด', bank: 'ธนาคารกรุงเทพ', account: '•••• 1934', balance: 1_080_000 },
  { company: 'บริษัท ซี จำกัด', bank: 'ธนาคารไทยพาณิชย์', account: '•••• 6702', balance: 610_000 },
];

const trend = [
  { month: 'ม.ค.', income: 1.6, expense: 1.1 }, { month: 'ก.พ.', income: 1.9, expense: 1.2 },
  { month: 'มี.ค.', income: 1.7, expense: 1.4 }, { month: 'เม.ย.', income: 2.1, expense: 1.3 },
  { month: 'พ.ค.', income: 2.0, expense: 1.5 }, { month: 'มิ.ย.', income: 2.45, expense: 1.32 },
];

const formatMoney = (value: number) => new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', maximumFractionDigits: 0,
}).format(value);

export default function AccountsOverview() {
  const [companyCode, setCompanyCode] = useState('ALL');
  const selectedCompanies = useMemo(
    () => companyCode === 'ALL' ? companies : companies.filter((company) => company.code === companyCode),
    [companyCode],
  );
  const totals = useMemo(() => selectedCompanies.reduce((sum, company) => ({
    income: sum.income + company.income,
    expense: sum.expense + company.expense,
    balance: sum.balance + company.balance,
  }), { income: 0, expense: 0, balance: 0 }), [selectedCompanies]);
  const scopeLabel = companyCode === 'ALL' ? 'ทุกบริษัท' : selectedCompanies[0]?.name;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 text-[#26352d] sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#859188]">
            <span>OBN Enterprise</span><span className="text-[#c5cdc7]">/</span><span className="text-[#52745e]">Central Finance</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#26352d] sm:text-[30px]">Dashboard การเงินกลาง</h1>
          <p className="mt-1.5 text-sm text-[#77847b]">ภาพรวมรายรับ รายจ่าย และสภาพคล่อง แยกตามบริษัทในกลุ่ม</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e3e9e4] bg-white px-3 text-xs text-[#6d7971] shadow-sm">
            <CalendarDays size={15} aria-hidden="true" /><span className="sr-only">ช่วงเวลา</span>
            <select defaultValue="มิถุนายน 2568" aria-label="เลือกช่วงเวลา" className="max-w-[150px] bg-transparent font-medium text-[#3b4a40] outline-none">
              <option>มิถุนายน 2568</option><option>พฤษภาคม 2568</option><option>ไตรมาส 2 / 2568</option><option>ปี 2568</option>
            </select><ChevronDown size={13} aria-hidden="true" />
          </label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dce6de] bg-white px-3 text-xs text-[#6d7971] shadow-sm">
            <Building2 size={15} className="text-[#5d8268]" aria-hidden="true" /><span className="sr-only">บริบทบริษัท</span>
            <select aria-label="เลือกบริษัท" value={companyCode} onChange={(event) => setCompanyCode(event.target.value)} className="max-w-[170px] bg-transparent font-semibold text-[#34483a] outline-none">
              <option value="ALL">ทุกบริษัท</option>{companies.map((company) => <option key={company.code} value={company.code}>{company.name}</option>)}
            </select><ChevronDown size={13} aria-hidden="true" />
          </label>
          <Link href="/dashboard/accounts/receipts" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#56886b] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#44765a]"><ArrowDownLeft size={15} aria-hidden="true" />บันทึกรับเงิน</Link>
          <Link href="/dashboard/accounts/payments" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#b87563] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#a36352]"><ArrowUpRight size={15} aria-hidden="true" />บันทึกจ่ายเงิน</Link>
          <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#edf5ef] px-3 text-[11px] font-semibold text-[#4d7959]"><ShieldCheck size={15} aria-hidden="true" />Group CFO</span>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5ebdf] bg-[#f6f8f2] px-4 py-2.5 text-[11px] text-[#71806e]">
        <span className="inline-flex items-center gap-2"><CircleAlert size={14} className="text-[#8d9b69]" aria-hidden="true" />ข้อมูลตัวอย่างสำหรับสาธิตหน้าจอ ไม่ใช่ข้อมูลทางบัญชีจริง</span>
        <span className="font-medium">ขอบเขตที่กำลังดู: {scopeLabel}</span>
      </div>

      <section aria-label="สรุปการเงิน" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="รายรับรวม" value={formatMoney(totals.income)} note="รับแล้วในช่วงเวลาที่เลือก" icon={ArrowDownLeft} tone="green" trend="+8.4%" />
        <MetricCard label="รายจ่ายรวม" value={formatMoney(totals.expense)} note="จ่ายแล้วในช่วงเวลาที่เลือก" icon={ArrowUpRight} tone="rose" trend="+3.1%" />
        <MetricCard label="กระแสเงินสดสุทธิ" value={formatMoney(totals.income - totals.expense)} note="รายรับหักรายจ่าย" icon={Wallet} tone="blue" trend="+12.6%" />
        <MetricCard label="ยอดเงินคงเหลือ" value={formatMoney(totals.balance)} note="บัญชีธนาคารและเงินสด" icon={Landmark} tone="amber" />
      </section>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-xl border border-[#e7ece8] bg-white shadow-[0_1px_2px_#22382a08]">
          <PanelHeading title="แนวโน้มรายรับ–รายจ่าย" subtitle="ภาพรวมกลุ่ม · 6 เดือนย้อนหลัง" icon={Scale} />
          <div className="grid h-[220px] grid-cols-6 items-end gap-3 px-5 pb-4 pt-6 sm:gap-7">
            {trend.map((item, index) => <div key={item.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <div className="flex h-[160px] w-full max-w-[82px] items-end justify-center gap-1.5" aria-label={`${item.month}: รับ ${item.income} ล้านบาท จ่าย ${item.expense} ล้านบาท`}>
                <div className={`w-[min(30px,45%)] rounded-t-md ${index === trend.length - 1 ? 'bg-[#54876a]' : 'bg-[#a9c7b1]'}`} style={{ height: `${item.income / 2.6 * 150}px` }} />
                <div className={`w-[min(30px,45%)] rounded-t-md ${index === trend.length - 1 ? 'bg-[#d28f7b]' : 'bg-[#e7c4b9]'}`} style={{ height: `${item.expense / 2.6 * 150}px` }} />
              </div><span className={`text-[10px] ${index === trend.length - 1 ? 'font-semibold text-[#477d5a]' : 'text-[#929d95]'}`}>{item.month}</span>
            </div>)}
          </div>
          <div className="flex items-center justify-between border-t border-[#eef1ee] px-5 py-3">
            <div className="flex gap-4 text-[10px] text-[#78847c]"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#54876a]" />รายรับ</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#d28f7b]" />รายจ่าย</span></div>
            <span className="text-[10px] text-[#98a29b]">หน่วย: ล้านบาท</span>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e7ece8] bg-white shadow-[0_1px_2px_#22382a08]">
          <PanelHeading title="รายการรออนุมัติ" subtitle="งานที่ต้องตรวจสอบตามสิทธิ์" icon={Clock3} action="ดูทั้งหมด" href="/dashboard/accounts/audit" />
          <div className="divide-y divide-[#f0f2f0]">
            {approvals.map((item) => <article key={item.code} className="flex items-center gap-3 px-5 py-3.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.type === 'รับ' ? 'bg-[#edf5ef] text-[#5a8a69]' : item.type === 'โอน' ? 'bg-[#f1eff8] text-[#8272a4]' : 'bg-[#fbf0ed] text-[#ba7765]'}`}>
                {item.type === 'รับ' ? <ArrowDownLeft size={17} /> : item.type === 'โอน' ? <ArrowRight size={17} /> : <ArrowUpRight size={17} />}
              </span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><strong className="truncate text-xs font-semibold text-[#39473e]">{item.description}</strong><span className="rounded-full bg-[#fff6e8] px-2 py-0.5 text-[9px] font-semibold text-[#a27b35]">{item.type}</span></div><p className="mt-1 truncate text-[10px] text-[#939d96]">{item.company} · {item.code} · {item.age}</p></div>
              <strong className="shrink-0 text-xs font-semibold tabular-nums text-[#46544a]">{formatMoney(item.amount)}</strong>
            </article>)}
          </div>
          <div className="border-t border-[#eef1ee] bg-[#fafbfa] px-5 py-3"><span className="inline-flex items-center gap-1.5 text-[10px] text-[#77847b]"><LockKeyhole size={13} aria-hidden="true" />แสดงเฉพาะรายการในขอบเขตสิทธิ์ของคุณ</span></div>
        </section>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-xl border border-[#e7ece8] bg-white shadow-[0_1px_2px_#22382a08]">
          <PanelHeading title="เปรียบเทียบรายบริษัท" subtitle="รายรับ รายจ่าย และเงินคงเหลือ · มิถุนายน 2568" icon={Building2} action="ดูรายงาน" href="/dashboard/accounts/closing" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[610px] text-left">
              <thead><tr className="h-10 border-b border-[#edf0ed] bg-[#fafbfa] text-[10px] font-medium text-[#8c9790]"><th className="px-5">บริษัท</th><th className="text-right">รายรับ</th><th className="text-right">รายจ่าย</th><th className="text-right">สุทธิ</th><th className="px-5 text-right">ยอดคงเหลือ</th><th className="pr-5" /></tr></thead>
              <tbody className="divide-y divide-[#f0f2f0]">{selectedCompanies.map((company) => <tr key={company.code} className="h-[62px] text-xs hover:bg-[#fcfdfc]">
                <td className="px-5"><div className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: company.color }} /><span><strong className="block font-semibold text-[#39473e]">{company.name}</strong><small className="mt-0.5 block text-[10px] text-[#99a29c]">รหัส {company.code}</small></span></div></td>
                <td className="whitespace-nowrap text-right font-medium tabular-nums text-[#4d8560]">{formatMoney(company.income)}</td><td className="whitespace-nowrap text-right font-medium tabular-nums text-[#b97060]">{formatMoney(company.expense)}</td><td className="whitespace-nowrap text-right font-semibold tabular-nums text-[#405c49]">{formatMoney(company.income - company.expense)}</td><td className="whitespace-nowrap px-5 text-right font-medium tabular-nums text-[#546159]">{formatMoney(company.balance)}</td>
                <td className="pr-5 text-right"><button type="button" onClick={() => setCompanyCode(company.code)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#548064] hover:bg-[#f0f6f1]">ดูบริษัท</button></td>
              </tr>)}</tbody>
              {companyCode === 'ALL' && <tfoot><tr className="h-12 bg-[#fafbfa] text-xs"><td className="px-5 font-semibold text-[#49584e]">รวมเพื่อการบริหาร</td><td className="text-right font-semibold tabular-nums text-[#4d8560]">{formatMoney(totals.income)}</td><td className="text-right font-semibold tabular-nums text-[#b97060]">{formatMoney(totals.expense)}</td><td className="text-right font-semibold tabular-nums text-[#405c49]">{formatMoney(totals.income - totals.expense)}</td><td className="px-5 text-right font-semibold tabular-nums text-[#546159]">{formatMoney(totals.balance)}</td><td /></tr></tfoot>}
            </table>
          </div>
          <div className="flex gap-2 border-t border-[#f0f2f0] bg-[#fffaf2] px-5 py-3 text-[10px] leading-relaxed text-[#88784f]"><CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>ยอดรวมนี้ใช้เพื่อการบริหารเท่านั้น งบการเงินรวมต้องกระทบยอดและตัดรายการระหว่างบริษัทก่อน</span></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e7ece8] bg-white shadow-[0_1px_2px_#22382a08]">
          <PanelHeading title="บัญชีธนาคารและเงินสด" subtitle="ยอดคงเหลือแยกตามบริษัท" icon={Landmark} action="ดูบัญชี" href="/dashboard/accounts/cash-and-banks" />
          <div className="divide-y divide-[#f0f2f0]">{banks.filter((bank) => companyCode === 'ALL' || companies.find((company) => company.code === companyCode)?.name === bank.company).map((bank) => <div key={bank.account} className="flex items-center gap-3 px-5 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eff4f0] text-[#648571]"><Landmark size={17} aria-hidden="true" /></span><div className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-[#425047]">{bank.bank}</strong><span className="mt-1 block text-[10px] text-[#98a19b]">{bank.company} · {bank.account}</span></div><strong className="shrink-0 text-xs font-semibold tabular-nums text-[#43564a]">{formatMoney(bank.balance)}</strong>
          </div>)}</div>
          <div className="flex items-center justify-between border-t border-[#eef1ee] bg-[#fafbfa] px-5 py-3 text-[10px]"><span className="text-[#89948d]">ยอดรวมบัญชีที่แสดง</span><strong className="text-[#46584c]">{formatMoney(selectedCompanies.reduce((sum, company) => sum + company.balance, 0))}</strong></div>
        </section>
      </div>

      <section className="mb-5 overflow-hidden rounded-xl border border-[#e7ece8] bg-white shadow-[0_1px_2px_#22382a08]">
        <PanelHeading title="เข้าสู่ระบบบัญชี" subtitle="ทุกงานใช้บริบทบริษัทและสิทธิ์สมาชิกเป็นตัวกำหนดข้อมูลที่เข้าถึงได้" icon={Receipt} />
        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
          <ModuleLink href="/dashboard/accounts/receipts" title="บันทึกรับเงิน" detail="รับเงินแยกตามบริษัทในบัญชีกลาง" icon={ArrowDownLeft} />
          <ModuleLink href="/dashboard/accounts/payments" title="บันทึกจ่ายเงิน" detail="จ่ายเงินแยกตามบริษัทในบัญชีกลาง" icon={ArrowUpRight} />
          <ModuleLink href="/dashboard/accounts/ar/invoices" title="ลูกหนี้ (AR)" detail="ใบแจ้งหนี้ ใบเสร็จ และรับชำระ" icon={ArrowDownLeft} />
          <ModuleLink href="/dashboard/accounts/ap/vouchers" title="เจ้าหนี้ (AP)" detail="ใบสำคัญจ่ายและจ่ายชำระ" icon={ArrowUpRight} />
          <ModuleLink href="/dashboard/accounts/cash-and-banks" title="บัญชีธนาคารและเงินสด" detail="บัญชีเงินฝากและรายการเคลื่อนไหว" icon={Landmark} />
          <ModuleLink href="/dashboard/accounts/trial-balance" title="งบทดลอง" detail="ตรวจสอบยอดเดบิตและเครดิต" icon={Scale} />
          <ModuleLink href="/dashboard/accounts/closing" title="ปิดบัญชีและงบการเงิน" detail="ตรวจยอดและปิดรอบบัญชี" icon={FileCheck2} />
          <ModuleLink href="/dashboard/accounts/audit" title="ตรวจสอบและเอกสาร" detail="ติดตามเอกสารและรายการตรวจสอบ" icon={ShieldCheck} />
          <ModuleLink href="/dashboard/accounts/budget" title="งบประมาณ" detail="ติดตามแผนและผลการใช้จ่าย" icon={Banknote} />
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-[#929d96]">
        <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-[#6a9776]" aria-hidden="true" />Dashboard กลาง · ตัวอย่างข้อมูลจำลอง · มิถุนายน 2568</span>
        <Link href="/admin/companies" className="inline-flex items-center gap-1 font-medium text-[#668371] hover:text-[#426a50]">จัดการข้อมูลบริษัท <ArrowRight size={13} aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone, trend }: { label: string; value: string; note: string; icon: typeof Wallet; tone: string; trend?: string }) {
  const tones: Record<string, string> = { green: 'bg-[#edf5ef] text-[#5b8968]', rose: 'bg-[#fbf0ed] text-[#b97564]', blue: 'bg-[#edf4f8] text-[#6289a0]', amber: 'bg-[#fbf5e9] text-[#aa884f]' };
  return <article className="rounded-xl border border-[#e7ece8] bg-white p-4 shadow-[0_1px_2px_#22382a08]">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#87938b]">{label}</p><p className="mt-3 text-[21px] font-semibold tracking-tight text-[#2e3c33]">{value}</p></div><span className={`grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}><Icon size={17} aria-hidden="true" /></span></div>
    <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-[#98a29b]">{note}</span>{trend && <span className="shrink-0 rounded-full bg-[#eff6f0] px-2 py-0.5 text-[9px] font-semibold text-[#5a8968]">{trend}</span>}</div>
  </article>;
}

function PanelHeading({ title, subtitle, icon: Icon, action, href }: { title: string; subtitle: string; icon: typeof Wallet; action?: string; href?: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#eef1ee] px-5 py-4"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f0f5f1] text-[#668773]"><Icon size={16} aria-hidden="true" /></span><span className="min-w-0"><strong className="block text-sm font-semibold text-[#354239]">{title}</strong><small className="mt-0.5 block truncate text-[10px] text-[#98a29b]">{subtitle}</small></span></div>{action && href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#5d8168] hover:text-[#42674c]">{action}<ArrowRight size={13} aria-hidden="true" /></Link>}</div>;
}

function ModuleLink({ href, title, detail, icon: Icon }: { href: string; title: string; detail: string; icon: typeof Wallet }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition hover:border-[#e6eee8] hover:bg-[#f7faf7]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eff4f0] text-[#668773]"><Icon size={17} aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-[#405047]">{title}</strong><small className="mt-1 block truncate text-[10px] text-[#98a29b]">{detail}</small></span><ArrowRight size={14} className="shrink-0 text-[#b5beb8] transition group-hover:translate-x-0.5 group-hover:text-[#5d8168]" aria-hidden="true" /></Link>;
}
