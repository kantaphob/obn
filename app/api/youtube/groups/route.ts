import { groupOpeningEntry } from "@/lib/youtube-cashbook";
import { isBillingDate, cyclePriceBaht, groupBillingDate, billingToday } from "@/lib/youtube-billing";
import { randomUUID } from "node:crypto";
import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

async function authorize(write: boolean) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("youtube")) {
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
  const startedOn = data.startedOn === undefined ? undefined : data.startedOn || null;
  if (startedOn !== undefined && startedOn !== null && !isBillingDate(startedOn)) return Response.json({ error: "วันเริ่มกลุ่มไม่ถูกต้อง" }, { status: 400 });
  const openingReceived = data.openingReceivedBaht === undefined ? undefined : Number(data.openingReceivedBaht || 0);
  if (openingReceived !== undefined && (!Number.isFinite(openingReceived) || openingReceived < 0 || openingReceived > 100000000)) return Response.json({ error: "ยอดรับยกมาต้องตั้งแต่ 0 ถึง 100,000,000 บาท" }, { status: 400 });
  const openingReceivedSatang = openingReceived === undefined ? undefined : Math.round(openingReceived * 100);
  const monthlyPrice = data.monthlyPriceBaht === undefined || data.monthlyPriceBaht === "" ? undefined : Number(data.monthlyPriceBaht);
  if (monthlyPrice !== undefined && (!Number.isFinite(monthlyPrice) || monthlyPrice < 0.01 || monthlyPrice > 1000000)) return Response.json({ error: "ราคากลุ่มต่อเดือนต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท" }, { status: 400 });
  const monthlyPriceSatang = monthlyPrice === undefined ? undefined : Math.round(monthlyPrice * 100);
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
    const email = typeof account.email === "string" ? account.email.trim() : "";
    const cycleMonths = Number(account.cycleMonths);
    const priceText = typeof account.priceBaht === "string" || typeof account.priceBaht === "number" ? String(account.priceBaht).trim() : "";
    const monthlyText = typeof account.monthlyPriceBaht === "string" ? account.monthlyPriceBaht : null;
    const effectivePrice = monthlyText !== null ? cyclePriceBaht(monthlyText, cycleMonths) : priceText;
    const priceBaht = effectivePrice ? Number(effectivePrice) : null;
    return { memberId, accountId, email, cycleMonths, priceBaht, nextDueDate: account.nextDueDate || null };
  });
  if (accounts.some(({ email }) => email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) return Response.json({ error: "อีเมลบัญชี YouTube ไม่ถูกต้อง" }, { status: 400 });
  if (accounts.some((entry) => entry.memberId && entry.nextDueDate !== null && !isBillingDate(entry.nextDueDate))) return Response.json({ error: "วันครบกำหนดไม่ถูกต้อง" }, { status: 400 });
  for (const entry of accounts) if (typeof entry.nextDueDate === "string") entry.nextDueDate = groupBillingDate(entry.nextDueDate, dueDay);
  if (accounts.some(({ accountId, memberId }) => accountId && !memberId)) {
    return Response.json({ error: "เลือกสมาชิกก่อนเลือกบัญชีอีเมล" }, { status: 400 });
  }
  if (!accounts[0].memberId) return Response.json({ error: "กรุณาเลือกสมาชิกในบัญชีหลักอย่างน้อย 1 คน" }, { status: 400 });
  const selectedAccountIds = accounts.map((account) => account.accountId).filter(Boolean);
  const selectedEmails = accounts.map((account) => account.email.toLocaleLowerCase("en")).filter(Boolean);
  if (accounts.some(({ memberId, cycleMonths, priceBaht }) => memberId && (![1, 3, 5].includes(cycleMonths) || priceBaht === null || !Number.isFinite(priceBaht) || priceBaht < 0 || priceBaht > 1000000))) {
    return Response.json({ error: "สมาชิกที่เลือกต้องกำหนดรอบ 1, 3 หรือ 5 เดือน และราคาตั้งแต่ 0 บาทขึ้นไป" }, { status: 400 });
  }
  if (new Set(selectedEmails).size !== selectedEmails.length) {
    return Response.json({ error: "อีเมลบัญชีในกลุ่มนี้ซ้ำกัน" }, { status: 400 });
  }
  const selectedMembers = await prisma.youtubeMember.findMany({
    where: { archivedAt: null, id: { in: accounts.map(({ memberId }) => memberId).filter(Boolean) } },
    select: { id: true, name: true },
  });
  const memberById = new Map(selectedMembers.map((member) => [member.id, member]));
  const selectedAccounts = await prisma.youtubeMemberAccount.findMany({ where: { id: { in: selectedAccountIds } } });
  const accountById = new Map(selectedAccounts.map((account) => [account.id, account]));
  const normalizedAccounts = accounts.map((account) => {
    if (!account.memberId) return { ...account, displayName: "", email: "" };
    const member = memberById.get(account.memberId);
    if (!member) return null;
    if (!account.accountId) return { ...account, displayName: member.name, email: account.email };
    const selected = accountById.get(account.accountId);
    if (!selected || selected.memberId !== account.memberId) return null;
    return { ...account, displayName: member.name, email: selected.email || account.email };
  });
  if (normalizedAccounts.some((account) => account === null)) {
    return Response.json({ error: "รายชื่อสมาชิกเปลี่ยนแปลง กรุณาเลือกสมาชิกใหม่อีกครั้ง" }, { status: 400 });
  }

  const importKey = `manual-${randomUUID()}`;
  const actor = await getCurrentAccess();
  const group = await prisma.$transaction(async (transaction) => {
  const saved = await transaction.youtubeBillingGroup.create({
    data: {
      importKey,
      name,
      dueDay,
      monthlyPriceSatang,
      startedOn: startedOn as string | null | undefined,
      openingReceivedSatang,
      status: "ACTIVE",
      seats: {
        create: normalizedAccounts.map((account, index) => {
          if (!account) return { position: index + 1, sourceRowKey: `${importKey}-slot-${index + 1}` };
          const { memberId, accountId, displayName, email, cycleMonths, priceBaht, nextDueDate } = account;
          return {
          position: index + 1,
          memberId: memberId || null,
          billingAnchorDay: memberId ? dueDay : null,
          nextDueDate: memberId ? nextDueDate as string | null : null,
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
  if (saved.openingReceivedSatang > 0) await transaction.youtubeLedgerEntry.create({ data: groupOpeningEntry(saved, billingToday()) });
  if (actor?.session?.user) await recordYoutubeActivity(actor.session.user, { action: "CREATE", entityType: "GROUP", entityId: saved.id, entityLabel: saved.name, summary: "สร้างกลุ่ม YouTube" }, transaction);
  return saved;
  });

  return Response.json({ group }, { status: 201 });
}
