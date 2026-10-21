import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return Response.json({ error: "ไม่มีสิทธิ์จัดการกลุ่ม Netflix" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "กรุณากรอกข้อมูลโปรไฟล์" }, { status: 400 });
  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const contactEmail = typeof data.contactEmail === "string" ? data.contactEmail.trim().toLowerCase() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  if (!name || name.length > 100 || contactEmail.length > 254 || phone.length > 40) return Response.json({ error: "กรุณากรอกชื่อโปรไฟล์ และตรวจสอบอีเมลหรือเบอร์โทร" }, { status: 400 });
  if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) return Response.json({ error: "รูปแบบอีเมลสมาชิกไม่ถูกต้อง" }, { status: 400 });

  const { id: groupId } = await params;
  try {
    const profile = await prisma.$transaction(async (tx) => {
      const group = await tx.netflixGroup.findUnique({ where: { id: groupId }, select: { id: true } });
      if (!group) return null;
      const count = await tx.netflixProfile.count({ where: { groupId } });
      if (count >= 5) throw new Error("PROFILE_LIMIT");
      return tx.netflixProfile.create({ data: { groupId, position: count + 1, name, contactEmail: contactEmail || null, phone: phone || null } });
    });
    if (!profile) return Response.json({ error: "ไม่พบกลุ่ม Netflix" }, { status: 404 });
    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_LIMIT") return Response.json({ error: "กลุ่มนี้มีครบ 5 โปรไฟล์แล้ว" }, { status: 409 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return Response.json({ error: "กลุ่มมีการเพิ่มโปรไฟล์พร้อมกัน กรุณาลองอีกครั้ง" }, { status: 409 });
    throw error;
  }
}
