import { unlink } from 'node:fs/promises';
import { ContractStatus, PaymentMethod, PaymentType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { formatBorrowerCode } from '@/lib/borrower-code';
import { writeLoanLog } from '@/lib/loan-logs';
import { saveBorrowerFile, storedUploadPath } from '@/lib/borrower-file-storage';

const fileTypes: Record<string, { extension: string; valid: (data: Buffer) => boolean }> = {
  'image/jpeg': { extension: 'jpg', valid: data => data[0] === 255 && data[1] === 216 },
  'image/png': { extension: 'png', valid: data => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: 'webp', valid: data => data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { extension: 'pdf', valid: data => data.subarray(0, 5).toString() === '%PDF-' },
};

function bangkokDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  }

  const { id } = await context.params;
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 });

  const paidDate = form.get('paidAt');
  const methodInput = form.get('method');
  const referenceInput = form.get('reference');
  const file = form.get('file');
  const reference = typeof referenceInput === 'string' ? referenceInput.trim().slice(0, 100) : '';
  const isMethodValid = methodInput === PaymentMethod.CASH || methodInput === PaymentMethod.BANK_TRANSFER;
  const datetimeMatch = typeof paidDate === 'string' ? /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(paidDate) : null;
  const dateOnlyMatch = typeof paidDate === 'string' ? /^(\d{4}-\d{2}-\d{2})$/.exec(paidDate) : null;
  const paidDay = datetimeMatch?.[1] ?? dateOnlyMatch?.[1];
  const paidAt = datetimeMatch
    ? new Date(`${datetimeMatch[1]}T${datetimeMatch[2]}:${datetimeMatch[3]}:00.000+07:00`)
    : dateOnlyMatch ? new Date(`${dateOnlyMatch[1]}T12:00:00.000+07:00`)
    : new Date(NaN);

  if (!isMethodValid || !paidDay || !Number.isFinite(paidAt.getTime()) || bangkokDate(paidAt) !== paidDay || paidAt.getTime() > Date.now()) {
    return Response.json({ error: 'ตรวจสอบวันที่และช่องทางการจ่ายเงิน' }, { status: 400 });
  }

  let fileData: Buffer | null = null;
  let fileExtension = '';
  if (file instanceof File && file.size > 0) {
    const type = fileTypes[file.type];
    if (!type || file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'รองรับ JPG, PNG, WebP หรือ PDF ไม่เกิน 10 MB' }, { status: 400 });
    }
    fileData = Buffer.from(await file.arrayBuffer());
    if (!type.valid(fileData)) return Response.json({ error: 'ชนิดไฟล์ไม่ตรงกับเนื้อหา' }, { status: 400 });
    fileExtension = type.extension;
  } else if (file instanceof File && file.size === 0 && file.name) {
    return Response.json({ error: 'ไฟล์หลักฐานว่างเปล่า กรุณาเลือกไฟล์ใหม่' }, { status: 400 });
  }

  if (!reference && !fileData) {
    return Response.json({ error: 'กรุณาระบุเลขอ้างอิงหรือแนบสลิปการจ่ายเงินอย่างน้อยหนึ่งอย่าง' }, { status: 400 });
  }

  const contractForFile = fileData ? await prisma.contract.findUnique({ where: { id }, include: { debtor: { select: { borrowersCode: true } } } }) : null;
  if (fileData && !contractForFile) return Response.json({ error: 'ไม่พบสัญญา' }, { status: 404 });
  const savedFile = fileData && contractForFile ? await saveBorrowerFile({
    storageArea: 'contract-attachments',
    borrowerCode: formatBorrowerCode(contractForFile.debtor.borrowersCode),
    contractNumber: contractForFile.contractNumber,
    extension: fileExtension,
    apiRoute: '/api/contracts/attachments',
    data: fileData,
  }) : null;
  const evidenceUrl = savedFile?.url || '';

  try {
    const result = await prisma.$transaction(async tx => {
      // Serialize concurrent payout requests before checking the contract status.
      await tx.contract.update({ where: { id }, data: { updatedAt: new Date() } });
      const contract = await tx.contract.findUniqueOrThrow({
        where: { id },
        include: { payments: true, debtor: { select: { borrowersCode: true, firstName: true, lastName: true, nickname: true } } },
      });
      if (contract.status !== ContractStatus.READY) throw new Error('จ่ายได้เฉพาะสัญญาที่พร้อมจ่ายเงิน');
      if (bangkokDate(contract.startDate) > bangkokDate(new Date())) throw new Error('ยังไม่ถึงวันเริ่มสัญญา');
      if (bangkokDate(paidAt) < bangkokDate(contract.startDate)) throw new Error('วันที่จ่ายต้องไม่ก่อนวันเริ่มสัญญา');
      if (contract.payments.some(payment => payment.type === PaymentType.DISBURSEMENT)) throw new Error('สัญญานี้มีรายการจ่ายเงินแล้ว');
      if (contract.netDisbursed <= 0) throw new Error('ยอดจ่ายสุทธิของสัญญาไม่ถูกต้อง');

      const payment = await tx.payment.create({
        data: {
          contractId: contract.id,
          type: PaymentType.DISBURSEMENT,
          amount: contract.netDisbursed,
          paidAt,
          timeRecorded: Boolean(datetimeMatch),
          method: methodInput as PaymentMethod,
          note: reference ? `เลขอ้างอิงการจ่าย ${reference}` : 'แนบหลักฐานการจ่ายเงิน',
        },
      });
      const attachment = fileData ? { url: evidenceUrl, name: `หลักฐานจ่ายเงิน ${contract.contractNumber}` } : null;
      const documentData = contract.documentData ? JSON.parse(contract.documentData) : {};
      documentData.attachments = [...(Array.isArray(documentData.attachments) ? documentData.attachments : []), ...(attachment ? [attachment] : [])];
      documentData.deliveryEvidenceRecords = [
        ...(Array.isArray(documentData.deliveryEvidenceRecords) ? documentData.deliveryEvidenceRecords : []),
        {
          ...(attachment ?? {}),
          reference: reference || null,
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method,
          paidAt: payment.paidAt.toISOString(),
          uploadedAt: new Date().toISOString(),
        },
      ];
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.ACTIVE, documentData: JSON.stringify(documentData) },
      });
      await writeLoanLog(tx, {
        borrowerId: contract.debtorId,
        contractId: contract.id,
        targetId: payment.id,
        type: 'PAYMENT',
        action: 'CREATE',
        note: `บันทึกการจ่ายเงินสัญญา ${contract.contractNumber}`,
        afterData: { amount: payment.amount, paidAt: payment.paidAt, method: payment.method, type: payment.type },
      });
      return { payment, attachment, contractNumber: contract.contractNumber, borrower: { ...contract.debtor, borrowersCode: formatBorrowerCode(contract.debtor.borrowersCode) } };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (savedFile) await unlink(storedUploadPath('contract-attachments', evidenceUrl)).catch(() => {});
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return Response.json({ error: 'ไม่พบสัญญา' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : '';
    const allowedMessages = ['จ่ายได้เฉพาะสัญญาที่พร้อมจ่ายเงิน', 'ยังไม่ถึงวันเริ่มสัญญา', 'วันที่จ่ายต้องไม่ก่อนวันเริ่มสัญญา', 'สัญญานี้มีรายการจ่ายเงินแล้ว', 'ยอดจ่ายสุทธิของสัญญาไม่ถูกต้อง'];
    return Response.json({ error: allowedMessages.includes(message) ? message : 'บันทึกการจ่ายไม่สำเร็จ กรุณาลองใหม่' }, { status: 409 });
  }
}
