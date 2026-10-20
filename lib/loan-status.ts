import { loanBalance, thaiDay, type BalanceContract } from "./loan-balance";

type StatusContract = BalanceContract & { contractType?: string; signatureMode?: string; signedAt?: Date | null };
// Project time-dependent display state without writing when a user reads a page.
export function loanStatus(contract: StatusContract, now = new Date()) {
  if (contract.status === "CLOSED" || contract.status === "CANCELLED") return contract.status;
  const hasMoney = contract.payments.some(payment => payment.amount > 0 && ["DISBURSEMENT", "PRINCIPAL", "INTEREST", "PENALTY"].includes(payment.type) && thaiDay(payment.paidAt) <= thaiDay(now));
  if (hasMoney) {
    const balance = loanBalance({ ...contract, status: "ACTIVE" }, now);
    return balance.total === 0 ? "CLOSED" : balance.overdueDays > 0 ? "OVERDUE" : "ACTIVE";
  }
  if (contract.status === "RESERVED" && thaiDay(contract.startDate) <= thaiDay(now)) {
    return contract.contractType === "NONE" || contract.signatureMode === "DIGITAL" || contract.signedAt ? "READY" : "AWAITING_DOCUMENT";
  }
  if (contract.status === "ACTIVE" || contract.status === "OVERDUE") return loanBalance(contract, now).overdueDays > 0 ? "OVERDUE" : "ACTIVE";
  return contract.status;
}
