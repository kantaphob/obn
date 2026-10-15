import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';
import { ContractStatus, ContractType, PaymentType, SignatureMode } from '@/generated/prisma/enums';
import { loanBalance, thaiDay } from '@/lib/loan-balance';

export async function GET() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const todayEnd = new Date(`${today}T23:59:59.999+07:00`);
  const noDisbursement = { payments: { none: { type: PaymentType.DISBURSEMENT } } };

  // Reconcile legacy statuses without making a contract with a recorded payout payable again.
  await prisma.contract.updateMany({
    where: { status: ContractStatus.DRAFT, ...noDisbursement, OR: [
      { contractType: ContractType.NONE }, { signatureMode: SignatureMode.DIGITAL }, { signedAt: { not: null } },
    ] },
    data: { status: ContractStatus.READY },
  });
  await prisma.contract.updateMany({
    where: { status: ContractStatus.DRAFT, ...noDisbursement, contractType: { not: ContractType.NONE }, signatureMode: SignatureMode.PRINT, signedAt: null },
    data: { status: ContractStatus.AWAITING_DOCUMENT },
  });
  await prisma.contract.updateMany({
    where: { status: ContractStatus.RESERVED, ...noDisbursement, startDate: { lte: todayEnd }, OR: [
      { contractType: ContractType.NONE }, { signatureMode: SignatureMode.DIGITAL }, { signedAt: { not: null } },
    ] },
    data: { status: ContractStatus.READY },
  });
  await prisma.contract.updateMany({
    where: { status: ContractStatus.RESERVED, ...noDisbursement, startDate: { lte: todayEnd }, contractType: { not: ContractType.NONE }, signatureMode: SignatureMode.PRINT, signedAt: null },
    data: { status: ContractStatus.AWAITING_DOCUMENT },
  });
  await prisma.contract.updateMany({
    where: { status: ContractStatus.ACTIVE, dueDate: { lt: todayStart } },
    data: { status: ContractStatus.OVERDUE },
  });

  // Repayment receipts prove that the loan was already paid out, even for older
  // contracts whose original DISBURSEMENT ledger row is missing.
  const readyWithMoneyHistory = await prisma.contract.findMany({
    where: {
      status: ContractStatus.READY,
      OR: [
        { payments: { some: { type: PaymentType.DISBURSEMENT } } },
        { repayments: { some: {} } },
      ],
    },
    include: { payments: true },
  });
  for (const contract of readyWithMoneyHistory) {
    const balance = loanBalance(contract, new Date());
    const repairedStatus = balance.total === 0
      ? ContractStatus.CLOSED
      : contract.dueDate && thaiDay(new Date()) > thaiDay(contract.dueDate)
        ? ContractStatus.OVERDUE
        : ContractStatus.ACTIVE;
    await prisma.contract.updateMany({ where: { id: contract.id, status: ContractStatus.READY }, data: { status: repairedStatus } });
  }

  const contracts = await prisma.contract.findMany({
    include: {
      debtor: { select: { borrowersCode: true, firstName: true, lastName: true, nickname: true } },
      schedules: {
        select: { id: true, periodNo: true, dueDate: true, amount: true, principalAmount: true, interestAmount: true, status: true },
        orderBy: { periodNo: 'asc' },
      },
      repayments: {
        select: { id: true, receiptNumber: true, amount: true, paidAt: true, interestPaid: true, penaltyPaid: true, principalPaid: true },
        orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      },
      payments: { select: { id: true, note: true, amount: true, type: true, paidAt: true, method: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });

  const rows = contracts.map(({ payments, ...contract }) => {
    const disbursement = payments
      .filter(payment => payment.type === PaymentType.DISBURSEMENT)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0] ?? null;
    const repayments = contract.repayments.map(receipt => {
      const linked = payments.filter(payment => payment.note === `รับชำระ ${receipt.receiptNumber}`);
      const matchesType = (type: string, expected: number) =>
        linked.filter(payment => payment.type === type).reduce((sum, payment) => sum + payment.amount, 0) === expected;
      const receiptVerified = linked.length > 0
        && matchesType('INTEREST', receipt.interestPaid)
        && matchesType('PENALTY', receipt.penaltyPaid)
        && matchesType('PRINCIPAL', receipt.principalPaid);
      return { ...receipt, receiptVerified };
    });

    return {
      ...contract,
      disbursement: disbursement ? {
        id: disbursement.id,
        amount: disbursement.amount,
        paidAt: disbursement.paidAt,
        method: disbursement.method,
        reference: disbursement.note?.match(/^เลขอ้างอิงการจ่าย (.+)$/)?.[1] ?? null,
      } : null,
      repayments,
      debtor: { ...contract.debtor, borrowersCode: formatBorrowerCode(contract.debtor.borrowersCode) },
    };
  });

  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}
