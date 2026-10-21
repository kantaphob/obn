import { billingToday, isBillingDate } from "./youtube-billing";
export function youtubeReceiptWhere(search: URLSearchParams) {
  const q = (search.get("q") || "").trim().slice(0, 150);
  const groupId = search.get("group") || "";
  const method = search.get("method") || "ALL";
  const from = search.get("from"); const to = search.get("to");
  const today = billingToday();
  return { voidedAt: null, ...(groupId ? { groupId } : {}), ...(method !== "ALL" ? { paymentMethod: method } : {}), paidOn: { ...(isBillingDate(from) ? { gte: from } : {}), lte: isBillingDate(to) && to <= today ? to : today }, ...(q ? { OR: ["memberName", "groupName", "email", "reference", "note"].map((field) => ({ [field]: { contains: q } })) } : {}) };
}
