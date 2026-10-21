import { captureYoutubeCharges } from "@/lib/youtube-charge-snapshots";
import { Suspense } from "react";
import { io } from "next/cache";
import { prisma } from "@/lib/prisma";
import { billingToday } from "@/lib/youtube-billing";
import { buildGroupCharges } from "@/lib/youtube-cashbook";
import Cashbook from "./Cashbook";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import CentralFinanceTransactions from "@/components/accounts/CentralFinanceTransactions";

export default function YouTubeLedgerPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return <Suspense fallback={<main aria-live="polite">กำลังโหลดสมุดบัญชี…</main>}><LedgerContent searchParams={searchParams} /></Suspense>;
}
async function LedgerContent({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await io();
  const { access, allowed } = await getYoutubePageAccess("/dashboard/youtube/ledger");
  if (!allowed || !access) return youtubePageDenied();
  const today = billingToday();
  const search = await searchParams;
  if (!search.view || search.view === "central") return <CentralFinanceTransactions type="INCOME" system="YOUTUBE" allowTypeSwitch backHref="/dashboard/youtube/ledger?view=cashbook" />;
  const [groups, entries, payables] = await Promise.all([
    prisma.youtubeBillingGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true, startedOn: true, dueDay: true, monthlyPriceSatang: true } }),
    prisma.youtubeLedgerEntry.findMany({ orderBy: [{ transactionOn: "desc" }, { createdAt: "desc" }] }),
    prisma.youtubePayable.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
  ]);
  const snapshots = await captureYoutubeCharges(groups, today);
  const confirmedKeys = new Set([
    ...entries.filter((entry) => entry.source === "GROUP_PAYMENT" && !entry.voidedAt).map((entry) => entry.sourceKey),
    ...payables.filter((payable) => payable.status !== "CANCELLED").map((payable) => payable.sourceKey),
  ]);
  const charges = buildGroupCharges(groups, today, confirmedKeys, snapshots);
  const canWrite = access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write");
  return <Cashbook key={search.view || "records"} initialView={search.view === "payments" ? "payments" : search.view === "approvals" ? "approvals" : "records"} today={today} canWrite={canWrite} groups={groups.map(({ id, name }) => ({ id, name }))} charges={charges} entries={entries} payables={payables} />;
}
