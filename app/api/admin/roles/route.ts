import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAdminApiRequest } from "@/lib/authorization";
import { rolePermissionChoices, type AppPermission } from "@/lib/auth-roles";

export async function GET() {
  const access = await authorizeAdminApiRequest("roles:manage");
  if (access instanceof Response) return access;
  const roles = await prisma.role.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(roles.map(role => ({ ...role, permissions: parsePermissions(role.permissions) })));
}

export async function PATCH(request: Request) {
  const access = await authorizeAdminApiRequest("roles:manage");
  if (access instanceof Response) return access;
  const body = await request.json().catch(() => null) as { code?: string; name?: string; description?: string; permissions?: unknown } | null;
  const validKeys = new Set<string>(rolePermissionChoices.map(item => item.key));
  if (!body?.code || typeof body.name !== "string" || typeof body.description !== "string" || !Array.isArray(body.permissions)) {
    return NextResponse.json({ error: "ข้อมูล Role ไม่ครบถ้วน" }, { status: 400 });
  }
  if (body.code === "owner") {
    return NextResponse.json({ error: "ไม่สามารถแก้ไขบทบาทเจ้าของระบบได้" }, { status: 400 });
  }
  if (body.permissions.some(item => typeof item !== "string" || !validKeys.has(item))) {
    return NextResponse.json({ error: "พบรายการสิทธิ์ที่ไม่รองรับ" }, { status: 400 });
  }
  const permissions = [...new Set(body.permissions as string[])];
  try {
    await prisma.role.update({ where: { code: body.code }, data: { name: body.name.trim(), description: body.description.trim(), permissions: JSON.stringify(permissions) } });
  } catch {
    return NextResponse.json({ error: "ไม่พบบทบาทที่ต้องการแก้ไข" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApiRequest("roles:manage");
  if (access instanceof Response) return access;
  const body = await request.json().catch(() => null) as { code?: unknown; name?: unknown; description?: unknown; permissions?: unknown } | null;
  const validKeys = new Set<string>(rolePermissionChoices.map((item) => item.key));
  if (!body || typeof body.code !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(body.code) || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 80 || typeof body.description !== "string" || body.description.length > 240 || !Array.isArray(body.permissions)) {
    return NextResponse.json({ error: "กรุณากรอกรหัสบทบาท ชื่อ และรายละเอียดให้ถูกต้อง" }, { status: 400 });
  }
  if (body.code === "owner" || body.permissions.some((item) => typeof item !== "string" || !validKeys.has(item))) {
    return NextResponse.json({ error: "รหัสบทบาทหรือรายการสิทธิ์ไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const role = await prisma.role.create({
      data: {
        code: body.code,
        name: body.name.trim(),
        description: body.description.trim(),
        permissions: JSON.stringify([...new Set(body.permissions as string[])]),
        isSystem: false,
      },
    });
    return NextResponse.json({ ...role, permissions: parsePermissions(role.permissions) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "รหัสบทบาทนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น" }, { status: 409 });
  }
}

function parsePermissions(value: string): string[] {
  try { return JSON.parse(value) as AppPermission[]; } catch { return []; }
}

