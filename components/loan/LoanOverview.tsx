import Link from "next/link";
import {
  AlarmClock,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { normalizeLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";
import { getLoanDashboardData } from "@/lib/loan-dashboard";
import { formatBorrowerCode } from "@/lib/borrower-code";
import { SYSTEMS } from "@/lib/nav";
import { workspaceStyles as styles } from "@/components/ui/workspace-styles";
import LoanFinanceCharts from "./LoanFinanceCharts";
import { AmountShare, CapitalWaterfall, FinanceSparkline, InterestComparison } from "./LoanSummaryVisuals";
import "./overview.css";

const money = (satang: number) => new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
}).format(satang / 100);

const dateLabel = (value: Date | null) => value
  ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(value)
  : "ไม่ระบุวันครบกำหนด";

function borrowerName(borrower: {
  firstName: string;
  lastName: string | null;
  nickname: string | null;
}) {
  return [borrower.firstName, borrower.lastName].filter(Boolean).join(" ") || borrower.nickname || "ไม่ระบุชื่อ";
}

export default async function LoanOverview() {
  const { now, year, dateParts, contracts, cashflowRows, lifetimeFinance, cashBalance, contractsById, upfrontInterestRows, upfrontInterestTotal, capitalRows, openContracts, dueToday, overdue, overdueBalance, recentReviewQueue, reviewPrincipalTotal, overdueFollowups, cashflow, annualCashflow, finance, outstanding, pendingDisbursement } = await getLoanDashboardData();
  const system = SYSTEMS.loan;
  const capitalFacts = [
    { label: "เงินสดคงเหลือตามบัญชี", value: cashBalance, note: "เงินรับทั้งหมด − เงินจ่ายทั้งหมดถึงวันนี้" },
    { label: "จ่ายเงินกู้ออกจริงสะสม", value: lifetimeFinance.disbursed, note: "เงินจ่ายสุทธิสะสม รวมเงินที่หมุนให้กู้ซ้ำ" },
    { label: "เงินต้นคงเหลือกับผู้กู้", value: outstanding.principal, note: "เงินต้นตามสัญญาที่ยังไม่คืน รวมส่วนหักดอกล่วงหน้า" },
  ];
  const interestReceiptRows = cashflowRows.flatMap(row => {
    if (row.type !== "INCOME") return [];
    const amount = row.loanReceiptBreakdown?.interest ?? (normalizeLoanFinanceCategoryCode(row.categoryCode) === "LOAN_INTEREST" ? row.amount : 0);
    return amount > 0 ? [{ id: row.id, title: row.title, date: row.transactionDate, amount }] : [];
  });
  const interestDueRows = openContracts.filter(contract => contract.balance.interest > 0);
  const annualExpenseDetails = [
    { label: "จ่ายเงินกู้สุทธิ", value: finance.disbursed },
    { label: "ค่าใช้จ่ายดำเนินงาน", value: finance.operatingExpenses },
    { label: "ถอนทุน", value: finance.capitalWithdrawn },
  ];
  const netCashflow = annualCashflow.net;
  const stages = [
    { status: "DRAFT", label: "ร่างสัญญา", color: "#b8c9cc" },
    { status: "RESERVED", label: "จองสัญญา", color: "#9ec7cf" },
    { status: "AWAITING_DOCUMENT", label: "รอเอกสาร", color: "#b4a2d6" },
    { status: "READY", label: "พร้อมจ่ายเงิน", color: "#6dcab9" },
    { status: "ACTIVE", label: "กำลังดำเนินการ", color: "#17ab99" },
    { status: "OVERDUE", label: "สถานะเกินกำหนด", color: "#e4a486" },
    { status: "CLOSED", label: "ปิดสัญญาแล้ว", color: "#4b8291" },
  ].map(stage => ({ ...stage, count: contracts.filter(contract => contract.status === stage.status).length }));
  const monthCount = Number(dateParts.find(part => part.type === "month")?.value);

  const metrics = [
    { label: "เงินรอจ่ายให้ผู้กู้", value: money(pendingDisbursement), note: "สัญญาพร้อมจ่ายและจองสัญญา ณ วันนี้", icon: CircleDollarSign, tone: "green", href: "/dashboard/loan/ap" },
    { label: "ครบกำหนดวันนี้", value: dueToday.length.toLocaleString("th-TH"), note: "สัญญาที่ยังมียอดคงเหลือ", icon: CalendarDays, tone: "amber", href: "/dashboard/loan/ar" },
    { label: "ยอดคงเหลือสัญญาเกินกำหนด", value: money(overdueBalance), note: `${overdue.length.toLocaleString("th-TH")} สัญญา · คำนวณถึงวันนี้`, icon: CircleDollarSign, tone: "rose", href: "/dashboard/loan/overdue" },
  ];

  return <div className={`${styles.page} loan-overview`}>
    <header className="loan-dashboard-heading">
      <div><p className="loan-dashboard-eyebrow">FINANCIAL WORKSPACE</p><h1>ภาพรวม{system.label}</h1><p>ทุกความเคลื่อนไหวของเงินและสินเชื่อ ในมุมมองเดียว</p></div>
      <div className="loan-dashboard-meta"><span className="loan-live-badge"><i /> อัปเดตทุก 10 วินาที</span><span className="loan-year-badge"><CalendarDays size={15} /> ปี {year + 543} · ถึง {dateLabel(now)}</span></div>
    </header>

    <div className="loan-summary-grid">
    <section className="loan-cashflow loan-primary-finance" aria-labelledby="loan-primary-capital-title">
      <header className="loan-cashflow-heading"><div><p>ทุนจริง / ยอดสะสมถึง {dateLabel(now)}</p><h2 id="loan-primary-capital-title">ทุนอยู่ตรงไหน และเหลือเงินจริงเท่าไหร่</h2></div><Link href="/dashboard/loan/ledger">ดูรายการรับ–จ่าย <ArrowUpRight size={15} /></Link></header>
      <CapitalWaterfall invested={lifetimeFinance.capitalReceived} withdrawn={lifetimeFinance.capitalWithdrawn} />
      <dl className="loan-capital-facts">{capitalFacts.map(item => <div key={item.label}><dt>{item.label}<small>{item.note}</small></dt><dd className={item.value < 0 ? "negative" : undefined}>{money(item.value)}</dd></div>)}</dl>
      <p className="loan-chart-footnote">ทุนสุทธิเป็นทุนหลังถอน ส่วนเงินสดและเงินต้นที่อยู่กับผู้กู้เป็นยอดคนละประเภท จึงไม่ควรนำมาบวกรวมกันเป็นทุนอีกครั้ง</p>
    </section>

    <section className="loan-cashflow loan-primary-finance" aria-labelledby="loan-primary-interest-title">
      <header className="loan-cashflow-heading"><div><p>INTEREST / ดอกเบี้ย</p><h2 id="loan-primary-interest-title">ดอกเบี้ยรับแล้ว รอรับ และหักไว้ล่วงหน้า</h2></div></header>
      <InterestComparison received={finance.interestReceived} withheld={upfrontInterestTotal} pending={outstanding.interest} year={year + 543} />
      <p className="loan-chart-footnote">ดอกเบี้ยหักล่วงหน้าคือเงินที่หักไว้ตอนจ่ายเงินกู้ จึงแสดงแยกจากดอกเบี้ยรับชำระ และไม่บวกซ้ำเข้าเงินรับในสมุดบัญชี</p>
    </section>

    </div>

    <section className="loan-overview-metrics" aria-label="สรุปสินเชื่อ">
      {metrics.map(({ label, value, note, icon: Icon, tone, href }) => <Link key={label} href={href} className={`loan-overview-metric ${tone}`}>
        <span className="loan-overview-metric-top"><span>{label}</span><i><Icon size={19} aria-hidden="true" /></i></span>
        <strong>{value}</strong>
        <small>{note}</small>
      </Link>)}
    </section>

    <section className="loan-cashflow" aria-labelledby="loan-cashflow-title">
      <header className="loan-cashflow-heading">
        <div><p>กระแสเงินสด / CASHFLOW</p><h2 id="loan-cashflow-title">ภาพรวมรายรับและรายจ่าย ปี {year + 543}</h2></div>
        <Link href="/dashboard/loan/ledger">ดูสมุดบัญชี <ArrowUpRight size={15} /></Link>
      </header>
      <div className="loan-cashflow-kpis">
        <article><span>รายจ่ายปีนี้</span><strong>{money(annualCashflow.expense)}</strong><small><ArrowUpRight size={14} /> ตั้งแต่ต้นปีถึงวันนี้</small><FinanceSparkline values={cashflow.slice(0, monthCount).map(row => row.expense)} color="#a78fcb" label="รายจ่าย" /></article>
        <article><span>รายรับปีนี้</span><strong>{money(annualCashflow.income)}</strong><small><ArrowDownRight size={14} /> ตั้งแต่ต้นปีถึงวันนี้</small><FinanceSparkline values={cashflow.slice(0, monthCount).map(row => row.income)} color="#26b59e" label="รายรับ" /></article>
        <article className={netCashflow >= 0 ? "positive" : "negative"}><span>สุทธิปีนี้</span><strong>{money(netCashflow)}</strong><small>รายรับลบรายจ่ายตั้งแต่ต้นปีถึงวันนี้</small><FinanceSparkline values={cashflow.slice(0, monthCount).map(row => row.income - row.expense)} color="#4d8caa" label="ยอดสุทธิ" /></article>
      </div>
      <details className="loan-monthly-data"><summary>ดูรายจ่ายแยกประเภทของปีนี้</summary><div><table><caption className="sr-only">รายละเอียดรายจ่ายปีปัจจุบัน</caption><thead><tr><th>ประเภท</th><th>จำนวนเงิน</th></tr></thead><tbody>{annualExpenseDetails.map(item => <tr key={item.label}><td>{item.label}</td><td>{money(item.value)}</td></tr>)}</tbody></table></div></details>
      <p className="loan-chart-footnote">รายรับรวมมีทั้งเงินต้นคืน เงินทุน และรายรับ จึงไม่ใช่กำไร</p>
    </section>

    <LoanFinanceCharts months={cashflow} monthCount={monthCount} stages={stages}
      receipts={[
        { label: "เงินต้นรับคืน", value: finance.principalReceived, color: "#13a997" },
        { label: "ดอกเบี้ย", value: finance.interestReceived, color: "#67cdbc" },
        { label: "ค่าปรับ", value: finance.penaltyReceived, color: "#a5e4d7" },
        { label: "เงินทุน", value: finance.capitalReceived, color: "#93b7ce" },
        { label: "รับชำระยังไม่แยกยอด", value: finance.unallocatedReceipts, color: "#bda8d9" },
        { label: "รายรับอื่น", value: finance.otherIncome, color: "#dae9e5" },
      ]}
      portfolio={[
        { label: "เงินต้นรอรับ", value: outstanding.principal, color: "#13a997" },
        { label: "ดอกเบี้ยค้างรับ", value: outstanding.interest, color: "#8bcfbe" },
        { label: "ค่าปรับค้างรับ", value: outstanding.penalty, color: "#e4b49a" },
      ]} />

    <section className="loan-interest-panels" aria-label="รายการดอกเบี้ย">
      <article className="loan-overview-panel"><header><div><h2>รายการดอกเบี้ยรับชำระ</h2><p>ปี {year + 543} · {interestReceiptRows.length} รายการ</p></div></header>
        {interestReceiptRows.length ? <ul>{interestReceiptRows.slice(0, 5).map(row => <li key={row.id}><span className="loan-overview-row-copy"><strong>{row.title}</strong><small>{dateLabel(row.date)}</small></span><span className="loan-overview-row-value"><strong>{money(row.amount)}</strong><AmountShare amount={row.amount} total={finance.interestReceived} /></span></li>)}</ul> : <div className="loan-overview-empty">ยังไม่มีรายการดอกเบี้ยรับชำระปีนี้</div>}<footer className="loan-interest-footer"><Link href="/dashboard/loan/ledger">ดูรายการรับทั้งหมด <ArrowUpRight size={14} /></Link></footer>
      </article>
      <article className="loan-overview-panel"><header><div><h2>รายการดอกเบี้ยรอรับ</h2><p>ยอดที่เกิดแล้ว ณ วันนี้ · {interestDueRows.length} สัญญา</p></div></header>
        {interestDueRows.length ? <ul>{interestDueRows.slice(0, 5).map(contract => <li key={contract.id}><span className="loan-overview-row-copy"><strong>{contract.contractNumber} · {borrowerName(contract.debtor)}</strong><small>ครบกำหนด {dateLabel(contract.dueDate)}</small></span><span className="loan-overview-row-value"><strong>{money(contract.balance.interest)}</strong><AmountShare amount={contract.balance.interest} total={outstanding.interest} color="#d8ac87" /></span></li>)}</ul> : <div className="loan-overview-empty">ยังไม่มีดอกเบี้ยค้างรับ</div>}<footer className="loan-interest-footer"><Link href="/dashboard/loan/ar">ดูยอดรอรับทั้งหมด <ArrowUpRight size={14} /></Link></footer>
      </article>
      <article className="loan-overview-panel"><header><div><h2>รายการดอกเบี้ยหักล่วงหน้า</h2><p>หักจากเงินจ่ายจริงปี {year + 543} · {upfrontInterestRows.length} สัญญา</p></div></header>
        {upfrontInterestRows.length ? <ul>{upfrontInterestRows.slice(0, 5).map(row => { const contract = contractsById.get(row.contractId)!; return <li key={row.contractId}><span className="loan-overview-row-copy"><strong>{contract.contractNumber} · {borrowerName(contract.debtor)}</strong><small>{dateLabel(row.paidAt)} · ต้น {money(row.principal)} / จ่ายจริง {money(row.netDisbursed)}</small></span><span className="loan-overview-row-value"><strong>{money(row.amount)}</strong><AmountShare amount={row.amount} total={upfrontInterestTotal} color="#a78fcb" /></span></li>; })}</ul> : <div className="loan-overview-empty">ยังไม่มีสัญญาหักดอกล่วงหน้าที่จ่ายแล้วปีนี้</div>}
        {upfrontInterestRows.length > 5 && <details className="loan-monthly-data loan-upfront-history"><summary>ดูรายการหักดอกล่วงหน้าเพิ่มเติมอีก {upfrontInterestRows.length - 5} สัญญา</summary><div><table><thead><tr><th>สัญญา</th><th>วันที่จ่าย</th><th>ดอกเบี้ยที่หัก</th></tr></thead><tbody>{upfrontInterestRows.slice(5).map(row => <tr key={row.contractId}><td>{contractsById.get(row.contractId)?.contractNumber}</td><td>{dateLabel(row.paidAt)}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div></details>}
      </article>
    </section>

    <section className="loan-cashflow" aria-labelledby="loan-capital-title">
      <header className="loan-cashflow-heading"><div><p>CAPITAL / ประวัติเงินทุน</p><h2 id="loan-capital-title">รายการใส่ทุนและถอนทุน</h2></div><Link href="/dashboard/loan/ledger">เพิ่ม / ถอนทุนในสมุดบัญชี <ArrowUpRight size={15} /></Link></header>
      <details className="loan-monthly-data"><summary>ประวัติเงินทุน {capitalRows.length.toLocaleString("th-TH")} รายการ</summary><div><table><caption className="sr-only">รายการเพิ่มทุนและถอนทุนทั้งหมดถึงวันนี้</caption><thead><tr><th>วันที่</th><th>รายการ</th><th>เพิ่มทุน</th><th>ถอนทุน</th></tr></thead><tbody>{capitalRows.map(row => <tr key={row.id}><td>{dateLabel(row.transactionDate)}</td><td>{row.title}</td><td>{row.type === "INCOME" ? money(row.amount) : "—"}</td><td>{row.type === "EXPENSE" ? money(row.amount) : "—"}</td></tr>)}{!capitalRows.length && <tr><td colSpan={4}>ยังไม่มีรายการทุนที่บันทึก</td></tr>}</tbody></table></div></details>
      <p className="loan-chart-footnote">เพิ่มทุนในสมุดบัญชี: เลือกรายรับ → เงินทุนเข้า · ถอนทุน: เลือกรายจ่าย → เงินทุนออก ยอดจะอัปเดตใน Dashboard อัตโนมัติ</p>
    </section>

    <section className="loan-overview-panels" aria-label="รายการติดตาม">
      <article className="loan-overview-panel">
        <header><div><h2><AlarmClock size={18} /> ค้างชำระที่ควรติดตาม</h2><p>เรียงตามจำนวนวันที่เกินกำหนด</p></div><Link href="/dashboard/loan/overdue">ดูทั้งหมด <ArrowUpRight size={15} /></Link></header>
        {overdueFollowups.length ? <ul>{overdueFollowups.map(contract => <li key={contract.id}>
          <span className="loan-overview-row-icon overdue"><Clock3 size={17} /></span>
          <span className="loan-overview-row-copy"><strong>{contract.contractNumber} · {borrowerName(contract.debtor)}</strong><small>{formatBorrowerCode(contract.debtor.borrowersCode)} · ครบกำหนด {dateLabel(contract.dueDate)}</small></span>
          <span className="loan-overview-row-value"><strong>{money(contract.balance.total)}</strong><small>เกิน {contract.balance.overdueDays.toLocaleString("th-TH")} วัน</small><AmountShare amount={contract.balance.total} total={overdueBalance} color="#d8ac87" /></span>
        </li>)}</ul> : <div className="loan-overview-empty"><CheckCircle2 size={20} /><span>ไม่มีสัญญาค้างชำระ</span></div>}
      </article>

      <article className="loan-overview-panel">
        <header><div><h2><RefreshCw size={17} /> รอดำเนินการ</h2><p>รายการที่รอเอกสารหรือพร้อมจ่ายเงิน</p></div><Link href="/dashboard/loan/approvals">เปิดรายการ <ArrowUpRight size={15} /></Link></header>
        {recentReviewQueue.length ? <ul>{recentReviewQueue.map(contract => <li key={contract.id}>
          <span className={`loan-overview-row-icon ${contract.status === "READY" ? "ready" : "waiting"}`}>{contract.status === "READY" ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span>
          <span className="loan-overview-row-copy"><strong>{contract.contractNumber} · {borrowerName(contract.debtor)}</strong><small>{formatBorrowerCode(contract.debtor.borrowersCode)} · {contract.status === "READY" ? "พร้อมจ่ายเงิน" : "รอเอกสารลงนาม"}</small></span>
          <span className="loan-overview-row-value"><strong>{money(contract.principal)}</strong><small>{dateLabel(contract.startDate)}</small><AmountShare amount={contract.principal} total={reviewPrincipalTotal} /></span>
        </li>)}</ul> : <div className="loan-overview-empty"><CheckCircle2 size={20} /><span>ไม่มีรายการรอดำเนินการ</span></div>}
      </article>
    </section>

  </div>;
}
