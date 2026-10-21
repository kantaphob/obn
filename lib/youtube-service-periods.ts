import { isBillingDate } from "./youtube-billing";

type Receipt = { amountSatang: number; dueDate: string; nextDueDate: string };
const day = 86400000;
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
/** Daily allocation is a service-period estimate, separate from actual cash. */
export function receiptServiceAllocation(receipt: Receipt, today: string) {
  if (!isBillingDate(receipt.dueDate) || !isBillingDate(receipt.nextDueDate) || !isBillingDate(today) || receipt.nextDueDate <= receipt.dueDate) return { usedSatang: 0, prepaidSatang: receipt.amountSatang, unknown: true };
  const start = timestamp(receipt.dueDate);
  const end = timestamp(receipt.nextDueDate);
  const elapsed = Math.max(0, Math.min(end, timestamp(today) + day) - start);
  const usedSatang = Math.round(receipt.amountSatang * elapsed / (end - start));
  return { usedSatang, prepaidSatang: receipt.amountSatang - usedSatang, unknown: false };
}
