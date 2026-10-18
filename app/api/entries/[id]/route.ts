import { authorizeApiRequest } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function PATCH(request: Request, context: RouteContext<"/api/entries/[id]">) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  const { id } = await context.params;
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

  const existing = await prisma.entry.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }

  const entry = await prisma.entry.update({
    where: { id },
    data: {
      title,
      category: readText(data.category, 60) || "ทั่วไป",
      description: readText(data.description, 1000),
      status: data.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    },
  });

  return Response.json(entry);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/entries/[id]">) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  const { id } = await context.params;
  const existing = await prisma.entry.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }

  await prisma.entry.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
