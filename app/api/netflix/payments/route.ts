import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

function authorize(write = false) {
  return getCurrentAccess().then((access) => {
    if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (access.accessConfigured && !access.appKeys.includes("dashboard")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
    if (write && !access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return Response.json({ error: "ไม่มีสิทธิ์บันทึกรับเงิน Netflix" }, { status: 403 });
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

export async function GET(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!validMonth(month)) return Response.json({ error: "รูปแบบเดือนต้องเป็น YYYY-MM" }, { status: 400 });
  const [payments, invoices] = await Promise.all([
    prisma.netflixPayment.findMany({ where: { billingMonth: month }, orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }] }),
    prisma.netflixLedgerEntry.findMany({ where: { source: "MEMBER_INVOICE", sourceKey: { endsWith: `:${month}` } }, orderBy: [{ transactionOn: "asc" }, { createdAt: "desc" }] }),
  ]);
  return Response.json({ payments, invoices });
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "กรุณากรอกข้อมูลรับเงิน" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const profileId = typeof data.profileId === "string" ? data.profileId : "";
  const billingMonth = typeof data.billingMonth === "string" ? data.billingMonth : "";
  const paidOn = typeof data.paidOn === "string" ? data.paidOn : "";
  const amount = typeof data.amountBaht === "string" || typeof data.amountBaht === "number" ? Number(data.amountBaht) : NaN;
  if (!profileId || !validMonth(billingMonth) || !validDate(paidOn) || paidOn > today()) return Response.json({ error: "กรุณาระบุสมาชิก เดือน และวันที่รับเงินจริงให้ถูกต้อง" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return Response.json({ error: "ยอดรับเงินต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท" }, { status: 400 });

  const profile = await prisma.netflixProfile.findUnique({ where: { id: profileId }, include: { group: { select: { id: true, name: true, startedOn: true } } } });
  if (!profile) return Response.json({ error: "ไม่พบโปรไฟล์สมาชิก" }, { status: 404 });
  if (profile.group.startedOn && (billingMonth < profile.group.startedOn.slice(0, 7) || paidOn < profile.group.startedOn)) return Response.json({ error: "วันที่รับเงินต้องไม่อยู่ก่อนวันเริ่มกลุ่ม" }, { status: 400 });
  const amountSatang = Math.round(amount * 100);
  const sourceKey = `profile-month:${profileId}:${billingMonth}`;
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.netflixPayment.upsert({
      where: { profileId_billingMonth: { profileId, billingMonth } },
      create: { profileId, groupId: profile.groupId, groupName: profile.group.name, profileName: profile.name, billingMonth, amountSatang, paidOn },
      update: { groupId: profile.groupId, groupName: profile.group.name, profileName: profile.name, amountSatang, paidOn },
    });
    const entry = await tx.netflixLedgerEntry.upsert({
      where: { sourceKey },
      create: { sourceKey, source: "PROFILE_PAYMENT", type: "INCOME", status: "PAID", groupId: profile.groupId, groupName: profile.group.name, profileId, profileName: profile.name, title: `รับชำระ Netflix ประจำเดือน ${billingMonth}`, category: "ค่าบริการสมาชิก", amountSatang, transactionOn: paidOn, paymentMethod: "OTHER", paidAt: new Date(), note: `รายการรับเงินจากโปรไฟล์ ${profile.name}` },
      update: { groupId: profile.groupId, groupName: profile.group.name, profileId, profileName: profile.name, title: `รับชำระ Netflix ประจำเดือน ${billingMonth}`, amountSatang, transactionOn: paidOn, paidAt: new Date(), note: `รายการรับเงินจากโปรไฟล์ ${profile.name}` },
    });
    return { payment, entry };
  });
  return Response.json(result, { status: 201 });
}
