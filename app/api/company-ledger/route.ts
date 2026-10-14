import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";

const TYPES = ["INCOME", "EXPENSE"] as const;
const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateFromInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return Number.isNaN(date.getTime()) || localDate !== value ? null : date;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const from = dateFromInput(params.get("from"));
  const to = dateFromInput(params.get("to"));
  const query = text(params.get("q"), 100);

  const entries = await getCompanyLedgerRows(from, to);
  const filtered = entries.filter((entry) => {
    if (type && type !== "ALL" && TYPES.includes(type as (typeof TYPES)[number]) && entry.type !== type) return false;
    if (!query) return true;
    return `${entry.title} ${entry.category} ${entry.party} ${entry.reference} ${entry.note}`.toLocaleLowerCase("th-TH").includes(query.toLocaleLowerCase("th-TH"));
  });

  return Response.json(filtered, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const type = data.type;
  const title = text(data.title, 120);
  const categoryId = text(data.categoryId, 80);
  const amount = data.amount;
  const transactionDate = dateFromInput(data.transactionDate);
  const method = data.method;

  if (type !== "INCOME" && type !== "EXPENSE") return Response.json({ error: "กรุณาเลือกประเภทรายการ" }, { status: 400 });
  if (!title) return Response.json({ error: "กรุณาระบุชื่อรายการ" }, { status: 400 });
  if (!Number.isSafeInteger(amount) || Number(amount) <= 0) return Response.json({ error: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
  if (!transactionDate) return Response.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  if (!METHODS.includes(method as (typeof METHODS)[number])) return Response.json({ error: "ช่องทางชำระเงินไม่ถูกต้อง" }, { status: 400 });
  const financeCategory = await prisma.companyFinanceCategory.findFirst({ where: { id: categoryId, direction: type, isActive: true } });
  if (!financeCategory) return Response.json({ error: "กรุณาเลือกหมวดหมู่ที่เปิดใช้งานสำหรับประเภทรายการนี้" }, { status: 400 });

  const entry = await prisma.companyLedgerEntry.create({
    data: {
      type,
      title,
      category: financeCategory.name,
      financeCategoryId: financeCategory.id,
      amount: Number(amount),
      transactionDate,
      party: text(data.party, 120),
      method: String(method),
      reference: text(data.reference, 100),
      note: text(data.note, 1000),
    },
  });
  return Response.json(entry, { status: 201 });
}
