import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined, Layers3, PieChart } from "lucide-react";

type Slice = { label: string; value: number; color: string };
type Month = { key: string; label: string; income: number; expense: number };
const baht = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(value / 100);
const compact = (value: number) => new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value / 100);

function Donut({ title, caption, slices, href, showTotal = true }: { title: string; caption: string; slices: Slice[]; href: string; showTotal?: boolean }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const circumference = 2 * Math.PI * 67;
  return <article className="loan-visual-card">
    <header className="loan-visual-heading"><div><span><PieChart size={15} /> สัดส่วนข้อมูล</span><h2>{title}</h2></div><Link href={href} aria-label={`ดูรายละเอียด${title}`}><ArrowUpRight size={18} /></Link></header>
    <div className="loan-donut-layout">
      <div className="loan-donut">
        <svg viewBox="0 0 180 180" role="img" aria-label={`${title} รวม ${baht(total)}`}>
          <circle cx="90" cy="90" r="67" fill="none" stroke="#dfedeb" strokeWidth="22" />
          {slices.map((slice, index) => {
            if (slice.value <= 0) return null;
            const length = total ? slice.value / total * circumference : 0;
            const start = slices.slice(0, index).reduce((sum, previous) => sum + previous.value, 0) / total * circumference;
            return <circle key={slice.label} cx="90" cy="90" r="67" fill="none" stroke={slice.color} strokeWidth="22" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"><title>{`${slice.label}: ${baht(slice.value)} (${(slice.value / total * 100).toFixed(1)}%)`}</title></circle>;
          })}
        </svg>
        <div><small>{showTotal ? "ยอดคาดว่าจะรับ" : "สัดส่วนเงินรับ"}</small><strong>{showTotal ? baht(total) : total ? "100%" : "0%"}</strong><small>{total ? caption : "ยังไม่มีข้อมูลยอดเงิน"}</small></div>
      </div>
      <ul className="loan-chart-legend">{slices.map(slice => <li key={slice.label}><i style={{ background: slice.color }} /><div><span>{slice.label}</span><strong>{total ? (slice.value / total * 100).toFixed(1) : "0"}%</strong></div></li>)}</ul>
    </div>
    <details className="loan-monthly-data"><summary>ดูยอดเงินแยกประเภท</summary><div><table><caption className="sr-only">{title}</caption><thead><tr><th>ประเภท</th><th>จำนวนเงิน</th></tr></thead><tbody>{slices.map(slice => <tr key={slice.label}><td>{slice.label}</td><td>{baht(slice.value)}</td></tr>)}</tbody></table></div></details>
  </article>;
}

export default function LoanFinanceCharts({ months, monthCount, receipts, portfolio, stages }: {
  months: Month[];
  monthCount: number;
  receipts: Slice[];
  portfolio: Slice[];
  stages: { label: string; count: number; color: string }[];
}) {
  const visibleMonths = months.slice(0, monthCount);
  const max = Math.max(100, ...visibleMonths.flatMap(month => [month.income, month.expense]));
  const x = (index: number) => 55 + index * 620 / 11;
  const y = (value: number) => 195 - value / max * 155;
  const points = (field: "income" | "expense") => visibleMonths.map((month, index) => `${x(index)},${y(month[field])}`).join(" ");
  const totalContracts = stages.reduce((sum, stage) => sum + stage.count, 0);
  const maxStage = Math.max(1, ...stages.map(stage => stage.count));
  return <section className="loan-visual-grid" aria-label="กราฟวิเคราะห์สินเชื่อ">
    <article className="loan-visual-card loan-trend-card">
      <header className="loan-visual-heading"><div><span><ChartNoAxesCombined size={15} /> แนวโน้มรายเดือน</span><h2>เส้นทางเงินรับและเงินจ่าย</h2></div><span className="loan-chart-unit">หน่วย: บาท</span></header>
      <div className="loan-line-scroll"><svg className="loan-line-chart" viewBox="0 0 710 235" role="img" aria-label="กราฟเส้นรายรับและรายจ่ายรายเดือนตั้งแต่มกราคมถึงเดือนปัจจุบัน">
        <defs><linearGradient id="loan-income-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#29b5a4" stopOpacity=".25" /><stop offset="100%" stopColor="#29b5a4" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1="55" x2="675" y1={y(max * tick / 4)} y2={y(max * tick / 4)} stroke="#dfebe8" strokeDasharray="3 5" /><text x="45" y={y(max * tick / 4) + 4} textAnchor="end">{compact(max * tick / 4)}</text></g>)}
        <polygon points={`${x(0)},195 ${points("income")} ${x(visibleMonths.length - 1)},195`} fill="url(#loan-income-area)" />
        <polyline points={points("income")} fill="none" stroke="#15a593" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points("expense")} fill="none" stroke="#a78ecb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {visibleMonths.map((month, index) => <g key={month.key}><circle cx={x(index)} cy={y(month.income)} r="4" fill="#15a593" stroke="white" strokeWidth="2"><title>{`${month.label} รายรับ ${baht(month.income)}`}</title></circle><circle cx={x(index)} cy={y(month.expense)} r="3.5" fill="#a78ecb" stroke="white" strokeWidth="2"><title>{`${month.label} รายจ่าย ${baht(month.expense)}`}</title></circle></g>)}
        {months.map((month, index) => <text key={month.key} x={x(index)} y="222" textAnchor="middle">{month.label}</text>)}
      </svg></div>
      <div className="loan-trend-legend"><span><i className="income" /> รายรับจริง</span><span><i className="expense" /> รายจ่ายจริง</span></div>
      <details className="loan-monthly-data"><summary>ดูตัวเลขรายเดือน</summary><div><table><caption className="sr-only">รายรับและรายจ่ายรายเดือน หน่วยบาท</caption><thead><tr><th>เดือน</th><th>รายรับ</th><th>รายจ่าย</th><th>สุทธิ</th></tr></thead><tbody>{visibleMonths.map(month => <tr key={month.key}><td>{month.label}</td><td>{baht(month.income)}</td><td>{baht(month.expense)}</td><td>{baht(month.income - month.expense)}</td></tr>)}</tbody></table></div></details>
    </article>
    <article className="loan-visual-card">
      <header className="loan-visual-heading"><div><span><Layers3 size={15} /> สถานะปัจจุบัน</span><h2>ภาพรวมสัญญาทั้งหมด</h2></div><span className="loan-chart-unit">{totalContracts.toLocaleString("th-TH")} สัญญา</span></header>
      <div className="loan-stage-list">{stages.map(stage => <div className="loan-stage" key={stage.label}><div><span>{stage.label}</span><strong>{stage.count.toLocaleString("th-TH")}</strong></div><div className="loan-stage-track"><i style={{ width: `${stage.count / maxStage * 100}%`, background: stage.color }} /></div></div>)}</div>
      <p className="loan-chart-footnote">นับตามสถานะปัจจุบัน รวมสัญญาจากทุกปี</p>
    </article>
    <Donut title="สัดส่วนเงินที่ได้รับปีนี้" caption="เงินรับปีนี้" slices={receipts} href="/dashboard/loan/ledger" showTotal={false} />
    <Donut title="เงินที่รอรับ ณ วันนี้" caption="รวมสัญญาที่ยังไม่ปิดจากทุกปี" slices={portfolio} href="/dashboard/loan/ar" />
  </section>;
}
