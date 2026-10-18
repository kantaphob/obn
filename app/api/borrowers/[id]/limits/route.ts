import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from '@/lib/prisma'
import { loanBalance } from '@/lib/loan-balance'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const denied = await authorizeApiRequest("borrowers", "read");
  if (denied) return denied;
  const { id } = await params
  const borrower = await prisma.borrowers.findUnique({
    where: { id },
    select: {
      status: true,
      approvedLimit: true,
      contracts: {
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
        select: {
          principal: true,
          interestRate: true,
          interestAmount: true,
          interestMode: true,
          interestRateBasis: true,
          startDate: true,
          dueDate: true,
          lateFeePerDay: true,
          lateFeeWaived: true,
          status: true,
          payments: { select: { type: true, amount: true, paidAt: true } },
        },
      },
    },
  })

  if (!borrower) return Response.json({ error: 'ไม่พบข้อมูลผู้กู้' }, { status: 404 })

  const asOf = new Date()
  const usedLimit = borrower.contracts.reduce((total, contract) => {
    return total + loanBalance(contract, asOf).principal
  }, 0)
  const availableLimit = borrower.approvedLimit === null
    ? null
    : Math.max(0, borrower.approvedLimit - usedLimit)

  return Response.json({
    status: borrower.status,
    approvedLimit: borrower.approvedLimit,
    usedLimit,
    availableLimit,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
