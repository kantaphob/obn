import MembersPanel from "./MembersPanel";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";

export default async function YouTubeMembersPage() {
  const { allowed, access } = await getYoutubePageAccess("/dashboard/youtube/members");
  if (!allowed) return youtubePageDenied();
  const directory = await prisma.youtubeMember.findMany({ where: { archivedAt: null },
    include: {
      accounts: { orderBy: { email: "asc" } },
      seats: { where: { group: { status: { not: "ARCHIVED" } } }, select: { group: { select: { id: true, name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  const members = directory.map((member) => ({
    ...member,
    groups: Array.from(new Map(member.seats.map(({ group }) => [group.id, group] as const)).values()),
  }));
  return <MembersPanel members={members} canWrite={Boolean(access && (access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")))} />;
}
