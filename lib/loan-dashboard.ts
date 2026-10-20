import { getCurrentAccess } from "./authorization";
import { canAccessLoanCompany, canReadLoanFinancials } from "./loan-access";
import { contractCompanyCode } from "./loan-accounting-lock";
import { loanStatus } from "./loan-status";
import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { loanBalance, thaiDay } from "@/lib/loan-balance";
import { getUpfrontInterestRows } from "@/lib/loan-upfront-interest";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { normalizeLoanFinanceCategoryCode, summarizeCompanyLedgerRows, summarizeLoanFinanceRows } from "@/lib/company-ledger-summary";

export async function getLoanDashboardData() {
  await connection();
  const access = await getCurrentAccess();
  if (!canReadLoanFinancials(access)) throw new Error("ไม่มีสิทธิ์ดูข้อมูลการเงิน Loan");
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
  const [unscopedContracts, unscopedLedgerRows] = await Promise.all([
    prisma.contract.findMany({
      select: {
        id: true,
        contractNumber: true,
        status: true,
        contractType: true,
        signatureMode: true,
        signedAt: true,
        repayType: true,
        installmentMonths: true,
        documentData: true,
        principal: true,
        netDisbursed: true,
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
    getCompanyLedgerRows(null, throughToday),
  ]);
  const contracts = unscopedContracts.filter(contract => canAccessLoanCompany(access, contractCompanyCode(contract.documentData))).map(contract => ({ ...contract, status: loanStatus(contract, now) }));
  const ledgerRows = unscopedLedgerRows.filter(row => canAccessLoanCompany(access, row.companyCode));
  const loanRows = ledgerRows.filter(row => row.source === "LOAN");
  const cashflowRows = loanRows.filter(row => row.transactionDate >= chartStart);
  const groupCashflowRows = ledgerRows.filter(row => row.transactionDate >= chartStart);
  const lifetimeFinance = summarizeLoanFinanceRows(loanRows);
  const cashBalance = summarizeCompanyLedgerRows(loanRows).net;
  const contractsById = new Map(contracts.map(contract => [contract.id, contract]));
  const upfrontInterestRows = getUpfrontInterestRows(contracts, now)
    .filter(row => row.paidAt >= chartStart);
  const upfrontInterestTotal = upfrontInterestRows.reduce((sum, row) => sum + row.amount, 0);
  const capitalRows = loanRows.filter(row => {
    const code = normalizeLoanFinanceCategoryCode(row.categoryCode);
    return code === "LOAN_CAPITAL_IN" || code === "LOAN_CAPITAL_OUT";
  });

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
  const reviewPrincipalTotal = reviewQueue.reduce((sum, contract) => sum + contract.principal, 0);
  const overdueFollowups = overdue.slice(0, 5);

  const cashflow = chartMonths.map(({ key, date }) => {
    const rows = groupCashflowRows.filter(row => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(row.transactionDate);
      return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}` === key;
    });
    const totals = summarizeCompanyLedgerRows(rows);
    return {
      key,
      label: new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", month: "short" }).format(date),
      expense: totals.expense,
      income: totals.income,
    };
  });
  const loanCashflow = chartMonths.map(({ key, date }) => {
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
    };
  });
  const annualCashflow = summarizeCompanyLedgerRows(groupCashflowRows);
  const loanAnnualCashflow = summarizeCompanyLedgerRows(cashflowRows);
  const finance = summarizeLoanFinanceRows(cashflowRows);
  const outstanding = openContracts.reduce((sum, contract) => ({
    principal: sum.principal + contract.balance.principal,
    interest: sum.interest + contract.balance.interest,
    penalty: sum.penalty + contract.balance.penalty,
  }), { principal: 0, interest: 0, penalty: 0 });
  const pendingDisbursement = contracts
    .filter(contract => contract.status === "READY" || contract.status === "RESERVED")
    .reduce((sum, contract) => sum + Math.max(0, contract.netDisbursed - contract.payments
      .filter(payment => payment.type === "DISBURSEMENT" && thaiDay(payment.paidAt) <= today)
      .reduce((paid, payment) => paid + payment.amount, 0)), 0);
  return { now, year, dateParts, contracts, ledgerRows, cashflowRows, lifetimeFinance, cashBalance, contractsById, upfrontInterestRows, upfrontInterestTotal, capitalRows, reviewQueue, openContracts, dueToday, overdue, overdueBalance, recentReviewQueue, reviewPrincipalTotal, overdueFollowups, cashflow, loanCashflow, annualCashflow, loanAnnualCashflow, finance, outstanding, pendingDisbursement };
}
