import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type Direction = "INCOME" | "EXPENSE";
function message(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return "มีหมวดหมู่นี้อยู่แล้วในฝั่งรับ/จ่ายเดียวกัน";
  return fallback;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const direction = params.get("direction");
  const categories = await prisma.companyFinanceCategory.findMany({
    where: {
      ...(direction === "INCOME" || direction === "EXPENSE" ? { direction } : {}),
      ...(params.get("activeOnly") === "true" ? { isActive: true } : {}),
    },
    orderBy: [{ direction: "asc" }, { isSystem: "desc" }, { name: "asc" }],
  });
  return Response.json(categories, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const direction = data.direction;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (direction !== "INCOME" && direction !== "EXPENSE") return Response.json({ error: "กรุณาเลือกประเภทรายการรับหรือจ่าย" }, { status: 400 });
  if (!name || name.length > 80) return Response.json({ error: "ชื่อหมวดหมู่ต้องมี 1–80 ตัวอักษร" }, { status: 400 });
  try {
    const category = await prisma.companyFinanceCategory.create({
      data: { code: `CUSTOM_${randomUUID().replaceAll("-", "").toUpperCase()}`, direction: direction as Direction, name },
    });
    return Response.json(category, { status: 201 });
  } catch (error) {
    return Response.json({ error: message(error, "เพิ่มหมวดหมู่ไม่สำเร็จ") }, { status: error && typeof error === "object" && "code" in error && error.code === "P2002" ? 409 : 500 });
  }
}
