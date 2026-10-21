import { prisma } from "@/lib/prisma";
import { connection } from "next/server";
import { Suspense } from "react";
import NetflixGroupsPanel from "./NetflixGroupsPanel";

export default function NetflixPage() {
  return <Suspense fallback={<main className="nf-page" aria-live="polite">กำลังโหลดข้อมูล Netflix…</main>}><NetflixPageContent /></Suspense>;
}

async function NetflixPageContent() {
  await connection();
  const currentMonth = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 7);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  const [groups, payments, invoices, allEntries] = await Promise.all([
    prisma.netflixGroup.findMany({ include: { profiles: { orderBy: { position: "asc" } } }, orderBy: [{ createdAt: "desc" }, { name: "asc" }] }),
    prisma.netflixPayment.findMany({ where: { billingMonth: currentMonth }, orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }] }),
    prisma.netflixLedgerEntry.findMany({ where: { source: "MEMBER_INVOICE", sourceKey: { endsWith: `:${currentMonth}` } }, orderBy: [{ transactionOn: "asc" }, { createdAt: "desc" }] }),
    prisma.netflixLedgerEntry.findMany({ where: { status: "PAID", transactionOn: { lte: today } }, select: { groupId: true, type: true, transactionOn: true, amountSatang: true } }),
  ]);
  const lifetimeIncomeByGroup = Object.fromEntries(groups.map((group) => [group.id, allEntries
    .filter((entry) => entry.type === "INCOME" && entry.groupId === group.id && entry.transactionOn >= (group.startedOn ?? "0000-00-00"))
    .reduce((sum, entry) => sum + entry.amountSatang, 0)]));
  const lifetimeIncome = allEntries.filter((entry) => entry.type === "INCOME").reduce((sum, entry) => sum + entry.amountSatang, 0);
  return <NetflixGroupsPanel groups={groups} initialPayments={payments} initialInvoices={invoices} initialMonth={currentMonth} lifetimeIncome={lifetimeIncome} lifetimeIncomeByGroup={lifetimeIncomeByGroup} />;
}
