import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query || query.length < 2) return Response.json([]);

  const borrowers = await prisma.borrowers.findMany({
    where: { OR: [
      { borrowersCode: { contains: query.toLowerCase() } },
      { borrowersCode: { contains: query.toUpperCase() } },
      { firstName: { contains: query } },
      { lastName: { contains: query } },
      { nickname: { contains: query } },
    ] },
    select: { id: true, borrowersCode: true, prefixTH: true, firstName: true, lastName: true, nickname: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  return Response.json(borrowers.map(borrower => ({ ...borrower, borrowersCode: formatBorrowerCode(borrower.borrowersCode) })), { headers: { 'Cache-Control': 'no-store' } });
}
