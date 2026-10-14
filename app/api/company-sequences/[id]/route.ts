import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyRecord,
  validateFiveDigitCode,
} from "@/lib/company-sequence-api";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = await request.json();
    const codeError = validateFiveDigitCode(input?.companycode, "รหัสบริษัท");
    if (codeError) return Response.json({ error: codeError }, { status: 400 });
    const data = parseCompanyRecord(input);
    if (typeof data === "string") return Response.json({ error: data }, { status: 400 });

    return Response.json(await prisma.companySequence.update({
      where: { id },
      data: { ...data, companycode: input.companycode.trim(), type: CompanySequenceType.COMPANY },
      include: { _count: { select: { branches: true } } },
    }));
  } catch (error) {
    return companySequenceError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await prisma.companySequence.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return companySequenceError(error);
  }
}
