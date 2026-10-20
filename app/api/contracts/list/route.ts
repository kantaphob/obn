import { filterLoanContracts } from "@/lib/loan-access";
import { loanStatus } from "@/lib/loan-status";
import { authorizeApiRequest } from "@/lib/authorization";
import { loanApplicationFields } from '@/lib/loan-application';
import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';
import { PaymentType } from '@/generated/prisma/enums';

export async function GET() {
  const denied = await authorizeApiRequest("contracts", "read");
  if (denied) return denied;
  const contracts = await filterLoanContracts(await prisma.contract.findMany({
    include: {
      application:true,
      debtor: { select: { borrowersCode: true, firstName: true, lastName: true, phone: true, nickname: true } },
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
  }));

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
      status: loanStatus({ ...contract, payments }),
      ...loanApplicationFields(contract.application),
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
