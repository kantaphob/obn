import { prisma } from "@/lib/prisma";
import { getYoutubePageAccess } from "@/lib/youtube-access";
import { youtubeReceiptWhere } from "@/lib/youtube-receipt-filters";
const escape = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
export async function GET(request: Request) {
  const { allowed } = await getYoutubePageAccess("/dashboard/youtube/collections");
  if (!allowed) return Response.json({ error: "ไม่มีสิทธิ์ดูรายการรับเงิน" }, { status: 403 });
  const where = youtubeReceiptWhere(new URL(request.url).searchParams);
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ async start(controller) {
    try {
      controller.enqueue(encoder.encode("\uFEFF" + ["วันที่รับจริง", "สมาชิก", "กลุ่ม", "อีเมล", "ยอดบาท", "ช่องทาง", "อ้างอิง", "หมายเหตุ", "รอบครบกำหนด", "จำนวนเดือน"].map(escape).join(",") + "\r\n"));
      let cursor: string | undefined;
      for (;;) {
        const rows = await prisma.youtubePayment.findMany({ where, orderBy: [{ paidOn: "desc" }, { id: "desc" }], take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!rows.length) break;
        controller.enqueue(encoder.encode(rows.map((row) => [row.paidOn, row.memberName, row.groupName, row.email, (row.amountSatang / 100).toFixed(2), row.paymentMethod, row.reference, row.note, row.dueDate, row.billingMonths].map(escape).join(",")).join("\r\n") + "\r\n"));
        cursor = rows[rows.length - 1].id;
      }
      controller.close();
    } catch (error) { controller.error(error); }
  } }), { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": 'attachment; filename="youtube-receipts.csv"', "Cache-Control": "private, no-store" } });
}
