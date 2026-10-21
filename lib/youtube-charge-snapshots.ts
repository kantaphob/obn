import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildGroupCharges } from "@/lib/youtube-cashbook";

type ChargeGroup = Parameters<typeof buildGroupCharges>[0][number];
/** Materialize liabilities at the current price before any configuration change.
 * Immutable monthly snapshots prevent a later edit from repricing old periods.
 */
export async function captureYoutubeCharges(groups: ChargeGroup[], today: string, tx: Prisma.TransactionClient = prisma) {
  for (const charge of buildGroupCharges(groups, today, new Set())) {
    await tx.youtubeGroupCharge.upsert({
      where: { groupId_billingMonth: { groupId: charge.groupId, billingMonth: charge.dueDate.slice(0, 7) } },
      create: { groupId: charge.groupId, groupName: charge.groupName, billingMonth: charge.dueDate.slice(0, 7), dueDate: charge.dueDate, coveredThrough: charge.coveredThrough, amountSatang: charge.amountSatang },
      update: {},
    });
  }
  return tx.youtubeGroupCharge.findMany({ where: { groupId: { in: groups.map((group) => group.id) }, dueDate: { lte: today } } });
}
