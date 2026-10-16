import { thaiDay } from "./loan-balance";

type UpfrontContract = {
  id: string;
  interestMode: string;
  principal: number;
  netDisbursed: number;
  payments: { type: string; amount: number; paidAt: Date }[];
};

// Upfront interest is withheld from the payout, rather than collected as an
// additional cash receipt. Require an actual payout before reporting it.
export function getUpfrontInterestRows(contracts: ReadonlyArray<UpfrontContract>, asOf: Date) {
  const today = thaiDay(asOf);
  return contracts.flatMap(contract => {
    if (contract.interestMode !== "UPFRONT") return [];
    const payment = contract.payments
      .filter(row => row.type === "DISBURSEMENT" && row.amount > 0 && thaiDay(row.paidAt) <= today)
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())[0];
    const amount = Math.max(0, contract.principal - contract.netDisbursed);
    if (!payment || amount === 0) return [];
    return [{ contractId: contract.id, paidAt: payment.paidAt, principal: contract.principal, netDisbursed: contract.netDisbursed, amount }];
  }).sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
}
