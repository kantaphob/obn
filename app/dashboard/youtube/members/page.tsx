import MembersPanel from "./MembersPanel";
import { prisma } from "@/lib/prisma";

export default async function YouTubeMembersPage() {
  const directory = await prisma.youtubeMember.findMany({
    include: {
      accounts: {
        orderBy: { email: "asc" },
        include: { seats: { select: { group: { select: { id: true, name: true } } } } },
      },
    },
    orderBy: { name: "asc" },
  });
  const members = directory.map((member) => ({
    ...member,
    groups: Array.from(new Map(member.accounts.flatMap((account) => account.seats.map(({ group }) => [group.id, group.name] as const))).values()),
  }));
  return <MembersPanel members={members} />;
}
