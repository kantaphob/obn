import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { billingToday, isBillingDate } from "@/lib/youtube-billing";
import { youtubePaymentMethods } from "@/lib/youtube-cashbook";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

class PayableConflict extends Error {}

async function authorize() {
  const access = await getCurrentAccess();
  if (!access) return { response: Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  if (access.accessConfigured && !access.appKeys.includes("youtube")) return { response: Response.json({ error: "ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 }) };
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return { response: Response.json({ error: "ไม่มีสิทธิ์จัดการหนี้ YouTube" }, { status: 403 }) };
  return { access };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const action = data.action;
  if (!['approve', 'reject', 'pay'].includes(String(action))) return Response.json({ error: "ไม่พบขั้นตอนที่ต้องการ" }, { status: 400 });
  const current = await prisma.youtubePayable.findUnique({ where: { id } });
  if (!current) return Response.json({ error: "ไม่พบหนี้รายการนี้" }, { status: 404 });
  if (data.version !== current.updatedAt.toISOString()) return Response.json({ error: "ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนดำเนินการ" }, { status: 409 });
  if (action === "approve" && current.status !== "PENDING_APPROVAL") return Response.json({ error: "หนี้นี้ไม่ได้อยู่ระหว่างรออนุมัติ" }, { status: 409 });
  if (action === "reject" && current.status !== "PENDING_APPROVAL") return Response.json({ error: "อนุมัติไปแล้วหรือปิดรายการแล้ว" }, { status: 409 });
  if (action === "pay" && current.status !== "APPROVED") return Response.json({ error: "ต้องอนุมัติหนี้ก่อนจ่าย" }, { status: 409 });

  const transactionOn = data.transactionOn;
  const method = typeof data.paymentMethod === "string" ? data.paymentMethod : "";
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";
  if (action === "pay" && (!isBillingDate(transactionOn) || transactionOn > billingToday() || !Object.hasOwn(youtubePaymentMethods, method) || reference.length > 120)) return Response.json({ error: "กรุณาระบุวันที่ ช่องทาง และเลขอ้างอิงให้ถูกต้อง" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.youtubePayable.updateMany({ where: { id, updatedAt: current.updatedAt, status: current.status }, data: { updatedAt: new Date() } });
      if (locked.count !== 1) throw new PayableConflict();
      if (action === "approve") {
        const payable = await tx.youtubePayable.update({ where: { id }, data: { status: "APPROVED", approvedBy: auth.access.session?.user?.id ?? null, approvedAt: new Date() } });
        if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "UPDATE", entityType: "LEDGER", entityId: id, entityLabel: current.title, summary: `อนุมัติหนี้ ฿${(current.amountSatang / 100).toFixed(2)}` }, tx);
        return { payable };
      }
      if (action === "reject") {
        const payable = await tx.youtubePayable.update({ where: { id }, data: { status: "CANCELLED" } });
        if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "DELETE", entityType: "LEDGER", entityId: id, entityLabel: current.title, summary: "ไม่อนุมัติหนี้" }, tx);
        return { payable };
      }
      if (current.source === "GROUP_PAYMENT" && await tx.youtubeLedgerEntry.findFirst({ where: { sourceKey: current.sourceKey, voidedAt: null }, select: { id: true } })) throw new PayableConflict();
      const entry = await tx.youtubeLedgerEntry.create({ data: {
        sourceKey: `payable-payment:${id}:${crypto.randomUUID()}`, source: "PAYABLE_PAYMENT", type: "EXPENSE", groupId: current.groupId, groupName: current.groupName,
        title: current.title, party: current.party, amountSatang: current.amountSatang, transactionOn: String(transactionOn), dueDate: current.dueDate,
        paymentMethod: method, reference: reference || null, note: current.note, confirmedBy: auth.access.session?.user?.id ?? null,
      } });
      const payable = await tx.youtubePayable.update({ where: { id }, data: { status: "PAID", paidEntryId: entry.id } });
      if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "PAY", entityType: "LEDGER", entityId: id, entityLabel: current.title, summary: `จ่ายหนี้ที่อนุมัติแล้ว ฿${(current.amountSatang / 100).toFixed(2)}` }, tx);
      return { payable, entry };
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof PayableConflict || (error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2028"].includes(String(error.code)))) return Response.json({ error: "รายการเปลี่ยนไปแล้ว กรุณารีเฟรช" }, { status: 409 });
    console.error("YouTube payable could not be updated", error);
    return Response.json({ error: "ดำเนินการกับหนี้ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
