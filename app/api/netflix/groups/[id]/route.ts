import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { parseNetflixGroup } from "@/lib/netflix";

async function authorize() {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("dashboard")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  if (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") return Response.json({ error: "ไม่มีสิทธิ์จัดการกลุ่ม Netflix" }, { status: 403 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const parsed = parseNetflixGroup(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { id } = await params;
  const existing = await prisma.netflixGroup.findUnique({ where: { id }, include: { profiles: true } });
  if (!existing) return Response.json({ error: "ไม่พบกลุ่ม Netflix" }, { status: 404 });
  const { profiles, ...group } = parsed.value;
  const requestedIds = profiles.map((profile) => profile.profileId).filter(Boolean);
  if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((profileId) => !existing.profiles.some((profile) => profile.id === profileId))) {
    return Response.json({ error: "รายการโปรไฟล์เปลี่ยนแปลง กรุณารีเฟรชและลองอีกครั้ง" }, { status: 409 });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.netflixGroup.findUniqueOrThrow({ where: { id }, include: { profiles: true } });
    await tx.netflixGroup.update({ where: { id }, data: group });
    const keepIds = profiles.map((profile) => profile.profileId).filter(Boolean);
    await tx.netflixProfile.deleteMany({ where: { groupId: id, id: { notIn: keepIds } } });
    for (const [index, profile] of profiles.entries()) {
      const data = { name: profile.name, contactEmail: profile.contactEmail || null, phone: profile.phone || null, position: index + 1 };
      if (profile.profileId) {
        if (!current.profiles.some((entry) => entry.id === profile.profileId)) throw new Error("STALE_PROFILE");
        await tx.netflixProfile.update({ where: { id: profile.profileId }, data });
      } else {
        await tx.netflixProfile.create({ data: { ...data, groupId: id } });
      }
    }
    return tx.netflixGroup.findUniqueOrThrow({ where: { id }, include: { profiles: { orderBy: { position: "asc" } } } });
  });
  return Response.json({ group: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.netflixGroup.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "ไม่พบกลุ่ม Netflix" }, { status: 404 });
  await prisma.netflixGroup.delete({ where: { id } });
  return Response.json({ success: true });
}
