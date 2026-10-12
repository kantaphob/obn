import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET() {
  await connection();
  const entries = await prisma.entry.findMany({ orderBy: { createdAt: "desc" } });
  const rows = [
    ["ชื่อรายการ", "หมวดหมู่", "รายละเอียด", "สถานะ", "วันที่สร้าง", "อัปเดตล่าสุด"],
    ...entries.map((entry) => [
      entry.title,
      entry.category,
      entry.description,
      entry.status === "ACTIVE" ? "กำลังใช้งาน" : "เก็บถาวร",
      entry.createdAt.toISOString(),
      entry.updatedAt.toISOString(),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="datahaus-entries.csv"',
    },
  });
}
