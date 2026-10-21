import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyOwner,
  parseCompanyRecord,
  validateFiveDigitCode,
} from "@/lib/company-sequence-api";
import { resolveBusinessSystemScope, type BusinessSystem } from "@/lib/company-system";

const BUSINESS_SYSTEMS: BusinessSystem[] = ["LOAN", "CONSTRUCTION", "BUILDIN", "AGRICULTURE", "YOUTUBE", "NETFLIX"];

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("companies", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  try {
    const params = new URL(request.url).searchParams;
    const system = params.get("system");
    if (system && !BUSINESS_SYSTEMS.includes(system as BusinessSystem)) return Response.json({ error: "ระบบบริษัทไม่ถูกต้อง" }, { status: 400 });
    const companies = await prisma.companySequence.findMany({
      where: access?.accessConfigured ? { companycode: { in: access.companyCodes } } : undefined,
      include: { owner: true, _count: { select: { branches: true } } },
      orderBy: { companycode: "asc" },
    });
    if (!system) return Response.json(companies, { headers: { "Cache-Control": "no-store" } });
    const branches = await prisma.branchCodeSequence.findMany({
      where: { type: "BRANCH", status: "ACTIVE", ...(access?.accessConfigured ? { companycode: { in: access.companyCodes } } : {}) },
      select: { companycode: true, branchcode: true, nameTH: true, nameEN: true },
    });
    const scope = resolveBusinessSystemScope(system as BusinessSystem, companies, branches);
    return Response.json(companies.filter((company) => company.status === "ACTIVE" && scope.companyCodes.has(company.companycode)), { headers: { "Cache-Control": "no-store" } });
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
