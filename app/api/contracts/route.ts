import { thaiDay } from "@/lib/loan-balance";
import { assertLoanCompanyAccess, canAccessLoanDraft } from "@/lib/loan-access";
import { authorizeApiRequest } from "@/lib/authorization";
import { createLoanApplication, loanApplicationFields, loanRequestTypes } from '@/lib/loan-application';
import { after } from 'next/server';
import { syncLoanGoogleSheet } from '@/lib/integrations/google-sheets';
import { emptyDocumentSettings } from "@/lib/contract-document";
import { access, unlink } from "node:fs/promises";
import { ContractStatus, ContractType, InterestMode, InterestRateBasis, RepayType, SignatureMode } from "@/generated/prisma/enums";
import { isPrismaCode } from "@/lib/borrowers";
import { prisma } from "@/lib/prisma";
import { formatBorrowerCode } from "@/lib/borrower-code";
import { writeLoanLog } from "@/lib/loan-logs";
import { isUploadUrl, saveBorrowerFile, storedUploadPath } from "@/lib/borrower-file-storage";

const CONSENT_TEXT = "ข้าพเจ้ายืนยันว่าลายเซ็นดิจิทัลที่เขียนข้างต้นเป็นลายเซ็นจริงของข้าพเจ้า และยินยอมใช้ลายเซ็นนี้ประกอบสัญญาฉบับนี้";

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function amount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function date(value: unknown, dateOnly = false) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOneOf<T extends Record<string, string>>(values: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(values).includes(value);
}

function bangkokYear() {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
}

function formatContractNumber(year: number, sequence: number) {
  return `LN-${year}-${String(sequence).padStart(5, "0")}`;
}

function monthlyDate(start: Date, monthOffset: number) {
  const day = start.getUTCDate();
  const month = start.getUTCMonth() + monthOffset;
  const year = start.getUTCFullYear() + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, normalizedMonth, Math.min(day, lastDay)));
}

function makeInstallmentSchedule({
  principal,
  interestAmount,
  months,
  startDate,
}: {
  principal: number;
  interestAmount: number;
  months: number;
  startDate: Date;
}) {
  return Array.from({ length: months }, (_, index) => {
    const periodNo = index + 1;
    const principalAmount = index === months - 1
      ? principal - Math.floor(principal / months) * index
      : Math.floor(principal / months);
    const periodInterest = index === months - 1
      ? interestAmount - Math.floor(interestAmount / months) * index
      : Math.floor(interestAmount / months);
    return {
      periodNo,
      dueDate: monthlyDate(startDate, periodNo),
      principalAmount,
      interestAmount: periodInterest,
      amount: principalAmount + periodInterest,
    };
  });
}

export async function GET() {
  const denied = await authorizeApiRequest("contracts", "read");
  if (denied) return denied;
  const year = bangkokYear();
  const current = await prisma.contractNumberSequence.findUnique({ where: { year }, select: { lastNumber: true } });
  return Response.json(
    { contractNumber: formatContractNumber(year, (current?.lastNumber ?? 0) + 1) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });

  const data = body as Record<string, unknown>;
  const debtorId = text(data.debtorId, 80);
  const principal = amount(data.principal);
  const interestRate = typeof data.interestRate === "number" ? data.interestRate : NaN;
  const months = data.installmentMonths === null || data.installmentMonths === "" ? null : amount(data.installmentMonths);
  const startDate = date(data.startDate, true);
  const dueDate = date(data.dueDate, true);
  const signedAt = date(data.signedAt);

  if (!debtorId) return Response.json({ error: "กรุณาเลือกผู้กู้" }, { status: 400 });
  if (principal === null || principal <= 0) return Response.json({ error: "เงินต้นต้องมากกว่า 0 บาท" }, { status: 400 });
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 1000) {
    return Response.json({ error: "อัตราดอกเบี้ยต้องอยู่ระหว่าง 0 ถึง 1,000 เปอร์เซ็นต์" }, { status: 400 });
  }
  const repayType = data.repayType;
  const interestMode = data.interestMode;
  if (!isOneOf(RepayType, repayType)) return Response.json({ error: "กรุณาเลือกรูปแบบการชำระ" }, { status: 400 });
  if (!isOneOf(InterestMode, interestMode)) return Response.json({ error: "กรุณาเลือกรูปแบบดอกเบี้ย" }, { status: 400 });
  if (!startDate) return Response.json({ error: "กรุณาระบุวันที่เริ่มสัญญาให้ถูกต้อง" }, { status: 400 });
  if (!dueDate) return Response.json({ error: "กรุณาระบุวันครบกำหนด" }, { status: 400 });
  if (dueDate <= startDate) return Response.json({ error: "วันครบกำหนดต้องอยู่หลังวันเริ่มสัญญา" }, { status: 400 });
  if (data.reserveMoney !== undefined && typeof data.reserveMoney !== "boolean") return Response.json({ error: "ข้อมูลการจองเงินไม่ถูกต้อง" }, { status: 400 });
  const todayInBangkok = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayEnd = new Date(`${todayInBangkok}T23:59:59.999+07:00`);
  if (data.reserveMoney === true && startDate <= todayEnd) return Response.json({ error: "การจองเงินต้องกำหนดวันเริ่มสัญญาเป็นวันถัดไปหรือหลังจากนั้น" }, { status: 400 });
  if (repayType === RepayType.INSTALLMENT && (months === null || months < 1 || months > 360)) {
    return Response.json({ error: "จำนวนเดือนผ่อนต้องอยู่ระหว่าง 1 ถึง 360 เดือน" }, { status: 400 });
  }
  if (repayType !== RepayType.INSTALLMENT && months !== null) {
    return Response.json({ error: "ระบุจำนวนเดือนได้เฉพาะสัญญาผ่อนชำระ" }, { status: 400 });
  }
  if (data.periodDays !== null && data.periodDays !== undefined && data.periodDays !== "") {
    const periodDays = amount(data.periodDays);
    if (periodDays === null || periodDays < 1 || periodDays > 3650) {
      return Response.json({ error: "รอบชำระดอกเบี้ยต้องอยู่ระหว่าง 1 ถึง 3,650 วัน" }, { status: 400 });
    }
  }
  if (data.signedAt && !signedAt) return Response.json({ error: "วันที่ลงนามไม่ถูกต้อง" }, { status: 400 });

  const contractType = data.contractType === undefined ? ContractType.NONE : data.contractType;
  const signatureMode = data.signatureMode === undefined ? SignatureMode.PRINT : data.signatureMode;
  if (!isOneOf(ContractType, contractType)) return Response.json({ error: "ประเภทเอกสารสัญญาไม่ถูกต้อง" }, { status: 400 });
  if (!isOneOf(SignatureMode, signatureMode)) return Response.json({ error: "วิธีลงนามไม่ถูกต้อง" }, { status: 400 });
  const isReservation = data.reserveMoney === true || startDate > todayEnd;
  const status = isReservation
    ? ContractStatus.RESERVED
    : contractType === ContractType.NONE || signatureMode === SignatureMode.DIGITAL || signedAt
      ? ContractStatus.READY
      : ContractStatus.AWAITING_DOCUMENT;

  if (repayType === RepayType.INSTALLMENT && months && thaiDay(dueDate!) !== thaiDay(monthlyDate(startDate!, months))) return Response.json({ error: "วันครบกำหนดต้องตรงกับวันครบงวดสุดท้ายตามจำนวนเดือน" }, { status: 400 });
  const interestRateBasis = repayType === RepayType.INSTALLMENT
    ? InterestRateBasis.MONTHLY_FLAT
    : InterestRateBasis.CONTRACT_FLAT;
  const rawInterest = principal * interestRate / 100 * (interestRateBasis === InterestRateBasis.MONTHLY_FLAT ? (months ?? 0) : 1);
  const interestAmount = Math.round(rawInterest);
  if (!Number.isSafeInteger(interestAmount) || interestAmount < 0) {
    return Response.json({ error: "ยอดดอกเบี้ยสูงเกินขอบเขตที่ระบบรองรับ" }, { status: 400 });
  }
  if (interestMode === InterestMode.UPFRONT && interestAmount > principal) {
    return Response.json({ error: "ยอดดอกเบี้ยที่หักล่วงหน้าต้องไม่เกินเงินต้น" }, { status: 400 });
  }
  const netDisbursed = interestMode === InterestMode.UPFRONT ? principal - interestAmount : principal;

  const lateFeePerDay = amount(data.lateFeePerDay ?? 5000);
  if (lateFeePerDay === null || lateFeePerDay < 0) return Response.json({ error: "ค่าปรับรายวันไม่ถูกต้อง" }, { status: 400 });
  const lateFeeWaived = data.lateFeeWaived;
  if (typeof lateFeeWaived !== "boolean") return Response.json({ error: "กรุณาระบุว่าจะละเว้นค่าปรับหรือไม่" }, { status: 400 });

  let signatureBuffer: Buffer | null = null;
  if (signatureMode === SignatureMode.DIGITAL) {
    if (data.consentAccepted !== true) return Response.json({ error: "กรุณายอมรับคำยินยอมสำหรับลายเซ็นดิจิทัล" }, { status: 400 });
    if (typeof data.signatureData !== "string") return Response.json({ error: "กรุณาเขียนลายเซ็นดิจิทัล" }, { status: 400 });
    const match = data.signatureData.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return Response.json({ error: "ไฟล์ลายเซ็นไม่ถูกต้อง" }, { status: 400 });
    signatureBuffer = Buffer.from(match[1], "base64");
    if (signatureBuffer.length < 100 || signatureBuffer.length > 512 * 1024 || signatureBuffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      return Response.json({ error: "ไฟล์ลายเซ็นไม่ถูกต้องหรือมีขนาดเกินกำหนด" }, { status: 400 });
    }
  }

  const documentInput = data.documentData && typeof data.documentData === "object" && !Array.isArray(data.documentData) ? data.documentData as Record<string, unknown> : {};
  const witnessCountInput = documentInput.witnessCount ?? "2";
  if (typeof witnessCountInput !== "string" || !["0","1","2"].includes(witnessCountInput)) return Response.json({error:"จำนวนพยานไม่ถูกต้อง"},{status:400});
  const witnessCount = Number(witnessCountInput);
  if (contractType !== ContractType.NONE && ((witnessCount>=1 && !text(data.witness1,160)) || (witnessCount>=2 && !text(data.witness2,160)))) return Response.json({error:"กรุณาระบุชื่อพยานตามจำนวนที่เลือก"},{status:400});
  const requestType=typeof documentInput.requestType==='string'?documentInput.requestType:'LOAN';
  const losNumber=text(documentInput.losNumber,100)||null;
  if(!Object.hasOwn(loanRequestTypes,requestType))return Response.json({error:'ประเภทคำขอไม่ถูกต้อง'},{status:400});
  const packageByContractType = contractType === ContractType.NONE ? "NONE" : contractType === ContractType.WITNESS ? "LOAN_WITNESS" : "LOAN_GUARANTEE_WITNESS";
  const documentPackage = typeof documentInput.packageType === "string" ? documentInput.packageType : packageByContractType;
  const validDocumentPackages = ["NONE", "LOAN_WITNESS", "LOAN_GUARANTEE_WITNESS", "LOAN_GUARANTEE_COLLATERAL", "LOAN_GUARANTEE_WITNESS_COLLATERAL"];
  if (!validDocumentPackages.includes(documentPackage)) return Response.json({ error: "รูปแบบเอกสารสัญญาไม่ถูกต้อง" }, { status: 400 });
  const packageHasGuarantor = ["LOAN_GUARANTEE_WITNESS", "LOAN_GUARANTEE_COLLATERAL", "LOAN_GUARANTEE_WITNESS_COLLATERAL"].includes(documentPackage);
  const packageHasCollateral = ["LOAN_GUARANTEE_COLLATERAL", "LOAN_GUARANTEE_WITNESS_COLLATERAL"].includes(documentPackage);
  if ((contractType === ContractType.NONE) !== (documentPackage === "NONE") || (contractType === ContractType.WITNESS) !== (documentPackage === "LOAN_WITNESS") || (contractType === ContractType.WITNESS_GUARANTOR) !== packageHasGuarantor) {
    return Response.json({ error: "รูปแบบเอกสารไม่ตรงกับข้อมูลสัญญา กรุณาเลือกใหม่" }, { status: 400 });
  }
  if (packageHasGuarantor && !text(documentInput.guarantorName ?? data.guarantor, 160)) return Response.json({ error: "กรุณาระบุชื่อผู้ค้ำประกัน" }, { status: 400 });
  if (packageHasCollateral && !text(documentInput.collateralDetails, 12000)) return Response.json({ error: "กรุณาระบุรายการทรัพย์สินที่ใช้เป็นหลักประกัน" }, { status: 400 });
  if (documentInput.lenderType !== undefined && !['COMPANY', 'PERSON'].includes(String(documentInput.lenderType))) return Response.json({ error: 'ประเภทผู้ให้กู้ไม่ถูกต้อง' }, { status: 400 });
  const personalLender = documentInput.lenderType === 'PERSON';
  let lenderDocumentUrl = '', lenderDocumentName = '';
  let lenderCompany: { companyCode: string; branchCode: string; name: string; taxId: string; address: string; postcode: string; phone: string } | null = null;
  if (contractType !== ContractType.NONE || text(documentInput.branchCode, 5)) {
    const branchCode = text(documentInput.branchCode, 5);
    if (!/^\d{5}$/.test(branchCode)) return Response.json({ error: "กรุณาเลือกสาขาที่ใช้ทำสัญญาและจ่ายเงิน" }, { status: 400 });
    const branch = await prisma.branchCodeSequence.findUnique({
      where: { branchcode: branchCode },
      include: { company: { include: { owner: true } } },
    });
    if (!branch || branch.status !== "ACTIVE" || branch.company.status !== "ACTIVE") {
      return Response.json({ error: "ไม่พบข้อมูลบริษัทสาขาที่ใช้งาน กรุณาเลือกสาขาใหม่" }, { status: 400 });
    }
    const owner = branch.company.owner;
    if (personalLender && (!owner?.ownerFirstName || !owner?.ownerLastName || !/^\d{13}$/.test(owner?.ownerNationalId || '') || !owner?.ownerAddress)) return Response.json({ error: 'กรุณาบันทึกชื่อ นามสกุล เลขประชาชน และที่อยู่เจ้าของในหน้าบริษัทก่อน' }, { status: 400 });
    if (personalLender) { lenderDocumentUrl = owner?.ownerDocumentUrl || ''; lenderDocumentName = owner?.ownerDocumentName || ''; }
    lenderCompany = {
      companyCode: branch.companycode,
      branchCode: branch.branchcode,
      name: personalLender ? [owner?.ownerPrefix, owner?.ownerFirstName, owner?.ownerLastName].filter(Boolean).join(' ') : branch.company.nameTH || branch.company.nameEN || branch.branchcode,
      taxId: personalLender ? owner?.ownerNationalId || '' : branch.company.TaxIdentificationNumber || "",
      address: personalLender ? [owner?.ownerAddress, owner?.ownerMoo && `หมู่${owner.ownerMoo}`, owner?.ownerSoi && `ซอย${owner.ownerSoi}`, owner?.ownerRoad && `ถนน${owner.ownerRoad}`, owner?.ownerSubdistrict && `${owner.ownerProvince === 'กรุงเทพมหานคร' ? 'แขวง' : 'ตำบล'}${owner.ownerSubdistrict}`, owner?.ownerDistrict && `${owner.ownerProvince === 'กรุงเทพมหานคร' ? 'เขต' : 'อำเภอ'}${owner.ownerDistrict}`, owner?.ownerProvince && `จังหวัด${owner.ownerProvince}`, owner?.ownerPostcode].filter(Boolean).join(' ') : branch.company.address || '',
      postcode: personalLender ? '' : branch.company.postcode || "",
      phone: personalLender ? owner?.ownerPhone || '' : branch.company.phone || "",
    };
  }
  if (!lenderCompany) return Response.json({ error: "กรุณาเลือกบริษัทและสาขาสำหรับสัญญาทุกรายการ" }, { status: 400 });
  try { await assertLoanCompanyAccess(lenderCompany.companyCode); } catch { return Response.json({ error: "กรุณาเลือกบริษัทที่มีสิทธิ์ก่อนสร้างสัญญา" }, { status: 403 }); }
  const documentPayload:Record<string,unknown> = {};
  for (const [key,defaultValue] of Object.entries(emptyDocumentSettings)) {
    if (key === "attachments") continue;
    const raw = documentInput[key];
    if (raw !== undefined && typeof raw !== "string") return Response.json({error:`ข้อมูลเอกสาร ${key} ไม่ถูกต้อง`},{status:400});
    documentPayload[key] = typeof raw === "string" ? raw.slice(0, key.endsWith("Signature") ? 800000 : key.endsWith("Text") ? 40000 : key === "collateralDetails" ? 12000 : 1000) : defaultValue;
  }
  documentPayload.lenderType = personalLender ? 'PERSON' : 'COMPANY';
  documentPayload.lenderDocumentUrl = lenderDocumentUrl; documentPayload.lenderDocumentName = lenderDocumentName;
  documentPayload.packageType = documentPackage;
  documentPayload.witnessCount = witnessCountInput;
  for (let n = witnessCount+1; n<=2; n++) {
    for (const suffix of ["Id","Phone","Address","Signature"]) documentPayload[`witness${n}${suffix}`]="";
  }
  if (lenderCompany) {
    documentPayload.companyCode = lenderCompany.companyCode;
    documentPayload.branchCode = lenderCompany.branchCode;
    documentPayload.lenderName = lenderCompany.name;
    documentPayload.lenderId = lenderCompany.taxId;
    documentPayload.lenderAddress = [lenderCompany.address, lenderCompany.postcode].filter(Boolean).join(" ");
    documentPayload.lenderPhone = lenderCompany.phone;
  }
  const attachments = Array.isArray(documentInput.attachments) ? documentInput.attachments : [];
  if (attachments.length > 20 || attachments.some(file => !file || typeof file.url !== "string" || !isUploadUrl(file.url, "/api/contracts/attachments", ["jpg", "png", "webp", "pdf"]) || typeof file.name !== "string")) return Response.json({error:"เอกสารแนบไม่ถูกต้อง"},{status:400});
  for(const file of attachments){try{await access(storedUploadPath("contract-attachments", file.url));}catch{return Response.json({error:"ไม่พบไฟล์เอกสารแนบ กรุณาอัปโหลดใหม่"},{status:400});}}
  documentPayload.attachments = attachments.map(file => ({url:file.url,name:file.name.slice(0,200)}));
  const additionalSignatures:{key:string;buffer:Buffer}[] = [];
  if(signatureMode !== SignatureMode.DIGITAL || contractType === ContractType.NONE){for(const key of ["lenderSignature","witness1Signature","witness2Signature","guarantorSignature","collateralProviderSignature"])documentPayload[key]="";}
  if (signatureMode === SignatureMode.DIGITAL && contractType !== ContractType.NONE) {
    const keys = [...(documentInput.lenderSignature ? ["lenderSignature"] : []),...["witness1Signature","witness2Signature"].slice(0,witnessCount),...(packageHasGuarantor ? ["guarantorSignature"] : []),...(packageHasCollateral ? ["collateralProviderSignature"] : [])];
    if (contractType === ContractType.WITNESS_GUARANTOR && !text(data.guarantor,160)) return Response.json({error:"กรุณาระบุชื่อผู้ค้ำประกัน"},{status:400});
    for (const key of keys) {
      const raw = documentInput[key];
      const match = typeof raw === "string" ? raw.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/) : null;
      if (!match) return Response.json({error:`กรุณาลงลายเซ็น ${key === "witness1Signature" ? "พยานคนที่ 1" : key === "witness2Signature" ? "พยานคนที่ 2" : key === "guarantorSignature" ? "ผู้ค้ำประกัน" : key === "collateralProviderSignature" ? "ผู้ให้หลักประกัน" : "ผู้ให้กู้"}`},{status:400});
      const buffer=Buffer.from(match[1],"base64");
      if (buffer.length<100 || buffer.length>512*1024 || buffer.subarray(0,8).toString("hex")!=="89504e470d0a1a0a") return Response.json({error:"ไฟล์ลายเซ็นพยานหรือผู้ค้ำไม่ถูกต้อง"},{status:400});
      additionalSignatures.push({key,buffer});
    }
  }
  const draftId = typeof data.draftId === "string" && /^[a-f0-9-]{36}$/.test(data.draftId) ? data.draftId : null;
  if (draftId) {
    const previous = await prisma.loanContractDraft.findUnique({where:{id:draftId}});
    if (previous && !await canAccessLoanDraft(previous.dataJson)) return Response.json({error:"ไม่มีสิทธิ์เข้าถึงร่างของบริษัทนี้"},{status:403});
    if (previous && previous.borrowerId !== debtorId) return Response.json({error:"ร่างไม่ตรงกับผู้กู้ที่เลือก"},{status:400});
    if (previous?.finalizedContractId) {
      const finalized=await prisma.contract.findUniqueOrThrow({where:{id:previous.finalizedContractId},include:{application:true}});
      return Response.json({...finalized,...loanApplicationFields(finalized.application)});
    }
  }
  const signaturePaths:string[] = [];
  const year = bangkokYear();
  let signatureUrl:string|null = null;
  const signatureBorrower = await prisma.borrowers.findUnique({ where: { id: debtorId, deletedAt: null }, select: { borrowersCode: true } });
  if (!signatureBorrower) return Response.json({ error: "ไม่พบข้อมูลผู้กู้ที่เลือก" }, { status: 404 });
  const filenameContractNumber = text(data.contractNumber, 80) || "DRAFT";

  try {
    if (signatureBuffer) {
      const file = await saveBorrowerFile({ storageArea: 'contract-signatures', borrowerCode: formatBorrowerCode(signatureBorrower.borrowersCode), contractNumber: filenameContractNumber, extension: "png", apiRoute: "/api/contracts/signatures", data: signatureBuffer });
      signaturePaths.push(file.path);
      signatureUrl = file.url;
    }

    for (const signature of additionalSignatures) {
      const file = await saveBorrowerFile({ storageArea: 'contract-signatures', borrowerCode: formatBorrowerCode(signatureBorrower.borrowersCode), contractNumber: filenameContractNumber, extension: "png", apiRoute: "/api/contracts/signatures", data: signature.buffer });
      signaturePaths.push(file.path);
      documentPayload[signature.key]=file.url;
    }
    const scheduleRows = repayType === RepayType.INSTALLMENT
      ? makeInstallmentSchedule({ principal, interestAmount: interestMode === InterestMode.UPFRONT ? 0 : interestAmount, months: months!, startDate })
      : [{
          periodNo: 1,
          dueDate,
          principalAmount: principal,
          interestAmount: interestMode === InterestMode.UPFRONT ? 0 : interestAmount,
          amount: principal + (interestMode === InterestMode.UPFRONT ? 0 : interestAmount),
        }];

    const saved = await prisma.$transaction(async (tx) => {
      if (draftId) {
        await tx.loanContractDraft.updateMany({where:{id:draftId,borrowerId:debtorId},data:{updatedAt:new Date()}});
        const previous=await tx.loanContractDraft.findUnique({where:{id:draftId}});
        if (previous?.finalizedContractId) return tx.contract.findUniqueOrThrow({where:{id:previous.finalizedContractId},include:{application:true}});
      }
      const sequence = await tx.contractNumberSequence.upsert({
        where: { year },
        create: { year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });
      const contractNumber = formatContractNumber(year, sequence.lastNumber);
      const provisionalNumber = text(data.contractNumber,80);
      if(documentPayload.kind === "NEW_LOAN" && provisionalNumber && provisionalNumber !== contractNumber){
        for(const key of ["loanText","guaranteeText","collateralAgreementText"]){if(typeof documentPayload[key] === "string")documentPayload[key]=(documentPayload[key] as string).replaceAll(provisionalNumber,contractNumber);}
      }
      const application=await createLoanApplication(tx,{borrowerId:debtorId,requestedAmount:principal,requestType,losNumber});
      const contract = await tx.contract.create({
        data: {
          contractNumber,
          application:{connect:{id:application.id}},
          debtorId,
          principal,
          interestRate,
          interestAmount,
          netDisbursed,
          repayType,
          interestMode,
          interestRateBasis,
          installmentMonths: months,
          periodDays: data.periodDays ? amount(data.periodDays) : null,
          startDate,
          dueDate,
          contractType,
          documentUrl: text(data.documentUrl, 500) || null,
          documentData: JSON.stringify(documentPayload),
          signedAt: signatureMode === SignatureMode.DIGITAL ? new Date() : signedAt,
          signatureMode,
          signatureUrl,
          consentAccepted: signatureMode === SignatureMode.DIGITAL,
          consentedAt: signatureMode === SignatureMode.DIGITAL ? new Date() : null,
          consentText: signatureMode === SignatureMode.DIGITAL ? CONSENT_TEXT : null,
          witness1: witnessCount>=1 ? text(data.witness1, 160) || null : null,
          witness2: witnessCount>=2 ? text(data.witness2, 160) || null : null,
          guarantor: text(data.guarantor, 160) || null,
          status,
          note: text(data.note, 2000) || null,
          lateFeePerDay,
          lateFeeWaived,
          schedules: { create: scheduleRows },
        },
        include: {
          application:true,
          debtor: { select: { id: true, prefixTH: true, firstName: true, lastName: true, nickname: true } },
        },
      });
      if (draftId) await tx.loanContractDraft.updateMany({where:{id:draftId,borrowerId:debtorId},data:{finalizedContractId:contract.id}});
      await writeLoanLog(tx, {
        borrowerId: debtorId,
        contractId: contract.id,
        targetId: contract.id,
        type: 'CONTRACT',
        action: 'CREATE',
        note: `สร้างสัญญา ${contract.contractNumber}`,
        afterData: {
          contractNumber: contract.contractNumber,
          principal: contract.principal,
          interestRate: contract.interestRate,
          interestAmount: contract.interestAmount,
          netDisbursed: contract.netDisbursed,
          repayType: contract.repayType,
          interestMode: contract.interestMode,
          startDate: contract.startDate,
          dueDate: contract.dueDate,
          status: contract.status,
        },
      });
      return contract;
    });
    const savedWithDebtor = saved as typeof saved & { debtor?: { borrowersCode: string; [key: string]: unknown } };
    const responsePayload = savedWithDebtor.debtor
      ? { ...savedWithDebtor, debtor: { ...savedWithDebtor.debtor, borrowersCode: formatBorrowerCode(savedWithDebtor.debtor.borrowersCode) } }
      : saved;
    after(async()=>{await syncLoanGoogleSheet();});
    return Response.json({...responsePayload,...loanApplicationFields(saved.application)}, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await Promise.all(signaturePaths.map(file=>unlink(file).catch(()=>{})));
    if (isPrismaCode(error, "P2002")) return Response.json({ error: "เลขที่สัญญา ใบคำขอ หรือ LOS ซ้ำ กรุณาตรวจเลข LOS แล้วลองอีกครั้ง" }, { status: 409 });
    if (isPrismaCode(error, "P2003")) return Response.json({ error: "ไม่พบข้อมูลผู้กู้ที่เลือก" }, { status: 404 });
    throw error;
  }
}
