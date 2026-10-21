import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { billingToday, isBillingDate } from "@/lib/youtube-billing";
import { isGroupChargeDate, youtubePaymentMethods } from "@/lib/youtube-cashbook";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

class LedgerConflict extends Error {}
export async function POST(request: Request) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("youtube")) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return Response.json({ error: "ไม่มีสิทธิ์บันทึกสมุดบัญชี" }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const today = billingToday();
  const transactionOn = data.transactionOn;
  const amountBaht = typeof data.amountBaht === "string" || typeof data.amountBaht === "number" ? Number(data.amountBaht) : NaN;
  const amountSatang = Math.round(amountBaht * 100);
  const method = typeof data.paymentMethod === "string" ? data.paymentMethod : "OTHER";
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";
  const note = typeof data.note === "string" ? data.note.trim() : "";
  const groupId = typeof data.groupId === "string" ? data.groupId : "";
  if (data.confirmed !== true) return Response.json({ error: "กรุณายืนยันว่าได้รับหรือจ่ายเงินจริงแล้ว" }, { status: 400 });
  if (!isBillingDate(transactionOn) || transactionOn > today || !Number.isFinite(amountBaht) || amountBaht < .01 || amountBaht > 10000000 || !Number.isSafeInteger(amountSatang) || !Object.hasOwn(youtubePaymentMethods, method) || reference.length > 120 || note.length > 500) return Response.json({ error: "กรุณาระบุยอด วันที่ และช่องทางชำระให้ถูกต้อง" }, { status: 400 });
  const isGroup = data.source === "GROUP_PAYMENT";
  const dueDate = typeof data.dueDate === "string" ? data.dueDate : "";
  const title = isGroup ? "ชำระค่า YouTube ประจำกลุ่ม" : typeof data.title === "string" ? data.title.trim() : "";
  const party = isGroup ? "YouTube" : typeof data.party === "string" ? data.party.trim() : "";
  const type = isGroup ? "EXPENSE" : data.type;
  const key = typeof data.requestKey === "string" ? data.requestKey : "";
  if (!title || title.length > 200 || party.length > 150 || !["INCOME", "EXPENSE"].includes(String(type)) || (!isGroup && (!/^[a-zA-Z0-9-]{16,80}$/.test(key) || data.source !== "MANUAL")) || (isGroup && (!groupId || !isBillingDate(dueDate) || !Number.isInteger(data.expectedAmountSatang)))) return Response.json({ error: "รายละเอียดรายการไม่ครบถ้วน" }, { status: 400 });
  const sourceKey = isGroup ? `group-charge:${groupId}:${dueDate}` : `manual:${key}`;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.youtubeLedgerEntry.findUnique({ where: { sourceKey } });
      if (existing) {
        if (existing.voidedAt) throw new LedgerConflict();
        if (existing.amountSatang !== amountSatang || existing.transactionOn !== transactionOn || existing.paymentMethod !== method || existing.type !== type || existing.title !== title || existing.party !== (party || null) || existing.groupId !== (groupId || null) || existing.reference !== (reference || null) || existing.note !== (note || null)) throw new LedgerConflict();
        return { entry: existing, created: false };
      }
      const group = groupId ? await tx.youtubeBillingGroup.findUnique({ where: { id: groupId } }) : null;
      if (groupId && !group) throw new LedgerConflict();
      const snapshot = isGroup ? await tx.youtubeGroupCharge.findUnique({ where: { groupId_billingMonth: { groupId, billingMonth: dueDate.slice(0, 7) } } }) : null;
      if (isGroup && await tx.youtubePayable.findFirst({ where: { sourceKey, status: { not: "CANCELLED" } }, select: { id: true } })) throw new LedgerConflict();
      if (isGroup && (!group || group.status !== "ACTIVE" || (snapshot ? snapshot.dueDate !== dueDate || snapshot.amountSatang !== data.expectedAmountSatang : group.monthlyPriceSatang !== data.expectedAmountSatang || !isGroupChargeDate(group, dueDate, today)))) throw new LedgerConflict();
      const entry = await tx.youtubeLedgerEntry.create({ data: {
        sourceKey, source: isGroup ? "GROUP_PAYMENT" : "MANUAL", type: type as string,
        groupId: group?.id ?? null, groupName: group?.name ?? null, title, party: party || null,
        amountSatang, transactionOn, dueDate: isGroup ? dueDate : null,
        paymentMethod: method, reference: reference || null, note: note || null,
        confirmedBy: access.session?.user?.id ?? null,
      } });
      if (access.session?.user) await recordYoutubeActivity(access.session.user, { action: type === "INCOME" ? "RECEIVE" : "PAY", entityType: "LEDGER", entityId: entry.id, entityLabel: entry.title, summary: `บันทึกเงินจริง ฿${(entry.amountSatang / 100).toFixed(2)}` }, tx);
      return { entry, created: true };
    });
    return Response.json({ entry: result.entry }, { status: 201 });
  } catch (error) {
    if (error instanceof LedgerConflict || (error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2028"].includes(String(error.code)))) return Response.json({ error: "รายการนี้ถูกบันทึกแล้วหรือข้อมูลกลุ่มเปลี่ยน กรุณารีเฟรช" }, { status: 409 });
    console.error("YouTube cashbook entry could not be saved", error);
    return Response.json({ error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
