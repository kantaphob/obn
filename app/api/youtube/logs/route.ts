import { getYoutubePageAccess } from "@/lib/youtube-access";
import { prisma } from "@/lib/prisma";
import { youtubeAuditFilters } from "@/lib/youtube-audit-filters";

const escape = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
export async function GET(request: Request) {
  const { allowed } = await getYoutubePageAccess("/dashboard/youtube/logs");
  if (!allowed) return Response.json({ error: "ไม่มีสิทธิ์ดูประวัติ" }, { status: 403 });
  const { historyWhere } = youtubeAuditFilters(Object.fromEntries(new URL(request.url).searchParams));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode("\uFEFF" + ["เวลา", "ประเภท", "รหัสรายการ", "การทำงาน", "ก่อนแก้ไข", "หลังแก้ไข"].map(escape).join(",") + "\r\n"));
        let cursor: string | undefined;
        for (;;) {
          const rows = await prisma.youtubeRecordHistory.findMany({ where: historyWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
          if (!rows.length) break;
          controller.enqueue(encoder.encode(rows.map((row) => [row.createdAt.toISOString(), row.entityType, row.entityId, row.action, row.beforeJson, row.afterJson].map(escape).join(",")).join("\r\n") + "\r\n"));
          cursor = rows[rows.length - 1].id;
        }
        controller.close();
      } catch (error) { controller.error(error); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": 'attachment; filename="youtube-history.csv"', "Cache-Control": "private, no-store" } });
}
