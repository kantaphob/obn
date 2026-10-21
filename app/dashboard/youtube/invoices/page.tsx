import { Suspense } from "react";
import { io } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess, youtubePageDenied } from "@/lib/youtube-access";
import { billingToday } from "@/lib/youtube-billing";
import { generateYoutubeBillingDocuments } from "@/lib/youtube-invoices";
import InvoiceWorkspace from "./InvoiceWorkspace";

type Search = Promise<{ group?: string; view?: string }>;
export default function Page({ searchParams }: { searchParams: Search }) { return <Suspense fallback={<main>กำลังจัดเตรียมใบแจ้งหนี้และกำหนดจ่าย…</main>}><Content searchParams={searchParams} /></Suspense>; }
async function Content({ searchParams }: { searchParams: Search }) {
  await io();
  const { allowed, access } = await getYoutubePageAccess("/dashboard/youtube/invoices");
  if (!allowed || !access) return youtubePageDenied();
  await generateYoutubeBillingDocuments();
  const search = await searchParams;
  const groupId = search.group || undefined;
  const [invoices, payables] = await Promise.all([
    prisma.youtubeInvoice.findMany({ where: { groupId }, orderBy: [{ dueDate: "asc" }, { id: "desc" }] }),
    prisma.youtubePayable.findMany({ where: { source: "GROUP_PAYMENT", groupId }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] }),
  ]);
  return <InvoiceWorkspace initialTab={search.view === "payables" ? "payables" : "invoices"} filteredGroup={Boolean(groupId)} today={billingToday()} invoices={invoices} payables={payables} canWrite={access.roleCode === "owner" || access.permissions.includes("*") || access.permissions.includes("dashboard:write")} />;
}
