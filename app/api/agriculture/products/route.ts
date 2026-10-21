import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const denied = await authorizeApiRequest("dashboard", "read");
  if (denied) return denied;
  const products = await prisma.agricultureProduct.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
  return Response.json({ products }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("dashboard", "write");
  if (denied) return denied;
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = text(data.name, 160);
  const barcode = text(data.barcode, 80) || null;
  if (!name) return Response.json({ error: "กรุณาระบุชื่อสินค้า" }, { status: 400 });

  try {
    const product = await prisma.agricultureProduct.create({
      data: {
        barcode,
        name,
        formula: text(data.formula, 120),
        brand: text(data.brand, 120),
        other: text(data.other, 1000),
      },
    });
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json({ error: "บาร์โค้ดนี้ถูกใช้กับสินค้าอื่นแล้ว" }, { status: 409 });
    }
    throw error;
  }
}
