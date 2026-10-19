import { unlink } from "node:fs/promises";
import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { isUploadUrl, saveBorrowerFile, storedUploadPath } from "@/lib/borrower-file-storage";
import { prisma } from "@/lib/prisma";
import { isLoanFinanceCategoryCode } from "@/lib/company-ledger-summary";

type Context = { params: Promise<{ id: string }> };
const API_ROUTE = "/api/company-ledger/evidence";
const STORAGE_AREA = "company-ledger-evidence";
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function validFileContent(mime: string, data: Buffer) {
  if (mime === "application/pdf") return data.subarray(0, 5).toString() === "%PDF-";
  if (mime === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8;
  if (mime === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp") return data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  return false;
}

async function getEditableLoanEntry(id: string) {
  const access = await getCurrentAccess();
  const entry = await prisma.companyLedgerEntry.findUnique({ where: { id }, include: { financeCategory: true } });
  if (!entry) return { response: Response.json({ error: "ไม่พบรายการใบรับ/จ่าย" }, { status: 404 }) };
  if (access?.accessConfigured && (!entry.companyCode || !access.companyCodes.includes(entry.companyCode))) {
    return { response: Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 }) };
  }
  if (!entry.financeCategory || !isLoanFinanceCategoryCode(entry.financeCategory.code)) {
    return { response: Response.json({ error: "แนบหลักฐานได้เฉพาะรายการในสมุด Loan" }, { status: 400 }) };
  }
  return { entry };
}

export async function POST(request: Request, context: Context) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const { id } = await context.params;
  const result = await getEditableLoanEntry(id);
  if (result.response) return result.response;
  const body = await request.formData().catch(() => null);
  const file = body?.get("file");
  if (!(file instanceof File) || !MIME_EXTENSIONS[file.type] || file.size < 1 || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "รองรับ JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 10 MB" }, { status: 400 });
  }
  const data = Buffer.from(await file.arrayBuffer());
  if (!validFileContent(file.type, data)) return Response.json({ error: "ชนิดไฟล์ไม่ตรงกับเนื้อหา" }, { status: 400 });

  let saved: Awaited<ReturnType<typeof saveBorrowerFile>>;
  try {
    saved = await saveBorrowerFile({
      storageArea: STORAGE_AREA,
      borrowerCode: result.entry.companyCode || "LOAN",
      contractNumber: result.entry.id,
      extension: MIME_EXTENSIONS[file.type],
      apiRoute: API_ROUTE,
      data,
    });
  } catch (error) {
    console.error("Company ledger evidence upload failed:", error);
    return Response.json({ error: "จัดเก็บไฟล์สลิปไม่สำเร็จ" }, { status: 500 });
  }

  try {
    await prisma.companyLedgerEntry.update({ where: { id }, data: { attachmentUrl: saved.url } });
  } catch (error) {
    await unlink(saved.path).catch(() => {});
    console.error("Company ledger evidence link save failed:", error);
    return Response.json({ error: "บันทึกลิงก์สลิปไม่สำเร็จ" }, { status: 500 });
  }
  if (result.entry.attachmentUrl && isUploadUrl(result.entry.attachmentUrl, API_ROUTE, Object.values(MIME_EXTENSIONS))) {
    await unlink(storedUploadPath(STORAGE_AREA, result.entry.attachmentUrl)).catch(() => {});
  }
  return Response.json({ url: saved.url }, { status: 201 });
}
