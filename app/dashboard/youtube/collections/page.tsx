import { Suspense } from "react";
import { io } from "next/cache";
import { prisma } from "@/lib/prisma";
import { billingToday } from "@/lib/youtube-billing";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import BillingCollections from "../BillingCollections";

type Search = Promise<{ group?: string }>;
export default function YouTubeCollectionsPage({ searchParams }: { searchParams: Search }) {
  return <Suspense fallback={<main aria-live="polite">กำลังโหลดรายการเรียกเก็บ…</main>}><CollectionsContent searchParams={searchParams} /></Suspense>;
}
async function CollectionsContent({ searchParams }: { searchParams: Search }) {
  await io();
  const { allowed, access } = await getYoutubePageAccess("/dashboard/youtube/collections");
  if (!allowed) return youtubePageDenied();
  const today = billingToday();
  const [groups, totals, monthly, search] = await Promise.all([
    prisma.youtubeBillingGroup.findMany({ include: { seats: { orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.youtubePayment.groupBy({ by: ["groupId"], where: { voidedAt: null, paidOn: { lte: today } }, _sum: { amountSatang: true } }),
    prisma.youtubePayment.groupBy({ by: ["groupId"], where: { voidedAt: null, paidOn: { gte: `${today.slice(0, 7)}-01`, lte: today } }, _sum: { amountSatang: true } }),
    searchParams,
  ]);
  const monthlyReceived = Object.fromEntries(monthly.map((entry) => [entry.groupId || "__deleted", entry._sum.amountSatang || 0]));
  return <BillingCollections key={search.group || "all"} canWrite={Boolean(access && (access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")))} groups={groups} receiptTotals={Object.fromEntries(totals.map((entry) => [entry.groupId || "__deleted", entry._sum.amountSatang || 0]))} today={today} initialGroupId={groups.some((group) => group.id === search.group) ? search.group : ""} monthlyReceived={monthlyReceived} />;
}
