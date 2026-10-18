import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authorization";
import { SYSTEMS, TOOLS, flattenNavItems } from "@/lib/nav";

const appKeys = [...Object.keys(SYSTEMS), ...TOOLS.map((tool) => `tool:${tool.key}`)];
const menuHrefs = [...new Set(Object.values(SYSTEMS).flatMap((system) => system.groups.flatMap((group) => flattenNavItems(group.items).map((item) => item.href))).concat(TOOLS.map((tool) => tool.href)))];

export async function GET() {
  const access = await getCurrentAccess();
  if (!access) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: access.session.user.id },
    include: { companyAccess: true, appAccess: true, menuAccess: true },
  });
  if (!user) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 401 });
  const companies = user.accessConfigured
    ? user.companyAccess.map((entry) => entry.companyCode)
    : (await prisma.companySequence.findMany({ where: { status: "ACTIVE" }, select: { companycode: true } })).map((company) => company.companycode);
  return NextResponse.json({
    configured: user.accessConfigured,
    companyCodes: companies,
    appKeys: user.accessConfigured ? user.appAccess.map((entry) => entry.appKey) : appKeys,
    navigationHrefs: user.accessConfigured ? user.menuAccess.map((entry) => entry.href) : menuHrefs,
  }, { headers: { "Cache-Control": "no-store" } });
}
