import "server-only";
import { getCurrentAccess } from "./authorization";
import { contractCompanyCode } from "./loan-accounting-lock";
import { prisma } from "./prisma";

type Access = Awaited<ReturnType<typeof getCurrentAccess>>;
export function canAccessLoanCompany(access: Access, companyCode: string | null) {
  return Boolean(access && (!access.accessConfigured || (companyCode && access.companyCodes.includes(companyCode))));
}
export async function filterLoanContracts<T extends { documentData: string | null }>(rows: T[]) {
  const access = await getCurrentAccess();
  return rows.filter(row => canAccessLoanCompany(access, contractCompanyCode(row.documentData)));
}
export async function authorizeLoanContract(id: string) {
  const [access, contract] = await Promise.all([getCurrentAccess(), prisma.contract.findUnique({ where: { id }, select: { documentData: true } })]);
  if (!contract || !canAccessLoanCompany(access, contractCompanyCode(contract.documentData))) return Response.json({ error: "ไม่พบสัญญาหรือไม่มีสิทธิ์บริษัทนี้" }, { status: 404 });
  return null;
}
export async function assertLoanCompanyAccess(companyCode: string | null) {
  if (!canAccessLoanCompany(await getCurrentAccess(), companyCode)) throw new Error("ไม่มีสิทธิ์เข้าถึงบริษัทของสัญญานี้");
}

export async function loanDraftCompany(dataJson: string) {
  try {
    const data = JSON.parse(dataJson);
    const branchCode = data?.documents?.branchCode;
    if (typeof branchCode !== "string" || !branchCode) return null;
    const branch = await prisma.branchCodeSequence.findUnique({ where: { branchcode: branchCode }, select: { companycode: true } });
    return branch?.companycode || null;
  } catch { return null; }
}
export async function canAccessLoanDraft(dataJson: string) {
  return canAccessLoanCompany(await getCurrentAccess(), await loanDraftCompany(dataJson));
}

export function canReadLoanFinancials(access: Access) {
  if (!access) return false;
  const has = (area: string) => access.permissions.includes("*") || access.permissions.includes(`${area}:read`) || access.permissions.includes(`${area}:write`);
  return has("contracts") && has("accounting") && (!access.accessConfigured || (access.appKeys.includes("loan") && access.appKeys.includes("dashboard")));
}

export async function authorizeLoanFile(requestUrl: string) {
  const access = await getCurrentAccess();
  if (!access) return new Response(null, { status: 401 });
  if (!access.accessConfigured) return null;
  const url = new URL(requestUrl);
  const normalize = (value: string) => { const u = new URL(value, url.origin); u.searchParams.sort(); return `${u.pathname}${u.search}`; };
  const requested = normalize(requestUrl);
  const refers = (value: unknown): boolean => {
    if (typeof value === "string") return value.startsWith("/api/") && normalize(value) === requested;
    if (Array.isArray(value)) return value.some(refers);
    if (value && typeof value === "object") return Object.values(value).some(refers);
    return false;
  };
  const [contracts, receipts, drafts] = await Promise.all([
    prisma.contract.findMany({ where: { OR: [{ documentUrl: { contains: url.pathname } }, { signatureUrl: { contains: url.pathname } }, { documentData: { contains: url.pathname } }] }, select: { documentUrl: true, signatureUrl: true, documentData: true } }),
    prisma.repayment.findMany({ where: { evidenceUrl: { contains: url.pathname } }, select: { evidenceUrl: true, contract: { select: { documentData: true } } } }),
    prisma.loanContractDraft.findMany({ where: { dataJson: { contains: url.pathname } }, select: { dataJson: true } }),
  ]);
  let linked = false;
  for (const contract of contracts) {
    let doc: unknown; try { doc = JSON.parse(contract.documentData || "{}"); } catch { doc = {}; }
    if (!refers([contract.documentUrl, contract.signatureUrl, doc])) continue;
    linked = true; if (!canAccessLoanCompany(access, contractCompanyCode(contract.documentData))) return new Response(null, { status: 404 });
  }
  for (const receipt of receipts) if (refers(receipt.evidenceUrl)) { linked = true; if (!canAccessLoanCompany(access, contractCompanyCode(receipt.contract.documentData))) return new Response(null, { status: 404 }); }
  for (const draft of drafts) { let doc: unknown; try { doc = JSON.parse(draft.dataJson); } catch { continue; } if (refers(doc)) { linked = true; if (!await canAccessLoanDraft(draft.dataJson)) return new Response(null, { status: 404 }); } }
  return linked ? null : new Response(null, { status: 404 });
}
