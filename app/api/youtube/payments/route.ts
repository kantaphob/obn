import { ensureYoutubeInvoice, invoiceSourceKey } from "@/lib/youtube-invoices";
import { youtubeReceiptWhere } from "@/lib/youtube-receipt-filters";
import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { billingToday, isBillingDate } from "@/lib/youtube-billing";
import { recordYoutubeActivity } from "@/lib/youtube-activity";
import { getYoutubePageAccess } from "@/lib/youtube-access";

export async function GET(request: Request) {
  const { allowed } = await getYoutubePageAccess("/dashboard/youtube/collections");
  if (!allowed) return Response.json({ error: "ไม่มีสิทธิ์ดูรายการรับเงิน" }, { status: 403 });
  const search = new URL(request.url).searchParams;
  const page = Math.min(100000, Math.max(1, Number.parseInt(search.get("page") || "1", 10) || 1));
  const where = youtubeReceiptWhere(search);
  const [payments, total, sum] = await prisma.$transaction([
    prisma.youtubePayment.findMany({ where, orderBy: [{ paidOn: "desc" }, { id: "desc" }], take: 100, skip: (page - 1) * 100 }),
    prisma.youtubePayment.count({ where }),
    prisma.youtubePayment.aggregate({ where, _sum: { amountSatang: true } }),
  ]);
  return Response.json({ payments, total, amountSatang: sum._sum.amountSatang || 0, page }, { headers: { "Cache-Control": "private, no-store" } });
}

class PaymentConflict extends Error {}
export async function POST(request: Request) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("youtube")) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return Response.json({ error: "ไม่มีสิทธิ์บันทึกรับเงิน" }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const methods = ["BANK_TRANSFER", "PROMPTPAY", "CASH", "OTHER"];
  const paymentMethod = typeof input.paymentMethod === "string" ? input.paymentMethod : "OTHER";
  const reference = typeof input.reference === "string" ? input.reference.trim() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";
  const confirmedReceived = input.confirmedReceived === true;
  if (!confirmedReceived) return Response.json({ error: "กรุณายืนยันว่าได้ตรวจสอบและได้รับเงินจริงแล้ว" }, { status: 400 });
  if (typeof input.seatId !== "string" || typeof input.requestKey !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestKey) || !isBillingDate(input.paidOn) || input.paidOn > billingToday() || !isBillingDate(input.dueDate) || !Number.isInteger(input.amountSatang) || !methods.includes(paymentMethod) || reference.length > 120 || note.length > 500) {
    return Response.json({ error: "กรุณาระบุวันที่รับเงินจริงและข้อมูลรอบชำระให้ถูกต้อง" }, { status: 400 });
  }
  const { seatId, requestKey, paidOn, dueDate, amountSatang } = input as { seatId: string; requestKey: string; paidOn: string; dueDate: string; amountSatang: number };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.youtubePayment.findUnique({ where: { requestKey } });
      if (previous) {
        if (previous.voidedAt) throw new PaymentConflict();
        if (previous.seatId !== seatId || previous.dueDate !== dueDate || previous.amountSatang !== amountSatang || previous.paidOn !== paidOn || previous.paymentMethod !== paymentMethod || previous.reference !== (reference || null) || previous.note !== (note || null)) throw new PaymentConflict();
        return { payment: previous, created: false };
      }
      const seat = await tx.youtubeBillingSeat.findUnique({ where: { id: seatId }, include: { group: true } });
      if (!seat) throw new PaymentConflict();
      let invoice = input.invoiceId !== undefined && Number.isSafeInteger(input.invoiceId) ? await tx.youtubeInvoice.findUnique({ where: { id: Number(input.invoiceId) } }) : await tx.youtubeInvoice.findUnique({ where: { sourceKey: invoiceSourceKey(seat.assignmentKey, dueDate) } });
      if (!invoice) {
        if (input.invoiceId !== undefined || seat.group.status !== "ACTIVE" || seat.nextDueDate !== dueDate || !seat.priceSatang || !seat.billingMonths || ![1, 3, 5].includes(seat.billingMonths)) throw new PaymentConflict();
        invoice = await ensureYoutubeInvoice(tx, seat, dueDate);
      }
      if (invoice.status !== "ISSUED" || invoice.seatId !== seatId || invoice.dueDate !== dueDate || invoice.amountSatang !== amountSatang) throw new PaymentConflict();
      const sameAssignment = seat.assignmentKey === invoice.assignmentKey;
      if ((sameAssignment && seat.nextDueDate !== dueDate) || ((!sameAssignment || seat.group.status !== "ACTIVE") && dueDate > billingToday())) throw new PaymentConflict();
      const locked = await tx.youtubeInvoice.updateMany({ where: { id: invoice.id, status: "ISSUED", updatedAt: invoice.updatedAt }, data: { updatedAt: new Date() } });
      if (locked.count !== 1) throw new PaymentConflict();
      const nextDueDate = invoice.nextDueDate;
      if (sameAssignment) {
        const changed = await tx.youtubeBillingSeat.updateMany({ where: { id: seatId, updatedAt: seat.updatedAt, nextDueDate: dueDate }, data: { nextDueDate, paymentStatus: "PAID" } });
        if (changed.count !== 1) throw new PaymentConflict();
      }
      const recorded = await tx.youtubePayment.create({ data: {
        requestKey, seatId, assignmentKey: invoice.assignmentKey, assignmentMemberId: invoice.memberId, groupId: seat.groupId, groupName: invoice.groupName,
        memberName: invoice.memberName, email: invoice.email,
        amountSatang, paymentMethod, reference: reference || null, note: note || null,
        billingMonths: invoice.billingMonths, dueDate, nextDueDate, paidOn,
      } });
      const ledger = await tx.youtubeLedgerEntry.create({ data: {
        sourceKey: `member-payment:${recorded.id}`, source: "MEMBER_PAYMENT", type: "INCOME",
        groupId: seat.groupId, groupName: seat.group.name, title: "รับค่าสมาชิก YouTube",
        party: recorded.memberName, amountSatang, transactionOn: paidOn, dueDate,
        paymentMethod, reference: reference || null, note: note || null,
        confirmedBy: access.session?.user?.id ?? null,
      } });
      await tx.youtubeInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", receiptId: recorded.id, ledgerId: ledger.id } });
      if (access.session?.user) await recordYoutubeActivity(access.session.user, { action: "RECEIVE", entityType: "PAYMENT", entityId: recorded.id, entityLabel: recorded.groupName, summary: `รับเงินจริง ฿${(recorded.amountSatang / 100).toFixed(2)} จากสมาชิก` }, tx);
      return { payment: recorded, created: true };
    });

    return Response.json({ payment: result.payment }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentConflict || (error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2028"].includes(String(error.code)))) return Response.json({ error: "รอบชำระหรือราคาเปลี่ยนแล้ว กรุณารีเฟรชก่อนบันทึกอีกครั้ง" }, { status: 409 });
    console.error("YouTube payment could not be saved", error);
    return Response.json({ error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
