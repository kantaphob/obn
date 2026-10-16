import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyRecord,
  validateFiveDigitCode,
} from "@/lib/company-sequence-api";

export async function GET(request: Request) {
  try {
    const companycode = new URL(request.url).searchParams.get("companycode")?.trim();
    const branchcode = new URL(request.url).searchParams.get("branchcode")?.trim();
    if (branchcode && !/^\d{5}$/.test(branchcode)) {
      return Response.json({ error: "กรุณาระบุรหัสสาขา 5 หลัก" }, { status: 400 });
    }
    return Response.json(await prisma.branchCodeSequence.findMany({
      where: { ...(companycode ? { companycode } : {}), ...(branchcode ? { branchcode } : {}) },
      include: {
        company: { select: { owner: true, nameTH: true, nameEN: true, TaxIdentificationNumber: true, address: true, postcode: true, phone: true } },
      },
      orderBy: [{ companycode: "asc" }, { branchcode: "asc" }],
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return companySequenceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const companycode = typeof input?.companycode === "string" ? input.companycode.trim() : "";
    const branchcode = typeof input?.branchcode === "string" ? input.branchcode.trim() : "";
    const branchCodeError = validateFiveDigitCode(branchcode, "รหัสสาขา");
    if (branchCodeError) return Response.json({ error: branchCodeError }, { status: 400 });
    const companyCodeError = validateFiveDigitCode(companycode, "รหัสบริษัท");
    if (companyCodeError) return Response.json({ error: companyCodeError }, { status: 400 });
    const data = parseCompanyRecord(input);
    if (typeof data === "string") return Response.json({ error: data }, { status: 400 });

    return Response.json(await prisma.branchCodeSequence.create({
      data: { ...data, companycode, branchcode, type: CompanySequenceType.BRANCH },
      include: { company: { select: { owner: true, nameTH: true, nameEN: true, TaxIdentificationNumber: true, address: true, postcode: true, phone: true } } },
    }), { status: 201 });
  } catch (error) {
    return companySequenceError(error);
  }
}
