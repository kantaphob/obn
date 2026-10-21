import { assertLoanPeriodOpen } from "@/lib/loan-accounting-lock";
import { writeLoanLog } from "@/lib/loan-logs";
import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { calculateCompanyLedgerTax } from "@/lib/company-ledger-tax";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";
import { resolveBusinessSystemScope } from "@/lib/company-system";

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
  const loanScope = source === "LOAN" ? await (async () => {
    const [companies, branches] = await Promise.all([
      prisma.companySequence.findMany({ where: { type: "COMPANY", status: "ACTIVE", ...(access?.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) }, select: { companycode: true, nameTH: true, nameEN: true } }),
      prisma.branchCodeSequence.findMany({ where: { type: "BRANCH", status: "ACTIVE", ...(access?.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) }, select: { companycode: true, branchcode: true, nameTH: true, nameEN: true } }),
    ]);
    return resolveBusinessSystemScope("LOAN", companies, branches);
  })() : null;
  const soleLoanCompanyCode = loanScope?.companyCodes.size === 1 ? [...loanScope.companyCodes][0] : null;
  const canReadUnassignedLoanHistory = Boolean(soleLoanCompanyCode && (!access?.accessConfigured || access.companyCodes.includes(soleLoanCompanyCode)));
  const companyScopedEntries = access?.accessConfigured ? entries.filter((entry) => entry.companyCode
    ? access.companyCodes.includes(entry.companyCode)
    : source === "LOAN" && canReadUnassignedLoanHistory) : entries;
  const filtered = companyScopedEntries.filter((entry) => {
    if (source === "LOAN" && (entry.source !== "LOAN" || !(entry.companyCode
      ? loanScope?.allowsLocation(entry.companyCode, entry.branchCode)
      : canReadUnassignedLoanHistory))) return false;
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

  if (["LOAN_CAPITAL_IN", "LOAN_CAPITAL_OUT", "LEGACY_CAPITAL_START", "LEGACY_CAPITAL_WITHDRAWAL"].includes(financeCategory.code)) return Response.json({ error: "เพิ่มทุนและถอนทุนผ่านหน้าบัญชีทุน เพื่อระบุผู้ลงทุนและอนุมัติรายการ" }, { status: 409 });

  let entry;
  try {
    entry = await prisma.$transaction(async (tx) => {
      await tx.loanAccountingPeriod.updateMany({ where: { id: "__loan_write_lock__" }, data: { status: "CLOSED" } });
      await assertLoanPeriodOpen(tx, companyCode, transactionDate);
      const company = await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" }, select: { companycode: true, nameTH: true, nameEN: true } });
      const branch = branchCode === companyCode
        ? null
        : await tx.branchCodeSequence.findFirst({ where: { companycode: companyCode, branchcode: branchCode, type: "BRANCH", status: "ACTIVE" }, select: { companycode: true, branchcode: true, nameTH: true, nameEN: true } });
      const isLoanLocation = branchCode === companyCode
        ? Boolean(company && resolveBusinessSystemScope("LOAN", [company], []).allowsLocation(companyCode, companyCode))
        : Boolean(company && branch && resolveBusinessSystemScope("LOAN", [company], [branch]).allowsLocation(companyCode, branchCode));
      if (!company || !isLoanLocation) throw new Error("เลือกได้เฉพาะสถานที่ทำรายการของระบบ Loan");
      if (branchCode !== companyCode && !branch) throw new Error("ไม่พบสำนักงานใหญ่หรือสาขาที่เปิดใช้งาน");

      const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(transactionDate));
      const sequence = await tx.companyLedgerNumberSequence.upsert({
        where: { companyCode_branchCode_year: { companyCode, branchCode, year } },
        create: { companyCode, branchCode, year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      if (sequence.lastNumber > 999999) throw new Error("เลขที่รายการของสาขานี้ครบ 999999 รายการแล้ว");
      const documentNumber = `OBN-L-${String(year % 100).padStart(2, "0")}-${companyCode}-${branchCode}-${String(sequence.lastNumber).padStart(6, "0")}`;

      const saved = await tx.companyLedgerEntry.create({
        data: {
          createdBy: access?.session.user.id,
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
      await writeLoanLog(tx, { borrowerId: "", userId: access?.session.user.id, targetId: saved.id, type: "ACCOUNTING", action: "CREATE", afterData: { amount: saved.amount, type: saved.type, categoryId: saved.financeCategoryId }, note: saved.title });
      return saved;
    });
  } catch (cause) {
    if (cause instanceof Error && (cause.message.includes("รอบบัญชี") || cause.message === "ไม่พบสำนักงานใหญ่หรือสาขาที่เปิดใช้งาน" || cause.message.startsWith("เลือกได้เฉพาะสถานที่ทำรายการของระบบ Loan") || cause.message.startsWith("เลขที่รายการของสาขานี้ครบ"))) {
      return Response.json({ error: cause.message }, { status: 400 });
    }
    console.error("Company ledger entry creation failed:", cause);
    return Response.json({ error: "ออกเลขที่รายการหรือบันทึกบัญชีไม่สำเร็จ" }, { status: 500 });
  }
  return Response.json(entry, { status: 201 });
}
