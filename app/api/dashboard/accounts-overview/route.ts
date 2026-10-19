import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCompanyLedgerRows } from "@/lib/company-ledger";

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

  const params = new URL(request.url).searchParams;
  const from = dateFromInput(params.get("from"));
  const to = dateFromInput(params.get("to"));
  const [entries, companies] = await Promise.all([
    getCompanyLedgerRows(from, to),
    prisma.companySequence.findMany({
      select: { companycode: true, nameTH: true, nameEN: true, status: true },
      orderBy: { companycode: "asc" },
    }),
  ]);

  return Response.json({ entries, companies }, { headers: { "Cache-Control": "no-store" } });
}
