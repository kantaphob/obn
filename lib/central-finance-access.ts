import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";

export async function authorizeCentralFinanceRequest(request: Request, action: "read" | "write") {
  const system = new URL(request.url).searchParams.get("system");
  if (system !== "YOUTUBE") return authorizeApiRequest("accounting", action);
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("youtube")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอป YouTube" }, { status: 403 });
  const allowed = access.roleCode === "owner" || access.permissions.includes("*")
    || (action === "write" ? access.permissions.includes("dashboard:write") : access.permissions.includes("dashboard:read") || access.permissions.includes("dashboard:write"));
  return allowed ? null : Response.json({ error: "ไม่มีสิทธิ์ดำเนินการกับบัญชี YouTube" }, { status: 403 });
}
