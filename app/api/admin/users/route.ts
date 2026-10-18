import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizeAdminApiRequest } from "@/lib/authorization";
import { SYSTEMS, TOOLS, flattenNavItems } from "@/lib/nav";

const appKeys = [...Object.keys(SYSTEMS), ...TOOLS.map((tool) => `tool:${tool.key}`)];
const menuHrefs = [...new Set(Object.values(SYSTEMS).flatMap((system) => system.groups.flatMap((group) => flattenNavItems(group.items).map((item) => item.href))).concat(TOOLS.map((tool) => tool.href)))];

export async function GET() {
  const access = await authorizeAdminApiRequest("users:manage");
  if (access instanceof Response) return access;
  const [users, companies] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, include: { profile: true, companyAccess: true, appAccess: true, menuAccess: true } }),
    prisma.companySequence.findMany({ where: { status: "ACTIVE" }, select: { companycode: true, nameTH: true, nameEN: true }, orderBy: { companycode: "asc" } }),
  ]);
  return NextResponse.json({ companies, users: users.map(({ profile, companyAccess, appAccess, menuAccess, ...user }) => ({
    id: user.id,
    userprofileId: profile?.id ?? null,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    banned: user.banned,
    status: user.status.toLowerCase(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    phone: profile?.phone ?? "",
    avatar: profile?.avatar ?? "",
    accessConfigured: user.accessConfigured,
    companyCodes: user.accessConfigured ? companyAccess.map((access) => access.companyCode) : companies.map((company) => company.companycode),
    appKeys: user.accessConfigured ? appAccess.map((access) => access.appKey) : appKeys,
    navigationHrefs: user.accessConfigured ? menuAccess.map((access) => access.href) : menuHrefs,
  })) });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApiRequest("users:manage");
  if (access instanceof Response) return access;
  const body = await request.json().catch(() => null) as { name?: string; username?: string; email?: string; password?: string; role?: string; firstName?: string; lastName?: string; phone?: string; avatar?: string; companyCodes?: string[]; appKeys?: string[]; navigationHrefs?: string[] } | null;
  const availableRoles = await prisma.role.findMany({ select: { code: true } });
  const availableCompanies = await prisma.companySequence.findMany({ select: { companycode: true } });
  const usernameValue = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!body || typeof body.name !== "string" || !body.name.trim() || !/^[a-z0-9_]{3,30}$/.test(usernameValue) || typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128 || !availableRoles.some(role => role.code === body.role)) {
    return NextResponse.json({ error: "กรุณากรอกชื่อ Username (3–30 ตัว a-z, 0-9, _) อีเมล รหัสผ่าน 8–128 ตัว และ Role ให้ถูกต้อง" }, { status: 400 });
  }
  if ([body.firstName, body.lastName, body.phone].some(value => value !== undefined && (typeof value !== "string" || value.length > 160)) || (body.avatar !== undefined && (typeof body.avatar !== "string" || body.avatar.length > 2048))) {
    return NextResponse.json({ error: "ข้อมูลโปรไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }
  const requestedCompanies = body.companyCodes ?? [];
  const requestedApps = body.appKeys ?? [];
  const requestedMenus = body.navigationHrefs ?? [];
  if (![requestedCompanies, requestedApps, requestedMenus].every(Array.isArray) || requestedCompanies.some((code) => !availableCompanies.some((company) => company.companycode === code)) || requestedApps.some((key) => !appKeys.includes(key)) || requestedMenus.some((href) => !menuHrefs.includes(href))) {
    return NextResponse.json({ error: "รายการบริษัทหรือสิทธิ์เมนูไม่ถูกต้อง" }, { status: 400 });
  }
  let createdUserId: string | null = null;
  try {
    // Better Auth's admin plugin only accepts the statically configured roles.
    // Create the account with the default role, then apply the database-backed role.
    const result = await auth.api.createUser({ headers: await headers(), body: { name: body.name.trim(), email: body.email.trim().toLowerCase(), password: body.password, role: "staff", data: { username: usernameValue } } });
    createdUserId = result.user.id;
    const profile = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: result.user.id }, data: { role: body.role } });
      const createdProfile = await tx.userProfile.create({ data: {
        userId: result.user.id,
        firstName: body.firstName?.trim() ?? "",
        lastName: body.lastName?.trim() ?? "",
        phone: body.phone?.trim() ?? "",
        avatar: body.avatar?.trim() || null,
      } });
      await tx.user.update({ where: { id: result.user.id }, data: { accessConfigured: true } });
      await tx.userCompanyAccess.createMany({ data: requestedCompanies.map((companyCode) => ({ userId: result.user.id, companyCode })) });
      await tx.userAppAccess.createMany({ data: requestedApps.map((appKey) => ({ userId: result.user.id, appKey })) });
      await tx.userMenuAccess.createMany({ data: requestedMenus.map((href) => ({ userId: result.user.id, href })) });
      return createdProfile;
    });
    return NextResponse.json({ user: { id: result.user.id, userprofileId: profile.id, username: usernameValue, name: result.user.name, email: result.user.email, role: body.role } }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      await auth.api.removeUser({ headers: await headers(), body: { userId: createdUserId } }).catch(() => undefined);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "สร้างบัญชีไม่สำเร็จ" }, { status: 400 });
  }
}
