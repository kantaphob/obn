import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { getCompanyLedgerRows } from "@/lib/company-ledger";

function csv(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function dateInput(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("accounting", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  const params = new URL(request.url).searchParams;
  const from = dateInput(params.get("from"));
  const to = dateInput(params.get("to"));
  const ledgerRows = await getCompanyLedgerRows(from, to);
  const entries = access?.accessConfigured ? ledgerRows.filter((entry) => entry.companyCode && access.companyCodes.includes(entry.companyCode)) : ledgerRows;
  const rows = [
    ["วันที่", "เวลา", "เลขที่รายการ", "รหัสสำนักงานใหญ่", "รหัสสาขา", "ประเภท", "รายการ", "หมวดหมู่", "ผู้เกี่ยวข้อง", "ช่องทาง", "เลขอ้างอิง", "แหล่งข้อมูล", "ยอดฐาน (บาท)", "VAT (%)", "VAT (บาท)", "WHT (%)", "WHT (บาท)", "รายรับสุทธิ (บาท)", "รายจ่ายสุทธิ (บาท)", "หมายเหตุ"],
    ...entries.map((entry) => [
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(entry.transactionDate),
      !entry.timeRecorded
        ? "ไม่ระบุเวลา"
        : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(entry.transactionDate),
      entry.documentNumber ?? "", entry.companyCode ?? "", entry.branchCode ?? "",
      entry.type === "INCOME" ? "รายรับ" : "รายจ่าย", entry.title, entry.category, entry.party,
      entry.method === "BANK_TRANSFER" ? "โอนเงิน" : entry.method === "CARD" ? "บัตร" : entry.method === "OTHER" ? "อื่นๆ" : "เงินสด",
      entry.reference, entry.source === "LOAN" ? "รายการสินเชื่อ" : "บันทึกเอง",
      entry.source === "MANUAL" ? ((entry.baseAmount ?? entry.amount) / 100).toFixed(2) : "",
      entry.vatRateBps === null ? "" : (entry.vatRateBps / 100).toFixed(2),
      entry.vatAmount === null ? "" : (entry.vatAmount / 100).toFixed(2),
      entry.whtRateBps === null ? "" : (entry.whtRateBps / 100).toFixed(2),
      entry.whtAmount === null ? "" : (entry.whtAmount / 100).toFixed(2),
      entry.type === "INCOME" ? (entry.amount / 100).toFixed(2) : "", entry.type === "EXPENSE" ? (entry.amount / 100).toFixed(2) : "", entry.note,
    ]),
  ];
  const content = `\uFEFF${rows.map((row) => row.map(csv).join(",")).join("\r\n")}`;
  return new Response(content, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="company-ledger.csv"' } });
}
