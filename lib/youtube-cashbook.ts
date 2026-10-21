import { groupBillingDate, groupPeriodSummary, isBillingDate, nextBillingDate } from "./youtube-billing";

export const youtubePaymentMethods: Record<string, string> = { BANK_TRANSFER: "โอนธนาคาร", PROMPTPAY: "พร้อมเพย์", CASH: "เงินสด", OTHER: "อื่น ๆ" };
export type GroupCharge = { sourceKey: string; groupId: string; groupName: string; dueDate: string; coveredThrough: string; amountSatang: number };
export function buildGroupCharges(groups: { id: string; name: string; status: string; startedOn: string | null; dueDay: number | null; monthlyPriceSatang: number | null }[], today: string, confirmedKeys: Set<string>, snapshots: Omit<GroupCharge, "sourceKey">[] = []): GroupCharge[] {
  if (!isBillingDate(today)) return [];
  const charges: GroupCharge[] = [];
  for (const group of groups) {
    if (group.status !== "ACTIVE" || !group.dueDay || !group.monthlyPriceSatang || group.monthlyPriceSatang <= 0) continue;
    const first = groupPeriodSummary(group.startedOn, group.dueDay, group.monthlyPriceSatang, today).firstCutoff;
    if (!first) continue;
    for (let due = first; due <= today; due = nextBillingDate(due, 1, group.dueDay)) {
      const snapshot = snapshots.find((entry) => entry.groupId === group.id && entry.dueDate.slice(0, 7) === due.slice(0, 7));
      const sourceKey = `group-charge:${group.id}:${snapshot?.dueDate || due}`;
      if (confirmedKeys.has(sourceKey)) continue;
      const covered = new Date(`${nextBillingDate(due, 1, group.dueDay)}T00:00:00Z`);
      covered.setUTCDate(covered.getUTCDate() - 1);
      charges.push(snapshot ? { ...snapshot, groupName: group.name, sourceKey } : { sourceKey, groupId: group.id, groupName: group.name, dueDate: due, coveredThrough: covered.toISOString().slice(0, 10), amountSatang: group.monthlyPriceSatang });
    }
  }
  for (const snapshot of snapshots) {
    const sourceKey = `group-charge:${snapshot.groupId}:${snapshot.dueDate}`;
    if (snapshot.dueDate <= today && groups.some((group) => group.id === snapshot.groupId && group.status === "ACTIVE") && !confirmedKeys.has(sourceKey) && !charges.some((charge) => charge.sourceKey === sourceKey)) charges.push({ ...snapshot, sourceKey });
  }
  return charges.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.groupName.localeCompare(b.groupName));
}
export function isGroupChargeDate(group: { startedOn: string | null; dueDay: number | null }, dueDate: string, today: string) {
  if (!isBillingDate(dueDate) || !group.dueDay || dueDate > today || groupBillingDate(dueDate, group.dueDay) !== dueDate) return false;
  const first = groupPeriodSummary(group.startedOn, group.dueDay, null, today).firstCutoff;
  return Boolean(first && dueDate >= first);
}
export function cashbookTotals(entries: { type: string; amountSatang: number; source?: string; voidedAt?: Date | string | null }[]) {
  let income = 0, expense = 0, opening = 0;
  for (const entry of entries) { if (entry.voidedAt) continue; if (entry.source === "OPENING" || entry.source === "REVERSAL_OPENING") { opening += entry.amountSatang; continue; } if (entry.type === "INCOME") income += entry.amountSatang; if (entry.type === "EXPENSE") expense += entry.amountSatang; }
  return { income, expense, opening, net: income - expense };
}

export function groupOpeningEntry(group: { id: string; name: string; startedOn: string | null; openingReceivedSatang: number }, fallbackDate: string) {
  return { sourceKey: `group-opening:${group.id}`, source: "OPENING", type: "INCOME", groupId: group.id, groupName: group.name, title: "ยอดรับยกมาก่อนใช้ระบบ", party: "ยอดยกมา", amountSatang: group.openingReceivedSatang, transactionOn: group.startedOn || fallbackDate, paymentMethod: "OTHER", note: "ยอดรับเดิมที่กรอกในกลุ่ม ไม่ใช่รายการรับเงินใหม่" };
}
