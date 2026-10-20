import type { Prisma } from "@/generated/prisma/client";
import { thaiDay } from "./loan-balance";
export function contractCompanyCode(documentData: string | null) {
  try { const data = JSON.parse(documentData || "{}"); return typeof data.companyCode === "string" ? data.companyCode : null; } catch { return null; }
}
export async function assertLoanPeriodOpen(tx: Prisma.TransactionClient, companyCode: string | null, date: Date) {
  const close = await tx.loanAccountingPeriod.findFirst({ where: { status: "CLOSED", ...(companyCode ? { companyCode } : {}), throughDate: { gte: new Date(thaiDay(date) - 7 * 3600000) } } });
  if (close) throw new Error("รายการอยู่ในรอบบัญชีที่ปิดแล้ว กรุณาให้ผู้อนุมัติเปิดรอบก่อน");
}
