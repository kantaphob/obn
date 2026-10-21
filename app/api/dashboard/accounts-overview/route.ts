import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { canReadLoanFinancials } from "@/lib/loan-access";

function dateFromInput(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return Number.isNaN(date.getTime()) || localDate !== value ? null : date;
}

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("dashboard", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const from = dateFromInput(params.get("from"));
  const to = dateFromInput(params.get("to"));
  const companyScope = access.accessConfigured ? access.companyCodes : null;
  const canReadLoan = canReadLoanFinancials(access);
  const [entries, companies, branches] = await Promise.all([
    getCompanyLedgerRows(from, to),
    prisma.companySequence.findMany({
      where: { type: "COMPANY", ...(companyScope ? { companycode: { in: companyScope } } : {}) },
      select: { companycode: true, nameTH: true, nameEN: true, status: true },
      orderBy: { companycode: "asc" },
    }),
    prisma.branchCodeSequence.findMany({
      where: { type: "BRANCH", status: "ACTIVE", ...(companyScope ? { companycode: { in: companyScope } } : {}) },
      select: { companycode: true, branchcode: true, nameTH: true, nameEN: true },
      orderBy: [{ companycode: "asc" }, { branchcode: "asc" }],
    }),
  ]);

  // Ledger sources include legacy records whose company code is stored in linked
  // contract metadata. Apply the user's allowed company scope before serializing
  // any data to the browser. Configured users cannot see unassigned legacy rows.
  const scopedEntries = companyScope
    ? entries.filter((entry) => Boolean(entry.companyCode && companyScope.includes(entry.companyCode)))
    : entries;
  const visibleEntries = canReadLoan ? scopedEntries : scopedEntries.filter((entry) => entry.source !== "LOAN");

  return Response.json({ entries: visibleEntries, companies, branches }, { headers: { "Cache-Control": "no-store" } });
}
