import { Prisma } from "@/generated/prisma/client";
import { CompanySequenceStatus } from "@/generated/prisma/enums";
import { isCompanyOwnerDocumentUrl } from '@/lib/company-file-storage';

export const companyFields = [
  "logo",
  "paymentBankCode", "paymentAccountNumber", "paymentAccountName", "paymentQrUrl",
  "houseNo", "moo", "soi", "road", "provinceId", "districtId", "subdistrictId",
  "nameTH",
  "nameEN",
  "TaxIdentificationNumber",
  "aboutus",
  "companyoverview",
  "address",
  "postcode",
  "phone",
  "email",
] as const;

export type CompanyField = (typeof companyFields)[number];
export type CompanyRecordInput = Record<CompanyField, string | null> & {
  status: CompanySequenceStatus;
};

export function parseCompanyRecord(value: unknown): CompanyRecordInput | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "ข้อมูลไม่ถูกต้อง";
  }

  const input = value as Record<string, unknown>;
  const data = {} as Record<CompanyField, string | null>;
  for (const field of companyFields) {
    const raw = input[field];
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return `ข้อมูล ${field} ไม่ถูกต้อง`;
    }
    data[field] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  if (data.paymentBankCode && !/^\d{3}$/.test(data.paymentBankCode)) return 'รหัสธนาคารไม่ถูกต้อง';
  if (data.paymentAccountNumber && !/^[0-9 -]{5,40}$/.test(data.paymentAccountNumber)) return 'เลขบัญชีต้องเป็นตัวเลข ไม่เกิน 40 ตัวอักษร';
  if (data.paymentAccountName && data.paymentAccountName.length > 200) return 'ชื่อบัญชียาวเกินกำหนด';
  if (data.paymentQrUrl && !data.paymentQrUrl.startsWith('/api/company-payment-qrs/')) return 'QR Code ไม่ถูกต้อง';
  const status = input.status ?? CompanySequenceStatus.ACTIVE;
  if (status !== CompanySequenceStatus.ACTIVE && status !== CompanySequenceStatus.INACTIVE) {
    return "สถานะไม่ถูกต้อง";
  }

  return { ...data, status };
}

export function validateFiveDigitCode(value: unknown, label: string): string | null {
  if (typeof value !== "string" || !/^\d{5}$/.test(value.trim())) {
    return `${label}ต้องเป็นตัวเลข 5 หลัก`;
  }
  return null;
}

export function companySequenceError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ error: "รหัสนี้ถูกใช้แล้ว" }, { status: 409 });
    if (error.code === "P2003" || error.code === "P2025") {
      return Response.json({ error: "ไม่พบข้อมูลที่เกี่ยวข้องหรือข้อมูลถูกใช้งานอยู่" }, { status: 409 });
    }
  }
  console.error("Company and branch request failed:", error);
  return Response.json({ error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
}

export function parseCompanyOwner(value: Record<string, unknown>) {
  const data: { ownerPrefix?: string | null; ownerFirstName?: string | null; ownerLastName?: string | null; ownerPhone?: string | null; ownerEmail?: string | null; ownerNationalId?: string | null; ownerAddress?: string | null; ownerProvince?: string | null; ownerDistrict?: string | null; ownerSubdistrict?: string | null; ownerPostcode?: string | null; ownerMoo?: string | null; ownerSoi?: string | null; ownerRoad?: string | null; ownerProvinceId?: number | null; ownerDistrictId?: number | null; ownerSubdistrictId?: number | null; ownerDocumentUrl?: string | null; ownerDocumentName?: string | null } = {};
  for (const key of ['ownerPrefix', 'ownerFirstName', 'ownerLastName', 'ownerPhone', 'ownerEmail', 'ownerDocumentUrl', 'ownerDocumentName', 'ownerNationalId', 'ownerAddress', 'ownerProvince', 'ownerDistrict', 'ownerSubdistrict', 'ownerPostcode', 'ownerMoo', 'ownerSoi', 'ownerRoad'] as const) {
    if (!(key in value)) continue;
    const raw = value[key];
    if (raw !== null && typeof raw !== 'string') return 'ข้อมูลเจ้าของไม่ถูกต้อง';
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (text.length > (key === 'ownerPhone' ? 40 : key === 'ownerAddress' ? 200 : 200)) return 'ข้อมูลเจ้าของยาวเกินกำหนด';
    if (key === 'ownerEmail' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'อีเมลเจ้าของไม่ถูกต้อง';
    if (key === 'ownerDocumentUrl' && text && !isCompanyOwnerDocumentUrl(text)) return 'เอกสารเจ้าของไม่ถูกต้อง';
    if (key === 'ownerNationalId' && text && !/^\d{13}$/.test(text)) return 'เลขประจำตัวประชาชนเจ้าของต้องเป็นตัวเลข 13 หลัก';
    if (key === 'ownerPostcode' && text && !/^\d{5}$/.test(text)) return 'รหัสไปรษณีย์ไม่ถูกต้อง';
    data[key] = text || null;
  }

  for (const key of ['ownerProvinceId', 'ownerDistrictId', 'ownerSubdistrictId'] as const) {
    if (!(key in value)) continue;
    const raw = value[key];
    if (raw === null || raw === '') {
      data[key] = null;
      continue;
    }
    const id = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(id) || id < 1) return 'รหัสตำบล อำเภอ หรือจังหวัดไม่ถูกต้อง';
    data[key] = id;
  }
  return data;
}
