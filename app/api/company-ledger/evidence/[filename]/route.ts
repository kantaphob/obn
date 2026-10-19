import { readFile } from "node:fs/promises";
import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { isUploadUrl, storedUploadPath } from "@/lib/borrower-file-storage";
import { prisma } from "@/lib/prisma";

const API_ROUTE = "/api/company-ledger/evidence";
const STORAGE_AREA = "company-ledger-evidence";
const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const denied = await authorizeApiRequest("accounting", "read");
  if (denied) return denied;
  const { filename } = await params;
  if (!/^[A-Za-z0-9ก-๛._-]+\.(jpg|png|webp|pdf)$/i.test(filename)) return new Response(null, { status: 404 });
  const requestedUrl = new URL(request.url);
  const relativeUrl = `${requestedUrl.pathname}${requestedUrl.search}`;
  if (!isUploadUrl(relativeUrl, API_ROUTE, Object.keys(CONTENT_TYPES).map((type) => type))) return new Response(null, { status: 404 });

  const access = await getCurrentAccess();
  const entry = await prisma.companyLedgerEntry.findFirst({ where: { attachmentUrl: relativeUrl }, select: { companyCode: true } });
  if (!entry || (access?.accessConfigured && (!entry.companyCode || !access.companyCodes.includes(entry.companyCode)))) {
    return new Response(null, { status: 404 });
  }
  try {
    const data = await readFile(storedUploadPath(STORAGE_AREA, relativeUrl));
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    return new Response(data, { headers: { "Content-Type": CONTENT_TYPES[extension], "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
