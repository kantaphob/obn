import { Suspense } from "react";
import { io } from "next/cache";
import { billingToday } from "@/lib/youtube-billing";
import GroupManagementPanel from "./GroupManagementPanel";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";

export default function YouTubeGroupManagementPage() {
  return <Suspense fallback={<main aria-live="polite">กำลังโหลดกลุ่มและรอบเรียกเก็บ…</main>}><GroupManagementContent /></Suspense>;
}

async function GroupManagementContent() {
  await io();
  const { allowed, access } = await getYoutubePageAccess("/dashboard/youtube/group");
  if (!allowed) return youtubePageDenied();
  const [groups, directory] = await Promise.all([
    prisma.youtubeBillingGroup.findMany({ where: { status: { not: "ARCHIVED" } },
      include: { seats: { orderBy: { position: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    }),
    prisma.youtubeMember.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const memberOptions = directory.map((member) => ({
    value: `member:${member.id}`,
    memberId: member.id,
    accountId: "",
    name: member.name,
    email: "",
    billingMonths: null,
    priceSatang: null,
  }));
  const today = billingToday();
  return <GroupManagementPanel groups={groups} canWrite={Boolean(access && (access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")))} memberOptions={memberOptions} today={today} />;
}
