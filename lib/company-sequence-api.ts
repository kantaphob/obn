import { Prisma } from "@/generated/prisma/client";
import { CompanySequenceStatus } from "@/generated/prisma/enums";

export const companyFields = [
  "logo",
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
