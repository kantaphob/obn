import { isBillingDate } from "./youtube-billing";

export function youtubeAuditFilters(search: { q?: string; entity?: string; from?: string; to?: string }) {
  const q = (search.q || "").trim().slice(0, 150);
  const entity = ["GROUP", "SEAT", "MEMBER", "PAYMENT", "LEDGER", "CHARGE", "INVOICE", "PAYABLE"].includes(search.entity || "") ? search.entity : undefined;
  const from = isBillingDate(search.from) ? search.from : "";
  const to = isBillingDate(search.to) ? search.to : "";
  const range = from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+07:00`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000) } : {}) } } : {};
  return {
    q, entity, from, to,
    eventsWhere: { ...range, ...(entity ? { entityType: entity } : {}), ...(q ? { OR: [{ entityLabel: { contains: q } }, { summary: { contains: q } }, { actorName: { contains: q } }] } : {}) },
    historyWhere: { ...range, ...(entity ? { entityType: entity } : {}), ...(q ? { OR: [{ entityId: { contains: q } }, { beforeJson: { contains: q } }, { afterJson: { contains: q } }] } : {}) },
  };
}
