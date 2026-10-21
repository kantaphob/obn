import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

function authorize(write = false) {
  return getCurrentAccess().then((access) => {
    if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (access.accessConfigured && !access.appKeys.includes("dashboard")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
    if (write && !access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return Response.json({ error: "ไม่มีสิทธิ์ออกใบแจ้งหนี้ Netflix" }, { status: 403 });
    return null;
  });
}

const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

function dueDateForMonth(month: string, billingDay: number | null) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = Math.min(billingDay ?? 1, lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  const billingMonth = typeof body?.billingMonth === "string" ? body.billingMonth : "";
  const amount = typeof body?.amountBaht === "string" || typeof body?.amountBaht === "number" ? Number(body.amountBaht) : NaN;
  if (!profileId || !validMonth(billingMonth)) return Response.json({ error: "กรุณาระบุสมาชิกและเดือนที่ถูกต้อง" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return Response.json({ error: "ยอดใบแจ้งหนี้ต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท" }, { status: 400 });

  const profile = await prisma.netflixProfile.findUnique({ where: { id: profileId }, include: { group: { select: { id: true, name: true, startedOn: true, billingDay: true } } } });
  if (!profile) return Response.json({ error: "ไม่พบโปรไฟล์สมาชิก" }, { status: 404 });
  if (profile.group.startedOn && billingMonth < profile.group.startedOn.slice(0, 7)) return Response.json({ error: "เดือนที่ออกใบแจ้งหนี้ต้องไม่อยู่ก่อนวันเริ่มกลุ่ม" }, { status: 400 });
  const sourceKey = `invoice:${profileId}:${billingMonth}`;
  const existing = await prisma.netflixLedgerEntry.findUnique({ where: { sourceKey }, select: { id: true } });
  if (existing) return Response.json({ error: "มีใบแจ้งหนี้ของสมาชิกในเดือนนี้แล้ว" }, { status: 409 });
  const entry = await prisma.netflixLedgerEntry.create({
    data: {
      sourceKey,
      source: "MEMBER_INVOICE",
      type: "INCOME",
      status: "PENDING_RECEIPT",
      groupId: profile.groupId,
      groupName: profile.group.name,
      profileId,
      profileName: profile.name,
      title: `ใบแจ้งหนี้ Netflix ประจำเดือน ${billingMonth}`,
      category: "ค่าบริการสมาชิก",
      party: profile.name,
      amountSatang: Math.round(amount * 100),
      transactionOn: profile.group.startedOn && profile.group.startedOn.slice(0, 7) === billingMonth
        ? [dueDateForMonth(billingMonth, profile.group.billingDay), profile.group.startedOn].sort().at(-1)!
        : dueDateForMonth(billingMonth, profile.group.billingDay),
      paymentMethod: "OTHER",
      approvalRequired: false,
      note: `ใบแจ้งหนี้สมาชิก ${profile.name} · กลุ่ม ${profile.group.name}`,
    },
  });
  const invoiceNumber = `NF-${billingMonth.replace("-", "")}-${entry.id.slice(-6).toUpperCase()}`;
  const updated = await prisma.netflixLedgerEntry.update({ where: { id: entry.id }, data: { reference: invoiceNumber } });
  return Response.json({ invoice: updated }, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : "";
  const paidOn = typeof body?.paidOn === "string" ? body.paidOn : "";
  if (!invoiceId || !validDate(paidOn) || paidOn > today()) return Response.json({ error: "กรุณาระบุวันที่รับเงินจริงให้ถูกต้อง" }, { status: 400 });
  const invoice = await prisma.netflixLedgerEntry.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.source !== "MEMBER_INVOICE" || !invoice.profileId) return Response.json({ error: "ไม่พบใบแจ้งหนี้สมาชิก" }, { status: 404 });
  if (invoice.status !== "PENDING_RECEIPT") return Response.json({ error: "ใบแจ้งหนี้นี้ไม่ได้อยู่ในสถานะรอยืนยันรับเงิน" }, { status: 409 });
  const billingMonth = invoice.sourceKey.split(":").at(-1) ?? "";
  if (!validMonth(billingMonth)) return Response.json({ error: "ข้อมูลเดือนในใบแจ้งหนี้ไม่ถูกต้อง" }, { status: 409 });
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.netflixPayment.upsert({
      where: { profileId_billingMonth: { profileId: invoice.profileId!, billingMonth } },
      create: { profileId: invoice.profileId!, groupId: invoice.groupId, groupName: invoice.groupName ?? "Netflix", profileName: invoice.profileName ?? "สมาชิก", billingMonth, amountSatang: invoice.amountSatang, paidOn },
      update: { groupId: invoice.groupId, groupName: invoice.groupName ?? "Netflix", profileName: invoice.profileName ?? "สมาชิก", amountSatang: invoice.amountSatang, paidOn },
    });
    const updated = await tx.netflixLedgerEntry.updateMany({ where: { id: invoice.id, status: "PENDING_RECEIPT" }, data: { status: "PAID", transactionOn: paidOn, paidAt: new Date(), paidBy: access.session.user.id } });
    if (updated.count !== 1) throw new Error("ใบแจ้งหนี้นี้ได้รับการยืนยันไปแล้ว");
    const entry = await tx.netflixLedgerEntry.findUniqueOrThrow({ where: { id: invoice.id } });
    return { payment, invoice: entry };
  });
  return Response.json(result);
}
