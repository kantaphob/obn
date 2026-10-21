import "server-only";
import { prisma } from "@/lib/prisma";

export async function youtubeGroupReceiptTotals(groups: { id: string; startedOn: string | null }[], today: string): Promise<Record<string, number>> {
  if (!groups.length) return {};
  const totals = await prisma.youtubePayment.groupBy({
    by: ["groupId"],
    where: { voidedAt: null, OR: groups.map((group) => ({ groupId: group.id, paidOn: { gte: group.startedOn || "2000-01-01", lte: today } })) },
    _sum: { amountSatang: true },
  });
  return Object.fromEntries(totals.filter((entry) => entry.groupId).map((entry) => [entry.groupId!, entry._sum.amountSatang ?? 0]));
}
