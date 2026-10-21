/** Calendar dates are stored as YYYY-MM-DD in the Bangkok billing timezone. */
export function billingToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function isBillingDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01" || value > "2199-12-31") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function nextBillingDate(date: string, months: number, anchorDay?: number | null) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(anchorDay || day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function unpaidBillingRounds(seat: { nextDueDate: string | null; billingMonths: number | null; priceSatang: number | null; billingAnchorDay?: number | null }, today: string) {
  if (!seat.nextDueDate || !isBillingDate(seat.nextDueDate) || !isBillingDate(today) || !seat.billingMonths || ![1, 3, 5].includes(seat.billingMonths) || !seat.priceSatang || seat.priceSatang < 0) return { count: 0, amountSatang: 0 };
  let count = 0;
  const anchorDay = seat.billingAnchorDay || Number(seat.nextDueDate.slice(8));
  for (let due = seat.nextDueDate; due <= today; due = nextBillingDate(due, seat.billingMonths, anchorDay)) count++;
  return { count, amountSatang: count * seat.priceSatang };
}
export function formatBillingDate(date: string | null) {
  return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "ยังไม่กำหนด";
}
export function scheduledAmount(seats: { nextDueDate: string | null; priceSatang: number | null; billingMonths: number | null; billingAnchorDay?: number | null; displayName: string | null; email: string | null }[], month: string) {
  let total = 0;
  for (const seat of seats) {
    if (!(seat.displayName || seat.email) || !seat.nextDueDate || !seat.priceSatang || !seat.billingMonths || ![1, 3, 5].includes(seat.billingMonths)) continue;
    let due = seat.nextDueDate;
    const anchorDay = seat.billingAnchorDay || Number(due.slice(8));
    // Include every unpaid scheduled cycle falling in the selected month.
    while (due.slice(0, 7) <= month) {
      if (due.slice(0, 7) === month) total += seat.priceSatang;
      due = nextBillingDate(due, seat.billingMonths, anchorDay);
    }
  }
  return total;
}

export function cyclePriceBaht(monthlyPriceBaht: string, months: number) {
  if (!monthlyPriceBaht.trim()) return "";
  const monthlySatang = Math.round(Number(monthlyPriceBaht) * 100);
  return Number.isFinite(monthlySatang) ? (monthlySatang * months / 100).toFixed(2) : "";
}
export function groupBillingDate(date: string, dueDay: number) {
  return date && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? nextBillingDate(`${date.slice(0, 7)}-01`, 0, dueDay) : date;
}

/** Start with the latest group cutoff, then add the member's payment cycle. */
export function automaticBillingDate(today: string, dueDay: number, cycleMonths: number) {
  if (!isBillingDate(today) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || ![1, 3, 5].includes(cycleMonths)) return "";
  let cutoff = groupBillingDate(today, dueDay);
  if (cutoff > today) cutoff = nextBillingDate(cutoff, -1, dueDay);
  return nextBillingDate(cutoff, cycleMonths, dueDay);
}

export function splitGroupMonthlyPrice<T extends { memberId: string; cycleMonths: number; monthlyPriceBaht: string; priceBaht: string; paymentExempt?: boolean }>(accounts: T[], groupPriceBaht: string): T[] {
  const total = Math.round(Number(groupPriceBaht) * 100);
  const normalized = accounts.map((entry) => entry.memberId && entry.paymentExempt ? { ...entry, monthlyPriceBaht: "0.00", priceBaht: "0.00" } : entry);
  const count = normalized.filter((entry) => entry.memberId && !entry.paymentExempt).length;
  if (!Number.isFinite(total) || total <= 0 || !count) return normalized;
  const monthlyPriceBaht = Math.ceil(total / (count * 100)).toFixed(2);
  return normalized.map((entry) => {
    if (!entry.memberId || entry.paymentExempt) return entry;
    return { ...entry, monthlyPriceBaht, priceBaht: cyclePriceBaht(monthlyPriceBaht, entry.cycleMonths) };
  });
}

/** Keep entered prices, and assign only the remaining budget to automatic slots. */
export function allocateRemainingMonthlyPrice<T extends { memberId: string; cycleMonths: number; monthlyPriceBaht: string; priceBaht: string; paymentExempt?: boolean; remainingShare?: boolean }>(accounts: T[], groupPriceBaht: string): T[] {
  const total = Math.round(Number(groupPriceBaht) * 100);
  if (!Number.isFinite(total) || total <= 0) return accounts;
  const automatic = (entry: T) => Boolean(entry.memberId && !entry.paymentExempt && (entry.remainingShare || !entry.monthlyPriceBaht.trim()));
  const count = accounts.filter(automatic).length;
  if (!count) return accounts;
  const assigned = accounts.reduce((sum, entry) => sum + (entry.memberId && !entry.paymentExempt && !automatic(entry) ? Math.round((Number(entry.monthlyPriceBaht) || 0) * 100) : 0), 0);
  const remaining = Math.max(0, total - assigned);
  const monthlyPriceBaht = Math.ceil(remaining / (count * 100)).toFixed(2);
  return accounts.map((entry) => {
    if (!automatic(entry)) return entry;
    return { ...entry, monthlyPriceBaht, priceBaht: cyclePriceBaht(monthlyPriceBaht, entry.cycleMonths) };
  });
}

export function groupPeriodSummary(startedOn: string | null, dueDay: number | null, monthlyPriceSatang: number | null, today: string) {
  if (!startedOn || !isBillingDate(startedOn) || !dueDay || !isBillingDate(today)) return { periods: 0, costSatang: 0, firstCutoff: null };
  let firstCutoff = groupBillingDate(startedOn, dueDay);
  if (firstCutoff < startedOn) firstCutoff = nextBillingDate(firstCutoff, 1, dueDay);
  let date = firstCutoff;
  let periods = 0;
  while (date <= today) { periods++; date = nextBillingDate(date, 1, dueDay); }
  return { periods, costSatang: periods * (monthlyPriceSatang ?? 0), firstCutoff };
}
export function memberDueFromStart(startedOn: string | null, today: string, dueDay: number, cycleMonths: number) {
  if (![1, 3, 5].includes(cycleMonths) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return "";
  // Prepayment: the first collection is due at the start, regardless of cycle length.
  if (startedOn) return groupPeriodSummary(startedOn, dueDay, null, today).firstCutoff || "";
  if (!isBillingDate(today)) return "";
  const cutoff = groupBillingDate(today, dueDay);
  return cutoff >= today ? cutoff : nextBillingDate(cutoff, 1, dueDay);
}

export function prepaidGroupSummary(startedOn: string | null, dueDay: number | null, monthlyPriceSatang: number | null, today: string) {
  const summary = groupPeriodSummary(startedOn, dueDay, monthlyPriceSatang, today);
  if (!summary.firstCutoff || !dueDay) return { ...summary, latestPaymentDate: null, nextPaymentDate: null, coveredThrough: null, recentPayments: [] as { date: string; amountSatang: number; cumulativeSatang: number }[] };
  const nextPaymentDate = nextBillingDate(summary.firstCutoff, summary.periods, dueDay);
  const through = new Date(`${nextPaymentDate}T00:00:00Z`);
  through.setUTCDate(through.getUTCDate() - 1);
  const recentPayments = Array.from({ length: Math.min(summary.periods, 12) }, (_, offset) => {
    const period = summary.periods - Math.min(summary.periods, 12) + offset;
    return { date: nextBillingDate(summary.firstCutoff!, period, dueDay), amountSatang: monthlyPriceSatang ?? 0, cumulativeSatang: (period + 1) * (monthlyPriceSatang ?? 0) };
  });
  return { ...summary, latestPaymentDate: summary.periods ? nextBillingDate(summary.firstCutoff, summary.periods - 1, dueDay) : null, nextPaymentDate, coveredThrough: summary.periods ? through.toISOString().slice(0, 10) : null, recentPayments };
}
