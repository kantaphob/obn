import { prisma } from "@/lib/prisma";
import { formatBorrowerCode } from "@/lib/borrower-code";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";

export type CompanyLedgerRow = {
  id: string;
  type: "INCOME" | "EXPENSE";
  title: string;
  category: string;
  categoryCode: string;
  financeCategoryId: string | null;
  amount: number;
  baseAmount: number | null;
  vatRateBps: number | null;
  vatAmount: number | null;
  whtRateBps: number | null;
  whtAmount: number | null;
  transactionDate: Date;
  timeRecorded: boolean;
  documentNumber: string | null;
  companyCode: string | null;
  branchCode: string | null;
  party: string;
  method: string;
  reference: string;
  note: string;
  attachmentUrl: string | null;
  source: "MANUAL" | "LOAN";
  loanReceiptBreakdown?: { principal: number; interest: number; penalty: number };
};

function contractCompanySource(documentData: string | null) {
  try {
    const data = documentData ? JSON.parse(documentData) as Record<string, unknown> : {};
    return {
      companyCode: typeof data.companyCode === "string" ? data.companyCode : null,
      branchCode: typeof data.branchCode === "string" ? data.branchCode : null,
    };
  } catch {
    return { companyCode: null, branchCode: null };
  }
}

const loanPaymentLabels: Record<string, { type: CompanyLedgerRow["type"]; title: string; categoryCode: string }> = {
  DISBURSEMENT: { type: "EXPENSE", title: "จ่ายเงินกู้", categoryCode: "LOAN_DISBURSEMENT" },
  INTEREST: { type: "INCOME", title: "รับดอกเบี้ย", categoryCode: "LOAN_INTEREST" },
  PRINCIPAL: { type: "INCOME", title: "รับคืนเงินต้น", categoryCode: "LOAN_PRINCIPAL" },
  PENALTY: { type: "INCOME", title: "รับค่าปรับ", categoryCode: "LOAN_PENALTY" },
  EXPENSE: { type: "EXPENSE", title: "ค่าใช้จ่ายบริษัท", categoryCode: "LOAN_EXPENSE" },
  CAPITAL_IN: { type: "INCOME", title: "รับเงินทุน", categoryCode: "LOAN_CAPITAL_IN" },
  CAPITAL_OUT: { type: "EXPENSE", title: "ถอนทุน", categoryCode: "LOAN_CAPITAL_OUT" },
};

export async function getCompanyLedgerRows(from: Date | null, to: Date | null): Promise<CompanyLedgerRow[]> {
  const dateFilter = from || to
    ? { transactionDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}) } }
    : {};
  const paymentDateFilter = from || to
    ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}) } }
    : {};

  const [manualEntries, payments, repayments, categories] = await Promise.all([
    prisma.companyLedgerEntry.findMany({ where: dateFilter, include: { financeCategory: true }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }] }),
    prisma.payment.findMany({
      where: paymentDateFilter,
      include: {
        contract: {
          select: {
            contractNumber: true,
            documentData: true,
            debtor: { select: { borrowersCode: true, firstName: true, lastName: true, nickname: true } },
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.repayment.findMany({
      where: paymentDateFilter,
      include: {
        contract: {
          select: {
            contractNumber: true,
            documentData: true,
            debtor: { select: { borrowersCode: true, firstName: true, lastName: true, nickname: true } },
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.companyFinanceCategory.findMany({}),
  ]);

  const categoryByCode = new Map(categories.map((category) => [category.code, category.name]));
  const categoryByName = new Map(categories.map((category) => [`${category.direction}:${category.name}`, category.name]));
  const manualRows: CompanyLedgerRow[] = manualEntries.flatMap((entry) => {
    if (entry.type !== "INCOME" && entry.type !== "EXPENSE") return [];
    const { financeCategory, ...manualEntry } = entry;
    const categoryCode = financeCategory?.code ?? "";
    const isLoanFinanceEntry = isLoanFinanceCategoryCode(categoryCode);
    return [{
      ...manualEntry,
      type: entry.type,
      category: financeCategory?.name ?? categoryByName.get(`${entry.type}:${entry.category}`) ?? entry.category,
      categoryCode,
      source: isLoanFinanceEntry ? "LOAN" : "MANUAL",
    }];
  });
  const repaymentRows: CompanyLedgerRow[] = repayments.map((repayment) => {
    const borrower = repayment.contract.debtor;
    const source = contractCompanySource(repayment.contract.documentData);
    const borrowerName = [borrower.firstName || borrower.nickname, borrower.lastName].filter(Boolean).join(" ");
    return {
      id: `repayment-${repayment.id}`,
      type: "INCOME" as const,
      title: `รับชำระสัญญา · ${repayment.contract.contractNumber}`,
      category: categoryByCode.get("LOAN_RECEIPT") ?? "รับชำระเงินกู้",
      categoryCode: "LOAN_RECEIPT",
      loanReceiptBreakdown: { principal: repayment.principalPaid, interest: repayment.interestPaid, penalty: repayment.penaltyPaid },
      financeCategoryId: null,
      amount: repayment.amount,
      baseAmount: null,
      vatRateBps: null,
      vatAmount: null,
      whtRateBps: null,
      whtAmount: null,
      transactionDate: repayment.paidAt,
      timeRecorded: repayment.timeRecorded,
      documentNumber: null,
      companyCode: source.companyCode,
      branchCode: source.branchCode,
      party: [formatBorrowerCode(borrower.borrowersCode), borrowerName].filter(Boolean).join(" · "),
      method: repayment.method,
      reference: repayment.receiptNumber,
      note: repayment.note ?? "",
      attachmentUrl: null,
      source: "LOAN" as const,
    };
  });
  const loanRows: CompanyLedgerRow[] = payments.flatMap((payment) => {
    // The receipt history stores the full receipt separately. Ignore its component rows here
    // for both current notes and imported legacy notes that include the original receipt number.
    if (repayments.some(({ receiptNumber }) => payment.note?.includes(receiptNumber))) return [];
    const label = loanPaymentLabels[payment.type];
    if (!label) return [];
    const contract = payment.contract;
    const borrower = contract?.debtor;
    const source = contractCompanySource(contract?.documentData ?? null);
    const borrowerName = borrower ? [borrower.firstName || borrower.nickname, borrower.lastName].filter(Boolean).join(" ") : "";
    const party = contract ? [borrower ? formatBorrowerCode(borrower.borrowersCode) : null, borrowerName].filter(Boolean).join(" · ") : "";
    const title = contract ? `${label.title} · ${contract.contractNumber}` : label.title;
    return [{
      id: `loan-${payment.id}`,
      type: label.type,
      title,
      category: categoryByCode.get(label.categoryCode) ?? "หมวดหมู่ระบบ",
      categoryCode: label.categoryCode,
      financeCategoryId: null,
      amount: payment.amount,
      baseAmount: null,
      vatRateBps: null,
      vatAmount: null,
      whtRateBps: null,
      whtAmount: null,
      transactionDate: payment.paidAt,
      timeRecorded: payment.timeRecorded,
      documentNumber: null,
      companyCode: source.companyCode,
      branchCode: source.branchCode,
      party,
      method: payment.method,
      reference: payment.type === "DISBURSEMENT" ? payment.note?.match(/^เลขอ้างอิงการจ่าย (.+)$/)?.[1] ?? "" : "",
      note: payment.type === "DISBURSEMENT" && payment.note?.startsWith("เลขอ้างอิงการจ่าย ") ? "" : payment.note ?? "",
      attachmentUrl: null,
      source: "LOAN",
    }];
  });

  return [...manualRows, ...repaymentRows, ...loanRows].sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime() || a.id.localeCompare(b.id));
}
