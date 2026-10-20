import { prisma } from "@/lib/prisma";
import { authorizeYoutubeMember, parseYoutubeMemberInput, readYoutubeMemberBody } from "@/lib/youtube-members";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeYoutubeMember(true);
  if (denied) return denied;
  const { id } = await params;
  const input = parseYoutubeMemberInput(await readYoutubeMemberBody(request));
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  const current = await prisma.youtubeMember.findUnique({ where: { id }, include: { accounts: true } });
  if (!current) return Response.json({ error: "ไม่พบสมาชิกที่ต้องการแก้ไข" }, { status: 404 });
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

  const desiredEmails = new Set(input.emails.map((email) => email.toLocaleLowerCase("en")));
  const currentEmails = new Set(current.accounts.map((account) => account.email.toLocaleLowerCase("en")));
  const member = await prisma.$transaction(async (transaction) => {
    await transaction.youtubeMember.update({
      where: { id },
      data: {
        name: input.name,
        contactEmail: input.contactEmail || null,
        phone: input.phone || null,
        line: input.line || null,
        facebook: input.facebook || null,
        instagram: input.instagram || null,
      },
    });
    await transaction.youtubeMemberAccount.deleteMany({
      where: { memberId: id, email: { in: current.accounts.filter((account) => !desiredEmails.has(account.email.toLocaleLowerCase("en"))).map((account) => account.email) } },
    });
    const newEmails = input.emails.filter((email) => !currentEmails.has(email.toLocaleLowerCase("en")));
    if (newEmails.length) await transaction.youtubeMemberAccount.createMany({ data: newEmails.map((email) => ({ memberId: id, email })) });
    return transaction.youtubeMember.findUniqueOrThrow({ where: { id }, include: { accounts: { orderBy: { email: "asc" } } } });
  });
  return Response.json({ member });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeYoutubeMember(true);
  if (denied) return denied;
  const { id } = await params;
  const existing = await prisma.youtubeMember.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return Response.json({ error: "ไม่พบสมาชิกที่ต้องการลบ" }, { status: 404 });
  await prisma.youtubeMember.delete({ where: { id } });
  return Response.json({ success: true });
}
