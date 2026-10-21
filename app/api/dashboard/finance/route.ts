import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { canReadLoanFinancials } from "@/lib/loan-access";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";
import { matchesBusinessSystem, type BusinessSystem } from "@/lib/company-system";
import { loanBalance } from "@/lib/loan-balance";
import { loanStatus } from "@/lib/loan-status";
import { ownedSatang } from "@/lib/wealth-assets";
import { compactFinanceRows, emptyFinancePosition, resolveFinancePlatformLocation, type FinanceRow, type FinanceUnit } from "@/lib/dashboard-finance";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const systems: BusinessSystem[] = ["LOAN", "CONSTRUCTION", "BUILDIN", "AGRICULTURE", "YOUTUBE", "NETFLIX"];

export async function GET() {
  const denied = await authorizeApiRequest("dashboard", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const now = new Date();
  const today = dayFormat.format(now);
  const throughToday = new Date(`${today}T00:00:00+07:00`);
  const companyFilter = access.accessConfigured ? { companyCode: { in: access.companyCodes } } : {};
  const readLoan = canReadLoanFinancials(access);
  const readYoutube = !access.accessConfigured || access.appKeys.includes("youtube");

  const [companies, branches, ledger, assets, liabilities, pending, youtube, netflix, youtubePayables, contracts] = await Promise.all([
    prisma.companySequence.findMany({ where: { type: "COMPANY" }, select: { companycode: true, nameEN: true, nameTH: true, status: true }, orderBy: { companycode: "asc" } }),
    prisma.branchCodeSequence.findMany({ where: { type: "BRANCH" }, select: { companycode: true, branchcode: true, nameEN: true, nameTH: true, status: true }, orderBy: { branchcode: "asc" } }),
    getCompanyLedgerRows(null, throughToday),
    prisma.wealthAsset.findMany({ where: { status: "ACTIVE", ...companyFilter }, select: { companyCode: true, branchCode: true, category: true, currentValue: true, acquisitionCost: true, ownershipBps: true } }),
    prisma.wealthLiability.findMany({ where: { status: "ACTIVE", ...companyFilter }, select: { companyCode: true, outstandingAmount: true } }),
    prisma.companyLedgerEntry.findMany({ where: { settlementStatus: { in: ["APPROVED", "PENDING_APPROVAL", "PENDING_PAYMENT", "PENDING_RECEIPT"] }, ...companyFilter }, select: { companyCode: true, branchCode: true, type: true, amount: true, financeCategory: { select: { code: true } } } }),
    readYoutube ? prisma.youtubeLedgerEntry.findMany({ where: { voidedAt: null, transactionOn: { lte: today }, source: { notIn: ["REVERSAL", "REVERSAL_OPENING"] } }, select: { source: true, type: true, title: true, amountSatang: true, transactionOn: true } }) : Promise.resolve([]),
    prisma.netflixLedgerEntry.findMany({ where: { OR: [{ status: "PAID", transactionOn: { lte: today } }, { status: { in: ["APPROVED", "PENDING_APPROVAL", "PENDING_PAYMENT", "PENDING_RECEIPT"] } }] }, select: { source: true, status: true, type: true, category: true, amountSatang: true, transactionOn: true } }),
    readYoutube ? prisma.youtubePayable.findMany({ where: { status: { in: ["APPROVED", "PENDING_APPROVAL"] } }, select: { amountSatang: true } }) : Promise.resolve([]),
    readLoan ? prisma.contract.findMany({ select: { documentData: true, status: true, contractType: true, signatureMode: true, signedAt: true, principal: true, interestRate: true, interestAmount: true, interestMode: true, interestRateBasis: true, startDate: true, dueDate: true, lateFeePerDay: true, lateFeeWaived: true, installmentMonths: true, repayType: true, payments: { select: { type: true, amount: true, paidAt: true } } } }) : Promise.resolve([]),
  ]);

  const companyByCode = new Map(companies.map(company => [company.companycode, company]));
  const branchByCode = new Map(branches.map(branch => [branch.branchcode, branch]));
  const units = new Map<string, FinanceUnit>();
  const positions = new Map<string, ReturnType<typeof emptyFinancePosition>>();
  const rows: FinanceRow[] = [];

  function location(companyCode: string | null, branchCode: string | null): string | null {
    companyCode ||= branchCode ? branchByCode.get(branchCode)?.companycode ?? null : null;
    if (access!.accessConfigured && (!companyCode || !access!.companyCodes.includes(companyCode))) return null;
    const headquarters = !branchCode || branchCode === companyCode;
    const id = companyCode ? `${companyCode}:${headquarters ? companyCode : branchCode}` : "UNASSIGNED";
    if (!units.has(id)) {
      const company = companyCode ? companyByCode.get(companyCode) : null;
      const branch = branchCode ? branchByCode.get(branchCode) : null;
      const companyName = company?.nameEN || company?.nameTH || companyCode || "ไม่ระบุบริษัท";
      const identity = headquarters ? company : branch;
      units.set(id, { id, companyCode, branchCode: headquarters ? companyCode : branchCode, companyName, headquarters,
        system: systems.find(system => matchesBusinessSystem(system, identity?.nameTH, identity?.nameEN)) ?? null,
        name: !companyCode ? "ไม่ระบุบริษัท / สาขา" : headquarters ? `${companyName} · สำนักงานใหญ่` : branch?.nameEN || branch?.nameTH || `สาขา ${branchCode}` });
      positions.set(id, emptyFinancePosition(id));
    }
    return id;
  }

  for (const company of companies) {
    if (company.status === "ACTIVE") location(company.companycode, null);
  }
  for (const branch of branches) {
    if (branch.status === "ACTIVE") location(branch.companycode, branch.branchcode);
  }

  // Platform ledgers have no company key. Resolve against the complete masterdata
  // before applying permissions; never guess between multiple registered units.
  function platformLocation(system: BusinessSystem) {
    const resolved = resolveFinancePlatformLocation(system, companies, branches);
    if (resolved) return location(resolved.companyCode, resolved.branchCode);
    if (access!.accessConfigured) return null;
    const id = `UNASSIGNED:${system}`;
    units.set(id, { id, companyCode: null, branchCode: null, companyName: "ไม่ระบุบริษัท", name: `${system} · ไม่ระบุบริษัท`, headquarters: false, system });
    positions.set(id, emptyFinancePosition(id));
    return id;
  }

  // Legacy loan records have an explicit Loan source but no location fields.
  // Attach only when global masterdata identifies exactly one Loan unit.
  const loanId = readLoan && (contracts.length || ledger.some(entry => entry.source === "LOAN")) ? platformLocation("LOAN") : null;
  for (const entry of ledger) {
    if (!readLoan && entry.source === "LOAN") continue;
    const unitId = entry.source === "LOAN" && !entry.companyCode && !entry.branchCode ? loanId : location(entry.companyCode, entry.branchCode);
    if (unitId) rows.push({ unitId, date: dayFormat.format(entry.transactionDate), category: entry.category || "อื่น ๆ", type: entry.type, amount: entry.amount, count: 1 });
  }
  const youtubeId = readYoutube && (youtube.length || youtubePayables.length) ? platformLocation("YOUTUBE") : null;
  if (youtubeId) {
    for (const entry of youtube) {
      if (entry.type !== "INCOME" && entry.type !== "EXPENSE") continue;
      rows.push({ unitId: youtubeId, date: entry.transactionOn, category: entry.source === "MEMBER_PAYMENT" ? "ค่าสมาชิก YouTube" : entry.title, type: entry.type, amount: entry.amountSatang, count: 1, opening: entry.source === "OPENING" });
    }
    positions.get(youtubeId)!.pendingPayments += youtubePayables.reduce((sum, item) => sum + item.amountSatang, 0);
  }
  const netflixId = netflix.length ? platformLocation("NETFLIX") : null;
  if (netflixId) {
    for (const entry of netflix) {
      if (entry.type !== "INCOME" && entry.type !== "EXPENSE") continue;
      if (entry.status === "PAID") rows.push({ unitId: netflixId, date: entry.transactionOn, category: entry.category || "ค่าสมาชิก Netflix", type: entry.type, amount: entry.amountSatang, count: 1, opening: entry.source === "OPENING" });
      else positions.get(netflixId)![entry.type === "INCOME" ? "pendingReceipts" : "pendingPayments"] += entry.amountSatang;
    }
  }
  for (const entry of pending) {
    if (!readLoan && isLoanFinanceCategoryCode(entry.financeCategory?.code ?? "")) continue;
    const unitId = isLoanFinanceCategoryCode(entry.financeCategory?.code ?? "") && !entry.companyCode && !entry.branchCode ? loanId : location(entry.companyCode, entry.branchCode);
    if (unitId) positions.get(unitId)![entry.type === "INCOME" ? "pendingReceipts" : "pendingPayments"] += entry.amount;
  }
  for (const asset of assets) {
    const unitId = location(asset.companyCode, asset.branchCode);
    if (!unitId) continue;
    const position = positions.get(unitId)!;
    const value = ownedSatang(Number(asset.currentValue), asset.ownershipBps);
    position.assetValue += value;
    position.assetCost += ownedSatang(Number(asset.acquisitionCost), asset.ownershipBps);
    position.assetCount++;
    const category = position.assetCategories.find(item => item.category === asset.category);
    if (category) category.value += value;
    else position.assetCategories.push({ category: asset.category, value });
  }
  for (const liability of liabilities) {
    // The liability register is company-level; it does not record a branch.
    const unitId = location(liability.companyCode, null);
    if (unitId) {
      positions.get(unitId)!.liabilityValue += Number(liability.outstandingAmount);
      positions.get(unitId)!.liabilityCount++;
    }
  }
  for (const contract of contracts) {
    const status = loanStatus(contract, now);
    if (status !== "ACTIVE" && status !== "OVERDUE") continue;
    let document: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(contract.documentData || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) document = parsed as Record<string, unknown>;
    } catch { /* A legacy location is inferred only for an unambiguous Loan unit. */ }
    const companyCode = typeof document.companyCode === "string" ? document.companyCode : null;
    const branchCode = typeof document.branchCode === "string" ? document.branchCode : null;
    const unitId = !companyCode && !branchCode ? loanId : location(companyCode, branchCode);
    if (!unitId) continue;
    const balance = loanBalance({ ...contract, status }, now);
    if (balance.total <= 0) continue;
    positions.get(unitId)!.receivablePrincipal += balance.principal;
    positions.get(unitId)!.receivableInterest += balance.interest;
    positions.get(unitId)!.receivableCount++;
  }

  return Response.json({ generatedAt: now.toISOString(), units: [...units.values()], rows: compactFinanceRows(rows), positions: [...positions.values()] }, { headers: { "Cache-Control": "no-store" } });
}
