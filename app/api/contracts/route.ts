import { emptyDocumentSettings } from "@/lib/contract-document";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ContractStatus, ContractType, InterestMode, InterestRateBasis, RepayType, SignatureMode } from "@/generated/prisma/enums";
import { isPrismaCode } from "@/lib/borrowers";
import { prisma } from "@/lib/prisma";

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
  const year = bangkokYear();
  const current = await prisma.contractNumberSequence.findUnique({ where: { year }, select: { lastNumber: true } });
  return Response.json(
    { contractNumber: formatContractNumber(year, (current?.lastNumber ?? 0) + 1) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
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
  const status = contractType === ContractType.NONE || signatureMode === SignatureMode.DIGITAL || signedAt
    ? ContractStatus.READY
    : ContractStatus.AWAITING_DOCUMENT;

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
  let lenderCompany: { companyCode: string; name: string; taxId: string; address: string; postcode: string; phone: string } | null = null;
  if (contractType !== ContractType.NONE) {
    const companyCode = text(documentInput.companyCode, 80);
    if (!companyCode) return Response.json({ error: "กรุณากรอก Companycode และเรียกข้อมูลผู้ให้กู้ก่อน" }, { status: 400 });
    lenderCompany = await prisma.company.findUnique({
      where: { companyCode },
      select: { companyCode: true, name: true, taxId: true, address: true, postcode: true, phone: true },
    });
    if (!lenderCompany) return Response.json({ error: "ไม่พบข้อมูลผู้ให้กู้จาก Companycode ที่ระบุ" }, { status: 400 });
  }
  const documentPayload:Record<string,unknown> = {};
  for (const [key,defaultValue] of Object.entries(emptyDocumentSettings)) {
    if (key === "attachments") continue;
    const raw = documentInput[key];
    if (raw !== undefined && typeof raw !== "string") return Response.json({error:`ข้อมูลเอกสาร ${key} ไม่ถูกต้อง`},{status:400});
    documentPayload[key] = typeof raw === "string" ? raw.slice(0, key.endsWith("Signature") ? 800000 : key.endsWith("Text") ? 40000 : 1000) : defaultValue;
  }
  if (lenderCompany) {
    documentPayload.companyCode = lenderCompany.companyCode;
    documentPayload.lenderName = lenderCompany.name;
    documentPayload.lenderId = lenderCompany.taxId;
    documentPayload.lenderAddress = [lenderCompany.address, lenderCompany.postcode].filter(Boolean).join(" ");
    documentPayload.lenderPhone = lenderCompany.phone;
  }
  const attachments = Array.isArray(documentInput.attachments) ? documentInput.attachments : [];
  if (attachments.length > 20 || attachments.some(file => !file || typeof file.url !== "string" || !/^\/api\/contracts\/attachments\/[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(file.url) || typeof file.name !== "string")) return Response.json({error:"เอกสารแนบไม่ถูกต้อง"},{status:400});
  for(const file of attachments){try{await access(path.join(process.cwd(),"storage","contract-attachments",file.url.split("/").pop()));}catch{return Response.json({error:"ไม่พบไฟล์เอกสารแนบ กรุณาอัปโหลดใหม่"},{status:400});}}
  documentPayload.attachments = attachments.map(file => ({url:file.url,name:file.name.slice(0,200)}));
  const additionalSignatures:{key:string;buffer:Buffer;filename:string}[] = [];
  if(signatureMode !== SignatureMode.DIGITAL || contractType === ContractType.NONE){for(const key of ["lenderSignature","witness1Signature","witness2Signature","guarantorSignature"])documentPayload[key]="";}
  if (signatureMode === SignatureMode.DIGITAL && contractType !== ContractType.NONE) {
    if (!text(data.witness1,160) || !text(data.witness2,160)) return Response.json({error:"กรุณาระบุชื่อพยานทั้งสองคน"},{status:400});
    const keys = [...(documentInput.lenderSignature ? ["lenderSignature"] : []),"witness1Signature","witness2Signature",...(contractType === ContractType.WITNESS_GUARANTOR ? ["guarantorSignature"] : [])];
    if (contractType === ContractType.WITNESS_GUARANTOR && !text(data.guarantor,160)) return Response.json({error:"กรุณาระบุชื่อผู้ค้ำประกัน"},{status:400});
    for (const key of keys) {
      const raw = documentInput[key];
      const match = typeof raw === "string" ? raw.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/) : null;
      if (!match) return Response.json({error:`กรุณาลงลายเซ็น ${key === "witness1Signature" ? "พยานคนที่ 1" : key === "witness2Signature" ? "พยานคนที่ 2" : key === "guarantorSignature" ? "ผู้ค้ำประกัน" : "ผู้ให้กู้"}`},{status:400});
      const buffer=Buffer.from(match[1],"base64");
      if (buffer.length<100 || buffer.length>512*1024 || buffer.subarray(0,8).toString("hex")!=="89504e470d0a1a0a") return Response.json({error:"ไฟล์ลายเซ็นพยานหรือผู้ค้ำไม่ถูกต้อง"},{status:400});
      additionalSignatures.push({key,buffer,filename:`${randomUUID()}.png`});
    }
  }
  const draftId = typeof data.draftId === "string" && /^[a-f0-9-]{36}$/.test(data.draftId) ? data.draftId : null;
  if (draftId) {
    const previous = await prisma.loanContractDraft.findUnique({where:{id:draftId}});
    if (previous && previous.borrowerId !== debtorId) return Response.json({error:"ร่างไม่ตรงกับผู้กู้ที่เลือก"},{status:400});
    if (previous?.finalizedContractId) return Response.json(await prisma.contract.findUnique({where:{id:previous.finalizedContractId}}));
  }
  const additionalPaths:string[] = [];
  const year = bangkokYear();
  const signatureFilename = signatureBuffer ? `${randomUUID()}.png` : null;
  const signatureDirectory = path.join(process.cwd(), "storage", "contract-signatures");
  const signaturePath = signatureFilename ? path.join(signatureDirectory, signatureFilename) : null;

  try {
    if (signatureBuffer && signaturePath) {
      await mkdir(signatureDirectory, { recursive: true });
      await writeFile(signaturePath, signatureBuffer, { flag: "wx" });
    }

    if (additionalSignatures.length) await mkdir(signatureDirectory,{recursive:true});
    for (const signature of additionalSignatures) {
      const filePath=path.join(signatureDirectory,signature.filename);
      await writeFile(filePath,signature.buffer,{flag:"wx"});additionalPaths.push(filePath);
      documentPayload[signature.key]=`/api/contracts/signatures/${signature.filename}`;
    }
    const scheduleRows = repayType === RepayType.INSTALLMENT
      ? makeInstallmentSchedule({ principal, interestAmount, months: months!, startDate })
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
        if (previous?.finalizedContractId) return tx.contract.findUniqueOrThrow({where:{id:previous.finalizedContractId}});
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
        for(const key of ["loanText","guaranteeText"]){if(typeof documentPayload[key] === "string")documentPayload[key]=(documentPayload[key] as string).replaceAll(provisionalNumber,contractNumber);}
      }
      const contract = await tx.contract.create({
        data: {
          contractNumber,
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
          signatureUrl: signatureFilename ? `/api/contracts/signatures/${signatureFilename}` : null,
          consentAccepted: signatureMode === SignatureMode.DIGITAL,
          consentedAt: signatureMode === SignatureMode.DIGITAL ? new Date() : null,
          consentText: signatureMode === SignatureMode.DIGITAL ? CONSENT_TEXT : null,
          witness1: text(data.witness1, 160) || null,
          witness2: text(data.witness2, 160) || null,
          guarantor: text(data.guarantor, 160) || null,
          status,
          note: text(data.note, 2000) || null,
          lateFeePerDay,
          lateFeeWaived,
          schedules: { create: scheduleRows },
        },
        include: {
          debtor: { select: { id: true, prefixTH: true, firstName: true, lastName: true, nickname: true } },
        },
      });
      if (draftId) await tx.loanContractDraft.updateMany({where:{id:draftId,borrowerId:debtorId},data:{finalizedContractId:contract.id}});
      return contract;
    });
    return Response.json(saved, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (signaturePath) await unlink(signaturePath).catch(() => {});
    await Promise.all(additionalPaths.map(file=>unlink(file).catch(()=>{})));
    if (isPrismaCode(error, "P2002")) return Response.json({ error: "ไม่สามารถสร้างเลขที่สัญญาได้ กรุณาลองบันทึกอีกครั้ง" }, { status: 409 });
    if (isPrismaCode(error, "P2003")) return Response.json({ error: "ไม่พบข้อมูลผู้กู้ที่เลือก" }, { status: 404 });
    throw error;
  }
}
