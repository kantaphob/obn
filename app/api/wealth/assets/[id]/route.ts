import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function amountToSatang(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,13}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(satang) ? satang : null;
}

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateFromInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const actual = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return actual === value ? date : null;
}

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const access = await getCurrentAccess();
  const { id } = await context.params;
  const asset = await prisma.wealthAsset.findUnique({ where: { id }, select: { id: true, companyCode: true } });
  if (!asset) return Response.json({ error: "ไม่พบรายการทรัพย์สิน" }, { status: 404 });
  if (access?.accessConfigured && !access.companyCodes.includes(asset.companyCode)) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์แก้ไขทรัพย์สินของบริษัทนี้" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const value = amountToSatang(data.currentValue);
  const valuationDate = dateFromInput(data.valuationDate);
  if (value === null) return Response.json({ error: "กรุณาระบุมูลค่าเป็นจำนวนเงินไม่ติดลบ" }, { status: 400 });
  if (!valuationDate) return Response.json({ error: "วันที่ประเมินมูลค่าไม่ถูกต้อง" }, { status: 400 });
  const source = text(data.valuationSource, 120) || "ประเมินโดยผู้ใช้";
  const note = text(data.valuationNote, 500);
  const createdBy = access?.session.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.wealthAsset.update({
      where: { id },
      data: { currentValue: BigInt(value), valuationDate, valuationSource: source },
    });
    await tx.wealthAssetValuation.create({
      data: { assetId: id, value: BigInt(value), valuationDate, source, note, createdBy },
    });
  });
  return Response.json({ success: true });
}
