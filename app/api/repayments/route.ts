import { access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { loanBalance, allocateRepayment, thaiDay } from '@/lib/loan-balance';
import { isPrismaCode } from '@/lib/borrowers';
export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const paidDate = params.get('date');
    const asOf = paidDate ? new Date(`${paidDate}T12:00:00+07:00`) : new Date();
    if (!Number.isFinite(asOf.getTime()))
        return Response.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
    const contractId = params.get('contractId');
    const [contracts, legacyEntries] = await Promise.all([
        prisma.contract.findMany({ where: contractId ? { id: contractId } : undefined, include: { debtor: { select: { borrowersCode: true, firstName: true, lastName: true, nickname: true } }, payments: true, repayments: { orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] } }, orderBy: { createdAt: 'desc' } }),
        prisma.companyLedgerEntry.findMany({
            where: { type: 'INCOME', title: { in: ['รับดอกเบี้ย', 'รับชำระเงินต้น', 'รับชำระเงินต้นพร้อมดอกเบี้ย'] }, note: { contains: 'นำเข้าจากบัญชีเดิม' } },
            select: { id: true, title: true, amount: true, transactionDate: true, party: true, reference: true, note: true, method: true },
            orderBy: { transactionDate: 'desc' },
        }),
    ]);
    return Response.json(contracts.map(({ payments, ...contract }) => ({
        ...contract,
        balance: loanBalance({ ...contract, payments }, asOf),
        legacyPayments: legacyEntries.filter(entry => entry.party.startsWith(`${contract.contractNumber} · `)),
    })), { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
        return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object')
        return Response.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const { contractId, requestKey, paidAt, method, evidenceUrl, note } = raw;
    const amount = raw.amount;
    const waivePenalty = raw.waivePenalty;
    if (waivePenalty !== undefined && typeof waivePenalty !== 'boolean')
        return Response.json({ error: 'ตัวเลือกยกเว้นค่าปรับไม่ถูกต้อง' }, { status: 400 });
    const date = typeof paidAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? new Date(`${paidAt}T12:00:00+07:00`) : new Date(NaN);
    if (typeof contractId !== 'string' || typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647 || !Number.isFinite(date.getTime()) || thaiDay(date) > thaiDay(new Date()) || !['CASH', 'BANK_TRANSFER'].includes(method))
        return Response.json({ error: 'ตรวจยอดเงิน วันที่ ช่องรับชำระ และรหัสรายการ' }, { status: 400 });
    if (evidenceUrl && (typeof evidenceUrl !== 'string' || !/^\/api\/repayments\/evidence\/[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(evidenceUrl)))
        return Response.json({ error: 'หลักฐานไม่ถูกต้อง' }, { status: 400 });
    if (evidenceUrl) {
        try {
            await access(path.join(process.cwd(), 'storage', 'repayment-evidence', evidenceUrl.split('/').pop()));
        }
        catch {
            return Response.json({ error: 'ไม่พบไฟล์หลักฐาน กรุณาแนบใหม่' }, { status: 400 });
        }
    }
    if (new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) !== paidAt)
        return Response.json({ error: 'วันที่รับชำระไม่ถูกต้อง' }, { status: 400 });
    const matches = (record: {
        contractId: string;
        amount: number;
        paidAt: Date;
        method: string;
    }) => record.contractId === contractId && record.amount === amount && thaiDay(record.paidAt) === thaiDay(date) && record.method === method;
    try {
        const saved = await prisma.$transaction(async (tx) => {
            // Acquire a write lock before reading balances so simultaneous receipts cannot overpay.
            const existing = await tx.repayment.findUnique({ where: { requestKey } });
            if (existing) {
                if (!matches(existing))
                    throw new Error('รหัสรายการนี้ใช้กับข้อมูลอื่นแล้ว');
                return existing;
            }
            await tx.contract.update({ where: { id: contractId }, data: { updatedAt: new Date(), ...(typeof waivePenalty === 'boolean' ? { lateFeeWaived: waivePenalty } : {}) } });
            const contract = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: { payments: true } });
            if (!['ACTIVE', 'OVERDUE'].includes(contract.status))
                throw new Error('รับชำระได้เฉพาะสัญญาที่จ่ายเงินแล้วและยังไม่ปิดยอด');
            if (thaiDay(date) < thaiDay(contract.startDate))
                throw new Error('วันชำระต้องไม่ก่อนวันเริ่มสัญญา');
            if (contract.payments.some(p => ['INTEREST', 'PRINCIPAL', 'PENALTY'].includes(p.type) && thaiDay(p.paidAt) > thaiDay(date)))
                throw new Error('ไม่สามารถลงรายการก่อนรายการรับชำระล่าสุดได้');
            const balance = loanBalance(contract, date);
            const allocation = allocateRepayment(balance, amount);
            const receiptNumber = `RC-${randomUUID()}`;
            const receipt = await tx.repayment.create({ data: { requestKey, receiptNumber, contractId, paidAt: date, amount, method, ...allocation, evidenceUrl: evidenceUrl || null, note: typeof note === 'string' ? note.trim().slice(0, 2000) || null : null } });
            for (const [type, value] of [['INTEREST', allocation.interestPaid], ['PENALTY', allocation.penaltyPaid], ['PRINCIPAL', allocation.principalPaid]] as const) {
                if (value > 0)
                    await tx.payment.create({ data: { contractId, type, amount: value, paidAt: date, method, note: `รับชำระ ${receiptNumber}` } });
            }
            if (allocation.totalRemaining === 0) {
                await tx.contract.update({ where: { id: contractId }, data: { status: 'CLOSED' } });
                await tx.interestSchedule.updateMany({ where: { contractId }, data: { status: 'PAID' } });
            }
            return receipt;
        });
        return Response.json(saved, { status: 201 });
    }
    catch (error) {
        if (isPrismaCode(error, 'P2002')) {
            const existing = await prisma.repayment.findUnique({ where: { requestKey } });
            if (existing && matches(existing))
                return Response.json(existing);
        }
        if (isPrismaCode(error, 'P2025'))
            return Response.json({ error: 'ไม่พบสัญญา' }, { status: 404 });
        return Response.json({ error: error instanceof Error && !('code' in error) ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่โดยใช้รายการเดิม' }, { status: 400 });
    }
}
