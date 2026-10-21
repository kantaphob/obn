import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { billingToday, isBillingDate } from "@/lib/youtube-billing";
import { isGroupChargeDate } from "@/lib/youtube-cashbook";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

class PayableConflict extends Error {}

async function authorize() {
  const access = await getCurrentAccess();
  if (!access) return { response: Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  if (access.accessConfigured && !access.appKeys.includes("youtube")) return { response: Response.json({ error: "ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 }) };
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return { response: Response.json({ error: "ไม่มีสิทธิ์จัดการหนี้ YouTube" }, { status: 403 }) };
  return { access };
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const isGroup = data.source === "GROUP_PAYMENT";
  if (data.confirmed !== true) return Response.json({ error: "กรุณายืนยันว่าหนี้รายการนี้ต้องได้รับอนุมัติก่อนจ่าย" }, { status: 400 });
  if (!isGroup && data.type !== "EXPENSE") return Response.json({ error: "รายการรออนุมัติต้องเป็นรายจ่าย" }, { status: 400 });
  const amountBaht = typeof data.amountBaht === "string" || typeof data.amountBaht === "number" ? Number(data.amountBaht) : NaN;
  const amountSatang = Math.round(amountBaht * 100);
  const groupId = typeof data.groupId === "string" ? data.groupId : "";
  const dueDate = typeof data.dueDate === "string" ? data.dueDate : "";
  const requestKey = typeof data.requestKey === "string" ? data.requestKey : "";
  const title = isGroup ? "ชำระค่า YouTube ประจำกลุ่ม" : typeof data.title === "string" ? data.title.trim() : "";
  const party = isGroup ? "YouTube" : typeof data.party === "string" ? data.party.trim() : "";
  const note = typeof data.note === "string" ? data.note.trim() : "";
  if (!Number.isFinite(amountBaht) || amountBaht < 0.01 || amountBaht > 10000000 || !Number.isSafeInteger(amountSatang) || !title || title.length > 200 || party.length > 150 || note.length > 500) return Response.json({ error: "กรุณาระบุชื่อรายการและยอดหนี้ให้ถูกต้อง" }, { status: 400 });
  if (isGroup && (!groupId || !isBillingDate(dueDate) || !Number.isInteger(data.expectedAmountSatang))) return Response.json({ error: "ข้อมูลรอบจ่ายไม่ครบถ้วน" }, { status: 400 });
  if (!isGroup && (!/^[a-zA-Z0-9-]{16,80}$/.test(requestKey) || data.source !== "MANUAL" || !title)) return Response.json({ error: "ข้อมูลรายการรออนุมัติไม่ครบถ้วน" }, { status: 400 });
  const sourceKey = isGroup ? `group-charge:${groupId}:${dueDate}` : `manual-payable:${requestKey}`;
  try {
    const payable = await prisma.$transaction(async (tx) => {
      const existing = await tx.youtubePayable.findUnique({ where: { sourceKey } });
      if (existing) {
        if (existing.status === "CANCELLED") {
          const reopened = await tx.youtubePayable.update({ where: { id: existing.id }, data: { status: "PENDING_APPROVAL", amountSatang, dueDate: isGroup ? dueDate : (isBillingDate(dueDate) ? dueDate : null), note: note || null, approvedBy: null, approvedAt: null } });
          if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "UPDATE", entityType: "LEDGER", entityId: reopened.id, entityLabel: reopened.title, summary: `ส่งหนี้กลับมารออนุมัติ ฿${(reopened.amountSatang / 100).toFixed(2)}` }, tx);
          return reopened;
        }
        return existing;
      }
      const group = groupId ? await tx.youtubeBillingGroup.findUnique({ where: { id: groupId } }) : null;
      if (groupId && !group) throw new PayableConflict();
      if (isGroup) {
        const snapshot = await tx.youtubeGroupCharge.findUnique({ where: { groupId_billingMonth: { groupId, billingMonth: dueDate.slice(0, 7) } } });
        if (!group || group.status !== "ACTIVE" || (snapshot ? snapshot.dueDate !== dueDate || snapshot.amountSatang !== data.expectedAmountSatang : group.monthlyPriceSatang !== data.expectedAmountSatang || !isGroupChargeDate(group, dueDate, billingToday()))) throw new PayableConflict();
        const alreadyPaid = await tx.youtubeLedgerEntry.findUnique({ where: { sourceKey } });
        if (alreadyPaid && !alreadyPaid.voidedAt) throw new PayableConflict();
        if (amountSatang !== data.expectedAmountSatang) throw new PayableConflict();
      }
      const result = await tx.youtubePayable.create({ data: {
        sourceKey, source: isGroup ? "GROUP_PAYMENT" : "MANUAL", groupId: group?.id ?? null, groupName: group?.name ?? null,
        title, party: party || null, amountSatang, dueDate: isGroup ? dueDate : (isBillingDate(dueDate) ? dueDate : null), note: note || null,
        createdBy: auth.access.session?.user?.id ?? null,
      } });
      if (auth.access.session?.user) await recordYoutubeActivity(auth.access.session.user, { action: "CREATE", entityType: "LEDGER", entityId: result.id, entityLabel: result.title, summary: `สร้างหนี้รออนุมัติ ฿${(result.amountSatang / 100).toFixed(2)}` }, tx);
      return result;
    });
    return Response.json({ payable }, { status: 201 });
  } catch (error) {
    if (error instanceof PayableConflict || (error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2028"].includes(String(error.code)))) return Response.json({ error: "หนี้รายการนี้ถูกสร้างแล้วหรือข้อมูลกลุ่มเปลี่ยน กรุณารีเฟรช" }, { status: 409 });
    console.error("YouTube payable could not be created", error);
    return Response.json({ error: "สร้างหนี้ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
