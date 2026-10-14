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
  const month = Number(dateParts.find(part => part.type === "month")?.value) - 1;
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 5 + index, 1));
    return { key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, date };
  });
  const currentMonthKey = chartMonths[5].key;
  const chartStart = new Date(Date.UTC(year, month - 5, 1) - 7 * 60 * 60 * 1000);
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
    prisma.payment.findMany({
      where: {
        paidAt: { gte: chartStart, lte: now },
        type: { in: ["DISBURSEMENT", "INTEREST", "PRINCIPAL", "PENALTY"] },
      },
      select: { type: true, amount: true, paidAt: true },
    }),
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
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(row.paidAt);
      return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}` === key;
    });
    const disbursed = rows.filter(row => row.type === "DISBURSEMENT").reduce((sum, row) => sum + row.amount, 0);
    const received = rows.filter(row => row.type !== "DISBURSEMENT").reduce((sum, row) => sum + row.amount, 0);
    return {
      key,
      label: new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", month: "short" }).format(date),
      disbursed,
      received,
    };
  });
  const currentCashflow = cashflow.find(row => row.key === currentMonthKey) ?? cashflow[cashflow.length - 1];
  const netCashflow = currentCashflow.received - currentCashflow.disbursed;
  const chartMax = Math.max(1, ...cashflow.flatMap(row => [row.disbursed, row.received]));

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
        <div><p>กระแสเงินสด / CASHFLOW</p><h2 id="loan-cashflow-title">ภาพรวมเงินปล่อยและเงินรับชำระ</h2></div>
        <Link href="/dashboard/loan/ledger">ดูสมุดบัญชี <ArrowUpRight size={15} /></Link>
      </header>
      <div className="loan-cashflow-kpis">
        <article><span>ปล่อยกู้เดือนนี้</span><strong>{money(currentCashflow.disbursed)}</strong><small><ArrowUpRight size={14} /> เงินออกจากรายการจ่ายสัญญา</small></article>
        <article><span>รับชำระเดือนนี้</span><strong>{money(currentCashflow.received)}</strong><small><ArrowDownRight size={14} /> เงินต้น ดอกเบี้ย และค่าปรับ</small></article>
        <article className={netCashflow >= 0 ? "positive" : "negative"}><span>Cashflow สุทธิเดือนนี้</span><strong>{money(netCashflow)}</strong><small>{netCashflow >= 0 ? "เงินรับมากกว่าเงินปล่อย" : "เงินปล่อยมากกว่าเงินรับ"}</small></article>
      </div>
      <div className="loan-cashflow-chart-wrap">
        <div className="loan-cashflow-legend"><span><i className="out" /> ปล่อยกู้</span><span><i className="in" /> รับชำระ</span></div>
        <div className="loan-cashflow-chart" role="img" aria-label="กราฟเปรียบเทียบยอดปล่อยกู้และยอดรับชำระย้อนหลัง 6 เดือน">
          {cashflow.map(row => <div className="loan-cashflow-month" key={row.key}>
            <div className="loan-cashflow-bars">
              <span className="bar out" style={{ height: `${Math.max(row.disbursed ? 3 : 0, row.disbursed / chartMax * 100)}%` }} title={`ปล่อยกู้ ${money(row.disbursed)}`} />
              <span className="bar in" style={{ height: `${Math.max(row.received ? 3 : 0, row.received / chartMax * 100)}%` }} title={`รับชำระ ${money(row.received)}`} />
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

    <section className={styles.sections}>
      {system.groups.filter(group => group.title !== "ภาพรวม").map(group => <div key={group.title}>
        <h2 className={styles.sectionTitle}>{group.title}<span>{group.items.length} เมนู</span></h2>
        <div className={styles.quickGrid}>{group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={styles.quickLink}>
          <Icon size={21} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={17} aria-hidden="true" />
        </Link>)}</div>
      </div>)}
    </section>
  </div>;
}
