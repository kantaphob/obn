import { captureYoutubeCharges } from "@/lib/youtube-charge-snapshots";
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
  if (data.scope === "details") return updateDetails(id, data);
  if (data.scope === "account" && (!Number.isInteger(data.seatPosition) || Number(data.seatPosition) < 1 || Number(data.seatPosition) > 6)) return Response.json({ error: "ช่องบัญชีไม่ถูกต้อง" }, { status: 400 });
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
    return Response.json({ error: "กรุณากรอกข้อมูลสมาชิกทั้ง 6 ช่อง" }, { status: 400 });
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
    return { memberId, accountId, email, cycleMonths, priceBaht, nextDueDate: account.nextDueDate || null, version: typeof account.version === "string" ? account.version : null };
  });
  if (accounts.some(({ email }) => email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) return Response.json({ error: "อีเมลบัญชี YouTube ไม่ถูกต้อง" }, { status: 400 });
  if (accounts.some((entry) => entry.memberId && entry.nextDueDate !== null && !isBillingDate(entry.nextDueDate))) return Response.json({ error: "วันครบกำหนดไม่ถูกต้อง" }, { status: 400 });
  for (const entry of accounts) if (typeof entry.nextDueDate === "string") entry.nextDueDate = groupBillingDate(entry.nextDueDate, dueDay);
  if (accounts.some(({ accountId, memberId }) => accountId && !memberId)) {
    return Response.json({ error: "เลือกสมาชิกก่อนเลือกบัญชีอีเมล" }, { status: 400 });
  }
  if (!accounts[0].memberId) return Response.json({ error: "กรุณาเลือกสมาชิกในบัญชีหลักอย่างน้อย 1 คน" }, { status: 400 });
  const selectedAccountIds = accounts.map(({ accountId }) => accountId).filter(Boolean);
  const selectedEmails = accounts.map(({ email }) => email.toLocaleLowerCase("en")).filter(Boolean);
  if (new Set(selectedEmails).size !== selectedEmails.length) return Response.json({ error: "อีเมลบัญชีในกลุ่มนี้ซ้ำกัน" }, { status: 400 });
  if (accounts.some(({ memberId, cycleMonths, priceBaht }) => memberId && (![1, 3, 5].includes(cycleMonths) || priceBaht === null || !Number.isFinite(priceBaht) || priceBaht < 0 || priceBaht > 1000000))) {
    return Response.json({ error: "สมาชิกที่เลือกต้องกำหนดรอบ 1, 3 หรือ 5 เดือน และราคาตั้งแต่ 0 บาทขึ้นไป" }, { status: 400 });
  }

  const existing = await prisma.youtubeBillingGroup.findUnique({ where: { id }, include: { seats: true } });
  if (!existing) return Response.json({ error: "ไม่พบกลุ่มที่ต้องการแก้ไข" }, { status: 404 });
  if (existing.status === "ARCHIVED" || (data.scope && data.version !== existing.updatedAt.toISOString())) return Response.json({ error: "กลุ่มเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข" }, { status: 409 });
  const selectedMembers = await prisma.youtubeMember.findMany({
    where: { archivedAt: null, id: { in: accounts.map(({ memberId }) => memberId).filter(Boolean) } },
    select: { id: true, name: true },
  });
  const memberById = new Map(selectedMembers.map((member) => [member.id, member]));
  const selectedAccounts = await prisma.youtubeMemberAccount.findMany({ where: { id: { in: selectedAccountIds } } });
  const accountById = new Map(selectedAccounts.map((account) => [account.id, account]));
  if (accounts.some(({ accountId, memberId }) => (memberId && !memberById.has(memberId)) || (accountId && accountById.get(accountId)?.memberId !== memberId))) {
    return Response.json({ error: "รายชื่อสมาชิกเปลี่ยนแปลง กรุณาเลือกสมาชิกใหม่อีกครั้ง" }, { status: 400 });
  }
  const actor = await getCurrentAccess();
  try {
    const group = await prisma.$transaction(async (transaction) => {
      const locked = await transaction.youtubeBillingGroup.updateMany({ where: { id, updatedAt: existing.updatedAt }, data: { updatedAt: new Date() } });
      if (locked.count !== 1) throw new Error("STALE_GROUP");
      await captureYoutubeCharges([existing], billingToday(), transaction);
      if (!data.scope) await transaction.youtubeBillingGroup.update({ where: { id }, data: { name, dueDay, startedOn: startedOn as string | null | undefined, openingReceivedSatang, monthlyPriceSatang, status: "ACTIVE" } });
      const seatsByPosition = new Map(existing.seats.map((seat) => [seat.position, seat]));
      for (let index = 0; index < accounts.length; index += 1) {
        const entry = accounts[index];
        const position = index + 1;
        if (data.scope === "account" && data.seatPosition !== position) continue;
        const current = seatsByPosition.get(position);
        const member = entry.memberId ? memberById.get(entry.memberId) : null;
        const selectedAccount = entry.accountId ? accountById.get(entry.accountId) : null;
        const email = (selectedAccount?.email ?? entry.email) || null;
        const sameAssignment = Boolean(member && current?.memberId === member.id && current.email === email);
        const seatData = {
          position,
          ...(!sameAssignment ? { assignmentKey: randomUUID() } : {}),
          memberId: member?.id ?? null,
          billingAnchorDay: member ? dueDay : null,
          nextDueDate: member ? entry.nextDueDate as string | null : null,
          displayName: member?.name ?? null,
          email,
          accountId: selectedAccount?.id ?? null,
          contactMethod: null,
          billingMonths: member ? entry.cycleMonths : null,
          sourceStatus: member ? "ใช้งาน" : null,
          priceSatang: member && entry.priceBaht !== null ? Math.round(entry.priceBaht * 100) : null,
          ...(!sameAssignment ? { paymentStatus: "UNRECORDED" } : {}),
        };
        if (current) {
          if (entry.version && entry.version !== current.updatedAt.toISOString()) throw new Error("STALE_GROUP");
          const changed = await transaction.youtubeBillingSeat.updateMany({ where: { id: current.id, updatedAt: current.updatedAt }, data: seatData });
          if (changed.count !== 1) throw new Error("STALE_GROUP");
        } else {
          await transaction.youtubeBillingSeat.create({
            data: { ...seatData, groupId: id, sourceRowKey: `managed-${randomUUID()}` },
          });
        }
      }
      if (!data.scope && (openingReceivedSatang !== undefined || startedOn !== undefined)) {
        const updatedGroup = await transaction.youtubeBillingGroup.findUniqueOrThrow({ where: { id } });
        const oldOpening = await transaction.youtubeLedgerEntry.findUnique({ where: { sourceKey: `group-opening:${id}` } });
        if (updatedGroup.openingReceivedSatang > 0 || oldOpening) {
          const opening = groupOpeningEntry(updatedGroup, billingToday());
          await transaction.youtubeLedgerEntry.upsert({ where: { sourceKey: opening.sourceKey }, create: opening, update: opening });
        }
      }
      const updatedGroup = await transaction.youtubeBillingGroup.findUniqueOrThrow({
        where: { id },
        include: { seats: { orderBy: { position: "asc" } } },
      });
      if (actor?.session?.user) await recordYoutubeActivity(actor.session.user, { action: "UPDATE", entityType: "GROUP", entityId: id, entityLabel: updatedGroup.name, summary: "แก้ไขกลุ่มและสมาชิก" }, transaction);
      return updatedGroup;
    });
    return Response.json({ group });
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_GROUP") return Response.json({ error: "ข้อมูลกลุ่มหรือรอบชำระเปลี่ยนแล้ว กรุณารีเฟรชและแก้ไขอีกครั้ง" }, { status: 409 });
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize(true);
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.youtubeBillingGroup.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) return Response.json({ error: "ไม่พบกลุ่มที่ต้องการลบ" }, { status: 404 });
  const actor = await getCurrentAccess();
  await prisma.$transaction(async (tx) => {
    await tx.youtubeBillingGroup.update({ where: { id }, data: { status: "ARCHIVED" } });
    if (actor?.session?.user) await recordYoutubeActivity(actor.session.user, { action: "DELETE", entityType: "GROUP", entityId: id, entityLabel: existing.name, summary: "เก็บกลุ่มเข้าคลัง โดยรักษาสมาชิกและประวัติทั้งหมด" }, tx);
  });
  return Response.json({ success: true });
}

async function updateDetails(id: string, data: Record<string, unknown>) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const dueDay = Number(data.dueDay);
  const monthlyPrice = Number(data.monthlyPriceBaht);
  const opening = Number(data.openingReceivedBaht || 0);
  const startedOn = data.startedOn || null;
  if (!name || name.length > 100 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !Number.isFinite(monthlyPrice) || monthlyPrice < .01 || monthlyPrice > 1000000 || !Number.isFinite(opening) || opening < 0 || opening > 100000000 || (startedOn !== null && !isBillingDate(startedOn))) return Response.json({ error: "ข้อมูลกลุ่มไม่ถูกต้อง" }, { status: 400 });
  const current = await prisma.youtubeBillingGroup.findUnique({ where: { id } });
  if (!current) return Response.json({ error: "ไม่พบกลุ่ม" }, { status: 404 });
  if (current.status === "ARCHIVED" || data.version !== current.updatedAt.toISOString()) return Response.json({ error: "กลุ่มเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
  const actor = await getCurrentAccess();
  try {
    const group = await prisma.$transaction(async (tx) => {
      await captureYoutubeCharges([current], billingToday(), tx);
      const changed = await tx.youtubeBillingGroup.updateMany({ where: { id, updatedAt: current.updatedAt }, data: { name, dueDay, monthlyPriceSatang: Math.round(monthlyPrice * 100), openingReceivedSatang: Math.round(opening * 100), startedOn: startedOn as string | null } });
      if (changed.count !== 1) throw new Error("STALE_GROUP");
      const updated = await tx.youtubeBillingGroup.findUniqueOrThrow({ where: { id }, include: { seats: true } });
      const oldOpening = await tx.youtubeLedgerEntry.findUnique({ where: { sourceKey: `group-opening:${id}` } });
      if (oldOpening?.voidedAt) throw new Error("VOIDED_OPENING");
      if (updated.openingReceivedSatang > 0 || oldOpening) {
        const entry = groupOpeningEntry(updated, billingToday());
        // Opening-entry date is independent of the service start after creation.
        await tx.youtubeLedgerEntry.upsert({ where: { sourceKey: entry.sourceKey }, create: entry, update: { ...entry, transactionOn: oldOpening?.transactionOn || entry.transactionOn } });
      }
      if (actor?.session?.user) await recordYoutubeActivity(actor.session.user, { action: "UPDATE", entityType: "GROUP", entityId: id, entityLabel: name, summary: "แก้เฉพาะข้อมูลกลุ่ม โดยไม่เปลี่ยนสมาชิกและกำหนดรับเงิน" }, tx);
      return updated;
    });
    return Response.json({ group });
  } catch (error) {
    if (error instanceof Error && ["STALE_GROUP", "VOIDED_OPENING"].includes(error.message)) return Response.json({ error: "ข้อมูลกลุ่มหรือยอดยกมาเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
    throw error;
  }
}
