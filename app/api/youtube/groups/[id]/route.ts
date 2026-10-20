import { randomUUID } from "node:crypto";
import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

async function authorize(write: boolean) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  }
  if (write && !access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") {
    return Response.json({ error: "ไม่มีสิทธิ์จัดการกลุ่ม YouTube" }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize(true);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "กรุณากรอกข้อมูลกลุ่ม" }, { status: 400 });

  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const dueDay = Number(data.dueDay);
  const rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
  if (!name || name.length > 100) return Response.json({ error: "กรุณาระบุชื่อกลุ่มไม่เกิน 100 ตัวอักษร" }, { status: 400 });
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return Response.json({ error: "วันเรียกเก็บต้องอยู่ระหว่างวันที่ 1–31" }, { status: 400 });
  if (rawAccounts.length !== 6 || rawAccounts.some((account) => !account || typeof account !== "object")) {
    return Response.json({ error: "กรุณากรอกข้อมูลสมาชิกทั้ง 6 ช่อง" }, { status: 400 });
  }

  const accounts = rawAccounts.map((raw) => {
    const account = raw as Record<string, unknown>;
    const memberId = typeof account.memberId === "string" ? account.memberId : "";
    const accountId = typeof account.accountId === "string" ? account.accountId : "";
    const cycleMonths = Number(account.cycleMonths);
    const priceText = typeof account.priceBaht === "string" || typeof account.priceBaht === "number" ? String(account.priceBaht).trim() : "";
    const priceBaht = priceText ? Number(priceText) : null;
    return { memberId, accountId, cycleMonths, priceBaht };
  });
  if (accounts.some(({ accountId, memberId }) => accountId && !memberId)) {
    return Response.json({ error: "เลือกสมาชิกก่อนเลือกบัญชีอีเมล" }, { status: 400 });
  }
  if (!accounts[0].memberId) return Response.json({ error: "กรุณาเลือกสมาชิกในบัญชีหลักอย่างน้อย 1 คน" }, { status: 400 });
  const selectedAccountIds = accounts.map(({ accountId }) => accountId).filter(Boolean);
  if (new Set(selectedAccountIds).size !== selectedAccountIds.length) return Response.json({ error: "บัญชีอีเมลในกลุ่มนี้ซ้ำกัน" }, { status: 400 });
  if (accounts.some(({ memberId, cycleMonths, priceBaht }) => memberId && (![1, 3, 5].includes(cycleMonths) || priceBaht === null || !Number.isFinite(priceBaht) || priceBaht <= 0 || priceBaht > 1000000))) {
    return Response.json({ error: "สมาชิกที่เลือกต้องกำหนดรอบ 1, 3 หรือ 5 เดือน และราคามากกว่า 0 บาท" }, { status: 400 });
  }

  const existing = await prisma.youtubeBillingGroup.findUnique({ where: { id }, include: { seats: true } });
  if (!existing) return Response.json({ error: "ไม่พบกลุ่มที่ต้องการแก้ไข" }, { status: 404 });
  const selectedMembers = await prisma.youtubeMember.findMany({
    where: { id: { in: accounts.map(({ memberId }) => memberId).filter(Boolean) } },
    select: { id: true, name: true },
  });
  const memberById = new Map(selectedMembers.map((member) => [member.id, member]));
  const selectedAccounts = await prisma.youtubeMemberAccount.findMany({ where: { id: { in: selectedAccountIds } } });
  const accountById = new Map(selectedAccounts.map((account) => [account.id, account]));
  if (accounts.some(({ accountId, memberId }) => (memberId && !memberById.has(memberId)) || (accountId && accountById.get(accountId)?.memberId !== memberId))) {
    return Response.json({ error: "รายชื่อสมาชิกเปลี่ยนแปลง กรุณาเลือกสมาชิกใหม่อีกครั้ง" }, { status: 400 });
  }

  const group = await prisma.$transaction(async (transaction) => {
    await transaction.youtubeBillingGroup.update({ where: { id }, data: { name, dueDay, status: "ACTIVE" } });
    const seatsByPosition = new Map(existing.seats.map((seat) => [seat.position, seat]));
    for (let index = 0; index < accounts.length; index += 1) {
      const entry = accounts[index];
      const position = index + 1;
      const current = seatsByPosition.get(position);
      const member = entry.memberId ? memberById.get(entry.memberId) : null;
      const selectedAccount = entry.accountId ? accountById.get(entry.accountId) : null;
      const sameMember = Boolean(member && (selectedAccount
        ? current?.accountId === selectedAccount.id
        : current?.accountId === null && current.displayName === member.name));
      const seatData = {
        position,
        displayName: member?.name ?? null,
        email: selectedAccount?.email ?? null,
        accountId: selectedAccount?.id ?? null,
        contactMethod: null,
        billingMonths: member ? entry.cycleMonths : null,
        sourceStatus: member ? "ใช้งาน" : null,
        priceSatang: member && entry.priceBaht !== null ? Math.round(entry.priceBaht * 100) : null,
        ...(!sameMember ? { paymentStatus: "UNRECORDED" } : {}),
      };
      if (current) {
        await transaction.youtubeBillingSeat.update({ where: { id: current.id }, data: seatData });
      } else {
        await transaction.youtubeBillingSeat.create({
          data: { ...seatData, groupId: id, sourceRowKey: `managed-${randomUUID()}` },
        });
      }
    }
    return transaction.youtubeBillingGroup.findUniqueOrThrow({
      where: { id },
      include: { seats: { orderBy: { position: "asc" } } },
    });
  });
  return Response.json({ group });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize(true);
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.youtubeBillingGroup.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "ไม่พบกลุ่มที่ต้องการลบ" }, { status: 404 });
  await prisma.youtubeBillingGroup.delete({ where: { id } });
  return Response.json({ success: true });
}
