import { assertLoanCompanyAccess } from "@/lib/loan-access";
import { authorizeLoanContract } from "@/lib/loan-access";
import { assertLoanPeriodOpen, contractCompanyCode } from "@/lib/loan-accounting-lock";
import { authorizeApiRequest } from "@/lib/authorization";
import { after } from 'next/server';
import { syncLoanGoogleSheet } from '@/lib/integrations/google-sheets';
import { ContractStatus, InterestMode, InterestRateBasis, PaymentType, RepayType, ScheduleStatus } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { loanBalance, allocateRepayment, thaiDay } from '@/lib/loan-balance';
import { writeLoanLog } from '@/lib/loan-logs';

function monthlyDate(start: Date, offset: number) {
  const year = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + offset) / 12);
  const month = (start.getUTCMonth() + offset) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), last)));
}

function scheduleRows(input: { principal: number; interestAmount: number; months: number | null; repayType: string; startDate: Date; dueDate: Date | null; interestMode: string }) {
  if (input.repayType === RepayType.INSTALLMENT && input.months) return Array.from({ length: input.months }, (_, i) => {
    const principalAmount = i === input.months! - 1 ? input.principal - Math.floor(input.principal / input.months!) * i : Math.floor(input.principal / input.months!);
    const interestAmount = input.interestMode === InterestMode.UPFRONT ? 0 : i === input.months! - 1 ? input.interestAmount - Math.floor(input.interestAmount / input.months!) * i : Math.floor(input.interestAmount / input.months!);
    return { periodNo: i + 1, dueDate: monthlyDate(input.startDate, i + 1), principalAmount, interestAmount, amount: principalAmount + interestAmount };
  });
  if (!input.dueDate) return [];
  return [{ periodNo: 1, dueDate: input.dueDate, principalAmount: input.principal, interestAmount: input.interestMode === InterestMode.UPFRONT ? 0 : input.interestAmount, amount: input.principal + (input.interestMode === InterestMode.UPFRONT ? 0 : input.interestAmount) }];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await authorizeApiRequest("contracts", "write");
  if (denied) return denied;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  const { id } = await context.params;
 const companyDenied = await authorizeLoanContract(id); if (companyDenied) return companyDenied;
  const data = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!data) return Response.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  // Keep the existing interest-mode-only client behavior.
  const termsOnly = Object.keys(data).length === 1 && typeof data.interestMode === 'string';
  const reason = typeof data.reason === 'string' ? data.reason.trim().slice(0, 500) : '';
  if (!termsOnly && !reason) return Response.json({ error: 'กรุณาระบุเหตุผลการแก้ไขสัญญา' }, { status: 400 });
  if (data.interestMode !== undefined && !Object.values(InterestMode).includes(data.interestMode as InterestMode)) return Response.json({ error: 'รูปแบบดอกเบี้ยไม่ถูกต้อง' }, { status: 400 });
  if (termsOnly) {
    try {
      await prisma.$transaction(async tx => {
        await tx.contract.update({ where: { id }, data: { updatedAt: new Date() } });
        const contract = await tx.contract.findUnique({ where: { id }, include: { payments: true } });
        if (!contract) throw new Error('ไม่พบสัญญา');
        await assertLoanCompanyAccess(contractCompanyCode(contract.documentData));
        await assertLoanPeriodOpen(tx, contractCompanyCode(contract.documentData), contract.startDate);
        if (contract.payments.some(payment => payment.amount !== 0 && ['DISBURSEMENT', 'PRINCIPAL', 'INTEREST', 'PENALTY'].includes(payment.type))) throw new Error('สัญญานี้จ่ายเงินแล้ว ต้องแก้ผ่านแบบแก้ไขเงื่อนไขเต็ม');
        if (contract.status !== ContractStatus.READY && contract.status !== ContractStatus.RESERVED) throw new Error('สัญญาที่จ่ายเงินแล้วต้องแก้ผ่านแบบแก้ไขพร้อมคำนวณย้อนหลัง');
        const mode = data.interestMode as InterestMode;
        const netDisbursed = mode === InterestMode.UPFRONT ? contract.principal - contract.interestAmount : contract.principal;
        if (netDisbursed <= 0) throw new Error('ยอดจ่ายสุทธิต้องมากกว่าศูนย์');
        await tx.payment.updateMany({ where: { contractId: id }, data: { scheduleId: null } });
        await tx.interestSchedule.deleteMany({ where: { contractId: id } });
        const rows = scheduleRows({ principal: contract.principal, interestAmount: contract.interestAmount, months: contract.installmentMonths, repayType: contract.repayType, startDate: contract.startDate, dueDate: contract.dueDate, interestMode: mode });
        await tx.interestSchedule.createMany({ data: rows.map(row => ({ ...row, contractId: id })) });
        const updated = await tx.contract.update({ where: { id }, data: { interestMode: mode, netDisbursed } });
        await writeLoanLog(tx, {
          borrowerId: contract.debtorId, contractId: id, targetId: id, type: 'CONTRACT', action: 'UPDATE',
          note: `แก้ไขรูปแบบดอกเบี้ยสัญญา ${contract.contractNumber}`,
          beforeData: { interestMode: contract.interestMode }, afterData: { interestMode: updated.interestMode, netDisbursed: updated.netDisbursed },
        });
      });
      after(async()=>{await syncLoanGoogleSheet();});
      return Response.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'แก้ไขสัญญาไม่สำเร็จ';
      return Response.json({ error: message }, { status: message.includes('ไม่พบ') ? 404 : 409 });
    }
  }

  const principal = data.principal;
  const interestRate = data.interestRate;
  const repayType = data.repayType;
  const interestMode = data.interestMode;
  const months = data.installmentMonths === '' || data.installmentMonths === null ? null : Number(data.installmentMonths);
  const periodDays = data.periodDays === '' || data.periodDays === null ? null : Number(data.periodDays);
  const lateFeePerDay = data.lateFeePerDay;
  const lateFeeWaived = data.lateFeeWaived;
  const startDate = typeof data.startDate === 'string' ? new Date(`${data.startDate}T12:00:00.000+07:00`) : new Date(NaN);
  let dueDate = typeof data.dueDate === 'string' && data.dueDate ? new Date(`${data.dueDate}T12:00:00.000+07:00`) : null;
  if (!Number.isSafeInteger(principal) || (principal as number) <= 0 || typeof interestRate !== 'number' || !Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100 || !Object.values(RepayType).includes(repayType as RepayType) || !Object.values(InterestMode).includes(interestMode as InterestMode) || !Number.isSafeInteger(lateFeePerDay) || (lateFeePerDay as number) < 0 || typeof lateFeeWaived !== 'boolean' || !Number.isFinite(startDate.getTime()) || (dueDate && !Number.isFinite(dueDate.getTime())) || (months !== null && (!Number.isSafeInteger(months) || months < 1 || months > 360)) || (repayType === RepayType.INSTALLMENT && months === null) || (repayType !== RepayType.INSTALLMENT && months !== null) || (periodDays !== null && (!Number.isSafeInteger(periodDays) || periodDays < 1 || periodDays > 3650))) {
    return Response.json({ error: 'กรุณาตรวจสอบยอดเงิน เงื่อนไข และวันที่สัญญา' }, { status: 400 });
  }
  if (repayType === RepayType.INSTALLMENT && months) {
    const finalDate = monthlyDate(startDate, months);
    if (dueDate && thaiDay(dueDate) !== thaiDay(finalDate)) return Response.json({ error: 'วันครบกำหนดต้องตรงกับงวดสุดท้าย' }, { status: 400 });
    dueDate = finalDate;
  }
  if (dueDate && thaiDay(dueDate) <= thaiDay(startDate)) return Response.json({ error: 'วันครบกำหนดต้องหลังวันเริ่มสัญญา' }, { status: 400 });
  if (repayType !== RepayType.INSTALLMENT && !dueDate) return Response.json({ error: 'กรุณาระบุวันครบกำหนด' }, { status: 400 });
  const interestRateBasis = repayType === RepayType.INSTALLMENT ? InterestRateBasis.MONTHLY_FLAT : InterestRateBasis.CONTRACT_FLAT;
  const interestAmount = Math.round((principal as number) * interestRate / 100 * (interestRateBasis === InterestRateBasis.MONTHLY_FLAT ? (months ?? 0) : 1));
  if (!Number.isSafeInteger(interestAmount) || interestAmount < 0 || (interestMode === InterestMode.UPFRONT && interestAmount > (principal as number))) return Response.json({ error: 'ยอดดอกเบี้ยไม่ถูกต้องหรือเกินเงินต้น' }, { status: 400 });

  try {
    const saved = await prisma.$transaction(async tx => {
      // Serialize concurrent changes and repayment writes using the contract row.
      await tx.contract.update({ where: { id }, data: { updatedAt: new Date() } });
      const current = await tx.contract.findUniqueOrThrow({ where: { id }, include: { payments: true, repayments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] }, schedules: true } });
      await assertLoanCompanyAccess(contractCompanyCode(current.documentData));
      await assertLoanPeriodOpen(tx, contractCompanyCode(current.documentData), current.startDate);
      await assertLoanPeriodOpen(tx, contractCompanyCode(current.documentData), startDate);
      for (const payment of current.payments) await assertLoanPeriodOpen(tx, contractCompanyCode(current.documentData), payment.paidAt);
      if (current.status === ContractStatus.CANCELLED) throw new Error('สัญญาที่ถูกยกเลิกแล้วไม่สามารถแก้ไขได้');
      if (current.repayments.some(receipt => receipt.reversedAt)) throw new Error('สัญญาที่มีใบรับกลับรายการแล้วต้องเก็บเงื่อนไขเดิม กรุณาสร้างสัญญาปรับโครงสร้างแยก');
      const receiptNotes = new Set(current.repayments.map(r => `รับชำระ ${r.receiptNumber}`));
      const recalculatedPayments = current.payments.filter(p => p.note && receiptNotes.has(p.note));
      const orphanedSplits = current.payments.filter(p => [PaymentType.INTEREST, PaymentType.PRINCIPAL, PaymentType.PENALTY].some(type => type === p.type) && !p.note?.startsWith('รับชำระ '));
      if (orphanedSplits.length) throw new Error('พบรายการตัดชำระเดิมที่ไม่มีใบรับเงินเชื่อมโยง จึงคำนวณย้อนหลังอย่างปลอดภัยไม่ได้');
      if (recalculatedPayments.length !== current.payments.filter(p => p.note?.startsWith('รับชำระ ') && receiptNotes.has(p.note)).length) throw new Error('รายการรับชำระเดิมไม่ครบถ้วน');

      const basePayments = current.payments.filter(p => !p.note || !receiptNotes.has(p.note));
      const interestModeValue = interestMode as InterestMode;
      const netDisbursed = interestModeValue === InterestMode.UPFRONT ? (principal as number) - interestAmount : principal as number;
      const terms = { principal: principal as number, interestRate, interestAmount, interestMode: interestModeValue, interestRateBasis, startDate, dueDate, lateFeePerDay: lateFeePerDay as number, lateFeeWaived, status: ContractStatus.ACTIVE, installmentMonths: months };
      const newPayments: { type: string; amount: number; paidAt: Date }[] = basePayments.map(({ type, amount, paidAt }) => ({ type, amount, paidAt }));
      const allocations: Array<{ id: string; allocation: ReturnType<typeof allocateRepayment> }> = [];
      for (const receipt of current.repayments) {
        const balance = loanBalance({ ...terms, payments: newPayments }, receipt.paidAt);
        const allocation = allocateRepayment(balance, receipt.amount);
        allocations.push({ id: receipt.id, allocation });
        newPayments.push(...([
          [PaymentType.INTEREST, allocation.interestPaid],
          [PaymentType.PENALTY, allocation.penaltyPaid],
          [PaymentType.PRINCIPAL, allocation.principalPaid],
        ] as const).filter(([, amount]) => amount > 0).map(([type, amount]) => ({ type, amount, paidAt: receipt.paidAt })));
      }
      await tx.payment.deleteMany({ where: { contractId: id, note: { in: [...receiptNotes] } } });
      await tx.payment.updateMany({ where: { contractId: id }, data: { scheduleId: null } });
      await tx.interestSchedule.deleteMany({ where: { contractId: id } });
      for (const receipt of current.repayments) {
        const allocation = allocations.find(item => item.id === receipt.id)!.allocation;
        await tx.repayment.update({ where: { id: receipt.id }, data: allocation });
        for (const [type, amount] of [[PaymentType.INTEREST, allocation.interestPaid], [PaymentType.PENALTY, allocation.penaltyPaid], [PaymentType.PRINCIPAL, allocation.principalPaid]] as const) {
          if (amount > 0) await tx.payment.create({ data: { contractId: id, type, amount, paidAt: receipt.paidAt, timeRecorded: receipt.timeRecorded, method: receipt.method, note: `รับชำระ ${receipt.receiptNumber}` } });
        }
      }
      const finalBalance = loanBalance({ ...terms, payments: newPayments }, new Date());
      const hasDisbursement = basePayments.some(p => p.type === PaymentType.DISBURSEMENT) || current.repayments.length > 0;
      const status = !hasDisbursement
        ? (current.status === ContractStatus.RESERVED && thaiDay(startDate) > thaiDay(new Date()) ? ContractStatus.RESERVED : current.status === ContractStatus.AWAITING_DOCUMENT ? ContractStatus.AWAITING_DOCUMENT : ContractStatus.READY)
        : finalBalance.total === 0 ? ContractStatus.CLOSED
          : dueDate && thaiDay(new Date()) > thaiDay(dueDate) ? ContractStatus.OVERDUE : ContractStatus.ACTIVE;
      const schedules = scheduleRows({ principal: principal as number, interestAmount, months, repayType: repayType as string, startDate, dueDate, interestMode: interestModeValue });
      await tx.interestSchedule.createMany({ data: schedules.map(row => ({ ...row, contractId: id, status: status === ContractStatus.CLOSED ? ScheduleStatus.PAID : ScheduleStatus.PENDING })) });
      let documentData = current.documentData;
      let parsed: Record<string, unknown>;
      try {
        const value: unknown = documentData ? JSON.parse(documentData) : {};
        parsed = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : { legacyDocumentData: documentData };
      }
      catch { parsed = { legacyDocumentData: documentData }; }
      const history = Array.isArray(parsed.contractEditHistory) ? parsed.contractEditHistory : [];
      parsed.contractEditHistory = [...history, {
        at: new Date().toISOString(), reason,
        old: { principal: current.principal, interestRate: current.interestRate, repayType: current.repayType, interestMode: current.interestMode, installmentMonths: current.installmentMonths, startDate: current.startDate.toISOString(), dueDate: current.dueDate?.toISOString() ?? null },
        next: { principal, interestRate, repayType, interestMode, installmentMonths: months, startDate: startDate.toISOString(), dueDate: dueDate?.toISOString() ?? null },
        repayments: current.repayments.map(receipt => ({ receiptNumber: receipt.receiptNumber, amount: receipt.amount, previous: { interestPaid: receipt.interestPaid, penaltyPaid: receipt.penaltyPaid, principalPaid: receipt.principalPaid }, recalculated: allocations.find(item => item.id === receipt.id)?.allocation })),
      }];
      documentData = JSON.stringify(parsed);
      const updated = await tx.contract.update({ where: { id }, data: { principal: principal as number, interestRate, interestAmount, netDisbursed, repayType: repayType as RepayType, interestMode: interestModeValue, interestRateBasis, installmentMonths: months, periodDays, startDate, dueDate, lateFeePerDay: lateFeePerDay as number, lateFeeWaived, status, documentData } });
      const auditFields = (value: typeof current | typeof updated) => ({
        contractNumber: value.contractNumber,
        principal: value.principal,
        interestRate: value.interestRate,
        interestAmount: value.interestAmount,
        netDisbursed: value.netDisbursed,
        repayType: value.repayType,
        interestMode: value.interestMode,
        installmentMonths: value.installmentMonths,
        periodDays: value.periodDays,
        startDate: value.startDate,
        dueDate: value.dueDate,
        lateFeePerDay: value.lateFeePerDay,
        lateFeeWaived: value.lateFeeWaived,
        status: value.status,
      });
      await writeLoanLog(tx, {
        borrowerId: current.debtorId, contractId: id, targetId: id, type: 'CONTRACT', action: 'UPDATE',
        note: `แก้ไขสัญญา ${current.contractNumber}: ${reason}`,
        beforeData: auditFields(current), afterData: auditFields(updated),
      });
      return updated;
    });
    after(async()=>{await syncLoanGoogleSheet();});
    return Response.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'แก้ไขสัญญาไม่สำเร็จ';
    return Response.json({ error: message }, { status: message.includes('ไม่พบ') ? 404 : 409 });
  }
}
