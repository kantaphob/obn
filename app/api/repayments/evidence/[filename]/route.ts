import { authorizeLoanFile } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { readFile } from 'node:fs/promises';
import { storedUploadPath } from '@/lib/borrower-file-storage';
export async function GET(_request: Request, { params }: {
    params: Promise<{
        filename: string;
    }>;
}) {
  const denied = await authorizeApiRequest("repayments", "read");
  if (denied) return denied;
  const fileDenied = await authorizeLoanFile(_request.url); if (fileDenied) return fileDenied;
    const { filename } = await params;
    if (!/^[A-Za-z0-9ก-๛._-]+\.(jpg|png|webp|pdf)$/i.test(filename))
        return new Response(null, { status: 404 });
    try {
        const data = await readFile(storedUploadPath('repayment-evidence', _request.url));
        const types: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
        return new Response(data, { headers: { 'Content-Type': types[filename.split('.').pop()!], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch {
        return new Response(null, { status: 404 });
    }
}
