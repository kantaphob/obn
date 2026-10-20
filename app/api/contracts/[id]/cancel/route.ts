import { authorizeLoanContract } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { ContractStatus } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

const cancellableStatuses: ContractStatus[] = [
  ContractStatus.RESERVED,
  ContractStatus.READY,
  ContractStatus.AWAITING_DOCUMENT,
];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (reason.length < 5) {
    return Response.json({ error: 'กรุณาระบุเหตุผลการยกเลิกอย่างน้อย 5 ตัวอักษร' }, { status: 400 });
  }

  const { id } = await context.params;
 const companyDenied = await authorizeLoanContract(id); if (companyDenied) return companyDenied;
  try {
    const contract = await prisma.$transaction(async tx => {
      // Serialize cancellation against a concurrent payout or contract edit.
      await tx.contract.update({ where: { id }, data: { updatedAt: new Date() } });
      const current = await tx.contract.findUniqueOrThrow({
        where: { id },
        include: { payments: { select: { id: true } }, repayments: { select: { id: true } } },
      });

      if (!cancellableStatuses.includes(current.status)) {
        throw new Error('ยกเลิกได้เฉพาะสัญญาจองหรือสัญญาที่ยังไม่จ่ายเงิน');
      }
      if (current.payments.length > 0 || current.repayments.length > 0) {
        throw new Error('สัญญานี้มีรายการเงินแล้ว จึงยกเลิกจากหน้ารายการจองไม่ได้');
      }

      return tx.contract.update({
        where: { id },
        data: {
          status: ContractStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        select: { id: true, contractNumber: true, status: true, cancelledAt: true, cancellationReason: true },
      });
    });

    return Response.json(contract, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return Response.json({ error: 'ไม่พบสัญญา' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : '';
    const allowedMessages = [
      'ยกเลิกได้เฉพาะสัญญาจองหรือสัญญาที่ยังไม่จ่ายเงิน',
      'สัญญานี้มีรายการเงินแล้ว จึงยกเลิกจากหน้ารายการจองไม่ได้',
    ];
    return Response.json({ error: allowedMessages.includes(message) ? message : 'ยกเลิกสัญญาไม่สำเร็จ กรุณาลองใหม่' }, { status: 409 });
  }
}
