import { loanStatus } from "./loan-status";
import "server-only";
import { prisma } from "./prisma";
import { getCompanyLedgerRows } from "./company-ledger";
import { summarizeCompanyLedgerRows, summarizeLoanFinanceRows, normalizeLoanFinanceCategoryCode } from "./company-ledger-summary";
import { loanBalance, thaiDay } from "./loan-balance";
import { getUpfrontInterestRows } from "./loan-upfront-interest";
import { buildLoanSchedule, DAY, localDate } from "./loan-operations-calculations";
import { contractCompanyCode } from "./loan-accounting-lock";
import { getCurrentAccess } from "./authorization";

export async function getLoanOperationsData(asOf: Date, company: string, year: number) {
  const access = await getCurrentAccess();
  if (!access) throw new Error("กรุณาเข้าสู่ระบบ");
  const allowed = (code: string | null) => (!company || code === company) && (!access.accessConfigured || Boolean(code && access.companyCodes.includes(code)));
  const [allContracts, allLedger, followups, investors, requests, periods, reconciliations, users, companies, plans] = await Promise.all([
    prisma.contract.findMany({ include: { debtor: { select: { id: true, borrowersCode: true, firstName: true, lastName: true, phone: true } }, schedules: true, payments: true, repayments: { orderBy: { paidAt: "desc" } } }, orderBy: { updatedAt: "desc" } }),
    getCompanyLedgerRows(null, new Date(thaiDay(asOf) - 7 * 3600000)),
    prisma.loanFollowUp.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.loanInvestor.findMany({ orderBy: { firstName: "asc" } }),
    prisma.loanCapitalRequest.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.loanAccountingPeriod.findMany({ orderBy: { throughDate: "desc" } }),
    prisma.loanReconciliation.findMany({ orderBy: { asOf: "desc" }, take: 200 }),
    prisma.user.findMany({ where: { status: "ACTIVE", banned: false }, select: { id: true, name: true } }),
    prisma.companySequence.findMany({ where: { type: "COMPANY", status: "ACTIVE" }, select: { companycode: true, nameTH: true } }),
    prisma.loanCashPlan.findMany({ where: { status: "OPEN" }, orderBy: { dueDate: "asc" } }),
  ]);
  const projectedContracts = allContracts.map(contract => ({ ...contract, status: loanStatus(contract, asOf) }));
  const permitted = projectedContracts.filter(contract => allowed(contractCompanyCode(contract.documentData)) && (thaiDay(contract.startDate) <= thaiDay(asOf) || ["READY", "RESERVED"].includes(contract.status)));
  const ids = new Set(permitted.map(contract => contract.id));
  const ledger = allLedger.filter(row => row.source === "LOAN" && allowed(row.companyCode));
  const contracts = permitted.map(contract => {
    const activeAsOf = contract.status === "CLOSED" && contract.payments.some(payment => payment.amount > 0 && ["PRINCIPAL", "INTEREST", "PENALTY"].includes(payment.type) && thaiDay(payment.paidAt) > thaiDay(asOf));
    const effectiveStatus = activeAsOf ? "ACTIVE" : contract.status;
    const balance = ["ACTIVE", "OVERDUE", "CLOSED"].includes(effectiveStatus) ? loanBalance(contract, asOf) : { principal: 0, interest: 0, penalty: 0, total: 0, chargedInterest: 0, overdueDays: 0 };
    const schedules = buildLoanSchedule(contract, asOf);
    const periodPayments = contract.payments.filter(payment => thaiDay(payment.paidAt) <= thaiDay(asOf) && localDate(payment.paidAt).startsWith(String(year)));
    const received = (type: string) => periodPayments.filter(payment => payment.type === type).reduce((sum,payment) => sum + payment.amount,0);
    const annualReceipts = { principal: received("PRINCIPAL"), interest: received("INTEREST"), penalty: received("PENALTY"), expenses: received("EXPENSE"), withheld: getUpfrontInterestRows([contract],asOf).filter(row => localDate(row.paidAt).startsWith(String(year))).reduce((sum,row) => sum + row.amount,0) };
    return { id: contract.id, contractNumber: contract.contractNumber, companyCode: contractCompanyCode(contract.documentData), status: effectiveStatus, annualReceipts, borrower: contract.debtor, principal: contract.principal, netDisbursed: contract.netDisbursed, startDate: localDate(contract.startDate), dueDate: contract.dueDate ? localDate(contract.dueDate) : null, balance, schedules, documents: (() => { try { const doc = JSON.parse(contract.documentData || "{}"); return [...(Array.isArray(doc.attachments) ? doc.attachments : []), ...(Array.isArray(doc.deliveryEvidenceRecords) ? doc.deliveryEvidenceRecords : [])].filter((item: { url?: unknown }) => typeof item?.url === "string" && item.url.startsWith("/api/contracts/attachments/")).map((item: { url: string; name?: string }) => ({ url: item.url, name: typeof item.name === "string" ? item.name : "เอกสารแนบ" })); } catch { return [] as { url: string; name: string }[]; } })(), documentUrl: contract.documentUrl?.startsWith("/api/") ? contract.documentUrl : null, receipts: contract.repayments.filter(row => thaiDay(row.paidAt) <= thaiDay(asOf)).map(row => ({ ...row, reversedAt: row.reversedAt && thaiDay(row.reversedAt) <= thaiDay(asOf) ? row.reversedAt : null })), updatedAt: contract.updatedAt };
  });
  const active = contracts.filter(contract => ["ACTIVE", "OVERDUE"].includes(contract.status));
  const scheduled = active.flatMap(contract => contract.schedules.map(row => ({ ...row, contractId: contract.id, contractNumber: contract.contractNumber, borrower: contract.borrower })));
  const cash = summarizeCompanyLedgerRows(ledger).net;
  const capital = summarizeLoanFinanceRows(ledger);
  const visibleFollowups = followups.filter(item => ids.has(item.contractId) && thaiDay(item.createdAt) <= thaiDay(asOf)).map(item => {
    const receipts = permitted.find(contract => contract.id === item.contractId)?.repayments || [];
    const nextPromise = followups.find(next => next.contractId === item.contractId && next.id !== item.id && next.promisedAmount > 0 && next.createdAt > item.createdAt && thaiDay(next.createdAt) <= thaiDay(asOf));
    const paidAfter = receipts.filter(receipt => (!receipt.reversedAt || thaiDay(receipt.reversedAt) > thaiDay(asOf)) && receipt.createdAt >= item.createdAt && thaiDay(receipt.paidAt) <= thaiDay(asOf)).reduce((sum, receipt) => sum + receipt.amount, 0);
    const effectiveStatus = item.status === "DONE" ? "DONE" : nextPromise && item.promisedAmount > 0 ? "SUPERSEDED" : item.promisedAt && item.promisedAmount > 0 && paidAfter >= item.promisedAmount ? "FULFILLED" : item.promisedAt && thaiDay(item.promisedAt) < thaiDay(asOf) ? item.promisedAmount > 0 ? "BROKEN" : "DUE" : "OPEN";
    return { ...item, promisedAt: item.promisedAt ? localDate(item.promisedAt) : null, paidAfter, effectiveStatus };
  });
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const rows = ledger.filter(row => localDate(row.transactionDate).startsWith(key));
    const finance = summarizeLoanFinanceRows(rows);
    const withheld = getUpfrontInterestRows(permitted, asOf).filter(row => localDate(row.paidAt).startsWith(key)).reduce((sum, row) => sum + row.amount, 0);
    return { key, label: new Intl.DateTimeFormat("th-TH", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, index, 1))), ...finance, withheld, operatingResult: finance.interestReceived + finance.penaltyReceived + finance.otherIncome - finance.operatingExpenses, cashflow: summarizeCompanyLedgerRows(rows) };
  });
  const scopedPlans = plans.filter(plan => allowed(plan.companyCode));
  const fingerprints = new Map<string, typeof ledger>();
  for (const row of ledger) {
    if (!row.reference || row.reversalOfId) continue;
    const key = `${row.companyCode}:${row.type}:${row.amount}:${row.method}:${row.reference.trim()}`;
    fingerprints.set(key, [...(fingerprints.get(key) || []), row]);
  }
  const possibleDuplicates = [...fingerprints.values()].filter(rows => rows.length > 1).map(rows => ({ reference: rows[0].reference, amount: rows[0].amount, ids: rows.map(row => row.id), titles: rows.map(row => row.title) }));
  const pendingDisbursements = permitted.filter(contract => ["READY", "RESERVED"].includes(contract.status)).map(contract => ({ id: contract.id, contractNumber: contract.contractNumber, amount: Math.max(0, contract.netDisbursed - contract.payments.filter(p => p.type === "DISBURSEMENT" && thaiDay(p.paidAt) <= thaiDay(asOf)).reduce((sum, p) => sum + p.amount, 0)), dueDate: localDate(new Date(Math.max(thaiDay(asOf) + DAY, thaiDay(contract.startDate)) + 5 * 3600000)) }));
  const forecast = [7, 30, 90].map(days => {
    const end = thaiDay(asOf) + days * DAY;
    const items = scheduled.filter(row => row.remaining > 0 && row.dueDate >= localDate(asOf) && row.dueDate <= localDate(new Date(end + 5 * 3600000)));
    const planRows = scopedPlans.filter(row => thaiDay(row.dueDate) >= thaiDay(asOf) && thaiDay(row.dueDate) <= end);
    const expectedReceipts = items.reduce((sum, row) => sum + row.remaining, 0);
    const plannedIncome = planRows.filter(row => row.direction === "INCOME").reduce((sum, row) => sum + row.amount, 0);
    const pendingPayout = pendingDisbursements.filter(row => row.dueDate <= localDate(new Date(end + 5 * 3600000))).reduce((sum, row) => sum + row.amount, 0);
    const plannedExpense = planRows.filter(row => row.direction === "EXPENSE").reduce((sum, row) => sum + row.amount, 0);
    return { days, expectedReceipts, plannedIncome, pendingPayout, plannedExpense, projectedCash: cash + expectedReceipts + plannedIncome - pendingPayout - plannedExpense };
  });
  const capitalRows = ledger.filter(row => ["LOAN_CAPITAL_IN", "LOAN_CAPITAL_OUT"].includes(normalizeLoanFinanceCategoryCode(row.categoryCode)));
  let running = 0;
  const capitalHistory = [...capitalRows].sort((a,b) => a.transactionDate.getTime() - b.transactionDate.getTime() || a.id.localeCompare(b.id)).map(row => { running += row.type === "INCOME" ? row.amount : -row.amount; return { ...row, balance: running }; }).reverse();
  const scopedRequests = requests.filter(row => allowed(row.companyCode));
  const investorIds = new Set([...capitalRows.map(row => row.investorId), ...scopedRequests.map(row => row.investorId)].filter(Boolean));
  return {
    unassignedContracts: access.permissions.includes("*") && !access.accessConfigured ? allContracts.filter(contract => !contractCompanyCode(contract.documentData)).map(contract => ({ id: contract.id, contractNumber: contract.contractNumber, borrower: contract.debtor, status: contract.status })) : [],
    unassignedLedger: access.permissions.includes("*") && !access.accessConfigured ? allLedger.filter(row => row.source === "LOAN" && !row.companyCode && !row.id.startsWith("repayment-") && !row.id.startsWith("loan-")).map(row => ({ id: row.id, title: row.title, amount: row.amount, transactionDate: localDate(row.transactionDate) })) : [],
    asOf: localDate(asOf), year, updatedAt: new Date().toISOString(), contracts, scheduled,
    followups: visibleFollowups, users, companies: companies.filter(row => allowed(row.companycode)),
    investors: investors.filter(investor => !access.accessConfigured || investorIds.has(investor.id) || investor.createdBy === access.session.user.id).map(({ nationalId, ...investor }) => ({ ...investor, nationalIdMasked: `*********${nationalId.slice(-4)}`, netCapital: capitalRows.filter(row => row.investorId === investor.id).reduce((sum,row) => sum + (row.type === "INCOME" ? row.amount : -row.amount),0) })),
    requests: scopedRequests, periods: periods.filter(row => allowed(row.companyCode)), reconciliations: reconciliations.filter(row => allowed(row.companyCode)), plans: scopedPlans,
    cash, capital, capitalHistory, months, forecast, pendingDisbursements, possibleDuplicates,
    unallocatedCapital: capitalRows.filter(row => !row.investorId).reduce((sum,row) => sum + (row.type === "INCOME" ? row.amount : -row.amount),0),
    ledger: ledger.map(row => ({ id: row.id, title: row.title, type: row.type, amount: row.amount, method: row.method, reference: row.reference, documentNumber: row.documentNumber, transactionDate: localDate(row.transactionDate), companyCode: row.companyCode, reversalOfId: row.reversalOfId, source: row.source })),
    canWrite: access.permissions.includes("*") || access.permissions.includes("contracts:write"),
    canAccounting: access.permissions.includes("*") || access.permissions.includes("accounting:write"),
    canApprove: access.permissions.includes("*") || (access.permissions.includes("accounting:write") && access.permissions.includes("loan:approve")),
  };
}
export type LoanOperationsData = Awaited<ReturnType<typeof getLoanOperationsData>>;
