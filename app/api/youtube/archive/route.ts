import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authorization";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

export async function POST(request: Request) {
  const access = await getCurrentAccess();
  if (!access || (access.accessConfigured && !access.appKeys.includes("youtube")) || (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner")) return Response.json({ error: "ไม่มีสิทธิ์กู้คืนข้อมูล" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !["GROUP", "MEMBER"].includes(body.type)) return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const item = body.type === "GROUP" ? await prisma.youtubeBillingGroup.findUnique({ where: { id: body.id } }) : await prisma.youtubeMember.findUnique({ where: { id: body.id } });
  if (!item) return Response.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
  if (body.type === "GROUP" && await prisma.youtubeBillingSeat.count({ where: { groupId: body.id, member: { archivedAt: { not: null } } } })) return Response.json({ error: "กรุณากู้คืนสมาชิกของกลุ่มจากคลังก่อนกู้คืนกลุ่ม" }, { status: 409 });
  await prisma.$transaction(async (tx) => {
    if (body.type === "GROUP") await tx.youtubeBillingGroup.update({ where: { id: body.id }, data: { status: "ACTIVE" } });
    else await tx.youtubeMember.update({ where: { id: body.id }, data: { archivedAt: null } });
    if (access.session?.user) await recordYoutubeActivity(access.session.user, { action: "UPDATE", entityType: body.type, entityId: body.id, entityLabel: item.name, summary: "กู้คืนจากคลังข้อมูล" }, tx);
  });
  return Response.json({ success: true });
}
