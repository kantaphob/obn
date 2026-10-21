import { prisma } from "@/lib/prisma";
import { authorizeYoutubeMember, parseYoutubeMemberInput, readYoutubeMemberBody } from "@/lib/youtube-members";
import { getCurrentAccess } from "@/lib/authorization";
import { recordYoutubeActivity } from "@/lib/youtube-activity";

export async function GET() {
  const denied = await authorizeYoutubeMember(false);
  if (denied) return denied;
  const members = await prisma.youtubeMember.findMany({ where: { archivedAt: null },
    include: { accounts: { orderBy: { email: "asc" } } },
    orderBy: { name: "asc" },
  });
  return Response.json({ members });
}

export async function POST(request: Request) {
  const denied = await authorizeYoutubeMember(true);
  if (denied) return denied;
  const input = parseYoutubeMemberInput(await readYoutubeMemberBody(request));
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  if (input.emails.length) return Response.json({ error: "ไม่สามารถเพิ่มหรือแก้ไขอีเมลบัญชี YouTube ในระบบสมาชิกได้" }, { status: 403 });

  const [members, accounts] = await Promise.all([
    prisma.youtubeMember.findMany({ select: { name: true } }),
    prisma.youtubeMemberAccount.findMany({ select: { email: true } }),
  ]);
  if (members.some((member) => member.name.toLocaleLowerCase("th") === input.name.toLocaleLowerCase("th"))) {
    return Response.json({ error: "มีชื่อสมาชิกนี้ในระบบแล้ว" }, { status: 409 });
  }
  const existingEmails = new Set(accounts.map((account) => account.email.toLocaleLowerCase("en")));
  if (input.emails.some((email) => existingEmails.has(email.toLocaleLowerCase("en")))) {
    return Response.json({ error: "มีอีเมลบัญชีนี้ผูกกับสมาชิกอื่นแล้ว" }, { status: 409 });
  }

  const access = await getCurrentAccess();
  const member = await prisma.$transaction(async (tx) => {
    const saved = await tx.youtubeMember.create({
    data: {
      name: input.name,
      contactEmail: input.contactEmail || null,
      phone: input.phone || null,
      line: input.line || null,
      facebook: input.facebook || null,
      instagram: input.instagram || null,
      accounts: { create: input.emails.map((email) => ({ email })) },
    },
    include: { accounts: { orderBy: { email: "asc" } } },
  });
    if (access?.session?.user) await recordYoutubeActivity(access.session.user, { action: "CREATE", entityType: "MEMBER", entityId: saved.id, entityLabel: saved.name, summary: "เพิ่มข้อมูลสมาชิก" }, tx);
    return saved;
  });
  return Response.json({ member }, { status: 201 });
}
