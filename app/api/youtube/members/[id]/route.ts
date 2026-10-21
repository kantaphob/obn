import { prisma } from "@/lib/prisma";
import { authorizeYoutubeMember, parseYoutubeMemberInput, readYoutubeMemberBody } from "@/lib/youtube-members";
import { getCurrentAccess } from "@/lib/authorization";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeYoutubeMember(true);
  if (denied) return denied;
  const { id } = await params;
  const input = parseYoutubeMemberInput(await readYoutubeMemberBody(request));
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  const current = await prisma.youtubeMember.findUnique({ where: { id }, include: { accounts: true } });
  if (!current) return Response.json({ error: "ไม่พบสมาชิกที่ต้องการแก้ไข" }, { status: 404 });
  if (current.archivedAt || input.version !== current.updatedAt.toISOString()) return Response.json({ error: "ข้อมูลสมาชิกเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
  const normalized = (emails: string[]) => emails.map((email) => email.toLocaleLowerCase("en")).sort();
  if (input.emails.length && JSON.stringify(normalized(input.emails)) !== JSON.stringify(normalized(current.accounts.map((account) => account.email)))) {
    return Response.json({ error: "ไม่สามารถเพิ่ม ลบ หรือแก้ไขอีเมลบัญชี YouTube ได้" }, { status: 403 });
  }
  const [members, accounts] = await Promise.all([
    prisma.youtubeMember.findMany({ where: { id: { not: id } }, select: { name: true } }),
    prisma.youtubeMemberAccount.findMany({ where: { memberId: { not: id } }, select: { email: true } }),
  ]);
  if (members.some((member) => member.name.toLocaleLowerCase("th") === input.name.toLocaleLowerCase("th"))) {
    return Response.json({ error: "มีชื่อสมาชิกนี้ในระบบแล้ว" }, { status: 409 });
  }
  const existingEmails = new Set(accounts.map((account) => account.email.toLocaleLowerCase("en")));
  if (input.emails.some((email) => existingEmails.has(email.toLocaleLowerCase("en")))) {
    return Response.json({ error: "มีอีเมลบัญชีนี้ผูกกับสมาชิกอื่นแล้ว" }, { status: 409 });
  }

  const access = await getCurrentAccess();
  try {
  const member = await prisma.$transaction(async (tx) => {
    const updated = await tx.youtubeMember.update({
      where: { id, updatedAt: current.updatedAt, archivedAt: null },
      data: {
        name: input.name,
        contactEmail: input.contactEmail || null,
        phone: input.phone || null,
        line: input.line || null,
        facebook: input.facebook || null,
        instagram: input.instagram || null,
      },
      include: { accounts: { orderBy: { email: "asc" } } },
  });
    await tx.youtubeBillingSeat.updateMany({ where: { memberId: id }, data: { displayName: input.name } });
    if (access?.session?.user) await recordYoutubeActivity(access.session.user, { action: "UPDATE", entityType: "MEMBER", entityId: id, entityLabel: updated.name, summary: "แก้ไขข้อมูลสมาชิกหรือข้อมูลติดต่อ" }, tx);
    return updated;
  });
  return Response.json({ member });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2025", "P2002", "P2034", "P2028"].includes(String(error.code))) return Response.json({ error: "ข้อมูลสมาชิกเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeYoutubeMember(true);
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.youtubeMember.findUnique({ where: { id }, include: { accounts: { select: { id: true } } } });
  if (!existing) return Response.json({ error: "ไม่พบสมาชิกที่ต้องการลบ" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || body.version !== existing.updatedAt.toISOString()) return Response.json({ error: "ข้อมูลสมาชิกเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
  const seats = await prisma.youtubeBillingSeat.count({ where: { memberId: id, group: { status: { not: "ARCHIVED" } } } });
  if (seats) return Response.json({ error: "นำสมาชิกออกจากกลุ่มที่ใช้งานก่อนเก็บเข้าคลัง" }, { status: 409 });
  const access = await getCurrentAccess();
  try {
  await prisma.$transaction(async (tx) => {
    const active = await tx.youtubeBillingSeat.count({ where: { memberId: id, group: { status: { not: "ARCHIVED" } } } });
    if (active) throw new Error("MEMBER_IN_GROUP");
    await tx.youtubeMember.update({ where: { id }, data: { archivedAt: new Date() } });
    if (access?.session?.user) await recordYoutubeActivity(access.session.user, { action: "DELETE", entityType: "MEMBER", entityId: id, entityLabel: existing.name, summary: "เก็บสมาชิกเข้าคลัง โดยรักษาประวัติทั้งหมด" }, tx);
  });
  return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_IN_GROUP") return Response.json({ error: "สมาชิกยังอยู่ในกลุ่มที่ใช้งาน กรุณารีเฟรช" }, { status: 409 });
    throw error;
  }
}
