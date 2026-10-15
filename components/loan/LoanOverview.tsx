import Link from "next/link";
import { connection } from "next/server";
import {
  AlarmClock,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  HandCoins,
  RefreshCw,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loanBalance, thaiDay } from "@/lib/loan-balance";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { summarizeCompanyLedgerRows } from "@/lib/company-ledger-summary";
import { SYSTEMS } from "@/lib/nav";
import { workspaceStyles as styles } from "@/components/ui/workspace-styles";
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
  await connection();
  const now = new Date();
  const today = thaiDay(now);
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(dateParts.find(part => part.type === "year")?.value);
  const chartMonths = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, index, 1));
    return { key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, date };
  });
  const chartStart = new Date(Date.UTC(year, 0, 1) - 7 * 60 * 60 * 1000);
  const throughToday = new Date(today - 7 * 60 * 60 * 1000);
  const [contracts, cashflowRows] = await Promise.all([
    prisma.contract.findMany({
      where: { status: { in: ["AWAITING_DOCUMENT", "READY", "ACTIVE", "OVERDUE"] } },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        principal: true,
        startDate: true,
        dueDate: true,
        interestRate: true,
        interestRateBasis: true,
        interestAmount: true,
        interestMode: true,
        lateFeePerDay: true,
        lateFeeWaived: true,
        updatedAt: true,
        debtor: { select: { firstName: true, lastName: true, nickname: true, borrowersCode: true } },
        payments: { select: { type: true, amount: true, paidAt: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    getCompanyLedgerRows(chartStart, throughToday),
  ]);

  const reviewQueue = contracts.filter(contract => contract.status === "AWAITING_DOCUMENT" || contract.status === "READY");
  const openContracts = contracts
    .filter(contract => contract.status === "ACTIVE" || contract.status === "OVERDUE")
    .map(({ payments, ...contract }) => ({
      ...contract,
      balance: loanBalance({ ...contract, payments }, now),
    }))
    .filter(contract => contract.balance.total > 0);
  const dueToday = openContracts.filter(contract => contract.dueDate && thaiDay(contract.dueDate) === today);
  const overdue = openContracts
    .filter(contract => contract.balance.overdueDays > 0)
    .sort((a, b) => b.balance.overdueDays - a.balance.overdueDays || b.balance.total - a.balance.total);
  const overdueBalance = overdue.reduce((total, contract) => total + contract.balance.total, 0);
  const recentReviewQueue = reviewQueue.slice(0, 5);
  const overdueFollowups = overdue.slice(0, 5);
  const system = SYSTEMS.loan;

  const cashflow = chartMonths.map(({ key, date }) => {
    const rows = cashflowRows.filter(row => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(row.transactionDate);
      return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}` === key;
    });
    const totals = summarizeCompanyLedgerRows(rows);
    return {
      key,
      label: new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", month: "short" }).format(date),
      expense: totals.expense,
      income: totals.income,
      net: totals.net,
    };
  });
  const annualCashflow = summarizeCompanyLedgerRows(cashflowRows);
  const netCashflow = annualCashflow.net;
  const chartMax = Math.max(1, ...cashflow.flatMap(row => [row.expense, row.income]));

  const metrics = [
    { label: "รอดำเนินการ", value: reviewQueue.length.toLocaleString("th-TH"), note: "รอเอกสารหรือพร้อมจ่ายเงิน", icon: FileCheck2, tone: "violet", href: "/dashboard/loan/approvals" },
    { label: "สัญญาที่ยังดำเนินการ", value: openContracts.length.toLocaleString("th-TH"), note: "รวมสัญญาปกติและเกินกำหนด", icon: HandCoins, tone: "green", href: "/dashboard/loan/contracts" },
    { label: "ครบกำหนดวันนี้", value: dueToday.length.toLocaleString("th-TH"), note: "สัญญาที่ยังมียอดคงเหลือ", icon: CalendarDays, tone: "amber", href: "/dashboard/loan/ar" },
    { label: "ยอดคงเหลือสัญญาเกินกำหนด", value: money(overdueBalance), note: `${overdue.length.toLocaleString("th-TH")} สัญญา · คำนวณถึงวันนี้`, icon: CircleDollarSign, tone: "rose", href: "/dashboard/loan/overdue" },
  ];

  return <div className={`${styles.page} loan-overview`}>
    <header className={styles.pageHeader}>
      <p className={styles.eyebrow}>ภาพรวม / LOAN OVERVIEW</p>
      <h1>{system.label}</h1>
      <p>สรุปสถานะสัญญา ยอดคงเหลือ และรายการที่ควรติดตาม</p>
    </header>

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
        <article><span>รายจ่ายปีนี้</span><strong>{money(annualCashflow.expense)}</strong><small><ArrowUpRight size={14} /> ตั้งแต่ต้นปีถึงวันนี้</small></article>
        <article><span>รายรับปีนี้</span><strong>{money(annualCashflow.income)}</strong><small><ArrowDownRight size={14} /> ตั้งแต่ต้นปีถึงวันนี้</small></article>
        <article className={netCashflow >= 0 ? "positive" : "negative"}><span>สุทธิปีนี้</span><strong>{money(netCashflow)}</strong><small>รายรับลบรายจ่ายตั้งแต่ต้นปีถึงวันนี้</small></article>
      </div>
      <div className="loan-cashflow-chart-wrap">
        <div className="loan-cashflow-legend"><span><i className="out" /> รายจ่าย</span><span><i className="in" /> รายรับ</span></div>
        <div className="loan-cashflow-chart" role="img" aria-label={`กราฟรายรับและรายจ่าย 12 เดือนของปี ${year + 543} คำนวณถึงวันนี้`}>
          {cashflow.map(row => <div className="loan-cashflow-month" key={row.key}>
            <div className="loan-cashflow-bars">
              <span className="bar out" style={{ height: `${Math.max(row.expense ? 3 : 0, row.expense / chartMax * 100)}%` }} title={`รายจ่าย ${money(row.expense)}`} />
              <span className="bar in" style={{ height: `${Math.max(row.income ? 3 : 0, row.income / chartMax * 100)}%` }} title={`รายรับ ${money(row.income)}`} />
            </div>
            <span className="loan-cashflow-month-label">{row.label}</span>
          </div>)}
        </div>
      </div>
    </section>

    <section className="loan-overview-panels" aria-label="รายการติดตาม">
      <article className="loan-overview-panel">
        <header><div><h2><AlarmClock size={18} /> ค้างชำระที่ควรติดตาม</h2><p>เรียงตามจำนวนวันที่เกินกำหนด</p></div><Link href="/dashboard/loan/overdue">ดูทั้งหมด <ArrowUpRight size={15} /></Link></header>
        {overdueFollowups.length ? <ul>{overdueFollowups.map(contract => <li key={contract.id}>
          <span className="loan-overview-row-icon overdue"><Clock3 size={17} /></span>
          <span className="loan-overview-row-copy"><strong>{contract.contractNumber} · {borrowerName(contract.debtor)}</strong><small>{contract.debtor.borrowersCode} · ครบกำหนด {dateLabel(contract.dueDate)}</small></span>
          <span className="loan-overview-row-value"><strong>{money(contract.balance.total)}</strong><small>เกิน {contract.balance.overdueDays.toLocaleString("th-TH")} วัน</small></span>
        </li>)}</ul> : <div className="loan-overview-empty"><CheckCircle2 size={20} /><span>ไม่มีสัญญาค้างชำระ</span></div>}
      </article>

      <article className="loan-overview-panel">
        <header><div><h2><RefreshCw size={17} /> รอดำเนินการ</h2><p>รายการที่รอเอกสารหรือพร้อมจ่ายเงิน</p></div><Link href="/dashboard/loan/approvals">เปิดรายการ <ArrowUpRight size={15} /></Link></header>
        {recentReviewQueue.length ? <ul>{recentReviewQueue.map(contract => <li key={contract.id}>
          <span className={`loan-overview-row-icon ${contract.status === "READY" ? "ready" : "waiting"}`}>{contract.status === "READY" ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span>
          <span className="loan-overview-row-copy"><strong>{contract.contractNumber} · {borrowerName(contract.debtor)}</strong><small>{contract.debtor.borrowersCode} · {contract.status === "READY" ? "พร้อมจ่ายเงิน" : "รอเอกสารลงนาม"}</small></span>
          <span className="loan-overview-row-value"><strong>{money(contract.principal)}</strong><small>{dateLabel(contract.startDate)}</small></span>
        </li>)}</ul> : <div className="loan-overview-empty"><CheckCircle2 size={20} /><span>ไม่มีรายการรอดำเนินการ</span></div>}
      </article>
    </section>

  </div>;
}
