import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { billingToday, isBillingDate } from "@/lib/youtube-billing";
import { youtubePaymentMethods } from "@/lib/youtube-cashbook";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

class LedgerConflict extends Error {}

async function authorize() {
  const access = await getCurrentAccess();
  if (!access) return { response: Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  if (access.accessConfigured && !access.appKeys.includes("youtube")) return { response: Response.json({ error: "ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 }) };
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return { response: Response.json({ error: "ไม่มีสิทธิ์จัดการสมุดบัญชี" }, { status: 403 }) };
  return { access };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const current = await prisma.youtubeLedgerEntry.findUnique({ where: { id } });
  if (!current) return Response.json({ error: "ไม่พบรายการบัญชี" }, { status: 404 });
  if (current.voidedAt || current.source.startsWith("REVERSAL")) return Response.json({ error: "รายการยกเลิกหรือกลับบัญชีแก้ไขไม่ได้" }, { status: 409 });
  if (data.version !== current.updatedAt.toISOString()) return Response.json({ error: "ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข" }, { status: 409 });
  if (data.confirmed !== true) return Response.json({ error: "กรุณายืนยันว่าได้ตรวจสอบรายการและหลักฐานแล้ว" }, { status: 400 });

  const amountBaht = typeof data.amountBaht === "string" || typeof data.amountBaht === "number" ? Number(data.amountBaht) : NaN;
  const amountSatang = Math.round(amountBaht * 100);
  const transactionOn = data.transactionOn;
  const paymentMethod = typeof data.paymentMethod === "string" ? data.paymentMethod : "";
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";
  const note = typeof data.note === "string" ? data.note.trim() : "";
  if (!isBillingDate(transactionOn) || transactionOn > billingToday() || !Number.isFinite(amountBaht) || amountBaht < 0.01 || amountBaht > 10000000 || !Number.isSafeInteger(amountSatang) || !Object.hasOwn(youtubePaymentMethods, paymentMethod) || reference.length > 120 || note.length > 500) {
    return Response.json({ error: "กรุณาระบุยอด วันที่ ช่องทาง และรายละเอียดให้ถูกต้อง" }, { status: 400 });
  }

  const isManual = current.source === "MANUAL";
  const type = isManual ? data.type : current.type;
  const title = isManual && typeof data.title === "string" ? data.title.trim() : current.title;
  const party = isManual && typeof data.party === "string" ? data.party.trim() : current.party || "";
  const groupId = isManual && typeof data.groupId === "string" ? data.groupId : current.groupId || "";
  if (isManual && (!['INCOME', 'EXPENSE'].includes(String(type)) || !title || title.length > 200 || party.length > 150)) return Response.json({ error: "กรุณาระบุประเภทรายการ ชื่อ และคู่รับจ่ายให้ถูกต้อง" }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.youtubeLedgerEntry.updateMany({ where: { id, updatedAt: current.updatedAt, voidedAt: null }, data: { updatedAt: new Date() } });
      if (locked.count !== 1) throw new LedgerConflict();
      const group = isManual && groupId ? await tx.youtubeBillingGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true } }) : null;
      if (isManual && groupId && !group) throw new LedgerConflict();
      let entry;
      if (current.source === "MEMBER_PAYMENT") {
        const invoice = await tx.youtubeInvoice.findUnique({ where: { ledgerId: id } });
        if (invoice && invoice.amountSatang !== amountSatang) throw new LedgerConflict();
        const paymentId = current.sourceKey.startsWith("member-payment:") ? current.sourceKey.slice("member-payment:".length) : "";
        const payment = paymentId ? await tx.youtubePayment.findUnique({ where: { id: paymentId } }) : null;
        if (!payment) throw new LedgerConflict();
        await tx.youtubePayment.update({ where: { id: payment.id }, data: { amountSatang, paidOn: transactionOn, paymentMethod, reference: reference || null, note: note || null } });
        entry = await tx.youtubeLedgerEntry.update({ where: { id }, data: { amountSatang, transactionOn, paymentMethod, reference: reference || null, note: note || null } });
      } else if (current.source === "OPENING") {
        if (current.groupId) await tx.youtubeBillingGroup.update({ where: { id: current.groupId }, data: { openingReceivedSatang: amountSatang } });
        entry = await tx.youtubeLedgerEntry.update({ where: { id }, data: { amountSatang, transactionOn, paymentMethod, reference: reference || null, note: note || null } });
      } else {
        entry = await tx.youtubeLedgerEntry.update({ where: { id }, data: {
          ...(isManual ? { type: type as string, title, party: party || null, groupId: group?.id ?? null, groupName: group?.name ?? null } : {}),
          amountSatang, transactionOn, paymentMethod, reference: reference || null, note: note || null,
        } });
      }
      if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "UPDATE", entityType: "LEDGER", entityId: id, entityLabel: entry.title, summary: `แก้ไขรายการบัญชีเป็น ฿${(entry.amountSatang / 100).toFixed(2)}` }, tx);
      return entry;
    });

    return Response.json({ entry: updated });
  } catch (error) {
    if (error instanceof LedgerConflict) return Response.json({ error: "รายการหรือกลุ่มเปลี่ยนไปแล้ว กรุณารีเฟรชก่อนแก้ไข" }, { status: 409 });
    console.error("YouTube ledger entry could not be updated", error);
    return Response.json({ error: "แก้ไขรายการไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const current = await prisma.youtubeLedgerEntry.findUnique({ where: { id } });
  if (!current) return Response.json({ error: "ไม่พบรายการบัญชี" }, { status: 404 });
  const input = await request.json().catch(() => null);
  if (!input || input.version !== current.updatedAt.toISOString()) return Response.json({ error: "ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนยกเลิก" }, { status: 409 });
  if (current.voidedAt || current.source.startsWith("REVERSAL")) return Response.json({ error: "รายการนี้ยกเลิกแล้ว หรือเป็นรายการกลับบัญชี" }, { status: 409 });
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.youtubeLedgerEntry.updateMany({ where: { id, updatedAt: current.updatedAt, voidedAt: null }, data: { voidedAt: new Date() } });
      if (locked.count !== 1) throw new LedgerConflict();
      if (current.source === "MEMBER_PAYMENT") {
        const paymentId = current.sourceKey.startsWith("member-payment:") ? current.sourceKey.slice("member-payment:".length) : "";
        const payment = paymentId ? await tx.youtubePayment.findUnique({ where: { id: paymentId } }) : null;
        if (!payment) throw new LedgerConflict();
        if (payment.seatId) {
          const laterReceipt = await tx.youtubePayment.findFirst({ where: { seatId: payment.seatId, assignmentKey: payment.assignmentKey, voidedAt: null, dueDate: { gt: payment.dueDate } }, select: { id: true } });
          const seat = await tx.youtubeBillingSeat.findUnique({ where: { id: payment.seatId } });
          if (seat?.assignmentKey === payment.assignmentKey && (laterReceipt || seat.memberId !== payment.assignmentMemberId || seat.nextDueDate !== payment.nextDueDate)) throw new LedgerConflict();
          if (seat?.assignmentKey === payment.assignmentKey) {
            const changed = await tx.youtubeBillingSeat.updateMany({ where: { id: seat.id, updatedAt: seat.updatedAt, nextDueDate: payment.nextDueDate }, data: { nextDueDate: payment.dueDate, paymentStatus: "UNRECORDED" } });
            if (changed.count !== 1) throw new LedgerConflict();
          }
        }
        await tx.youtubePayment.update({ where: { id: payment.id }, data: { voidedAt: new Date() } });
        await tx.youtubeInvoice.updateMany({ where: { receiptId: payment.id, status: "PAID" }, data: { status: "ISSUED", receiptId: null, ledgerId: null } });
      } else if (current.source === "OPENING") {
        if (current.groupId) await tx.youtubeBillingGroup.update({ where: { id: current.groupId }, data: { openingReceivedSatang: 0 } });
      } else if (current.source === "PAYABLE_PAYMENT") {
        const payable = await tx.youtubePayable.findFirst({ where: { paidEntryId: current.id } });
        if (!payable || payable.status !== "PAID") throw new LedgerConflict();
        await tx.youtubePayable.update({ where: { id: payable.id }, data: { status: "APPROVED", paidEntryId: null } });
      } else if (!["MANUAL", "GROUP_PAYMENT"].includes(current.source)) {
        throw new LedgerConflict();
      }
      if (["GROUP_PAYMENT", "OPENING"].includes(current.source)) await tx.youtubeLedgerEntry.update({ where: { id }, data: { sourceKey: `voided:${id}` } });
      await tx.youtubeLedgerEntry.create({ data: {
        sourceKey: `reversal:${id}`, source: current.source === "OPENING" ? "REVERSAL_OPENING" : "REVERSAL", type: current.type,
        groupId: current.groupId, groupName: current.groupName, title: `กลับบัญชี: ${current.title}`, party: current.party,
        amountSatang: -current.amountSatang, transactionOn: current.transactionOn, dueDate: current.dueDate,
        paymentMethod: current.paymentMethod, note: `ยกเลิกรายการ ${id} โดยเก็บต้นฉบับไว้ · วันที่ยกเลิก ${billingToday()}`,
        confirmedBy: auth.access.session?.user?.id ?? null,
      } });
      if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "DELETE", entityType: "LEDGER", entityId: id, entityLabel: current.title, summary: `ยกเลิกพร้อมกลับบัญชี ฿${(current.amountSatang / 100).toFixed(2)}` }, tx);
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof LedgerConflict) return Response.json({ error: "ลบรายการนี้ไม่ได้ เพราะสถานะรอบชำระเปลี่ยนแล้ว กรุณารีเฟรชข้อมูล" }, { status: 409 });
    console.error("YouTube ledger entry could not be deleted", error);
    return Response.json({ error: "ลบรายการไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
