import { filterLoanContracts } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma';
import { loanBalance } from '@/lib/loan-balance';
import { formatBorrowerCode } from '@/lib/borrower-code';

export async function GET() {
  const denied = await authorizeApiRequest("contracts", "read");
  if (denied) return denied;
  const contracts = await filterLoanContracts(await prisma.contract.findMany({
    where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    select: {
      id: true,
      contractNumber: true,
      status: true,
      documentData: true,
      installmentMonths: true,
      repayType: true,
      principal: true,
      interestRate: true,
      interestRateBasis: true,
      startDate: true,
      dueDate: true,
      interestAmount: true,
      interestMode: true,
      lateFeePerDay: true,
      lateFeeWaived: true,
      debtor: { select: { id: true, borrowersCode: true, firstName: true, lastName: true, nickname: true } },
      payments: { select: { type: true, amount: true, paidAt: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { contractNumber: 'asc' }],
  }));

  const asOf = new Date();
  const rows = contracts.map(({ payments, ...contract }) => ({
    ...contract,
    balance: loanBalance({ ...contract, payments }, asOf),
  })).filter(contract => contract.balance.total > 0);

  return Response.json(rows.map(row=>({...row,debtor:{...row.debtor,borrowersCode:formatBorrowerCode(row.debtor.borrowersCode)}})), { headers: { 'Cache-Control': 'no-store' } });
}
