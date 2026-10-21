import { matchesBusinessSystem, type BusinessSystem, type BusinessSystemCompany, type BusinessSystemBranch } from "./company-system";

export function resolveFinancePlatformLocation(system: BusinessSystem, companies: readonly BusinessSystemCompany[], branches: readonly BusinessSystemBranch[]) {
  const matchedBranches = branches.filter(branch => matchesBusinessSystem(system, branch.nameTH, branch.nameEN));
  const candidates = matchedBranches.map(branch => ({ companyCode: branch.companycode, branchCode: branch.branchcode }));
  for (const company of companies) {
    if (matchesBusinessSystem(system, company.nameTH, company.nameEN) && !matchedBranches.some(branch => branch.companycode === company.companycode)) {
      candidates.push({ companyCode: company.companycode, branchCode: company.companycode });
    }
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export type FinanceUnit = {
  id: string;
  companyCode: string | null;
  branchCode: string | null;
  name: string;
  companyName: string;
  headquarters: boolean;
  system?: BusinessSystem | null;
};

export type FinanceRow = {
  unitId: string;
  date: string;
  category: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  count: number;
  opening?: boolean;
};

export type FinancePosition = {
  unitId: string;
  assetValue: number;
  assetCost: number;
  assetCount: number;
  liabilityValue: number;
  liabilityCount: number;
  receivablePrincipal: number;
  receivableInterest: number;
  receivableCount: number;
  pendingReceipts: number;
  pendingPayments: number;
  assetCategories: { category: string; value: number }[];
};

export type FinanceDashboardData = {
  generatedAt: string;
  units: FinanceUnit[];
  rows: FinanceRow[];
  positions: FinancePosition[];
};

export type CashTotals = { income: number; expense: number; net: number; opening: number; count: number };
export const emptyCashTotals = (): CashTotals => ({ income: 0, expense: 0, net: 0, opening: 0, count: 0 });
export const emptyFinancePosition = (unitId: string): FinancePosition => ({
  unitId, assetValue: 0, assetCost: 0, assetCount: 0, liabilityValue: 0, liabilityCount: 0,
  receivablePrincipal: 0, receivableInterest: 0, receivableCount: 0,
  pendingReceipts: 0, pendingPayments: 0, assetCategories: [],
});

/** Preserve integer satang and count each source transaction exactly once. */
export function summarizeFinanceRows(rows: readonly FinanceRow[]): CashTotals {
  const totals = emptyCashTotals();
  for (const row of rows) {
    if (row.opening) {
      totals.opening += row.type === "INCOME" ? row.amount : -row.amount;
      continue;
    }
    if (row.type === "INCOME") totals.income += row.amount;
    else totals.expense += row.amount;
    totals.count += row.count;
  }
  totals.net = totals.income - totals.expense;
  return totals;
}

/** Aggregate before sending to the browser; no parties, contracts or receipt IDs. */
export function compactFinanceRows(rows: readonly FinanceRow[]): FinanceRow[] {
  const grouped = new Map<string, FinanceRow>();
  for (const row of rows) {
    const key = JSON.stringify([row.unitId, row.date, row.category, row.type, Boolean(row.opening)]);
    const current = grouped.get(key);
    if (current) { current.amount += row.amount; current.count += row.count; }
    else grouped.set(key, { ...row });
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function combineFinancePositions(positions: readonly FinancePosition[]): FinancePosition {
  const combined = emptyFinancePosition("ALL");
  const categories = new Map<string, number>();
  for (const position of positions) {
    combined.assetValue += position.assetValue;
    combined.assetCost += position.assetCost;
    combined.assetCount += position.assetCount;
    combined.liabilityValue += position.liabilityValue;
    combined.liabilityCount += position.liabilityCount;
    combined.receivablePrincipal += position.receivablePrincipal;
    combined.receivableInterest += position.receivableInterest;
    combined.receivableCount += position.receivableCount;
    combined.pendingReceipts += position.pendingReceipts;
    combined.pendingPayments += position.pendingPayments;
    for (const asset of position.assetCategories) categories.set(asset.category, (categories.get(asset.category) ?? 0) + asset.value);
  }
  combined.assetCategories = [...categories].map(([category, value]) => ({ category, value }));
  return combined;
}

export function monthlyFinanceRows(rows: readonly FinanceRow[], from: string, to: string) {
  const months = new Map<string, { key: string; income: number; expense: number; net: number }>();
  const startYear = Number(from.slice(0, 4)), startMonth = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4)), endMonth = Number(to.slice(5, 7));
  for (let month = startYear * 12 + startMonth - 1; month <= endYear * 12 + endMonth - 1; month++) {
    const key = `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, "0")}`;
    months.set(key, { key, income: 0, expense: 0, net: 0 });
  }
  for (const row of rows) {
    if (row.opening || row.date < from || row.date > to) continue;
    const month = months.get(row.date.slice(0, 7));
    if (!month) continue;
    if (row.type === "INCOME") month.income += row.amount;
    else month.expense += row.amount;
    month.net = month.income - month.expense;
  }
  return [...months.values()];
}
