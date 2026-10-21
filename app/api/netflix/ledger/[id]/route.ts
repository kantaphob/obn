import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const methods = ["BANK_TRANSFER", "PROMPTPAY", "CASH", "CARD", "OTHER"];
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
async function authorize() {
  const access = await getCurrentAccess();
  if (!access) return { response: Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }), access: null };
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) return { response: Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 }), access: null };
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return { response: Response.json({ error: "ไม่มีสิทธิ์จัดการสมุดบัญชี Netflix" }, { status: 403 }), access: null };
  return { response: null, access };
}
function parse(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const type = data.type === "INCOME" || data.type === "EXPENSE" ? data.type : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const category = typeof data.category === "string" ? data.category.trim() : "";
  const party = typeof data.party === "string" ? data.party.trim() : "";
  const groupId = typeof data.groupId === "string" ? data.groupId : "";
  const transactionOn = data.transactionOn;
  const amountBaht = typeof data.amountBaht === "string" || typeof data.amountBaht === "number" ? Number(data.amountBaht) : NaN;
  const amountSatang = Math.round(amountBaht * 100);
  const paymentMethod = typeof data.paymentMethod === "string" ? data.paymentMethod : "OTHER";
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";
  const note = typeof data.note === "string" ? data.note.trim() : "";
  if (data.confirmed !== true || !type || !title || title.length > 200 || category.length > 100 || party.length > 150 || !validDate(transactionOn) || transactionOn > today() || !Number.isFinite(amountBaht) || amountBaht < .01 || amountBaht > 10000000 || !Number.isSafeInteger(amountSatang) || !methods.includes(paymentMethod) || reference.length > 120 || note.length > 500) return null;
  return { type, title, category, party: party || null, groupId, transactionOn, amountSatang, paymentMethod, reference: reference || null, note: note || null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response, access } = await authorize();
  if (response) return response;
  const { id } = await params;
  const existing = await prisma.netflixLedgerEntry.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "ไม่พบรายการในสมุดบัญชี" }, { status: 404 });
  if (existing.source !== "MANUAL") return Response.json({ error: "รายการรับเงินจากสมาชิกต้องแก้ไขในหน้าสมาชิก" }, { status: 409 });
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action === "approve") {
    if (existing.type !== "EXPENSE" || existing.status !== "PENDING_APPROVAL") return Response.json({ error: "รายการนี้ไม่อยู่ในสถานะรออนุมัติ" }, { status: 409 });
    const entry = await prisma.netflixLedgerEntry.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedBy: access?.session.user.id ?? null } });
    return Response.json({ entry });
  }
  if (body?.action === "pay") {
    if (existing.type !== "EXPENSE" || existing.status !== "APPROVED") return Response.json({ error: "อนุมัติรายการก่อนบันทึกการจ่ายเงิน" }, { status: 409 });
    const paidOn = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const entry = await prisma.netflixLedgerEntry.update({ where: { id }, data: { status: "PAID", transactionOn: paidOn, paidAt: new Date(), paidBy: access?.session.user.id ?? null } });
    return Response.json({ entry });
  }
  if (existing.status !== "PAID") return Response.json({ error: "รายการค้างจ่ายให้ดำเนินการผ่านปุ่มอนุมัติหรือบันทึกจ่าย" }, { status: 409 });
  const data = parse(await request.json().catch(() => null));
  if (!data) return Response.json({ error: "กรุณาตรวจสอบข้อมูล และยืนยันรายการเงินจริง" }, { status: 400 });
  const group = data.groupId ? await prisma.netflixGroup.findUnique({ where: { id: data.groupId }, select: { id: true, name: true, startedOn: true } }) : null;
  if (data.groupId && !group) return Response.json({ error: "ไม่พบกลุ่ม Netflix" }, { status: 404 });
  if (group?.startedOn && data.transactionOn < group.startedOn) return Response.json({ error: "วันที่รายการต้องไม่อยู่ก่อนวันเริ่มกลุ่ม" }, { status: 400 });
  const entry = await prisma.netflixLedgerEntry.update({ where: { id }, data: { ...data, groupId: group?.id ?? null, groupName: group?.name ?? null } });
  return Response.json({ entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await authorize();
  if (response) return response;
  const { id } = await params;
  const existing = await prisma.netflixLedgerEntry.findUnique({ where: { id }, select: { source: true } });
  if (!existing) return Response.json({ error: "ไม่พบรายการในสมุดบัญชี" }, { status: 404 });
  if (existing.source !== "MANUAL") return Response.json({ error: "ลบรายการรับเงินจากสมาชิกในหน้านี้ไม่ได้" }, { status: 409 });
  await prisma.netflixLedgerEntry.delete({ where: { id } });
  return Response.json({ success: true });
}
