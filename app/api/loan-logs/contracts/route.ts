import { filterLoanContracts } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("contracts", "read");
  if (denied) return denied;
  const borrowerId = new URL(request.url).searchParams.get('borrowerId')?.trim();
  if (!borrowerId) return Response.json({ error: 'กรุณาระบุผู้กู้' }, { status: 400 });

  const contracts = await filterLoanContracts(await prisma.contract.findMany({
    where: { debtorId: borrowerId },
    select: { id: true, contractNumber: true, status: true, documentData: true },
    orderBy: [{ createdAt: 'desc' }, { contractNumber: 'desc' }],
  }));
  return Response.json(contracts.map(row => ({ id: row.id, contractNumber: row.contractNumber, status: row.status })), { headers: { 'Cache-Control': 'no-store' } });
}
