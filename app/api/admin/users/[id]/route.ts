import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizeAdminApiRequest } from "@/lib/authorization";
import { SYSTEMS, TOOLS, flattenNavItems } from "@/lib/nav";

type Context = { params: Promise<{ id: string }> };
const appKeys = [...Object.keys(SYSTEMS), ...TOOLS.map((tool) => `tool:${tool.key}`)];
const menuHrefs = [...new Set(Object.values(SYSTEMS).flatMap((system) => system.groups.flatMap((group) => flattenNavItems(group.items).map((item) => item.href))).concat(TOOLS.map((tool) => tool.href)))];

export async function PATCH(request: Request, context: Context) {
  const access = await authorizeAdminApiRequest("users:manage");
  if (access instanceof Response) return access;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { name?: string; username?: string; email?: string; password?: string; role?: string; banned?: boolean; firstName?: string; lastName?: string; phone?: string; avatar?: string | null; companyCodes?: string[]; appKeys?: string[]; navigationHrefs?: string[] } | null;
  const user = await prisma.user.findUnique({ where: { id }, include: { companyAccess: true, appAccess: true, menuAccess: true } });
  if (!user || !body) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  const nextRole = typeof body.role === "string" ? await prisma.role.findUnique({ where: { code: body.role } }) : null;
  if (typeof body.role === "string" && !nextRole) return NextResponse.json({ error: "ไม่พบ Role ที่เลือก" }, { status: 400 });
  if (typeof body.role === "string" && user.id === access.session.user.id && body.role !== "owner") return NextResponse.json({ error: "ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานอยู่" }, { status: 400 });
  if (typeof body.banned === "boolean" && id === access.session.user.id) return NextResponse.json({ error: "ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่" }, { status: 400 });
  const usernameValue = typeof body.username === "string" ? body.username.trim().toLowerCase() : undefined;
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120)) return NextResponse.json({ error: "ชื่อที่แสดงไม่ถูกต้อง" }, { status: 400 });
  if (usernameValue !== undefined && !/^[a-z0-9_]{3,30}$/.test(usernameValue)) return NextResponse.json({ error: "Username ต้องมี 3–30 ตัว และใช้ได้เฉพาะ a-z, 0-9, _" }, { status: 400 });
  if (body.email !== undefined && (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128)) return NextResponse.json({ error: "รหัสผ่านต้องมี 8–128 ตัวอักษร" }, { status: 400 });
  for (const key of ["firstName", "lastName", "phone"] as const) if (body[key] !== undefined && (typeof body[key] !== "string" || body[key].length > 160)) return NextResponse.json({ error: "ข้อมูลโปรไฟล์ไม่ถูกต้อง" }, { status: 400 });
  if (body.avatar !== undefined && body.avatar !== null && (typeof body.avatar !== "string" || body.avatar.length > 2048)) return NextResponse.json({ error: "ลิงก์รูปโปรไฟล์ไม่ถูกต้อง" }, { status: 400 });
  if (body.companyCodes !== undefined || body.appKeys !== undefined || body.navigationHrefs !== undefined) {
    const [companies] = await Promise.all([prisma.companySequence.findMany({ select: { companycode: true } })]);
    const companyCodes = body.companyCodes ?? [];
    const selectedApps = body.appKeys ?? [];
    const selectedMenus = body.navigationHrefs ?? [];
    if (![companyCodes, selectedApps, selectedMenus].every(Array.isArray) || companyCodes.some((code) => !companies.some((company) => company.companycode === code)) || selectedApps.some((key) => !appKeys.includes(key)) || selectedMenus.some((href) => !menuHrefs.includes(href))) {
      return NextResponse.json({ error: "รายการบริษัทหรือสิทธิ์เมนูไม่ถูกต้อง" }, { status: 400 });
    }
    if (id === access.session.user.id && ((body.appKeys !== undefined && !selectedApps.includes("admin")) || (body.navigationHrefs !== undefined && !selectedMenus.includes("/admin/users")))) {
      return NextResponse.json({ error: "ไม่สามารถนำสิทธิ์จัดการบัญชีของบัญชีที่กำลังใช้งานอยู่ออกได้" }, { status: 400 });
    }
  }
  if (body.name !== undefined || usernameValue !== undefined || body.email !== undefined) {
    const data: Record<string, string> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (usernameValue !== undefined) data.username = usernameValue;
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    await auth.api.adminUpdateUser({ headers: await headers(), body: { userId: id, data } });
  }
  if (body.password !== undefined) await auth.api.setUserPassword({ headers: await headers(), body: { userId: id, newPassword: body.password } });
  const profileData = Object.fromEntries(
    (["firstName", "lastName", "phone", "avatar"] as const)
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, key === "avatar" ? body[key] || null : (body[key] as string).trim()]),
  );
  if (Object.keys(profileData).length) {
    await prisma.userProfile.upsert({ where: { userId: id }, create: { userId: id, ...profileData }, update: profileData });
  }
  if (typeof body.role === "string") {
    await prisma.user.update({ where: { id }, data: { role: body.role } });
  }
  if (typeof body.banned === "boolean") {
    if (body.banned) await auth.api.banUser({ headers: await headers(), body: { userId: id, banReason: "ระงับโดยผู้ดูแลระบบ" } });
    else await auth.api.unbanUser({ headers: await headers(), body: { userId: id } });
    await prisma.user.update({ where: { id }, data: { status: body.banned ? "SUSPENDED" : "ACTIVE" } });
  }
  if (body.companyCodes !== undefined || body.appKeys !== undefined || body.navigationHrefs !== undefined) {
    const companyCodes = body.companyCodes ?? user.companyAccess.map((entry) => entry.companyCode);
    const selectedApps = body.appKeys ?? user.appAccess.map((entry) => entry.appKey);
    const selectedMenus = body.navigationHrefs ?? user.menuAccess.map((entry) => entry.href);
    await prisma.$transaction(async (tx) => {
      await tx.userCompanyAccess.deleteMany({ where: { userId: id } });
      await tx.userAppAccess.deleteMany({ where: { userId: id } });
      await tx.userMenuAccess.deleteMany({ where: { userId: id } });
      await tx.user.update({ where: { id }, data: { accessConfigured: true } });
      if (companyCodes.length) await tx.userCompanyAccess.createMany({ data: companyCodes.map((companyCode) => ({ userId: id, companyCode })) });
      if (selectedApps.length) await tx.userAppAccess.createMany({ data: selectedApps.map((appKey) => ({ userId: id, appKey })) });
      if (selectedMenus.length) await tx.userMenuAccess.createMany({ data: selectedMenus.map((href) => ({ userId: id, href })) });
    });
  }
  return NextResponse.json({ ok: true });
}
