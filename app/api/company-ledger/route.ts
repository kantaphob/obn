import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { calculateCompanyLedgerTax } from "@/lib/company-ledger-tax";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";

const TYPES = ["INCOME", "EXPENSE"] as const;
const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateFromInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return localDate !== value ? null : date;
}

function dateTimeFromInput(dateValue: unknown, timeValue: unknown) {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    || typeof timeValue !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return null;
  const date = new Date(`${dateValue}T${timeValue}:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return localDate !== dateValue || date.getTime() > Date.now() ? null : date;
}

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("accounting", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const source = params.get("source");
  const from = dateFromInput(params.get("from"));
  const to = dateFromInput(params.get("to"));
  const query = text(params.get("q"), 100);

  const entries = await getCompanyLedgerRows(from, to);
  const companyScopedEntries = access?.accessConfigured ? entries.filter((entry) => entry.companyCode && access.companyCodes.includes(entry.companyCode)) : entries;
  const filtered = companyScopedEntries.filter((entry) => {
    if (source === "LOAN" && entry.source !== "LOAN") return false;
    if (source === "MANUAL" && entry.source !== "MANUAL") return false;
    if (type && type !== "ALL" && TYPES.includes(type as (typeof TYPES)[number]) && entry.type !== type) return false;
    if (!query) return true;
    return `${entry.title} ${entry.category} ${entry.party} ${entry.reference} ${entry.note}`.toLocaleLowerCase("th-TH").includes(query.toLocaleLowerCase("th-TH"));
  });

  return Response.json(filtered, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const type = data.type;
  const title = text(data.title, 120);
  const categoryId = text(data.categoryId, 80);
  const amount = data.amount;
  const transactionDate = dateTimeFromInput(data.transactionDate, data.transactionTime);
  const companyCode = text(data.companyCode, 5);
  const branchCode = text(data.branchCode, 5);
  const method = data.method;

  if (type !== "INCOME" && type !== "EXPENSE") return Response.json({ error: "กรุณาเลือกประเภทรายการ" }, { status: 400 });
  if (!title) return Response.json({ error: "กรุณาระบุชื่อรายการ" }, { status: 400 });
  const tax = calculateCompanyLedgerTax(type, amount, data.vatRateBps, data.whtRateBps);
  if (!tax) return Response.json({ error: "จำนวนเงินหรืออัตรา VAT/WHT ไม่ถูกต้อง" }, { status: 400 });
  if (!transactionDate) return Response.json({ error: "วันที่หรือเวลาไม่ถูกต้อง" }, { status: 400 });
  if (!/^\d{5}$/.test(companyCode) || !/^\d{5}$/.test(branchCode)) return Response.json({ error: "กรุณาเลือกสำนักงานใหญ่และสาขาที่ทำรายการ" }, { status: 400 });
  if (access?.accessConfigured && !access.companyCodes.includes(companyCode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
  if (!METHODS.includes(method as (typeof METHODS)[number])) return Response.json({ error: "ช่องทางชำระเงินไม่ถูกต้อง" }, { status: 400 });
  const financeCategory = await prisma.companyFinanceCategory.findFirst({ where: { id: categoryId, direction: type, isActive: true } });
  if (!financeCategory || !isLoanFinanceCategoryCode(financeCategory.code)) return Response.json({ error: "กรุณาเลือกหมวดหมู่ Loan ที่เปิดใช้งานสำหรับประเภทรายการนี้" }, { status: 400 });

  let entry;
  try {
    entry = await prisma.$transaction(async (tx) => {
      const company = await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" }, select: { companycode: true } });
      const branch = branchCode === companyCode
        ? { branchcode: companyCode }
        : await tx.branchCodeSequence.findFirst({ where: { companycode: companyCode, branchcode: branchCode, type: "BRANCH", status: "ACTIVE" }, select: { branchcode: true } });
      if (!company || !branch) throw new Error("ไม่พบสำนักงานใหญ่หรือสาขาที่เปิดใช้งาน");

      const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(transactionDate));
      const sequence = await tx.companyLedgerNumberSequence.upsert({
        where: { companyCode_branchCode_year: { companyCode, branchCode, year } },
        create: { companyCode, branchCode, year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      if (sequence.lastNumber > 999999) throw new Error("เลขที่รายการของสาขานี้ครบ 999999 รายการแล้ว");
      const documentNumber = `OBN-L-${String(year % 100).padStart(2, "0")}-${companyCode}-${branchCode}-${String(sequence.lastNumber).padStart(6, "0")}`;

      return tx.companyLedgerEntry.create({
        data: {
          type,
          title,
          category: financeCategory.name,
          financeCategoryId: financeCategory.id,
          ...tax,
          transactionDate,
          timeRecorded: true,
          documentNumber,
          companyCode,
          branchCode,
          party: text(data.party, 120),
          method: String(method),
          reference: text(data.reference, 100),
          note: text(data.note, 1000),
        },
      });
    });
  } catch (cause) {
    if (cause instanceof Error && (cause.message === "ไม่พบสำนักงานใหญ่หรือสาขาที่เปิดใช้งาน" || cause.message.startsWith("เลขที่รายการของสาขานี้ครบ"))) {
      return Response.json({ error: cause.message }, { status: 400 });
    }
    console.error("Company ledger entry creation failed:", cause);
    return Response.json({ error: "ออกเลขที่รายการหรือบันทึกบัญชีไม่สำเร็จ" }, { status: 500 });
  }
  return Response.json(entry, { status: 201 });
}
