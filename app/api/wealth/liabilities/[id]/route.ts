import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function amountToSatang(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,13}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function dateFromInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const actual = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return actual === value ? date : null;
}

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const access = await getCurrentAccess();
  const { id } = await context.params;
  const liability = await prisma.wealthLiability.findUnique({ where: { id }, select: { id: true, companyCode: true } });
  if (!liability) return Response.json({ error: "ไม่พบรายการหนี้สิน" }, { status: 404 });
  if (access?.accessConfigured && !access.companyCodes.includes(liability.companyCode)) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์แก้ไขหนี้สินของบริษัทนี้" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const outstandingAmount = amountToSatang(data.outstandingAmount);
  const balanceDate = dateFromInput(data.balanceDate);
  const term = data.term;
  if (outstandingAmount === null) return Response.json({ error: "กรุณาระบุยอดหนี้คงเหลือ" }, { status: 400 });
  if (term !== undefined && term !== "SHORT_TERM" && term !== "LONG_TERM") return Response.json({ error: "ระยะเวลาหนี้สินไม่ถูกต้อง" }, { status: 400 });
  if (!balanceDate) return Response.json({ error: "วันที่ยอดคงเหลือไม่ถูกต้อง" }, { status: 400 });
  const current = await prisma.wealthLiability.findUnique({ where: { id }, select: { originalAmount: true } });
  if (!current || outstandingAmount > Number(current.originalAmount)) return Response.json({ error: "ยอดหนี้คงเหลือต้องไม่เกินยอดหนี้ตั้งต้น" }, { status: 400 });
  const createdBy = access?.session.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.wealthLiability.update({ where: { id }, data: { outstandingAmount: BigInt(outstandingAmount), ...(term ? { term } : {}) } });
    await tx.wealthLiabilityBalance.create({
      data: { liabilityId: id, outstandingAmount: BigInt(outstandingAmount), balanceDate, note: typeof data.note === "string" ? data.note.trim().slice(0, 500) : "", createdBy },
    });
  });
  return Response.json({ success: true });
}
