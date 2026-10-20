export type CompanyLedgerTotals = { income: number; expense: number; net: number };

export function normalizeLoanFinanceCategoryCode(code: string): string {
  const legacyCodes: Record<string, string> = {
    LEGACY_CAPITAL_START: "LOAN_CAPITAL_IN",
    LEGACY_CAPITAL_WITHDRAWAL: "LOAN_CAPITAL_OUT",
    LEGACY_LOAN_DISBURSEMENT: "LOAN_DISBURSEMENT",
    LEGACY_INTEREST_RECEIVED: "LOAN_INTEREST",
    LEGACY_LOAN_RECEIPT: "LOAN_RECEIPT",
  };
  return legacyCodes[code] ?? code;
}

export function isLoanFinanceCategoryCode(code: string): boolean {
  return code.startsWith("LOAN_") || code.startsWith("LEGACY_");
}

// Receipt totals already include their principal, interest, and penalty components.
// These components classify cash received; they must not be added to cash income again.
export function summarizeLoanFinanceRows(rows: ReadonlyArray<{
  type: "INCOME" | "EXPENSE";
  amount: number;
  categoryCode: string;
  reversalOfType?: string | null;
  loanReceiptBreakdown?: { principal: number; interest: number; penalty: number };
}>) {
  const totals = { principalReceived: 0, interestReceived: 0, penaltyReceived: 0, capitalReceived: 0, unallocatedReceipts: 0, otherIncome: 0, disbursed: 0, capitalWithdrawn: 0, operatingExpenses: 0 };
  for (const original of rows) {
    const row = original.reversalOfType === "INCOME" || original.reversalOfType === "EXPENSE" ? { ...original, type: original.reversalOfType, amount: -original.amount, loanReceiptBreakdown: original.loanReceiptBreakdown ? { principal: -original.loanReceiptBreakdown.principal, interest: -original.loanReceiptBreakdown.interest, penalty: -original.loanReceiptBreakdown.penalty } : undefined } : original;
    const categoryCode = normalizeLoanFinanceCategoryCode(row.categoryCode);
    if (row.type === "INCOME") {
      if (row.loanReceiptBreakdown) {
        totals.principalReceived += row.loanReceiptBreakdown.principal;
        totals.interestReceived += row.loanReceiptBreakdown.interest;
        totals.penaltyReceived += row.loanReceiptBreakdown.penalty;
      } else if (categoryCode === "LOAN_PRINCIPAL") totals.principalReceived += row.amount;
      else if (categoryCode === "LOAN_INTEREST") totals.interestReceived += row.amount;
      else if (categoryCode === "LOAN_PENALTY") totals.penaltyReceived += row.amount;
      else if (categoryCode === "LOAN_CAPITAL_IN") totals.capitalReceived += row.amount;
      else if (categoryCode === "LOAN_RECEIPT") totals.unallocatedReceipts += row.amount;
      else totals.otherIncome += row.amount;
    } else if (categoryCode === "LOAN_DISBURSEMENT") totals.disbursed += row.amount;
    else if (categoryCode === "LOAN_CAPITAL_OUT") totals.capitalWithdrawn += row.amount;
    else totals.operatingExpenses += row.amount;
  }
  return totals;
}

export function summarizeCompanyLedgerRows(
  rows: ReadonlyArray<{ type: "INCOME" | "EXPENSE"; amount: number }>,
): CompanyLedgerTotals {
  const totals = rows.reduce((sum, row) => {
    if (row.type === "INCOME") sum.income += row.amount;
    else sum.expense += row.amount;
    return sum;
  }, { income: 0, expense: 0, net: 0 });
  totals.net = totals.income - totals.expense;
  return totals;
}
