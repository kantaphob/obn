import { thaiDay, type BalanceContract } from "./loan-balance";

export const DAY = 86_400_000;
export function localDate(value: Date) { return new Date(thaiDay(value)).toISOString().slice(0, 10); }
export function parseLoanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("วันที่ไม่ถูกต้อง");
  const date = new Date(`${value}T12:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || localDate(date) !== value) throw new Error("วันที่ไม่ถูกต้อง");
  return date;
}
function monthly(start: Date, offset: number) {
  const d = new Date(thaiDay(start));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, Math.min(last, d.getUTCDate())) + 5 * 60 * 60 * 1000);
}
type ScheduleContract = BalanceContract & {
  id: string; repayType: string; installmentMonths: number | null; periodDays: number | null;
  schedules: { id: string; periodNo: number; dueDate: Date; amount: number; principalAmount: number; interestAmount: number }[];
};
export function buildLoanSchedule(contract: ScheduleContract, asOf: Date) {
  const months = Math.min(1200, Math.max(1, contract.installmentMonths || 1));
  let rows = [...contract.schedules].sort((a, b) => a.periodNo - b.periodNo).map(row => ({ ...row }));
  if (!rows.length) {
    const count = contract.repayType === "INSTALLMENT" ? months : contract.repayType === "INTEREST_ONLY" && contract.periodDays && contract.dueDate
      ? Math.min(1200, Math.max(1, Math.ceil((thaiDay(contract.dueDate) - thaiDay(contract.startDate)) / DAY / contract.periodDays))) : 1;
    rows = Array.from({ length: count }, (_, index) => {
      const dueDate = contract.repayType === "INSTALLMENT" ? monthly(contract.startDate, index + 1)
        : contract.repayType === "INTEREST_ONLY" && contract.periodDays ? new Date(Math.min(thaiDay(contract.startDate) + (index + 1) * contract.periodDays * DAY, contract.dueDate ? thaiDay(contract.dueDate) : Infinity) + 5 * 3600000)
        : contract.dueDate || monthly(contract.startDate, 1);
      return { id: `${contract.id}-${index + 1}`, periodNo: index + 1, dueDate, amount: 0, principalAmount: 0, interestAmount: 0 };
    });
  }
  const expectedInterest = contract.interestMode === "UPFRONT" ? 0 : contract.interestAmount;
  // Reconcile legacy schedules to the contractual principal and the shared interest calculation.
  if (rows.reduce((sum, row) => sum + row.principalAmount, 0) !== contract.principal) {
    rows.forEach((row, index) => { row.principalAmount = contract.repayType === "INTEREST_ONLY" ? index === rows.length - 1 ? contract.principal : 0 : Math.floor(contract.principal / rows.length) + (index === rows.length - 1 ? contract.principal % rows.length : 0); });
  }
  if (rows.reduce((sum, row) => sum + row.interestAmount, 0) !== expectedInterest) {
    rows.forEach((row, index) => { row.interestAmount = Math.floor(expectedInterest / rows.length) + (index === rows.length - 1 ? expectedInterest % rows.length : 0); });
  }
  const closedAsOf = contract.status === "CLOSED" && !contract.payments.some(payment => payment.amount > 0 && ["PRINCIPAL", "INTEREST", "PENALTY"].includes(payment.type) && thaiDay(payment.paidAt) > thaiDay(asOf));
  const paid = contract.payments.filter(payment => thaiDay(payment.paidAt) <= thaiDay(asOf));
  let principalPaid = paid.filter(p => p.type === "PRINCIPAL").reduce((sum, p) => sum + p.amount, 0);
  let interestPaid = paid.filter(p => p.type === "INTEREST").reduce((sum, p) => sum + p.amount, 0);
  return rows.map(row => {
    const p = Math.min(Math.max(0, principalPaid), row.principalAmount);
    const i = Math.min(Math.max(0, interestPaid), row.interestAmount);
    principalPaid -= p; interestPaid -= i;
    const waived = closedAsOf ? row.principalAmount + row.interestAmount - p - i : 0;
    const principalRemaining = closedAsOf ? 0 : row.principalAmount - p, interestRemaining = closedAsOf ? 0 : row.interestAmount - i;
    const remaining = principalRemaining + interestRemaining;
    const overdueDays = remaining > 0 ? Math.max(0, (thaiDay(asOf) - thaiDay(row.dueDate)) / DAY) : 0;
    return { id: row.id, periodNo: row.periodNo, dueDate: localDate(row.dueDate), principal: row.principalAmount, interest: row.interestAmount, amount: row.principalAmount + row.interestAmount, paid: p + i, waived, principalRemaining, interestRemaining, remaining, overdueDays, status: closedAsOf && waived > 0 ? "SETTLED" : remaining === 0 ? "PAID" : p + i > 0 ? "PARTIAL" : overdueDays > 0 ? "OVERDUE" : "PENDING" };
  });
}
