import { getCurrentAccess } from "@/lib/authorization";

export async function authorizeYoutubeMember(write: boolean) {
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (access.accessConfigured && !access.appKeys.includes("youtube")) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงแอปนี้" }, { status: 403 });
  }
  if (write && !access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner") {
    return Response.json({ error: "ไม่มีสิทธิ์จัดการสมาชิก YouTube" }, { status: 403 });
  }
  return null;
}

export function parseYoutubeMemberInput(body: unknown) {
  if (!body || typeof body !== "object") return { error: "กรุณากรอกข้อมูลสมาชิก" };
  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const contactEmail = typeof data.contactEmail === "string" ? data.contactEmail.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const line = typeof data.line === "string" ? data.line.trim() : "";
  const facebook = typeof data.facebook === "string" ? data.facebook.trim() : "";
  const instagram = typeof data.instagram === "string" ? data.instagram.trim() : "";
  const rawEmails = Array.isArray(data.emails) ? data.emails : [];
  if (!name || name.length > 150) return { error: "กรุณาระบุชื่อสมาชิกไม่เกิน 150 ตัวอักษร" };
  if (contactEmail && (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) return { error: "อีเมลติดต่อไม่ถูกต้อง" };
  if ([phone, line, facebook, instagram].some((value) => value.length > 200)) return { error: "ข้อมูลติดต่อมีความยาวเกินกำหนด" };
  if (rawEmails.length > 20 || rawEmails.some((email) => typeof email !== "string")) return { error: "ตรวจสอบรายการอีเมลอีกครั้ง" };
  const emails = rawEmails.map((email) => (email as string).trim()).filter(Boolean);
  if (emails.some((email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "มีอีเมลที่รูปแบบไม่ถูกต้อง" };
  if (new Set(emails.map((email) => email.toLocaleLowerCase("en"))).size !== emails.length) return { error: "อีเมลซ้ำกันในสมาชิกคนนี้" };
  return { name, contactEmail, phone, line, facebook, instagram, emails, version: typeof data.version === "string" ? data.version : "" };
}

export async function readYoutubeMemberBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
