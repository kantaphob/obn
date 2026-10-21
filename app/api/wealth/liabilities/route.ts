import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const CATEGORIES = new Set(["LOAN", "MORTGAGE", "VEHICLE_FINANCE", "CREDIT_CARD", "PAYABLE", "OTHER"]);

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToSatang(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,13}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function dateFromInput(value: unknown) {
  if (!value) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  const actual = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return actual === value ? date : undefined;
}

async function getObnCompany() {
  return prisma.companySequence.findFirst({
    where: { nameEN: "OBN Co., Ltd.", type: "COMPANY", status: "ACTIVE" },
    select: { companycode: true, nameTH: true, nameEN: true },
  });
}

export async function GET() {
  const denied = await authorizeApiRequest("dashboard", "read");
  if (denied) return denied;
  const company = await getObnCompany();
  if (!company) return Response.json({ company: null, liabilities: [] }, { headers: { "Cache-Control": "no-store" } });
  const liabilities = await prisma.wealthLiability.findMany({
    where: { companyCode: company.companycode, status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: { balances: { orderBy: [{ balanceDate: "desc" }, { createdAt: "desc" }], take: 5 } },
  });
  return Response.json({
    company,
    liabilities: liabilities.map((item) => ({
      id: item.id,
      liabilityCode: item.liabilityCode,
      companyCode: item.companyCode,
      name: item.name,
      category: item.category,
      term: item.term,
      lender: item.lender,
      originalAmount: Number(item.originalAmount),
      outstandingAmount: Number(item.outstandingAmount),
      interestRateBps: item.interestRateBps,
      startDate: item.startDate?.toISOString() ?? null,
      nextDueDate: item.nextDueDate?.toISOString() ?? null,
      notes: item.notes,
      updatedAt: item.updatedAt.toISOString(),
      balances: item.balances.map((balance) => ({
        id: balance.id,
        outstandingAmount: Number(balance.outstandingAmount),
        balanceDate: balance.balanceDate.toISOString(),
        note: balance.note,
      })),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const access = await getCurrentAccess();
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const name = text(data.name, 120);
  const category = data.category;
  const term = data.term ?? "SHORT_TERM";
  const originalAmount = amountToSatang(data.originalAmount);
  const outstandingAmount = amountToSatang(data.outstandingAmount);
  const startDate = dateFromInput(data.startDate);
  const nextDueDate = dateFromInput(data.nextDueDate);
  const rateText = typeof data.interestRate === "string" ? data.interestRate.trim() : "";
  const interestRateBps = rateText === "" ? null : /^(?:\d{1,3})(?:\.\d{1,2})?$/.test(rateText) ? Math.round(Number(rateText) * 100) : undefined;
  const balanceDate = dateFromInput(data.balanceDate);
  if (!name) return Response.json({ error: "กรุณาระบุชื่อหนี้สิน" }, { status: 400 });
  if (typeof category !== "string" || !CATEGORIES.has(category)) return Response.json({ error: "กรุณาเลือกประเภทหนี้สิน" }, { status: 400 });
  if (term !== "SHORT_TERM" && term !== "LONG_TERM") return Response.json({ error: "กรุณาเลือกระยะเวลาหนี้สิน" }, { status: 400 });
  if (originalAmount === null || outstandingAmount === null || outstandingAmount > originalAmount) return Response.json({ error: "ยอดคงเหลือต้องเป็นจำนวนเงินและไม่เกินยอดหนี้ตั้งต้น" }, { status: 400 });
  if (startDate === undefined || nextDueDate === undefined || !balanceDate) return Response.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  if (interestRateBps === undefined) return Response.json({ error: "อัตราดอกเบี้ยไม่ถูกต้อง" }, { status: 400 });
  const company = await getObnCompany();
  if (!company) return Response.json({ error: "ไม่พบทะเบียนบริษัท OBN Co., Ltd." }, { status: 409 });
  if (access?.accessConfigured && !access.companyCodes.includes(company.companycode)) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์บันทึกหนี้สินของ OBN Co., Ltd." }, { status: 403 });
  }
  const createdBy = access?.session.user.id;
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.wealthLiabilityNumberSequence.upsert({
      where: { companyCode: company.companycode },
      create: { companyCode: company.companycode, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const liabilityCode = `OBN-LIA-${String(sequence.lastNumber).padStart(6, "0")}`;
    const liability = await tx.wealthLiability.create({
      data: {
        liabilityCode,
        companyCode: company.companycode,
        name,
        category,
        term,
        lender: text(data.lender, 160),
        originalAmount: BigInt(originalAmount),
        outstandingAmount: BigInt(outstandingAmount),
        interestRateBps,
        startDate,
        nextDueDate,
        notes: text(data.notes, 2000),
        createdBy,
      },
    });
    await tx.wealthLiabilityBalance.create({
      data: { liabilityId: liability.id, outstandingAmount: BigInt(outstandingAmount), balanceDate, note: text(data.balanceNote, 500), createdBy },
    });
    return liability;
  });
  return Response.json({ id: result.id, liabilityCode: result.liabilityCode }, { status: 201 });
}
