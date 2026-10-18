import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const { id } = await context.params;
  const category = await prisma.companyFinanceCategory.findUnique({ where: { id } });
  if (!category) return Response.json({ error: "ไม่พบหมวดหมู่นี้" }, { status: 404 });
  if (category.isSystem) return Response.json({ error: "หมวดหมู่ที่ผูกกับระบบสัญญาไม่สามารถแก้ไขหรือนำออกได้" }, { status: 409 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const update: { name?: string; isActive?: boolean } = {};
  if ("name" in data) {
    if (typeof data.name !== "string" || !data.name.trim() || data.name.trim().length > 80) return Response.json({ error: "ชื่อหมวดหมู่ต้องมี 1–80 ตัวอักษร" }, { status: 400 });
    update.name = data.name.trim();
  }
  if ("isActive" in data) {
    if (typeof data.isActive !== "boolean") return Response.json({ error: "สถานะหมวดหมู่ไม่ถูกต้อง" }, { status: 400 });
    update.isActive = data.isActive;
  }
  if (!Object.keys(update).length) return Response.json({ error: "ไม่มีข้อมูลสำหรับบันทึก" }, { status: 400 });
  try {
    return Response.json(await prisma.companyFinanceCategory.update({ where: { id }, data: update }));
  } catch (error) {
    const duplicate = error && typeof error === "object" && "code" in error && error.code === "P2002";
    return Response.json({ error: duplicate ? "มีหมวดหมู่นี้อยู่แล้วในฝั่งรับ/จ่ายเดียวกัน" : "บันทึกหมวดหมู่ไม่สำเร็จ" }, { status: duplicate ? 409 : 500 });
  }
}
