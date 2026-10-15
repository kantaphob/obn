export type CompanyLedgerTotals = { income: number; expense: number; net: number };

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
