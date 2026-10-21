import { getCurrentAccess } from "@/lib/authorization";
import { generateYoutubeBillingDocuments } from "@/lib/youtube-invoices";
export async function POST() {
  const access = await getCurrentAccess();
  if (!access || (access.accessConfigured && !access.appKeys.includes("youtube")) || (!access.permissions.includes("*") && !access.permissions.includes("dashboard:write") && access.roleCode !== "owner")) return Response.json({ error: "ไม่มีสิทธิ์สร้างเอกสาร" }, { status: 403 });
  await generateYoutubeBillingDocuments();
  return Response.json({ success: true });
}
