import { prisma } from "@/lib/prisma";

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const status = searchParams.get("status")?.trim();

  const entries = await prisma.entry.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { category: { contains: query } },
              { description: { contains: query } },
            ],
          }
        : {}),
      ...(category && category !== "ทั้งหมด" ? { category } : {}),
      ...(status && status !== "ALL" ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(entries);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const title = readText(data.title, 120);
  if (!title) {
    return Response.json({ error: "กรุณาระบุชื่อรายการ" }, { status: 400 });
  }

  const entry = await prisma.entry.create({
    data: {
      title,
      category: readText(data.category, 60) || "ทั่วไป",
      description: readText(data.description, 1000),
      status: data.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    },
  });

  return Response.json(entry, { status: 201 });
}
