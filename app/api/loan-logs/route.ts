import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("logs", "read");
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('th') ?? '';
  const logs = await prisma.loanlogs.findMany({ orderBy: { createdAt: 'desc' } });
  const borrowerIds = [...new Set(logs.map(log => log.borrowerId))];
  const contractIds = [...new Set(logs.flatMap(log => log.contractId ? [log.contractId] : []))];
  const userIds = [...new Set(logs.map(log => log.userId).filter(id => id && id !== 'guest'))];
  const [borrowers, contracts, users] = await Promise.all([
    borrowerIds.length ? prisma.borrowers.findMany({ where: { id: { in: borrowerIds } }, select: { id: true, borrowersCode: true, prefixTH: true, firstName: true, lastName: true, nickname: true } }) : [],
    contractIds.length ? prisma.contract.findMany({ where: { id: { in: contractIds } }, select: { id: true, contractNumber: true } }) : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true, profile: { select: { firstName: true, lastName: true } } } }) : [],
  ]);
  const borrowerById = new Map(borrowers.map(row => [row.id, row]));
  const contractById = new Map(contracts.map(row => [row.id, row]));
  const userById = new Map(users.map(row => [row.id, row]));
  const rows = logs.map(log => {
    const borrower = borrowerById.get(log.borrowerId);
    return {
      ...log,
      userId: log.userId || 'guest',
      actorName: (() => {
        const user = userById.get(log.userId);
        return user ? [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') || user.name || user.username || 'ผู้ใช้' : log.userId === 'guest' ? 'ไม่ระบุผู้ใช้' : 'ผู้ใช้ที่ไม่อยู่ในระบบ';
      })(),
      borrower: borrower ? { ...borrower, borrowersCode: formatBorrowerCode(borrower.borrowersCode) } : null,
      contract: log.contractId ? contractById.get(log.contractId) ?? null : null,
    };
  }).filter(log => !query || [log.action, log.note, log.borrower?.borrowersCode, log.borrower?.firstName, log.borrower?.lastName, log.borrower?.nickname, log.contract?.contractNumber].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(query));

  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}
