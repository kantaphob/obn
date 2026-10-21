import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { billingToday, isBillingDate, nextBillingDate } from "./youtube-billing";
import { captureYoutubeCharges } from "./youtube-charge-snapshots";
import { buildGroupCharges } from "./youtube-cashbook";

type Seat = Prisma.YoutubeBillingSeatGetPayload<{ include: { group: true } }>;
export const invoiceSourceKey = (assignmentKey: string, dueDate: string) => `member-invoice:${assignmentKey}:${dueDate}`;
export function ensureYoutubeInvoice(tx: Prisma.TransactionClient, seat: Seat, dueDate: string) {
  return tx.youtubeInvoice.upsert({
    where: { sourceKey: invoiceSourceKey(seat.assignmentKey, dueDate) },
    create: { sourceKey: invoiceSourceKey(seat.assignmentKey, dueDate), groupId: seat.groupId, groupName: seat.group.name, seatId: seat.id, assignmentKey: seat.assignmentKey, memberId: seat.memberId, memberName: seat.displayName || seat.email || "สมาชิก", email: seat.email, position: seat.position, amountSatang: seat.priceSatang!, billingMonths: seat.billingMonths!, dueDate, nextDueDate: nextBillingDate(dueDate, seat.billingMonths!, seat.group.dueDay || seat.billingAnchorDay), issuedOn: billingToday() },
    update: {},
  });
}

/** Issue documents, never cash entries. Unique source keys make repeated runs safe. */
export async function generateYoutubeBillingDocuments() {
  const today = billingToday();
  const horizon = nextBillingDate(`${today.slice(0, 7)}-01`, 2);
  const groups = await prisma.youtubeBillingGroup.findMany({ where: { status: "ACTIVE" }, include: { seats: true } });
  // Issue each account's next invoice, even for a quarterly/five-month cycle.
  for (const group of groups) for (const seat of group.seats) {
    if (!seat.memberId || !seat.nextDueDate || !isBillingDate(seat.nextDueDate) || !seat.priceSatang || !seat.billingMonths || ![1, 3, 5].includes(seat.billingMonths)) continue;
    let due = seat.nextDueDate;
    do {
      const date = due;
      await prisma.$transaction(async (tx) => {
        const current = await tx.youtubeBillingSeat.findUnique({ where: { id: seat.id }, include: { group: true } });
        if (!current || current.assignmentKey !== seat.assignmentKey || current.group.status !== "ACTIVE" || !current.priceSatang || !current.billingMonths) return;
        const received = await tx.youtubePayment.findFirst({ where: { assignmentKey: current.assignmentKey, dueDate: date, voidedAt: null }, select: { id: true } });
        if (!received) await ensureYoutubeInvoice(tx, current, date);
      });
      due = nextBillingDate(due, seat.billingMonths, group.dueDay || seat.billingAnchorDay);
    } while (due < horizon);
  }
  const through = new Date(`${horizon}T00:00:00Z`); through.setUTCDate(through.getUTCDate() - 1);
  const end = through.toISOString().slice(0, 10);
  const snapshots = await captureYoutubeCharges(groups, end);
  const [entries, payables] = await Promise.all([
    prisma.youtubeLedgerEntry.findMany({ where: { source: "GROUP_PAYMENT", voidedAt: null }, select: { sourceKey: true } }),
    prisma.youtubePayable.findMany({ select: { sourceKey: true, status: true } }),
  ]);
  // Cancelled requests stay cancelled until an operator deliberately reissues them.
  const keys = new Set([...entries, ...payables].map((row) => row.sourceKey));
  for (const charge of buildGroupCharges(groups, end, keys, snapshots)) {
    await prisma.youtubePayable.upsert({ where: { sourceKey: charge.sourceKey }, create: { sourceKey: charge.sourceKey, source: "GROUP_PAYMENT", groupId: charge.groupId, groupName: charge.groupName, title: "ชำระค่า YouTube ประจำกลุ่ม", party: "YouTube", amountSatang: charge.amountSatang, dueDate: charge.dueDate, status: "PENDING_APPROVAL", note: "สร้างตามวันครบกำหนดของกลุ่ม · ต้องอนุมัติและยืนยันจ่ายเงินจริงก่อนลงสมุดบัญชี" }, update: {} });
  }
}
