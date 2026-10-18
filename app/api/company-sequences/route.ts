import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyOwner,
  parseCompanyRecord,
  validateFiveDigitCode,
} from "@/lib/company-sequence-api";

export async function GET() {
  const denied = await authorizeApiRequest("companies", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  try {
    return Response.json(await prisma.companySequence.findMany({
      where: access?.accessConfigured ? { companycode: { in: access.companyCodes } } : undefined,
      include: { owner: true, _count: { select: { branches: true } } },
      orderBy: { companycode: "asc" },
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return companySequenceError(error);
  }
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("companies", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  try {
    const input = await request.json();
    const codeError = validateFiveDigitCode(input?.companycode, "รหัสบริษัท");
    if (codeError) return Response.json({ error: codeError }, { status: 400 });
    const companycode = input.companycode.trim();
    if (access?.accessConfigured && !access.companyCodes.includes(companycode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
    const owner = parseCompanyOwner(input);
    if (typeof owner === 'string') return Response.json({ error: owner }, { status: 400 });
    const data = parseCompanyRecord(input);
    if (typeof data === "string") return Response.json({ error: data }, { status: 400 });

    const ownerData = Object.values(owner).some((value) => value !== null && value !== '') ? owner : null;
    return Response.json(await prisma.companySequence.create({
      data: { ...data, companycode, type: CompanySequenceType.COMPANY, ...(ownerData ? { owner: { create: ownerData } } : {}) },
      include: { owner: true, _count: { select: { branches: true } } },
    }), { status: 201 });
  } catch (error) {
    return companySequenceError(error);
  }
}
