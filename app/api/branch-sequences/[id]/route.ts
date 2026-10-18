import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyRecord,
  validateFiveDigitCode,
} from "@/lib/company-sequence-api";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await authorizeApiRequest("companies", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  try {
    const { id } = await params;
    const current = await prisma.branchCodeSequence.findUnique({ where: { id }, select: { companycode: true } });
    if (!current) return Response.json({ error: "ไม่พบสาขา" }, { status: 404 });
    if (access?.accessConfigured && !access.companyCodes.includes(current.companycode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
    const input = await request.json();
    const companycode = typeof input?.companycode === "string" ? input.companycode.trim() : "";
    const branchcode = typeof input?.branchcode === "string" ? input.branchcode.trim() : "";
    const branchCodeError = validateFiveDigitCode(branchcode, "รหัสสาขา");
    if (branchCodeError) return Response.json({ error: branchCodeError }, { status: 400 });
    const companyCodeError = validateFiveDigitCode(companycode, "รหัสบริษัท");
    if (companyCodeError) return Response.json({ error: companyCodeError }, { status: 400 });
    if (access?.accessConfigured && !access.companyCodes.includes(companycode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
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
  const denied = await authorizeApiRequest("companies", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  try {
    const { id } = await params;
    const current = await prisma.branchCodeSequence.findUnique({ where: { id }, select: { companycode: true } });
    if (!current) return Response.json({ error: "ไม่พบสาขา" }, { status: 404 });
    if (access?.accessConfigured && !access.companyCodes.includes(current.companycode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
    await prisma.branchCodeSequence.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return companySequenceError(error);
  }
}
