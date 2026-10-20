import type { Prisma } from "@/generated/prisma/client";
import { buildLoanSchedule } from "./loan-operations-calculations";
export async function syncLoanScheduleStatus(tx: Prisma.TransactionClient, contractId: string) {
  const contract = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: { payments: true, schedules: true } });
  for (const row of buildLoanSchedule(contract, new Date())) {
    if (contract.schedules.some(schedule => schedule.id === row.id)) {
      await tx.interestSchedule.update({ where: { id: row.id }, data: { status: row.remaining === 0 ? "PAID" : row.overdueDays > 0 ? "OVERDUE" : "PENDING" } });
    }
  }
}
