import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('th') ?? '';
  const logs = await prisma.loanlogs.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const borrowerIds = [...new Set(logs.map(log => log.borrowerId))];
  const contractIds = [...new Set(logs.flatMap(log => log.contractId ? [log.contractId] : []))];
  const [borrowers, contracts] = await Promise.all([
    borrowerIds.length ? prisma.borrowers.findMany({ where: { id: { in: borrowerIds } }, select: { id: true, borrowersCode: true, prefixTH: true, firstName: true, lastName: true, nickname: true } }) : [],
    contractIds.length ? prisma.contract.findMany({ where: { id: { in: contractIds } }, select: { id: true, contractNumber: true } }) : [],
  ]);
  const borrowerById = new Map(borrowers.map(row => [row.id, row]));
  const contractById = new Map(contracts.map(row => [row.id, row]));
  const rows = logs.map(log => {
    const borrower = borrowerById.get(log.borrowerId);
    return {
      ...log,
      userId: log.userId || 'guest',
      borrower: borrower ? { ...borrower, borrowersCode: formatBorrowerCode(borrower.borrowersCode) } : null,
      contract: log.contractId ? contractById.get(log.contractId) ?? null : null,
    };
  }).filter(log => !query || [log.action, log.note, log.borrower?.borrowersCode, log.borrower?.firstName, log.borrower?.lastName, log.borrower?.nickname, log.contract?.contractNumber].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(query));

  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') return Response.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const borrowerId = typeof input.borrowerId === 'string' ? input.borrowerId.trim() : '';
  const contractId = typeof input.contractId === 'string' ? input.contractId.trim() : '';
  const action = typeof input.action === 'string' ? input.action.trim() : '';
  const note = typeof input.note === 'string' ? input.note.trim() : '';

  if (!borrowerId) return Response.json({ error: 'กรุณาเลือกผู้กู้' }, { status: 400 });
  if (!action || action.length > 100) return Response.json({ error: 'กรุณาระบุการทำงาน (ไม่เกิน 100 ตัวอักษร)' }, { status: 400 });
  if (note.length > 2000) return Response.json({ error: 'หมายเหตุยาวเกิน 2,000 ตัวอักษร' }, { status: 400 });

  const borrower = await prisma.borrowers.findUnique({ where: { id: borrowerId }, select: { id: true } });
  if (!borrower) return Response.json({ error: 'ไม่พบผู้กู้ที่เลือก' }, { status: 404 });
  if (contractId) {
    const contract = await prisma.contract.findFirst({ where: { id: contractId, debtorId: borrowerId }, select: { id: true } });
    if (!contract) return Response.json({ error: 'สัญญาที่เลือกไม่ตรงกับผู้กู้' }, { status: 400 });
  }

  const log = await prisma.loanlogs.create({ data: { userId: 'guest', borrowerId, contractId: contractId || null, targetId: borrowerId, type: 'MANUAL', action, note: note || null } });
  return Response.json(log, { status: 201 });
}
