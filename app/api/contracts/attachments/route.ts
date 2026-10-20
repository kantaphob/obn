import { authorizeLoanContract } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';
import { saveBorrowerFile } from '@/lib/borrower-file-storage';
export async function POST(request: Request) {
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
    const body = await request.formData().catch(() => null), file = body?.get('file');
    const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
    if (!(file instanceof File) || !types[file.type] || file.size < 1 || file.size > 10 * 1024 * 1024)
        return Response.json({ error: 'รองรับ JPG, PNG, WebP หรือ PDF ไม่เกิน 10 MB' }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer());
    const valid = file.type === 'application/pdf' ? data.subarray(0, 5).toString() === '%PDF-' : file.type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 : file.type === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
    if (!valid)
        return Response.json({ error: 'ชนิดไฟล์ไม่ตรงกับเนื้อหา' }, { status: 400 });
    const contractId = body?.get('contractId');
    if (typeof contractId === 'string' && contractId) { const scopeDenied = await authorizeLoanContract(contractId); if (scopeDenied) return scopeDenied; }
    const borrowerId = body?.get('borrowerId');
    const contractNumber = body?.get('contractNumber');
    const contract = typeof contractId === 'string' && contractId
      ? await prisma.contract.findUnique({ where: { id: contractId }, include: { debtor: { select: { borrowersCode: true } } } })
      : null;
    const borrower = contract?.debtor ?? (typeof borrowerId === 'string' && borrowerId
      ? await prisma.borrowers.findUnique({ where: { id: borrowerId }, select: { borrowersCode: true } })
      : null);
    if (!borrower) return Response.json({ error: 'กรุณาเลือกผู้กู้ก่อนแนบเอกสาร' }, { status: 400 });
    const resolvedContractNumber = contract?.contractNumber || (typeof contractNumber === 'string' && contractNumber.trim() ? contractNumber : 'DRAFT');
    const saved = await saveBorrowerFile({ storageArea: 'contract-attachments', borrowerCode: formatBorrowerCode(borrower.borrowersCode), contractNumber: resolvedContractNumber, extension: types[file.type], apiRoute: '/api/contracts/attachments', data });
    return Response.json({ url: saved.url }, { status: 201 });
}
