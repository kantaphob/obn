import { randomUUID } from "node:crypto";
import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const methods: Record<string, string> = { BANK_TRANSFER: "โอนธนาคาร", PROMPTPAY: "พร้อมเพย์", CASH: "เงินสด", CARD: "บัตร", OTHER: "อื่น ๆ" };
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
async function authorize(write = false) {
  const access = await getCurrentAccess();
  if (!access) return { response: Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }), access: null };
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) return { response: Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 }), access: null };
  if (write && !access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return { response: Response.json({ error: "ไม่มีสิทธิ์บันทึกสมุดบัญชี Netflix" }, { status: 403 }), access: null };
  return { response: null, access };
}

function parseEntry(body: unknown) {
  if (!body || typeof body !== "object") return { error: "กรุณากรอกรายการรับหรือจ่าย" } as const;
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
  const settlement = data.settlement === "PAYABLE" ? "PAYABLE" : "PAID";
  const approvalRequired = data.approvalRequired === true;
  if ((type === "INCOME" || settlement === "PAID") && data.confirmed !== true) return { error: "กรุณายืนยันว่าได้รับหรือจ่ายเงินจริงแล้ว" } as const;
  if (type === "INCOME" && settlement === "PAYABLE") return { error: "รายการรับเงินต้องบันทึกหลังได้รับเงินจริง" } as const;
  if (!type || !title || title.length > 200 || category.length > 100 || party.length > 150 || !validDate(transactionOn) || (settlement === "PAID" && transactionOn > today()) || !Number.isFinite(amountBaht) || amountBaht < .01 || amountBaht > 10000000 || !Number.isSafeInteger(amountSatang) || !Object.hasOwn(methods, paymentMethod) || reference.length > 120 || note.length > 500) return { error: "กรุณาตรวจสอบประเภท รายการ วันที่ ยอด และช่องทางชำระ" } as const;
  return { value: { type, title, category, party, groupId, transactionOn, amountSatang, paymentMethod, reference, note, settlement, approvalRequired } } as const;
}

export async function GET(request: Request) {
  const { response } = await authorize();
  if (response) return response;
  const to = new URL(request.url).searchParams.get("to") ?? today();
  if (!validDate(to)) return Response.json({ error: "วันที่สิ้นสุดไม่ถูกต้อง" }, { status: 400 });
  const [entries, groups] = await Promise.all([
    prisma.netflixLedgerEntry.findMany({ where: { OR: [{ status: { not: "PAID" } }, { transactionOn: { lte: to } }] }, orderBy: [{ transactionOn: "desc" }, { createdAt: "desc" }] }),
    prisma.netflixGroup.findMany({ select: { id: true, name: true, startedOn: true, billingDay: true }, orderBy: { name: "asc" } }),
  ]);
  return Response.json({ entries, groups });
}

export async function POST(request: Request) {
  const { response, access } = await authorize(true);
  if (response) return response;
  const parsed = parseEntry(await request.json().catch(() => null));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const data = parsed.value;
  const group = data.groupId ? await prisma.netflixGroup.findUnique({ where: { id: data.groupId }, select: { id: true, name: true, startedOn: true } }) : null;
  if (data.groupId && !group) return Response.json({ error: "ไม่พบกลุ่ม Netflix" }, { status: 404 });
  if (group?.startedOn && data.transactionOn < group.startedOn) return Response.json({ error: "วันที่รายการต้องไม่อยู่ก่อนวันเริ่มกลุ่ม" }, { status: 400 });
  const { settlement, approvalRequired, ...entryData } = data;
  const status = entryData.type === "EXPENSE" && settlement === "PAYABLE" ? (approvalRequired ? "PENDING_APPROVAL" : "APPROVED") : "PAID";
  const entry = await prisma.netflixLedgerEntry.create({ data: { ...entryData, sourceKey: `manual:${randomUUID()}`, source: "MANUAL", status, approvalRequired: entryData.type === "EXPENSE" && settlement === "PAYABLE" && approvalRequired, paidAt: status === "PAID" ? new Date() : null, groupId: group?.id ?? null, groupName: group?.name ?? null, profileId: null, profileName: null, party: data.party || null } });
  return Response.json({ entry }, { status: 201 });
}

