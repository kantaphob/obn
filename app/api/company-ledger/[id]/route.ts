import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { calculateCompanyLedgerTax } from "@/lib/company-ledger-tax";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";

type Context = { params: Promise<{ id: string }> };
const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateTimeFromInput(dateValue: unknown, timeValue: unknown) {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    || typeof timeValue !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return null;
  const date = new Date(`${dateValue}T${timeValue}:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return localDate !== dateValue || date.getTime() > Date.now() ? null : date;
}

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const { id } = await context.params;
  const existing = await prisma.companyLedgerEntry.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "ไม่พบรายการใบรับ/จ่าย" }, { status: 404 });
  if (access?.accessConfigured && (!existing.companyCode || !access.companyCodes.includes(existing.companyCode))) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const type = data.type;
  const title = text(data.title, 120);
  const categoryId = text(data.categoryId, 80);
  const amount = data.amount;
  const transactionDate = dateTimeFromInput(data.transactionDate, data.transactionTime);
  const method = data.method;

  if (type !== "INCOME" && type !== "EXPENSE") return Response.json({ error: "กรุณาเลือกประเภทรายการ" }, { status: 400 });
  if (!title) return Response.json({ error: "กรุณาระบุชื่อรายการ" }, { status: 400 });
  const tax = calculateCompanyLedgerTax(type, amount, data.vatRateBps, data.whtRateBps);
  if (!tax) return Response.json({ error: "จำนวนเงินหรืออัตรา VAT/WHT ไม่ถูกต้อง" }, { status: 400 });
  if (!transactionDate) return Response.json({ error: "วันที่หรือเวลาไม่ถูกต้อง" }, { status: 400 });
  if (!METHODS.includes(method as (typeof METHODS)[number])) return Response.json({ error: "ช่องทางชำระเงินไม่ถูกต้อง" }, { status: 400 });

  if (existing.documentNumber) {
    const previousYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(existing.transactionDate);
    const updatedYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(transactionDate);
    if (previousYear !== updatedYear) return Response.json({ error: "เปลี่ยนวันที่ข้ามปีไม่ได้ เพราะเลขที่ใบรับ/จ่ายผูกกับปีเดิม" }, { status: 400 });
  }

  const category = await prisma.companyFinanceCategory.findFirst({ where: { id: categoryId, direction: type } });
  if (!category || !isLoanFinanceCategoryCode(category.code) || (!category.isActive && existing.financeCategoryId !== category.id)) {
    return Response.json({ error: "กรุณาเลือกหมวดหมู่ Loan ที่เปิดใช้งานสำหรับประเภทรายการนี้" }, { status: 400 });
  }

  const entry = await prisma.companyLedgerEntry.update({
    where: { id },
    data: {
      type,
      title,
      category: category.name,
      financeCategoryId: category.id,
      ...tax,
      transactionDate,
      timeRecorded: true,
      party: text(data.party, 120),
      method: String(method),
      reference: text(data.reference, 100),
      note: text(data.note, 1000),
    },
  });
  return Response.json(entry);
}

export async function DELETE(request: Request, context: Context) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const { id } = await context.params;
  const existing = await prisma.companyLedgerEntry.findUnique({ where: { id }, select: { id: true, title: true, documentNumber: true, companyCode: true } });
  if (!existing) return Response.json({ error: "ไม่พบรายการใบรับ/จ่าย" }, { status: 404 });
  if (access?.accessConfigured && (!existing.companyCode || !access.companyCodes.includes(existing.companyCode))) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
  await prisma.companyLedgerEntry.delete({ where: { id } });
  return Response.json({ ok: true, deleted: existing });
}
