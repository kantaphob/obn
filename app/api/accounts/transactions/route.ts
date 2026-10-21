import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { calculateCompanyLedgerTax } from "@/lib/company-ledger-tax";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";
import { matchesBusinessSystem, resolveBusinessSystemScope, type BusinessSystem } from "@/lib/company-system";
import { authorizeCentralFinanceRequest } from "@/lib/central-finance-access";

const TYPES = ["INCOME", "EXPENSE"] as const;
const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;
type LedgerType = (typeof TYPES)[number];
const SYSTEMS: BusinessSystem[] = ["LOAN", "CONSTRUCTION", "BUILDIN", "AGRICULTURE", "YOUTUBE", "NETFLIX"];

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateTimeFromInput(dateValue: unknown, timeValue: unknown, allowFuture = false) {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    || typeof timeValue !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return null;
  const date = new Date(`${dateValue}T${timeValue}:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return localDate !== dateValue || (!allowFuture && date.getTime() > Date.now()) ? null : date;
}

export async function GET(request: Request) {
  const denied = await authorizeCentralFinanceRequest(request, "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const system = params.get("system");
  if (!TYPES.includes(type as LedgerType)) return Response.json({ error: "ประเภทรายการไม่ถูกต้อง" }, { status: 400 });
  if (system && !SYSTEMS.includes(system as BusinessSystem)) return Response.json({ error: "ระบบบริษัทไม่ถูกต้อง" }, { status: 400 });
  const [accessibleCompanies, accessibleBranches] = await Promise.all([prisma.companySequence.findMany({
    where: { type: "COMPANY", status: "ACTIVE", ...(access.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) },
    select: { companycode: true, nameTH: true, nameEN: true, status: true },
    orderBy: { companycode: "asc" },
  }), prisma.branchCodeSequence.findMany({
    where: { type: "BRANCH", status: "ACTIVE", ...(access.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) },
    select: { companycode: true, branchcode: true, nameTH: true, nameEN: true, status: true },
    orderBy: [{ companycode: "asc" }, { branchcode: "asc" }],
  })]);
  const systemScope = system ? resolveBusinessSystemScope(system as BusinessSystem, accessibleCompanies, accessibleBranches) : null;
  const companyCodes = systemScope ? [...systemScope.companyCodes] : access.accessConfigured ? access.companyCodes : null;
  const companies = systemScope ? accessibleCompanies.filter((company) => systemScope.companyCodes.has(company.companycode)) : accessibleCompanies;
  const branchOptions = systemScope ? systemScope.visibleBranches : accessibleBranches;
  const ledgerScope = systemScope
    ? {
      OR: [
        ...[...systemScope.branchCodesByCompany.entries()].map(([code, branchCodes]) => ({ companyCode: code, branchCode: { in: [...branchCodes] } })),
        ...[...systemScope.directCompanyCodes].filter((code) => !systemScope.branchCodesByCompany.has(code)).map((companyCode) => ({ companyCode })),
      ],
    }
    : companyCodes ? { companyCode: { in: companyCodes } } : {};
  const [ledgerRows, categories, netflixRows, youtubeRows] = await Promise.all([
    prisma.companyLedgerEntry.findMany({
      where: { type: type as LedgerType, AND: [ledgerScope, system === "NETFLIX" || system === "YOUTUBE" ? { OR: [{ settlementStatus: { not: "PAID" } }, { transactionDate: { lte: new Date() } }] } : { transactionDate: { lte: new Date() } }] },
      include: { financeCategory: { select: { code: true, name: true } } },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.companyFinanceCategory.findMany({ where: { direction: type as LedgerType, isActive: true }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
    system === "NETFLIX"
      ? prisma.netflixLedgerEntry.findMany({ where: { type: type as LedgerType, OR: [{ status: { not: "PAID" } }, { transactionOn: { lte: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) } }] }, orderBy: [{ transactionOn: "desc" }, { createdAt: "desc" }] })
      : Promise.resolve([]),
    system === "YOUTUBE" && type === "INCOME"
      ? prisma.youtubePayment.findMany({ where: { voidedAt: null, paidOn: { lte: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) } }, orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }] })
      : Promise.resolve([]),
  ]);
  const entries = ledgerRows.filter((entry) => !isLoanFinanceCategoryCode(entry.financeCategory?.code ?? "")).map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    category: entry.financeCategory?.name ?? entry.category,
    amount: entry.amount,
    baseAmount: entry.baseAmount,
    vatRateBps: entry.vatRateBps,
    vatAmount: entry.vatAmount,
    whtRateBps: entry.whtRateBps,
    whtAmount: entry.whtAmount,
    transactionDate: entry.transactionDate,
    documentNumber: entry.documentNumber,
    companyCode: entry.companyCode,
    branchCode: entry.branchCode,
    party: entry.party,
    method: entry.method,
    reference: entry.reference,
    note: entry.note,
    settlementStatus: entry.settlementStatus,
    approvalRequired: entry.approvalRequired,
  }));
  if (system === "NETFLIX") {
    const seen = new Set(entries.map((entry) => entry.id));
    entries.push(...netflixRows.filter((entry) => !seen.has(entry.id)).map((entry) => ({
      id: `netflix-${entry.id}`,
      type: entry.type as LedgerType,
      title: entry.title,
      category: entry.category,
      amount: entry.amountSatang,
      baseAmount: entry.amountSatang,
      vatRateBps: null,
      vatAmount: null,
      whtRateBps: null,
      whtAmount: null,
      transactionDate: new Date(`${entry.transactionOn}T12:00:00+07:00`),
      documentNumber: entry.source === "MEMBER_INVOICE" ? entry.reference : null,
      companyCode: null,
      branchCode: null,
      party: entry.profileName || entry.groupName || entry.party || "Netflix",
      method: entry.paymentMethod,
      reference: entry.reference || "",
      note: entry.note || "",
      settlementStatus: entry.status === "PENDING_RECEIPT" ? "PENDING_RECEIPT" as const : entry.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" as const : entry.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" as const : entry.status === "APPROVED" ? "APPROVED" as const : "PAID" as const,
      approvalRequired: entry.approvalRequired,
    })));
  }
  if (system === "YOUTUBE" && type === "INCOME") {
    const seen = new Set(entries.map((entry) => entry.id));
    entries.push(...youtubeRows.filter((entry) => !seen.has(entry.id)).map((entry) => ({
      id: `youtube-${entry.id}`,
      type: "INCOME" as const,
      title: "รับค่าสมาชิก YouTube",
      category: "รับจากสมาชิก",
      amount: entry.amountSatang,
      baseAmount: entry.amountSatang,
      vatRateBps: null,
      vatAmount: null,
      whtRateBps: null,
      whtAmount: null,
      transactionDate: new Date(`${entry.paidOn}T12:00:00+07:00`),
      documentNumber: null,
      companyCode: null,
      branchCode: null,
      party: entry.memberName || entry.groupName || "",
      method: entry.paymentMethod,
      reference: entry.reference || "",
      note: entry.note || "",
      settlementStatus: "PAID" as const,
      approvalRequired: false,
    })));
  }
  entries.sort((left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime());
  const allowedCategories = categories.filter((category) => !isLoanFinanceCategoryCode(category.code));
  return Response.json({
    entries,
    companies,
    branches: branchOptions,
    systemBranchCompanyCodes: systemScope ? [...systemScope.branchCodesByCompany.keys()] : [],
    categories: allowedCategories,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorizeCentralFinanceRequest(request, "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const params = new URL(request.url).searchParams;
  const expectedType = params.get("type");
  const system = params.get("system");
  if (!TYPES.includes(expectedType as LedgerType)) return Response.json({ error: "ประเภทรายการไม่ถูกต้อง" }, { status: 400 });
  if (system && !SYSTEMS.includes(system as BusinessSystem)) return Response.json({ error: "ระบบบริษัทไม่ถูกต้อง" }, { status: 400 });
  const type = expectedType as LedgerType;
  const title = text(data.title, 120);
  const categoryId = text(data.categoryId, 80);
  const companyCode = text(data.companyCode, 5);
  const branchCode = text(data.branchCode, 5);
  const supportsApproval = system === "NETFLIX" || system === "YOUTUBE";
  const settlement = supportsApproval && type === "EXPENSE" && data.settlement === "PAYABLE" ? "PAYABLE"
    : system === "NETFLIX" && type === "INCOME" && data.settlement === "RECEIVABLE" ? "RECEIVABLE" : "PAID";
  const approvalRequired = data.approvalRequired === true;
  const transactionDate = dateTimeFromInput(data.transactionDate, data.transactionTime, settlement !== "PAID");
  const method = data.method;

  if (data.type !== type) return Response.json({ error: "ประเภทรายการไม่ตรงกับหน้าบันทึกนี้" }, { status: 400 });
  if (supportsApproval && settlement === "PAID" && data.confirmed !== true) return Response.json({ error: "กรุณายืนยันว่าได้รับหรือจ่ายเงินจริงแล้ว" }, { status: 400 });
  if (!title) return Response.json({ error: "กรุณาระบุชื่อรายการ" }, { status: 400 });
  const tax = calculateCompanyLedgerTax(type, data.amount, data.vatRateBps, data.whtRateBps);
  if (!tax) return Response.json({ error: "จำนวนเงินหรืออัตราภาษีไม่ถูกต้อง" }, { status: 400 });
  if (!transactionDate) return Response.json({ error: "วันที่หรือเวลาไม่ถูกต้อง" }, { status: 400 });
  if (!/^\d{5}$/.test(companyCode) || !/^\d{5}$/.test(branchCode)) return Response.json({ error: "กรุณาเลือกบริษัทและสถานที่ทำรายการ" }, { status: 400 });
  if (access.accessConfigured && !access.companyCodes.includes(companyCode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
  if (!METHODS.includes(method as (typeof METHODS)[number])) return Response.json({ error: "ช่องทางรับ–จ่ายไม่ถูกต้อง" }, { status: 400 });

  const financeCategory = await prisma.companyFinanceCategory.findFirst({ where: { id: categoryId, direction: type as LedgerType, isActive: true } });
  if (!financeCategory || isLoanFinanceCategoryCode(financeCategory.code)) return Response.json({ error: "กรุณาเลือกหมวดหมู่บัญชีกลางที่เปิดใช้งาน" }, { status: 400 });

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const company = await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" }, select: { companycode: true, nameTH: true, nameEN: true } });
      const branch = branchCode === companyCode
        ? null
        : await tx.branchCodeSequence.findFirst({ where: { companycode: companyCode, branchcode: branchCode, type: "BRANCH", status: "ACTIVE" }, select: { branchcode: true, nameTH: true, nameEN: true } });
      if (system) {
        const matches = branchCode === companyCode
          ? Boolean(company && matchesBusinessSystem(system as BusinessSystem, company.nameTH, company.nameEN))
          : Boolean(branch && matchesBusinessSystem(system as BusinessSystem, branch.nameTH, branch.nameEN));
        if (!matches) throw new Error("สถานที่ทำรายการนี้ไม่ตรงกับระบบที่เลือก");
      }
      if (!company || (branchCode !== companyCode && !branch)) throw new Error("ไม่พบบริษัทหรือสาขาที่เปิดใช้งาน");

      const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(transactionDate));
      const sequence = await tx.companyLedgerNumberSequence.upsert({
        where: { companyCode_branchCode_year: { companyCode, branchCode, year } },
        create: { companyCode, branchCode, year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      if (sequence.lastNumber > 999999) throw new Error("เลขที่รายการของบริษัทนี้ครบ 999999 รายการแล้ว");
      const documentNumber = `OBN-F-${String(year % 100).padStart(2, "0")}-${companyCode}-${branchCode}-${String(sequence.lastNumber).padStart(6, "0")}`;

      return tx.companyLedgerEntry.create({
        data: {
          createdBy: access.session.user.id,
          type: type as LedgerType,
          title,
          category: financeCategory.name,
          financeCategoryId: financeCategory.id,
          ...tax,
          transactionDate,
          timeRecorded: true,
          documentNumber,
          settlementStatus: type === "INCOME" && settlement === "RECEIVABLE" ? "PENDING_RECEIPT" : type === "EXPENSE" && settlement === "PAYABLE" ? (approvalRequired ? "PENDING_APPROVAL" : "APPROVED") : "PAID",
          approvalRequired: type === "EXPENSE" && settlement === "PAYABLE" && approvalRequired,
          paidAt: settlement === "PAID" ? new Date() : null,
          companyCode,
          branchCode,
          party: text(data.party, 120),
          method: String(method),
          reference: text(data.reference, 100),
          note: text(data.note, 1000),
        },
      });
    });
    return Response.json(entry, { status: 201 });
  } catch (cause) {
    if (cause instanceof Error && (cause.message === "ไม่พบบริษัทหรือสาขาที่เปิดใช้งาน" || cause.message === "สถานที่ทำรายการนี้ไม่ตรงกับระบบที่เลือก" || cause.message.startsWith("เลขที่รายการของบริษัทนี้ครบ"))) {
      return Response.json({ error: cause.message }, { status: 400 });
    }
    console.error("Central finance transaction creation failed:", cause);
    return Response.json({ error: "ออกเลขที่รายการหรือบันทึกรายการไม่สำเร็จ" }, { status: 500 });
  }
}
