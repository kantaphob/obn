import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const borrowerId = new URL(request.url).searchParams.get('borrowerId')?.trim();
  if (!borrowerId) return Response.json({ error: 'กรุณาระบุผู้กู้' }, { status: 400 });

  const contracts = await prisma.contract.findMany({
    where: { debtorId: borrowerId },
    select: { id: true, contractNumber: true, status: true },
    orderBy: [{ createdAt: 'desc' }, { contractNumber: 'desc' }],
  });
  return Response.json(contracts, { headers: { 'Cache-Control': 'no-store' } });
}
