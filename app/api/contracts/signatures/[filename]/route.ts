import { authorizeLoanFile } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { readFile } from "node:fs/promises";
import { storedUploadPath } from "@/lib/borrower-file-storage";

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const denied = await authorizeApiRequest("contracts", "read");
  if (denied) return denied;
  const fileDenied = await authorizeLoanFile(_request.url); if (fileDenied) return fileDenied;
  const { filename } = await params;
  if (!/^[A-Za-z0-9ก-๛._-]+\.png$/i.test(filename)) {
    return Response.json({ error: "ไม่พบลายเซ็น" }, { status: 404 });
  }
  try {
    const image = await readFile(storedUploadPath("contract-signatures", _request.url));
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "ไม่พบลายเซ็น" }, { status: 404 });
  }
}
