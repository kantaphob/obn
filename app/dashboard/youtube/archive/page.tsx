import { Suspense } from "react";
import { io } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import ArchivePanel from "./ArchivePanel";

export default function Page() { return <Suspense fallback={<main>กำลังโหลดคลังข้อมูล…</main>}><Content /></Suspense>; }
async function Content() {
  await io();
  const { access, allowed } = await getYoutubePageAccess("/dashboard/youtube/group");
  if (!allowed || !access) return youtubePageDenied();
  const [groups, members] = await Promise.all([prisma.youtubeBillingGroup.findMany({ where: { status: "ARCHIVED" }, select: { id: true, name: true } }), prisma.youtubeMember.findMany({ where: { archivedAt: { not: null } }, select: { id: true, name: true } })]);
  return <ArchivePanel groups={groups} members={members} canWrite={access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")} />;
}
