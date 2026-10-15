const MAX_SATANG = 2_147_483_647;

export function calculateCompanyLedgerTax(
  type: "INCOME" | "EXPENSE",
  baseAmount: unknown,
  vatRateBps: unknown,
  whtRateBps: unknown,
) {
  if (!Number.isSafeInteger(baseAmount) || Number(baseAmount) <= 0 || Number(baseAmount) > MAX_SATANG) return null;
  const validRate = (value: unknown) => value === null || value === undefined
    || (Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 10_000);
  if (!validRate(vatRateBps) || !validRate(whtRateBps) || (type === "INCOME" && whtRateBps != null)) return null;

  const base = Number(baseAmount);
  const vatRate = vatRateBps == null ? null : Number(vatRateBps);
  const whtRate = whtRateBps == null ? null : Number(whtRateBps);
  const vatAmount = vatRate === null ? null : Math.round(base * vatRate / 10_000);
  const whtAmount = whtRate === null ? null : Math.round(base * whtRate / 10_000);
  const amount = base + (vatAmount ?? 0) - (whtAmount ?? 0);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_SATANG) return null;
  return { amount, baseAmount: base, vatRateBps: vatRate, vatAmount, whtRateBps: whtRate, whtAmount };
}
