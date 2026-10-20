import type { LoanClosingSnapshot } from "@/lib/loan-closing-snapshot";
import { syncLoanScheduleStatus } from "@/lib/loan-schedule-status";
import { authorizeApiRequest, getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getLoanOperationsData } from "@/lib/loan-operations-data";
import { localDate, parseLoanDate } from "@/lib/loan-operations-calculations";
import { assertLoanPeriodOpen, contractCompanyCode } from "@/lib/loan-accounting-lock";
import { getCompanyLedgerRows } from "@/lib/company-ledger";
import { summarizeCompanyLedgerRows } from "@/lib/company-ledger-summary";
import { thaiDay } from "@/lib/loan-balance";
import { writeLoanLog } from "@/lib/loan-logs";

const text = (v: unknown, max = 2000) => typeof v === "string" ? v.trim().slice(0, max) : "";
function amount(v: unknown, allowZero = false) { if (typeof v !== "number" || !Number.isSafeInteger(v) || v < (allowZero ? 0 : 1) || v > 2147483647) throw new Error("จำนวนเงินไม่ถูกต้อง"); return v; }
function signedAmount(v: unknown) { if (typeof v !== "number" || !Number.isSafeInteger(v) || Math.abs(v) > 2147483647) throw new Error("ยอดคงเหลือไม่ถูกต้อง"); return v; }

export async function GET(request: Request) {
  for (const area of ["contracts", "accounting"] as const) { const denied = await authorizeApiRequest(area, "read"); if (denied) return denied; }
  const params = new URL(request.url).searchParams;
  try {
    const asOf = params.get("asOf") ? parseLoanDate(params.get("asOf")) : new Date();
    if (thaiDay(asOf) > thaiDay(new Date())) throw new Error("วันที่สรุปต้องไม่เกินวันนี้");
    const year = Number(params.get("year") || localDate(asOf).slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("ปีไม่ถูกต้อง");
    return Response.json(await getLoanOperationsData(asOf, text(params.get("company"), 5), year), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" }, { status: 400 }); }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const data = input as Record<string, unknown>;
  const action = text(data.action, 40);
  const followup = ["FOLLOWUP", "COMPLETE_FOLLOWUP"].includes(action);
  const denied = await authorizeApiRequest(followup ? "contracts" : "accounting", "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const userId = access.session.user.id;
  const canApprove = access.permissions.includes("*") || access.permissions.includes("loan:approve");
  const scope = (company: string | null) => { if (access.accessConfigured && (!company || !access.companyCodes.includes(company))) throw new Error("ไม่มีสิทธิ์เข้าถึงบริษัทนี้"); };
  try {
    const result = await prisma.$transaction(async tx => {
      // Take a SQLite write lock before reading balances and closure state.
      await tx.loanAccountingPeriod.updateMany({ where: { id: "__loan_write_lock__" }, data: { status: "CLOSED" } });
      let targetId = "", borrowerId = "", contractId: string | null = null;
      let saved: unknown;
      if (action === "ASSIGN_COMPANY" || action === "ASSIGN_LEDGER_COMPANY") {
        if (!access.permissions.includes("*") || access.accessConfigured) throw new Error("ให้เจ้าของระบบที่ดูข้อมูลรวมเป็นผู้ยืนยันบริษัทของรายการเดิม");
        const companyCode = text(data.companyCode,5), branchCode = text(data.branchCode,5) || companyCode, reason = text(data.reason);
        if (!reason) throw new Error("ระบุเหตุผลการจัดสรรบริษัท");
        const company = await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" } });
        if (!company) throw new Error("เลือกบริษัทที่เปิดใช้งาน");
        if (branchCode !== companyCode && !await tx.branchCodeSequence.findFirst({ where: { branchcode: branchCode, companycode: companyCode, type: "BRANCH", status: "ACTIVE" } })) throw new Error("สาขาไม่ตรงกับบริษัท");
        if (action === "ASSIGN_COMPANY") {
          const current = await tx.contract.findUniqueOrThrow({ where: { id: text(data.id,100) }, include: { payments: true } });
          if (contractCompanyCode(current.documentData)) throw new Error("สัญญานี้ระบุบริษัทแล้ว");
          for (const payment of current.payments) await assertLoanPeriodOpen(tx, companyCode, payment.paidAt);
          const snapshot = { companyCode, branchCode, companyName: company.nameTH || company.nameEN, assignedAt: new Date().toISOString(), assignedBy: userId, reason };
          const document = JSON.parse(current.documentData || "{}");
          saved = await tx.contract.update({ where: { id: current.id }, data: { documentData: JSON.stringify({ ...document, companyCode, branchCode, companyAssignment: snapshot }) } });
          targetId = current.id; contractId = current.id; borrowerId = current.debtorId;
        } else {
          const current = await tx.companyLedgerEntry.findUniqueOrThrow({ where: { id: text(data.id,100) } });
          if (current.companyCode) throw new Error("รายการนี้ระบุบริษัทแล้ว");
          await assertLoanPeriodOpen(tx, companyCode, current.transactionDate);
          saved = await tx.companyLedgerEntry.update({ where: { id: current.id }, data: { companyCode, branchCode, note: `${current.note}\nจัดสรรบริษัท: ${reason}`.trim() } }); targetId = current.id;
        }
      } else       if (action === "FOLLOWUP" || action === "COMPLETE_FOLLOWUP") {
        const previous = action === "COMPLETE_FOLLOWUP" ? await tx.loanFollowUp.findUniqueOrThrow({ where: { id: text(data.id, 100) } }) : null;
        const contract = await tx.contract.findUniqueOrThrow({ where: { id: previous?.contractId || text(data.contractId, 100) } });
        scope(contractCompanyCode(contract.documentData)); contractId = contract.id; borrowerId = contract.debtorId;
        if (previous) {
          saved = await tx.loanFollowUp.update({ where: { id: previous.id }, data: { status: "DONE", completedAt: new Date() } }); targetId = previous.id;
        } else {
          const outcome = text(data.outcome, 40), note = text(data.note);
          if (!["CONTACTED", "NO_ANSWER", "PROMISE", "RESCHEDULE", "OTHER"].includes(outcome) || !note) throw new Error("ระบุผลการติดต่อและบันทึก");
          const promisedAt = data.promisedAt ? parseLoanDate(data.promisedAt) : null;
          const promisedAmount = data.promisedAmount ? amount(data.promisedAmount) : 0;
          if (["PROMISE", "RESCHEDULE"].includes(outcome) && (!promisedAt || promisedAmount <= 0)) throw new Error("กรุณาระบุวันนัดและยอดนัดชำระ");
          const assigneeId = text(data.assigneeId, 100) || userId;
          const assignee = await tx.user.findFirst({ where: { id: assigneeId, status: "ACTIVE", banned: false } });
          if (!assignee) throw new Error("ไม่พบผู้รับผิดชอบ");
          const row = await tx.loanFollowUp.create({ data: { contractId, outcome, note, promisedAt, promisedAmount, assigneeId, assigneeName: assignee.name, createdBy: userId } }); saved = row; targetId = row.id;
        }
      } else if (action === "INVESTOR") {
        const nationalId = text(data.nationalId, 13), title = text(data.title, 30), firstName = text(data.firstName, 100), lastName = text(data.lastName, 100), phone = text(data.phone, 30), email = text(data.email, 200), address = text(data.address, 1000);
        if (!/^\d{13}$/.test(nationalId) || !title || !firstName || !lastName || !phone || !address || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("กรอกข้อมูลผู้ลงทุนให้ครบและถูกต้อง");
        const row = await tx.loanInvestor.create({ data: { nationalId, title, firstName, lastName, phone, email, address, createdBy: userId } });
        saved = { id: row.id }; targetId = row.id;
      } else if (action === "ASSIGN_INVESTOR") {
        if (!canApprove) throw new Error("ต้องมีสิทธิ์อนุมัติ Loan เพื่อจัดผู้ลงทุนให้ทุนเดิม");
        const entry = await tx.companyLedgerEntry.findUniqueOrThrow({ where: { id: text(data.id,100) }, include: { financeCategory: true } }); scope(entry.companyCode);
        if (entry.investorId || entry.reversalOfId || !entry.financeCategory || !["LOAN_CAPITAL_IN","LOAN_CAPITAL_OUT","LEGACY_CAPITAL_START","LEGACY_CAPITAL_WITHDRAWAL"].includes(entry.financeCategory.code)) throw new Error("เลือกได้เฉพาะรายการทุนเดิมที่ยังไม่ระบุผู้ลงทุน");
        await assertLoanPeriodOpen(tx, entry.companyCode, entry.transactionDate);
        const investor = await tx.loanInvestor.findUniqueOrThrow({ where: { id: text(data.investorId,100) } });
        if (access.accessConfigured && investor.createdBy !== userId && !await tx.loanCapitalRequest.findFirst({ where: { investorId: investor.id, companyCode: { in: access.companyCodes } } })) throw new Error("ไม่มีสิทธิ์เข้าถึงผู้ลงทุน");
        const investorSnapshot = JSON.stringify({ id: investor.id, title: investor.title, firstName: investor.firstName, lastName: investor.lastName, phone: investor.phone, email: investor.email, address: investor.address });
        saved = await tx.companyLedgerEntry.update({ where: { id: entry.id }, data: { investorId: investor.id, investorSnapshot } }); targetId = entry.id;
      } else if (action === "CAPITAL_REQUEST") {
        const companyCode = text(data.companyCode, 5), branchCode = text(data.branchCode, 5) || companyCode;
        scope(companyCode);
        const company = await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" } });
        if (!company) throw new Error("เลือกบริษัทที่เปิดใช้งาน");
        if (branchCode !== companyCode && !await tx.branchCodeSequence.findFirst({ where: { branchcode: branchCode, companycode: companyCode, type: "BRANCH", status: "ACTIVE" } })) throw new Error("สาขาไม่ถูกต้อง");
        const direction = text(data.direction, 10), method = text(data.method, 30);
        if (!["INCOME", "EXPENSE"].includes(direction) || !["CASH", "BANK_TRANSFER"].includes(method)) throw new Error("ประเภทรายการหรือช่องทางไม่ถูกต้อง");
        const investorId = text(data.investorId, 100);
        if (!investorId) throw new Error("เลือกผู้ลงทุนก่อนบันทึกทุน");
        const investor = await tx.loanInvestor.findUniqueOrThrow({ where: { id: investorId } });
        if (!investor.active) throw new Error("ผู้ลงทุนไม่เปิดใช้งาน");
        if (access.accessConfigured && investor.createdBy !== userId) {
          const linked = await tx.loanCapitalRequest.findFirst({ where: { investorId, companyCode: { in: access.companyCodes } } });
          if (!linked) throw new Error("ไม่มีสิทธิ์เข้าถึงผู้ลงทุนนี้");
        }
        const investorSnapshot = JSON.stringify({ id: investor.id, title: investor.title, firstName: investor.firstName, lastName: investor.lastName, phone: investor.phone, email: investor.email, address: investor.address });
        const requestKey = text(data.requestKey, 100);
        if (requestKey.length < 16) throw new Error("รหัสคำขอไม่ถูกต้อง");
        const value = amount(data.amount);
        const existing = await tx.loanCapitalRequest.findUnique({ where: { requestKey } });
        if (existing) { if (existing.requestedBy !== userId || existing.amount !== value || existing.direction !== direction || existing.companyCode !== companyCode || existing.investorId !== investorId) throw new Error("รหัสคำขอถูกใช้แล้ว"); return existing; }
        const row = await tx.loanCapitalRequest.create({ data: { requestKey, direction, amount: value, companyCode, branchCode, investorId, investorSnapshot, method, reference: text(data.reference, 100), note: text(data.note), requestedBy: userId } }); saved = row; targetId = row.id;
      } else if (action === "REVIEW_CAPITAL") {
        if (!canApprove) throw new Error("ต้องมีสิทธิ์อนุมัติ Loan");
        const row = await tx.loanCapitalRequest.findUniqueOrThrow({ where: { id: text(data.id, 100) } }); scope(row.companyCode);
        if (row.status !== "PENDING") return row;
        if (row.requestedBy === userId && !access.permissions.includes("*")) throw new Error("ผู้ขอต้องเป็นคนละคนกับผู้อนุมัติ");
        const decision = text(data.decision, 20), reason = text(data.reason);
        if (!["APPROVED", "REJECTED"].includes(decision) || !reason) throw new Error("ระบุผลอนุมัติและเหตุผล");
        let ledgerEntryId: string | null = null;
        if (decision === "APPROVED") {
          await assertLoanPeriodOpen(tx, row.companyCode, new Date());
          if (!row.reference && row.method === "BANK_TRANSFER") throw new Error("คำขอโอนเงินต้องมีเลขอ้างอิงหลักฐานก่อนอนุมัติ");
          if (row.direction === "EXPENSE") {
            const rows = (await getCompanyLedgerRows(null, new Date(thaiDay(new Date()) - 7 * 3600000), tx)).filter(item => item.source === "LOAN" && item.companyCode === row.companyCode);
            const cash = summarizeCompanyLedgerRows(rows).net;
            const investorNet = rows.filter(item => item.investorId === row.investorId && /CAPITAL|WITHDRAWAL/.test(item.categoryCode)).reduce((sum,item) => sum + (item.type === "INCOME" ? item.amount : -item.amount),0);
            if (row.amount > cash) throw new Error("เงินสดคงเหลือไม่พอถอนทุน");
            if (row.amount > investorNet) throw new Error("ยอดถอนเกินทุนคงเหลือของผู้ลงทุนนี้");
          }
          const code = row.direction === "INCOME" ? "LOAN_CAPITAL_IN" : "LOAN_CAPITAL_OUT";
          const name = row.direction === "INCOME" ? "รับเงินทุน" : "ถอนทุน";
          const category = await tx.companyFinanceCategory.upsert({ where: { code }, create: { code, direction: row.direction, name, isSystem: true }, update: {} });
          const date = new Date(), year = Number(localDate(date).slice(0,4));
          const sequence = await tx.companyLedgerNumberSequence.upsert({ where: { companyCode_branchCode_year: { companyCode: row.companyCode, branchCode: row.branchCode, year } }, create: { companyCode: row.companyCode, branchCode: row.branchCode, year, lastNumber: 1 }, update: { lastNumber: { increment: 1 } } });
          const snapshot = JSON.parse(row.investorSnapshot || "{}");
          const entry = await tx.companyLedgerEntry.create({ data: { type: row.direction, title: name, category: category.name, financeCategoryId: category.id, amount: row.amount, transactionDate: date, timeRecorded: true, documentNumber: `OBN-L-${String(year % 100).padStart(2,"0")}-${row.companyCode}-${row.branchCode}-${String(sequence.lastNumber).padStart(6,"0")}`, companyCode: row.companyCode, branchCode: row.branchCode, method: row.method, reference: row.reference, party: [snapshot.firstName, snapshot.lastName].filter(Boolean).join(" "), note: row.note, investorId: row.investorId, investorSnapshot: row.investorSnapshot, createdBy: userId } }); ledgerEntryId = entry.id;
        }
        saved = await tx.loanCapitalRequest.update({ where: { id: row.id }, data: { status: decision, reviewedBy: userId, reviewedAt: new Date(), reviewNote: reason, ledgerEntryId } }); targetId = row.id;
      } else if (action === "CLOSE_PERIOD" || action === "REOPEN_PERIOD") {
        if (!canApprove) throw new Error("ต้องมีสิทธิ์อนุมัติ Loan");
        const reason = text(data.reason); if (!reason) throw new Error("ระบุเหตุผล");
        if (action === "REOPEN_PERIOD") {
          const row = await tx.loanAccountingPeriod.findUniqueOrThrow({ where: { id: text(data.id, 100) } }); scope(row.companyCode);
          if (await tx.loanAccountingPeriod.findFirst({ where: { companyCode: row.companyCode, status: "CLOSED", throughDate: { gt: row.throughDate } } })) throw new Error("กรุณาเปิดรอบจากรอบล่าสุดก่อน เพื่อรักษาลำดับยอดยืนยัน");
          saved = await tx.loanAccountingPeriod.update({ where: { id: row.id }, data: { status: "OPEN", reopenedAt: new Date(), reopenedBy: userId, reason: `${row.reason}\nเปิดรอบ: ${reason}` } }); targetId = row.id;
        } else {
          const companyCode = text(data.companyCode, 5); scope(companyCode);
          if (!await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" } })) throw new Error("เลือกบริษัท");
          const throughDate = parseLoanDate(data.throughDate);
          if (thaiDay(throughDate) > thaiDay(new Date())) throw new Error("ปิดรอบล่วงหน้าไม่ได้");
          const previous = await tx.loanAccountingPeriod.findFirst({ where: { companyCode, status: "CLOSED" }, orderBy: { throughDate: "desc" } });
          if (previous && thaiDay(previous.throughDate) >= thaiDay(throughDate)) throw new Error("ต้องปิดรอบหลังรอบที่ปิดล่าสุด หรือเปิดรอบเดิมก่อนปิดใหม่");
          const allClosingRows = await getCompanyLedgerRows(null, new Date(thaiDay(throughDate) - 7 * 3600000), tx);
          if (allClosingRows.some(item => item.source === "LOAN" && !item.companyCode)) throw new Error("มีรายการ Loan ยังไม่จัดสรรบริษัท กรุณาให้เจ้าของระบบตรวจและจัดสรรก่อนปิดรอบ");
          const rows = allClosingRows.filter(item => item.source === "LOAN" && item.companyCode === companyCode);
          const periodRows = previous ? rows.filter(item => thaiDay(item.transactionDate) > thaiDay(previous.throughDate)) : rows;
          const totals = summarizeCompanyLedgerRows(periodRows);
          const reconciliation = await tx.loanReconciliation.findFirst({ where: { companyCode, method: "ALL", asOf: { gte: new Date(thaiDay(throughDate) - 7 * 3600000), lt: new Date(thaiDay(throughDate) + 17 * 3600000) } }, orderBy: { createdAt: "desc" } });
          const cashBalance = summarizeCompanyLedgerRows(rows).net;
          const snapshot: LoanClosingSnapshot = { version: 1, from: previous ? localDate(new Date(thaiDay(previous.throughDate) + 86400000 + 5 * 3600000)) : null, through: localDate(throughDate), capturedAt: new Date().toISOString(), income: totals.income, expense: totals.expense, cashBalance, difference: reconciliation ? reconciliation.statementAmount - cashBalance : null, reconciliationId: reconciliation?.id || null };
          const row = await tx.loanAccountingPeriod.create({ data: { companyCode, throughDate, reason, createdBy: userId, snapshot: JSON.stringify(snapshot) } }); saved = row; targetId = row.id;
        }
      } else if (action === "RECONCILE") {
        const companyCode = text(data.companyCode, 5); scope(companyCode);
        if (!await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" } })) throw new Error("เลือกบริษัท");
        const asOf = parseLoanDate(data.asOf), method = text(data.method, 30), reference = text(data.reference, 100);
        if (!["CASH", "BANK_TRANSFER", "ALL"].includes(method) || !reference || thaiDay(asOf) > thaiDay(new Date())) throw new Error("ระบุวันที่ ช่องทาง และเลขอ้างอิงที่ถูกต้อง");
        const rows = (await getCompanyLedgerRows(null, new Date(thaiDay(asOf) - 7 * 3600000), tx)).filter(row => row.source === "LOAN" && row.companyCode === companyCode && (method === "ALL" || row.method === method));
        const ledgerAmount = summarizeCompanyLedgerRows(rows).net, statementAmount = signedAmount(data.statementAmount);
        const row = await tx.loanReconciliation.create({ data: { companyCode, asOf, method, reference, statementAmount, ledgerAmount, difference: statementAmount - ledgerAmount, note: text(data.note), createdBy: userId } }); saved = row; targetId = row.id;
      } else if (action === "REVERSE_RECEIPT") {
        if (!canApprove) throw new Error("ต้องมีสิทธิ์อนุมัติ Loan เพื่อกลับใบรับชำระ");
        const receipt = await tx.repayment.findUniqueOrThrow({ where: { id: text(data.id,100) }, include: { contract: { include: { repayments: true } } } });
        const contract = receipt.contract, code = contractCompanyCode(contract.documentData); scope(code);
        if (receipt.reversedAt) return { id: receipt.id, reversedAt: receipt.reversedAt };
        if (contract.repayments.some(other => !other.reversedAt && other.id !== receipt.id && (other.paidAt > receipt.paidAt || (other.paidAt.getTime() === receipt.paidAt.getTime() && other.createdAt > receipt.createdAt)))) throw new Error("ต้องกลับใบรับชำระล่าสุดก่อน เพื่อรักษาลำดับการตัดยอด");
        const reason = text(data.reason); if (!reason) throw new Error("ระบุเหตุผล");
        const reverseDate = parseLoanDate(data.date);
        if (thaiDay(reverseDate) > thaiDay(new Date()) || thaiDay(reverseDate) < thaiDay(receipt.paidAt)) throw new Error("วันที่กลับใบรับไม่ถูกต้อง");
        await assertLoanPeriodOpen(tx, code, reverseDate);
        const category = await tx.companyFinanceCategory.upsert({ where: { code: "LOAN_RECEIPT" }, create: { code: "LOAN_RECEIPT", direction: "INCOME", name: "รับชำระเงินกู้", isSystem: true }, update: {} });
        const branchCode = (() => { try { return JSON.parse(contract.documentData || "{}").branchCode || code; } catch { return code; } })();
        await tx.companyLedgerEntry.create({ data: { type: "EXPENSE", title: `กลับใบรับ ${receipt.receiptNumber}`, category: category.name, financeCategoryId: category.id, amount: receipt.amount, transactionDate: reverseDate, reference: receipt.receiptNumber, companyCode: code, branchCode, method: receipt.method, reversalOfId: `repayment-${receipt.id}`, reversalOfType: "INCOME", receiptBreakdown: JSON.stringify({ principal: receipt.principalPaid, interest: receipt.interestPaid, penalty: receipt.penaltyPaid }), createdBy: userId, note: reason } });
        for (const [type,value] of [["PRINCIPAL",receipt.principalPaid],["INTEREST",receipt.interestPaid],["PENALTY",receipt.penaltyPaid]] as const) {
          if (value) await tx.payment.create({ data: { contractId: contract.id, type, amount: -value, paidAt: reverseDate, method: receipt.method, note: `กลับรายการ ${receipt.receiptNumber}` } });
        }
        if (contract.status === "CLOSED") await tx.contract.update({ where: { id: contract.id }, data: { status: "ACTIVE" } });
        await tx.interestSchedule.updateMany({ where: { contractId: contract.id }, data: { status: "PENDING" } });
        await syncLoanScheduleStatus(tx, contract.id);
        saved = await tx.repayment.update({ where: { id: receipt.id }, data: { reversedAt: reverseDate, reversedBy: userId, reversalReason: reason } });
        contractId = contract.id; borrowerId = contract.debtorId; targetId = receipt.id;
      } else if (action === "REVERSE") {
        if (!canApprove) throw new Error("ต้องมีสิทธิ์อนุมัติ Loan เพื่อกลับรายการ");
        const original = await tx.companyLedgerEntry.findUniqueOrThrow({ where: { id: text(data.id, 100) }, include: { financeCategory: true } }); scope(original.companyCode);
        if (!original.financeCategory || !/^(LOAN_|LEGACY_)/.test(original.financeCategory.code)) throw new Error("กลับรายการได้เฉพาะสมุดบัญชี Loan");
        if (original.reversalOfId) throw new Error("กลับรายการของรายการกลับบัญชีไม่ได้");
        const reason = text(data.reason); if (!reason) throw new Error("ระบุเหตุผลกลับรายการ");
        const existing = await tx.companyLedgerEntry.findUnique({ where: { reversalOfId: original.id } }); if (existing) return existing;
        const transactionDate = parseLoanDate(data.date);
        if (thaiDay(transactionDate) > thaiDay(new Date()) || thaiDay(transactionDate) < thaiDay(original.transactionDate)) throw new Error("วันที่กลับรายการไม่ถูกต้อง");
        await assertLoanPeriodOpen(tx, original.companyCode, transactionDate);
        const { id: ignoredId, createdAt: ignoredCreated, updatedAt: ignoredUpdated, financeCategory: ignoredCategory, ...fields } = original;
        void ignoredId; void ignoredCreated; void ignoredUpdated; void ignoredCategory;
        const row = await tx.companyLedgerEntry.create({ data: { ...fields, type: original.type === "INCOME" ? "EXPENSE" : "INCOME", title: `กลับรายการ: ${original.title}`.slice(0,120), transactionDate, timeRecorded: false, documentNumber: null, reversalOfId: original.id, reversalOfType: original.type, createdBy: userId, reference: original.documentNumber || original.id, note: reason, attachmentUrl: null } }); saved = row; targetId = row.id;
      } else if (action === "CASH_PLAN") {
        const companyCode = text(data.companyCode,5); scope(companyCode);
        if (!await tx.companySequence.findFirst({ where: { companycode: companyCode, type: "COMPANY", status: "ACTIVE" } })) throw new Error("เลือกบริษัท");
        const dueDate = parseLoanDate(data.dueDate), title = text(data.title,120), direction = text(data.direction,10);
        if (!title || !["INCOME", "EXPENSE"].includes(direction) || thaiDay(dueDate) < thaiDay(new Date())) throw new Error("ตรวจสอบชื่อ วันที่ และประเภทแผนเงินสด");
        const row = await tx.loanCashPlan.create({ data: { companyCode, dueDate, title, direction, amount: amount(data.amount), createdBy: userId } }); saved = row; targetId = row.id;
      } else if (action === "COMPLETE_PLAN") {
        const row = await tx.loanCashPlan.findUniqueOrThrow({ where: { id: text(data.id,100) } }); scope(row.companyCode);
        saved = await tx.loanCashPlan.update({ where: { id: row.id }, data: { status: "DONE" } }); targetId = row.id;
      } else throw new Error("ไม่พบการทำงานที่เลือก");
      await writeLoanLog(tx, { userId, borrowerId, contractId, targetId, action: "CREATE", type: followup ? "COLLECTION" : "ACCOUNTING", note: `${action} · ${text(data.reason) || text(data.note)}`, afterData: { targetId, action } });
      return saved;
    }, { timeout: 20000 });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && !("code" in error) ? error.message : "บันทึกไม่สำเร็จ ตรวจสอบข้อมูลซ้ำหรือสิทธิ์แล้วลองใหม่";
    return Response.json({ error: message }, { status: 400 });
  }
}
