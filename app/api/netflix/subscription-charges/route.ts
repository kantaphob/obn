import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

function monthEndDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:read") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") {
    return Response.json({ error: "ไม่มีสิทธิ์ดูรายการค่าสมาชิก Netflix" }, { status: 403 });
  }

  const currentDate = today();
  const [year, month] = currentDate.split("-").map(Number);
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const groups = await prisma.netflixGroup.findMany({ where: { status: "ACTIVE", monthlySatang: { gt: 0 }, billingDay: { not: null } }, select: { id: true, name: true, accountEmail: true, monthlySatang: true, billingDay: true, startedOn: true } });
  let created = 0;

  for (const group of groups) {
    if (!group.monthlySatang || !group.billingDay) continue;
    const billingDay = Math.min(group.billingDay, monthEndDay(year, month));
    const dueDate = `${billingMonth}-${String(billingDay).padStart(2, "0")}`;
    if (group.startedOn && group.startedOn > dueDate) continue;
    const sourceKey = `subscription:${group.id}:${billingMonth}`;
    const existing = await prisma.netflixLedgerEntry.findUnique({ where: { sourceKey }, select: { id: true } });
    if (existing) continue;
    await prisma.netflixLedgerEntry.upsert({
      where: { sourceKey },
      create: {
        sourceKey,
        source: "SUBSCRIPTION_BILLING",
        type: "EXPENSE",
        groupId: group.id,
        groupName: group.name,
        title: `ค่าสมาชิก Netflix ประจำเดือน ${billingMonth}`,
        category: "ค่าสมาชิก Netflix",
        party: group.accountEmail || "Netflix",
        amountSatang: group.monthlySatang,
        transactionOn: dueDate,
        paymentMethod: "CARD",
        status: "PENDING_PAYMENT",
        approvalRequired: false,
        note: `รายการตัดบัตรอัตโนมัติ · ${group.name}`,
      },
      update: {},
    });
    created += 1;
  }

  return Response.json({ billingMonth, created });
}
