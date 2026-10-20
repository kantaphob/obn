export type LoanClosingSnapshot = {
  version: 1;
  from: string | null;
  through: string;
  capturedAt: string;
  income: number;
  expense: number;
  cashBalance: number;
  difference: number | null;
  reconciliationId: string | null;
};

export function readLoanClosingSnapshot(value: string | null): LoanClosingSnapshot | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value);
    if (data.version !== 1 || ![data.income, data.expense, data.cashBalance].every(Number.isSafeInteger)
      || (data.difference !== null && !Number.isSafeInteger(data.difference))
      || typeof data.through !== "string" || typeof data.capturedAt !== "string"
      || (data.from !== null && typeof data.from !== "string")
      || (data.reconciliationId !== null && typeof data.reconciliationId !== "string")) return null;
    return data as LoanClosingSnapshot;
  } catch { return null; }
}
