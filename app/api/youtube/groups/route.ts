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
    return Response.json({ error: "ไม่มีสิทธิ์สร้างกลุ่ม YouTube" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await authorize(false);
  if (denied) return denied;

  const groups = await prisma.youtubeBillingGroup.findMany({
    include: { seats: { orderBy: { position: "asc" } } },
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
  });
  return Response.json({ groups });
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;

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
    return Response.json({ error: "กรุณากรอกข้อมูลบัญชีทั้ง 6 ช่อง" }, { status: 400 });
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
  const selectedAccountIds = accounts.map((account) => account.accountId).filter(Boolean);
  if (accounts.some(({ memberId, cycleMonths, priceBaht }) => memberId && (![1, 3, 5].includes(cycleMonths) || priceBaht === null || !Number.isFinite(priceBaht) || priceBaht <= 0 || priceBaht > 1000000))) {
    return Response.json({ error: "สมาชิกที่เลือกต้องกำหนดรอบ 1, 3 หรือ 5 เดือน และราคามากกว่า 0 บาท" }, { status: 400 });
  }
  if (new Set(selectedAccountIds).size !== selectedAccountIds.length) {
    return Response.json({ error: "บัญชีอีเมลในกลุ่มนี้ซ้ำกัน" }, { status: 400 });
  }
  const selectedMembers = await prisma.youtubeMember.findMany({
    where: { id: { in: accounts.map(({ memberId }) => memberId).filter(Boolean) } },
    select: { id: true, name: true },
  });
  const memberById = new Map(selectedMembers.map((member) => [member.id, member]));
  const selectedAccounts = await prisma.youtubeMemberAccount.findMany({ where: { id: { in: selectedAccountIds } } });
  const accountById = new Map(selectedAccounts.map((account) => [account.id, account]));
  const normalizedAccounts = accounts.map((account) => {
    if (!account.memberId) return { ...account, displayName: "", email: "" };
    const member = memberById.get(account.memberId);
    if (!member) return null;
    if (!account.accountId) return { ...account, displayName: member.name, email: "" };
    const selected = accountById.get(account.accountId);
    if (!selected || selected.memberId !== account.memberId) return null;
    return { ...account, displayName: member.name, email: selected.email };
  });
  if (normalizedAccounts.some((account) => account === null)) {
    return Response.json({ error: "รายชื่อสมาชิกเปลี่ยนแปลง กรุณาเลือกสมาชิกใหม่อีกครั้ง" }, { status: 400 });
  }

  const importKey = `manual-${randomUUID()}`;
  const group = await prisma.youtubeBillingGroup.create({
    data: {
      importKey,
      name,
      dueDay,
      status: "ACTIVE",
      seats: {
        create: normalizedAccounts.map((account, index) => {
          if (!account) return { position: index + 1, sourceRowKey: `${importKey}-slot-${index + 1}` };
          const { memberId, accountId, displayName, email, cycleMonths, priceBaht } = account;
          return {
          position: index + 1,
          sourceRowKey: `${importKey}-slot-${index + 1}`,
          displayName: memberId ? displayName : null,
          email: email || null,
          accountId: accountId || null,
          contactMethod: null,
          billingMonths: memberId ? cycleMonths : null,
          sourceStatus: memberId ? "ใช้งาน" : null,
          priceSatang: memberId && priceBaht !== null ? Math.round(priceBaht * 100) : null,
        };}),
      },
    },
    include: { seats: { orderBy: { position: "asc" } } },
  });

  return Response.json({ group }, { status: 201 });
}
