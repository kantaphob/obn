import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { isWealthAssetCategory, parseWealthAssetDetails } from "@/lib/wealth-assets";

const DETAIL_KEYS = new Set(["provider", "weight", "unit", "purity", "symbol", "quantity", "broker", "location", "titleNumber", "area", "brand", "model", "year", "serialNumber", "plateNumber", "bankName", "accountName", "description"]);
const DEPRECIATION_METHODS = new Set(["NONE", "STRAIGHT_LINE", "DECLINING_BALANCE", "UNITS_OF_PRODUCTION"]);
const ACQUISITION_METHODS = new Set(["PURCHASE", "SELF_CONSTRUCTED", "TRANSFER", "LEASE", "DONATION", "OPENING_BALANCE"]);

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToSatang(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,13}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(satang) ? satang : null;
}

function dateFromInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const actual = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return actual === value ? date : null;
}

function sanitizeDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => DETAIL_KEYS.has(key) && typeof item === "string")
    .map(([key, item]) => [key, text(item, 160)])
    .filter(([, item]) => item));
}

async function getObnCompany() {
  return prisma.companySequence.findFirst({
    where: { nameEN: "OBN Co., Ltd.", type: "COMPANY", status: "ACTIVE" },
    select: { companycode: true, nameTH: true, nameEN: true },
  });
}

export async function GET() {
  const denied = await authorizeApiRequest("dashboard", "read");
  if (denied) return denied;
  const company = await getObnCompany();
  if (!company) return Response.json({ company: null, assets: [] }, { headers: { "Cache-Control": "no-store" } });
  const [branches, assets] = await Promise.all([prisma.branchCodeSequence.findMany({
    where: { companycode: company.companycode, type: "BRANCH", status: "ACTIVE" },
    select: { branchcode: true, nameTH: true, nameEN: true },
    orderBy: { branchcode: "asc" },
  }), prisma.wealthAsset.findMany({
    where: { companyCode: company.companycode, status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: { valuations: { orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }], take: 5 } },
  })]);
  return Response.json({
    company,
    locations: [{ branchCode: company.companycode, label: "สำนักงานใหญ่" }, ...branches.map((branch) => ({ branchCode: branch.branchcode, label: branch.nameTH || branch.nameEN || branch.branchcode }))],
    assets: assets.map((asset) => ({
      id: asset.id,
      assetCode: asset.assetCode,
      companyCode: asset.companyCode,
      branchCode: asset.branchCode || asset.companyCode,
      name: asset.name,
      category: asset.category,
      currency: asset.currency,
      acquisitionDate: asset.acquisitionDate?.toISOString() ?? null,
      readyForUseDate: asset.readyForUseDate?.toISOString() ?? null,
      acquisitionMethod: asset.acquisitionMethod,
      supplierName: asset.supplierName,
      supplierTaxId: asset.supplierTaxId,
      sourceDocumentNo: asset.sourceDocumentNo,
      purchasePrice: Number(asset.purchasePrice),
      directCosts: Number(asset.directCosts),
      recoverableVat: Number(asset.recoverableVat),
      nonRecoverableVat: Number(asset.nonRecoverableVat),
      acquisitionCost: Number(asset.acquisitionCost),
      currentValue: Number(asset.currentValue),
      residualValue: Number(asset.residualValue),
      usefulLifeMonths: asset.usefulLifeMonths,
      depreciationMethod: asset.depreciationMethod,
      depreciationStart: asset.depreciationStart?.toISOString() ?? null,
      accumulatedDep: Number(asset.accumulatedDep),
      accumulatedImpairment: Number(asset.accumulatedImpairment),
      taxCost: asset.taxCost === null ? null : Number(asset.taxCost),
      taxUsefulLifeMonths: asset.taxUsefulLifeMonths,
      taxDepMethod: asset.taxDepMethod,
      taxAccumulatedDep: asset.taxAccumulatedDep === null ? null : Number(asset.taxAccumulatedDep),
      ownershipBps: asset.ownershipBps,
      valuationDate: asset.valuationDate?.toISOString() ?? null,
      valuationSource: asset.valuationSource,
      details: parseWealthAssetDetails(asset.detailsJson),
      notes: asset.notes,
      createdAt: asset.createdAt.toISOString(),
      valuations: asset.valuations.map((valuation) => ({
        id: valuation.id,
        value: Number(valuation.value),
        valuationDate: valuation.valuationDate.toISOString(),
        source: valuation.source,
        note: valuation.note,
      })),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("accounting", "write");
  if (denied) return denied;
  if (!originAllowed(request)) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  const access = await getCurrentAccess();
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });

  const data = body as Record<string, unknown>;
  const name = text(data.name, 120);
  const category = data.category;
  const purchasePrice = amountToSatang(data.purchasePrice ?? data.acquisitionCost);
  const directCosts = amountToSatang(data.directCosts ?? "0");
  const recoverableVat = amountToSatang(data.recoverableVat ?? "0");
  const nonRecoverableVat = amountToSatang(data.nonRecoverableVat ?? "0");
  const acquisitionCost = purchasePrice !== null && directCosts !== null && nonRecoverableVat !== null
    ? purchasePrice + directCosts + nonRecoverableVat
    : null;
  const currentValue = amountToSatang(data.currentValue);
  const ownership = typeof data.ownershipPercentage === "string" && /^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(data.ownershipPercentage.trim())
    ? Number(data.ownershipPercentage)
    : null;
  const acquisitionDate = data.acquisitionDate ? dateFromInput(data.acquisitionDate) : null;
  const readyForUseDate = data.readyForUseDate ? dateFromInput(data.readyForUseDate) : null;
  const valuationDate = dateFromInput(data.valuationDate);
  const depreciationStart = data.depreciationStart ? dateFromInput(data.depreciationStart) : null;
  const residualValue = amountToSatang(data.residualValue ?? "0");
  const accumulatedDep = amountToSatang(data.accumulatedDep ?? "0");
  const accumulatedImpairment = amountToSatang(data.accumulatedImpairment ?? "0");
  const taxCost = data.taxCost === undefined || data.taxCost === "" ? null : amountToSatang(data.taxCost);
  const taxAccumulatedDep = data.taxAccumulatedDep === undefined || data.taxAccumulatedDep === "" ? null : amountToSatang(data.taxAccumulatedDep);
  const usefulLifeMonths = data.usefulLifeMonths === undefined || data.usefulLifeMonths === "" ? null : Number(data.usefulLifeMonths);
  const taxUsefulLifeMonths = data.taxUsefulLifeMonths === undefined || data.taxUsefulLifeMonths === "" ? null : Number(data.taxUsefulLifeMonths);
  const depreciationMethod = typeof data.depreciationMethod === "string" ? data.depreciationMethod : "NONE";
  const acquisitionMethod = typeof data.acquisitionMethod === "string" ? data.acquisitionMethod : "PURCHASE";
  if (!name) return Response.json({ error: "กรุณาระบุชื่อทรัพย์สิน" }, { status: 400 });
  if (!isWealthAssetCategory(category)) return Response.json({ error: "กรุณาเลือกประเภททรัพย์สิน" }, { status: 400 });
  if (purchasePrice === null || directCosts === null || recoverableVat === null || nonRecoverableVat === null || acquisitionCost === null || !Number.isSafeInteger(acquisitionCost) || currentValue === null) return Response.json({ error: "กรุณาระบุราคาซื้อ ค่าใช้จ่าย ภาษี และมูลค่าปัจจุบันเป็นจำนวนเงินที่ถูกต้อง" }, { status: 400 });
  if (data.acquisitionDate && !acquisitionDate) return Response.json({ error: "วันที่ได้มาไม่ถูกต้อง" }, { status: 400 });
  if (data.readyForUseDate && !readyForUseDate) return Response.json({ error: "วันที่พร้อมใช้งานไม่ถูกต้อง" }, { status: 400 });
  if (data.depreciationStart && !depreciationStart) return Response.json({ error: "วันที่เริ่มคิดค่าเสื่อมไม่ถูกต้อง" }, { status: 400 });
  if (!valuationDate) return Response.json({ error: "กรุณาระบุวันที่ประเมินมูลค่า" }, { status: 400 });
  if (residualValue === null || accumulatedDep === null || accumulatedImpairment === null || (taxCost === null && data.taxCost !== undefined && data.taxCost !== "") || (taxAccumulatedDep === null && data.taxAccumulatedDep !== undefined && data.taxAccumulatedDep !== "")) return Response.json({ error: "จำนวนเงินในข้อมูลค่าเสื่อมหรือภาษีไม่ถูกต้อง" }, { status: 400 });
  if ((usefulLifeMonths !== null && (!Number.isInteger(usefulLifeMonths) || usefulLifeMonths < 1 || usefulLifeMonths > 1200)) || (taxUsefulLifeMonths !== null && (!Number.isInteger(taxUsefulLifeMonths) || taxUsefulLifeMonths < 1 || taxUsefulLifeMonths > 1200))) return Response.json({ error: "อายุการใช้งานต้องระบุเป็นจำนวนเดือนตั้งแต่ 1 ถึง 1,200 เดือน" }, { status: 400 });
  if (!DEPRECIATION_METHODS.has(depreciationMethod) || !ACQUISITION_METHODS.has(acquisitionMethod)) return Response.json({ error: "วิธีได้มาหรือวิธีคิดค่าเสื่อมไม่ถูกต้อง" }, { status: 400 });
  if (residualValue + accumulatedDep + accumulatedImpairment > acquisitionCost || (taxAccumulatedDep !== null && (taxCost === null || taxAccumulatedDep > taxCost))) return Response.json({ error: "มูลค่าคงเหลือ ค่าเสื่อมสะสม หรือผลขาดทุนจากการด้อยค่าเกินฐานต้นทุน" }, { status: 400 });
  if (depreciationMethod !== "NONE" && (usefulLifeMonths === null || !depreciationStart)) return Response.json({ error: "วิธีคิดค่าเสื่อมต้องระบุอายุใช้งานและวันที่เริ่มคิดค่าเสื่อม" }, { status: 400 });
  if (ownership === null || ownership < 0.01 || ownership > 100) return Response.json({ error: "สัดส่วนกรรมสิทธิ์ต้องอยู่ระหว่าง 0.01 ถึง 100 เปอร์เซ็นต์" }, { status: 400 });

  const company = await getObnCompany();
  if (!company) return Response.json({ error: "ไม่พบทะเบียนบริษัท OBN Co., Ltd." }, { status: 409 });
  if (access?.accessConfigured && !access.companyCodes.includes(company.companycode)) {
    return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์บันทึกทรัพย์สินของ OBN Co., Ltd." }, { status: 403 });
  }

  const requestedBranchCode = text(data.branchCode, 5) || company.companycode;
  const branch = requestedBranchCode === company.companycode ? null : await prisma.branchCodeSequence.findFirst({
    where: { branchcode: requestedBranchCode, companycode: company.companycode, type: "BRANCH", status: "ACTIVE" },
    select: { branchcode: true },
  });
  if (requestedBranchCode !== company.companycode && !branch) return Response.json({ error: "ไม่พบสำนักงานใหญ่หรือสาขาที่เลือก" }, { status: 400 });

  const details = sanitizeDetails(data.details);
  const source = text(data.valuationSource, 120) || "ประเมินโดยผู้ใช้";
  const note = text(data.valuationNote, 500);
  const createdBy = access?.session.user.id;
  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.wealthAssetNumberSequence.upsert({
      where: { companyCode: company.companycode },
      create: { companyCode: company.companycode, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const assetCode = `OBN-AST-${String(sequence.lastNumber).padStart(6, "0")}`;
    const asset = await tx.wealthAsset.create({
      data: {
        assetCode,
        companyCode: company.companycode,
        branchCode: requestedBranchCode,
        name,
        category,
        acquisitionMethod,
        acquisitionDate,
        readyForUseDate,
        supplierName: text(data.supplierName, 160),
        supplierTaxId: text(data.supplierTaxId, 20),
        sourceDocumentNo: text(data.sourceDocumentNo, 100),
        purchasePrice: BigInt(purchasePrice),
        directCosts: BigInt(directCosts),
        recoverableVat: BigInt(recoverableVat),
        nonRecoverableVat: BigInt(nonRecoverableVat),
        acquisitionCost: BigInt(acquisitionCost),
        currentValue: BigInt(currentValue),
        residualValue: BigInt(residualValue),
        usefulLifeMonths,
        depreciationMethod,
        depreciationStart,
        accumulatedDep: BigInt(accumulatedDep),
        accumulatedImpairment: BigInt(accumulatedImpairment),
        taxCost: taxCost === null ? null : BigInt(taxCost),
        taxUsefulLifeMonths,
        taxDepMethod: text(data.taxDepMethod, 60),
        taxAccumulatedDep: taxAccumulatedDep === null ? null : BigInt(taxAccumulatedDep),
        ownershipBps: Math.round(ownership * 100),
        valuationDate,
        valuationSource: source,
        detailsJson: JSON.stringify(details),
        notes: text(data.notes, 2000),
        createdBy,
      },
    });
    await tx.wealthAssetValuation.create({
      data: { assetId: asset.id, value: BigInt(currentValue), valuationDate, source, note, createdBy },
    });
    return asset;
  });
  return Response.json({ id: result.id, assetCode: result.assetCode }, { status: 201 });
}
