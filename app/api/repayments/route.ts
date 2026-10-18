import { authorizeApiRequest } from "@/lib/authorization";
import { loanApplicationFields } from '@/lib/loan-application';
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { loanBalance, allocateRepayment, thaiDay } from '@/lib/loan-balance';
import { isPrismaCode } from '@/lib/borrowers';
import { formatBorrowerCode } from '@/lib/borrower-code';
import { writeLoanLog } from '@/lib/loan-logs';
import { isUploadUrl, storedUploadPath } from '@/lib/borrower-file-storage';
export async function GET(request: Request) {
  const denied = await authorizeApiRequest("repayments", "read");
  if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const paidDate = params.get('date');
    const asOf = paidDate ? new Date(`${paidDate}T12:00:00+07:00`) : new Date();
    if (!Number.isFinite(asOf.getTime()))
        return Response.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
    const contractId = params.get('contractId');
    const [contracts, legacyEntries] = await Promise.all([
        prisma.contract.findMany({ where: contractId ? { id: contractId } : undefined, include: { application:true, debtor: { select: { borrowersCode: true, firstName: true, lastName: true, phone: true, nickname: true, address: true, houseNumber: true } }, payments: true, repayments: { orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] } }, orderBy: { createdAt: 'desc' } }),
        prisma.companyLedgerEntry.findMany({
            where: { type: 'INCOME', title: { in: ['รับดอกเบี้ย', 'รับชำระเงินต้น', 'รับชำระเงินต้นพร้อมดอกเบี้ย'] }, note: { contains: 'นำเข้าจากบัญชีเดิม' } },
            select: { id: true, title: true, amount: true, transactionDate: true, party: true, reference: true, note: true, method: true },
            orderBy: { transactionDate: 'desc' },
        }),
    ]);
    const branchInfoOf = (documentData: string | null) => {
        if (!documentData) return { branchCode: '', companyCode: '' };
        try {
            const parsed = JSON.parse(documentData);
            return {
                branchCode: typeof parsed?.branchCode === 'string' ? parsed.branchCode.trim() : '',
                companyCode: typeof parsed?.companyCode === 'string' ? parsed.companyCode.trim() : '',
            };
        } catch {
            return { branchCode: '', companyCode: '' };
        }
    };
    const branchInfoByContract = new Map(contracts.map(contract => [contract.id, branchInfoOf(contract.documentData)]));
    const branchCodes = [...new Set([...branchInfoByContract.values()].map(info => info.branchCode).filter(Boolean))];
    const companyCodes = [...new Set([...branchInfoByContract.values()].map(info => info.companyCode).filter(Boolean))];
    const branchFilters = [
        ...(branchCodes.length ? [{ branchcode: { in: branchCodes } }] : []),
        ...(companyCodes.length ? [{ companycode: { in: companyCodes } }] : []),
    ];
    const branches = await prisma.branchCodeSequence.findMany({
        where: branchFilters.length ? { OR: [...branchFilters, { status: 'ACTIVE', type: 'BRANCH' }] } : { status: 'ACTIVE', type: 'BRANCH' },
        include: { company: { select: { nameTH: true, nameEN: true, TaxIdentificationNumber: true, address: true, postcode: true, phone: true } } },
    });
    const branchByCode = new Map(branches.map(branch => [branch.branchcode, {
        name: branch.nameTH || branch.nameEN || '',
        companyName: branch.company.nameTH || branch.company.nameEN || '',
        taxId: branch.TaxIdentificationNumber || branch.company.TaxIdentificationNumber || '',
        address: [branch.address || [branch.houseNo && `เลขที่ ${branch.houseNo}`, branch.moo && `หมู่${branch.moo}`, branch.soi && `ซอย${branch.soi}`, branch.road && `ถนน${branch.road}`].filter(Boolean).join(' ') || branch.company.address, branch.postcode || branch.company.postcode].filter(Boolean).join(' '),
        phone: branch.phone || branch.company.phone || '',
    }]));
    const branchesByCompany = new Map<string, typeof branches>();
    for (const branch of branches) {
        const companyBranches = branchesByCompany.get(branch.companycode) ?? [];
        companyBranches.push(branch);
        branchesByCompany.set(branch.companycode, companyBranches);
    }
    const loanBranchOf = (companyCode = '') => {
        const candidates = branches.filter(branch => branch.status === 'ACTIVE'
            && (!companyCode || branch.companycode === companyCode)
            && /loan|สินเชื่อ|เงินกู้|โลน/i.test(`${branch.nameTH ?? ''} ${branch.nameEN ?? ''}`));
        return candidates.length === 1 ? branchByCode.get(candidates[0].branchcode) ?? null : null;
    };
    const receiptBranchOf = (contractId: string) => {
        const identifiers = branchInfoByContract.get(contractId);
        if (!identifiers) return null;
        if (identifiers.branchCode) return branchByCode.get(identifiers.branchCode) ?? null;
        const companyBranches = branchesByCompany.get(identifiers.companyCode) ?? [];
        if (companyBranches.length === 1) return branchByCode.get(companyBranches[0].branchcode) ?? null;
        return loanBranchOf(identifiers.companyCode);
    };
    return Response.json(contracts.map(({ payments, ...contract }) => ({
        ...contract,
        ...loanApplicationFields(contract.application),
        debtor: { ...contract.debtor, borrowersCode: formatBorrowerCode(contract.debtor.borrowersCode) },
        receiptBranch: receiptBranchOf(contract.id),
        balance: loanBalance({ ...contract, payments }, asOf),
        legacyPayments: legacyEntries.filter(entry => entry.party.startsWith(`${contract.contractNumber} · `)),
    })), { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  const denied = await authorizeApiRequest("repayments", "write");
  if (denied) return denied;
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
    const datetimeMatch = typeof paidAt === 'string' ? /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(paidAt) : null;
    const legacyDateMatch = typeof paidAt === 'string' ? /^(\d{4}-\d{2}-\d{2})$/.exec(paidAt) : null;
    const paidDate = datetimeMatch?.[1] ?? legacyDateMatch?.[1];
    const date = datetimeMatch
        ? new Date(`${datetimeMatch[1]}T${datetimeMatch[2]}:${datetimeMatch[3]}:00.000+07:00`)
        : legacyDateMatch ? new Date(`${legacyDateMatch[1]}T12:00:00.000+07:00`) : new Date(NaN);
    if (typeof contractId !== 'string' || typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647 || !Number.isFinite(date.getTime()) || date.getTime() > Date.now() || !['CASH', 'BANK_TRANSFER'].includes(method))
        return Response.json({ error: 'ตรวจยอดเงิน วันที่ ช่องรับชำระ และรหัสรายการ' }, { status: 400 });
    if (evidenceUrl && (typeof evidenceUrl !== 'string' || !isUploadUrl(evidenceUrl, '/api/repayments/evidence', ['jpg', 'png', 'webp', 'pdf'])))
        return Response.json({ error: 'หลักฐานไม่ถูกต้อง' }, { status: 400 });
    if (evidenceUrl) {
        try {
            await access(storedUploadPath('repayment-evidence', evidenceUrl));
        }
        catch {
            return Response.json({ error: 'ไม่พบไฟล์หลักฐาน กรุณาแนบใหม่' }, { status: 400 });
        }
    }
    if (new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) !== paidDate)
        return Response.json({ error: 'วันที่รับชำระไม่ถูกต้อง' }, { status: 400 });
    const matches = (record: {
        contractId: string;
        amount: number;
        paidAt: Date;
        method: string;
    }) => record.contractId === contractId && record.amount === amount && record.paidAt.getTime() === date.getTime() && record.method === method;
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
            const receipt = await tx.repayment.create({ data: { requestKey, receiptNumber, contractId, paidAt: date, timeRecorded: Boolean(datetimeMatch), amount, method, ...allocation, evidenceUrl: evidenceUrl || null, note: typeof note === 'string' ? note.trim().slice(0, 2000) || null : null } });
            await writeLoanLog(tx, {
                borrowerId: contract.debtorId,
                contractId,
                targetId: receipt.id,
                type: 'REPAYMENT',
                action: 'CREATE',
                note: `รับชำระเงิน ${receiptNumber} · สัญญา ${contract.contractNumber}`,
                afterData: { receiptNumber, amount: receipt.amount, paidAt: receipt.paidAt, method: receipt.method, interestPaid: receipt.interestPaid, penaltyPaid: receipt.penaltyPaid, principalPaid: receipt.principalPaid },
            });
            for (const [type, value] of [['INTEREST', allocation.interestPaid], ['PENALTY', allocation.penaltyPaid], ['PRINCIPAL', allocation.principalPaid]] as const) {
                if (value > 0)
                    await tx.payment.create({ data: { contractId, type, amount: value, paidAt: date, timeRecorded: Boolean(datetimeMatch), method, note: `รับชำระ ${receiptNumber}` } });
            }
            if (allocation.totalRemaining === 0) {
                await tx.contract.update({ where: { id: contractId }, data: { status: 'CLOSED' } });
                await tx.interestSchedule.updateMany({ where: { contractId }, data: { status: 'PAID' } });
                await writeLoanLog(tx, {
                    borrowerId: contract.debtorId,
                    contractId,
                    targetId: contractId,
                    type: 'CONTRACT',
                    action: 'UPDATE',
                    note: `ปิดสัญญา ${contract.contractNumber} หลังรับชำระครบ`,
                    beforeData: { status: contract.status },
                    afterData: { status: 'CLOSED' },
                });
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
