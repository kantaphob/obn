import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { CompanySequenceType } from "@/generated/prisma/enums";
import {
  companySequenceError,
  parseCompanyOwner,
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
    const current = await prisma.companySequence.findUnique({ where: { id }, select: { companycode: true } });
    if (!current) return Response.json({ error: "ไม่พบบริษัท" }, { status: 404 });
    if (access?.accessConfigured && !access.companyCodes.includes(current.companycode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
    const input = await request.json();
    const codeError = validateFiveDigitCode(input?.companycode, "รหัสบริษัท");
    if (codeError) return Response.json({ error: codeError }, { status: 400 });
    if (access?.accessConfigured && !access.companyCodes.includes(input.companycode.trim())) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
    const owner = parseCompanyOwner(input);
    if (typeof owner === 'string') return Response.json({ error: owner }, { status: 400 });
    const data = parseCompanyRecord(input);
    if (typeof data === "string") return Response.json({ error: data }, { status: 400 });

    return Response.json(await prisma.companySequence.update({
      where: { id },
      data: { ...data, companycode: input.companycode.trim(), type: CompanySequenceType.COMPANY, ...(Object.keys(owner).length ? { owner: { upsert: { create: owner, update: owner } } } : {}) },
      include: { owner: true, _count: { select: { branches: true } } },
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
    const current = await prisma.companySequence.findUnique({ where: { id }, select: { companycode: true } });
    if (!current) return Response.json({ error: "ไม่พบบริษัท" }, { status: 404 });
    if (access?.accessConfigured && !access.companyCodes.includes(current.companycode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });
    await prisma.companySequence.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return companySequenceError(error);
  }
}
