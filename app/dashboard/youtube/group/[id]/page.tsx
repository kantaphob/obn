import { captureYoutubeCharges } from "@/lib/youtube-charge-snapshots";
import { Suspense } from "react";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { billingToday } from "@/lib/youtube-billing";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import GroupNotebook from "./GroupNotebook";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main>กำลังเปิดสมุดสมาชิก…</main>}><Content params={params} /></Suspense>;
}
async function Content({ params }: { params: Promise<{ id: string }> }) {
  await io();
  const { allowed, access } = await getYoutubePageAccess("/dashboard/youtube/group");
  if (!allowed) return youtubePageDenied();
  const { id } = await params;
  const [group, members, entries] = await Promise.all([
    prisma.youtubeBillingGroup.findUnique({ where: { id }, include: { seats: { orderBy: { position: "asc" } } } }),
    prisma.youtubeMember.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.youtubeLedgerEntry.findMany({ where: { groupId: id, voidedAt: null }, select: { type: true, amountSatang: true } }),
  ]);
  if (!group) notFound();
  const snapshots = await captureYoutubeCharges([group], billingToday());
  return <GroupNotebook historicalCostSatang={snapshots.reduce((sum, entry) => sum + entry.amountSatang, 0)} chargeCount={snapshots.length} canWrite={Boolean(access && (access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")))} group={group} today={billingToday()} actualExpense={entries.filter((entry) => entry.type === "EXPENSE").reduce((sum, entry) => sum + entry.amountSatang, 0)} memberOptions={members.map((member) => ({ value: `member:${member.id}`, memberId: member.id, accountId: "", name: member.name, email: "", billingMonths: null, priceSatang: null }))} />;
}
