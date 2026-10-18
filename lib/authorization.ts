import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AppPermission } from "@/lib/auth-roles";

export type PermissionArea = "dashboard" | "borrowers" | "contracts" | "repayments" | "accounting" | "companies" | "masterdata" | "logs" | "integrations";

export async function getCurrentAccess({ includeNavigation = false }: { includeNavigation?: boolean } = {}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, banned: true, status: true, accessConfigured: true, appAccess: { select: { appKey: true } }, companyAccess: { select: { companyCode: true } }, ...(includeNavigation ? { menuAccess: { select: { href: true } } } : {}) } });
  if (!user || user.banned || user.status !== "ACTIVE") return null;
  const role = await prisma.role.findUnique({ where: { code: user.role || "staff" } });
  let permissions: string[] = [];
  try { permissions = role ? JSON.parse(role.permissions) as string[] : []; } catch { permissions = []; }
  const menuAccess = "menuAccess" in user ? user.menuAccess : [];
  return { session, roleCode: user.role || "staff", roleName: role?.name || "พนักงาน", permissions, accessConfigured: user.accessConfigured, appKeys: user.appAccess.map((item) => item.appKey), companyCodes: user.companyAccess.map((item) => item.companyCode), navigationHrefs: menuAccess.map((item) => item.href) };
}

export async function authorizeApiRequest(area: PermissionArea, action: "read" | "write") {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const key = area === "integrations" ? "integrations:manage" : area === "logs" ? "logs:read" : `${area}:${action}` as AppPermission;
  const implicitRead = action === "read" && access.permissions.includes(`${area}:write`);
  if (!access.permissions.includes("*") && !access.permissions.includes(key) && !implicitRead) {
    return Response.json({ error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 403 });
  }
  const appByArea: Record<PermissionArea, string> = {
    dashboard: "dashboard",
    borrowers: "loan",
    contracts: "loan",
    repayments: "loan",
    accounting: "dashboard",
    companies: "dashboard",
    masterdata: "dashboard",
    logs: "admin",
    integrations: "admin",
  };
  if (access.accessConfigured && !access.appKeys.includes(appByArea[area])) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  }
  return null;
}

export async function authorizeAdminApiRequest(permission: "roles:manage" | "users:manage") {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("admin")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปจัดการระบบ" }, { status: 403 });
  if (!access.permissions.includes("*") && !access.permissions.includes(permission)) {
    return Response.json({ error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 403 });
  }
  return access;
}
