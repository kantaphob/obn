import { prisma } from '@/lib/prisma';
import { loanBalance } from '@/lib/loan-balance';
import { formatBorrowerCode } from '@/lib/borrower-code';

const bangkokDate = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export async function GET() {
  const today = bangkokDate(new Date());
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ['ACTIVE', 'OVERDUE'] },
      dueDate: { lt: todayStart },
    },
    include: {
      debtor: {
        select: {
          borrowersCode: true,
          firstName: true,
          lastName: true,
          nickname: true,
          phone: true,
          line: true,
        },
      },
      payments: true,
    },
    orderBy: [{ dueDate: 'asc' }, { contractNumber: 'asc' }],
  });

  const asOf = new Date();
  const rows = contracts.map(({ payments, ...contract }) => ({
    ...contract,
    balance: loanBalance({ ...contract, payments }, asOf),
  })).filter(contract => contract.balance.total > 0 && contract.balance.overdueDays > 0);

  return Response.json(rows.map(row=>({...row,debtor:{...row.debtor,borrowersCode:formatBorrowerCode(row.debtor.borrowersCode)}})), { headers: { 'Cache-Control': 'no-store' } });
}
