import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { recordYoutubeActivity } from "@/lib/youtube-activity";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCurrentAccess();
  if (!access || (access.accessConfigured && !access.appKeys.includes("youtube")) || (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner")) return Response.json({ error: "ไม่มีสิทธิ์ยกเลิกใบแจ้งหนี้" }, { status: 403 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(id) || !body || body.action !== "cancel" || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 500) return Response.json({ error: "ระบุเหตุผลยกเลิกใบแจ้งหนี้" }, { status: 400 });
  const invoice = await prisma.youtubeInvoice.findUnique({ where: { id } });
  if (!invoice || invoice.status !== "ISSUED" || body.version !== invoice.updatedAt.toISOString()) return Response.json({ error: "ใบแจ้งหนี้เปลี่ยนสถานะแล้ว กรุณารีเฟรช หากชำระแล้วให้ยกเลิกผ่านสมุดบัญชี" }, { status: 409 });
  const count = await prisma.$transaction(async (tx) => {
    const changed = await tx.youtubeInvoice.updateMany({ where: { id, status: "ISSUED", updatedAt: invoice.updatedAt }, data: { status: "CANCELLED", sourceKey: `cancelled:${id}:${invoice.sourceKey}`, note: body.reason.trim() } });
    if (changed.count && access.session?.user) await recordYoutubeActivity(access.session.user, { action: "DELETE", entityType: "INVOICE", entityId: String(id), entityLabel: `YT-INV-${String(id).padStart(6, "0")}`, summary: body.reason.trim() }, tx);
    return changed.count;
  });
  return count ? Response.json({ success: true }) : Response.json({ error: "ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
}
