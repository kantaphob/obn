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
    const companycode = typeof input?.companycode === "string" ? input.companycode.trim() : "";
    const branchcode = typeof input?.branchcode === "string" ? input.branchcode.trim() : "";
    const branchCodeError = validateFiveDigitCode(branchcode, "รหัสสาขา");
    if (branchCodeError) return Response.json({ error: branchCodeError }, { status: 400 });
    const companyCodeError = validateFiveDigitCode(companycode, "รหัสบริษัท");
    if (companyCodeError) return Response.json({ error: companyCodeError }, { status: 400 });
    const data = parseCompanyRecord(input);
    if (typeof data === "string") return Response.json({ error: data }, { status: 400 });

    return Response.json(await prisma.branchCodeSequence.update({
      where: { id },
      data: { ...data, companycode, branchcode, type: CompanySequenceType.BRANCH },
      include: { company: { select: { owner: true, nameTH: true, nameEN: true, TaxIdentificationNumber: true, address: true, postcode: true, phone: true } } },
    }));
  } catch (error) {
    return companySequenceError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await prisma.branchCodeSequence.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return companySequenceError(error);
  }
}
