import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type YoutubeActivityActor = { id: string; name?: string | null };
export type YoutubeActivityInput = {
  action: "CREATE" | "UPDATE" | "DELETE" | "RECEIVE" | "PAY";
  entityType: "MEMBER" | "GROUP" | "PAYMENT" | "LEDGER" | "INVOICE";
  entityId?: string | null;
  entityLabel: string;
  summary: string;
};

export async function recordYoutubeActivity(actor: YoutubeActivityActor, input: YoutubeActivityInput, tx?: Prisma.TransactionClient) {
    await (tx || prisma).youtubeActivityLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name?.trim() || "ผู้ใช้ระบบ",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel.slice(0, 200),
        summary: input.summary.slice(0, 500),
      },
    });
}
