import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const denied = await authorizeApiRequest("companies", "read");
  if (denied) return denied;
  const access = await getCurrentAccess();
  const companyCode = new URL(request.url).searchParams.get("code")?.trim();
  if (!companyCode || !/^\d{5}$/.test(companyCode)) {
    return Response.json({ error: "กรุณาระบุรหัสบริษัท" }, { status: 400 });
  }
  if (access?.accessConfigured && !access.companyCodes.includes(companyCode)) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงบริษัทที่เลือก" }, { status: 403 });

  const company = await prisma.companySequence.findUnique({
    where: { companycode: companyCode },
    select: { companycode: true, nameTH: true, nameEN: true, TaxIdentificationNumber: true, address: true, postcode: true, phone: true },
  });
  if (company) {
    return Response.json({
      companyCode: company.companycode,
      name: company.nameTH || company.nameEN || company.companycode,
      taxId: company.TaxIdentificationNumber ?? "",
      address: company.address ?? "",
      postcode: company.postcode ?? "",
      phone: company.phone ?? "",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // Keep previously registered legacy companies available to existing contracts.
  const legacyCompany = await prisma.company.findUnique({
    where: { companyCode },
    select: { companyCode: true, name: true, taxId: true, address: true, postcode: true, phone: true },
  });
  if (!legacyCompany) return Response.json({ error: "ไม่พบข้อมูลบริษัทจากรหัสที่ระบุ" }, { status: 404 });

  return Response.json(legacyCompany, { headers: { "Cache-Control": "no-store" } });
}
