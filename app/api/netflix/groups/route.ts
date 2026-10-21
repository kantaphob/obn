import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { parseNetflixGroup } from "@/lib/netflix";

async function authorize(write = false) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  }
  if (write && !access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") {
    return Response.json({ error: "ไม่มีสิทธิ์จัดการกลุ่ม Netflix" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  const groups = await prisma.netflixGroup.findMany({ include: { profiles: { orderBy: { position: "asc" } } }, orderBy: [{ createdAt: "desc" }, { name: "asc" }] });
  return Response.json({ groups });
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const parsed = parseNetflixGroup(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { profiles, ...group } = parsed.value;
  const created = await prisma.netflixGroup.create({
    data: { ...group, status: "ACTIVE", profiles: { create: profiles.map((profile, index) => ({ name: profile.name, contactEmail: profile.contactEmail || null, phone: profile.phone || null, position: index + 1 })) } },
    include: { profiles: { orderBy: { position: "asc" } } },
  });
  return Response.json({ group: created }, { status: 201 });
}

