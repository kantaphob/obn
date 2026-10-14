import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyRecord,
  validateFiveDigitCode,
} from "@/lib/company-sequence-api";

export async function GET() {
  try {
    return Response.json(await prisma.companySequence.findMany({
      include: { _count: { select: { branches: true } } },
      orderBy: { companycode: "asc" },
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return companySequenceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const codeError = validateFiveDigitCode(input?.companycode, "รหัสบริษัท");
    if (codeError) return Response.json({ error: codeError }, { status: 400 });
    const companycode = input.companycode.trim();
    const data = parseCompanyRecord(input);
    if (typeof data === "string") return Response.json({ error: data }, { status: 400 });

    return Response.json(await prisma.companySequence.create({
      data: { ...data, companycode, type: CompanySequenceType.COMPANY },
      include: { _count: { select: { branches: true } } },
    }), { status: 201 });
  } catch (error) {
    return companySequenceError(error);
  }
}
