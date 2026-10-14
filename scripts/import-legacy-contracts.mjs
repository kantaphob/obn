import "dotenv/config";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const databasePath = path.resolve(databaseUrl.replace(/^file:/, "").split("?")[0]);
const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
const date = (value) => new Date(`${value}T12:00:00+07:00`).toISOString();
const baht = (value) => Math.round(value * 100);
const contracts = [
  { number: "LM26-001", borrowerId: "CM003", borrowerCode: "bo000003", principal: 2000, rate: 10, interest: 200, start: "2026-09-17", due: "2026-09-30", status: "CLOSED", paid: 2200, closed: "2026-09-30", slip: "SLIP-20260917-004", lateDays: 0, penalty: 0, waived: false },
  { number: "LM26-002", borrowerId: "CM002", borrowerCode: "bo000002", principal: 500, rate: 0, interest: 0, start: "2026-09-12", due: "2026-09-20", status: "CLOSED", paid: 500, closed: "2026-09-21", slip: "SLIP-20260912-002", lateDays: 1, penalty: 50, waived: true },
  { number: "LM26-003", borrowerId: "CM001", borrowerCode: "bo000001", principal: 5000, rate: 10, interest: 500, start: "2026-09-20", due: "2026-09-30", status: "CLOSED", paid: 5500, closed: "2026-09-30", slip: "SLIP-20260920-006", lateDays: 0, penalty: 0, waived: false },
  { number: "LM26-004", borrowerId: "CM004", borrowerCode: "bo000004", principal: 1000, rate: 10, interest: 100, start: "2026-09-19", due: "2026-09-25", status: "CLOSED", paid: 1100, closed: "2026-09-25", slip: "SLIP-20260919-005", lateDays: 0, penalty: 0, waived: false },
  { number: "LM26-005", borrowerId: "CM002", borrowerCode: "bo000002", principal: 500, rate: 0, interest: 0, start: "2026-09-28", due: "2026-10-02", status: "CLOSED", paid: 500, closed: "2026-10-02", slip: "SLIP-20260928-012", lateDays: 0, penalty: 0, waived: false },
  { number: "LM26-006", borrowerId: "CM006", borrowerCode: "bo000006", principal: 300, rate: 10, interest: 30, start: "2026-09-29", due: "2026-09-30", status: "CLOSED", paid: 330, closed: "2026-09-30", slip: "SLIP-20260928-013", lateDays: 0, penalty: 0, waived: false },
  { number: "LM26-007", borrowerId: "CM001", borrowerCode: "bo000001", principal: 5000, rate: 15, interest: 750, start: "2026-10-01", due: "2026-10-31", status: "ACTIVE", paid: 750, interestPaid: 750, payDate: "2026-10-01", disbursementSlip: "SLIP-20261001-020", repaymentSlip: "SLIP-20261001-021" },
  { number: "LM26-008", borrowerId: "CM003", borrowerCode: "bo000003", principal: 5000, rate: 20, interest: 1000, start: "2026-10-01", due: "2026-10-31", status: "ACTIVE", paid: 1000, interestPaid: 1000, payDate: "2026-10-01", disbursementSlip: "SLIP-20261001-018", repaymentSlip: "SLIP-20261001-019" },
  { number: "LM26-010", borrowerId: "CM004", borrowerCode: "bo000004", principal: 1500, rate: 20, interest: 300, start: "2026-10-02", due: "2026-10-15", status: "ACTIVE", paid: 0, disbursementSlip: "SLIP-20261002-023" },
  { number: "LM26-011", borrowerId: "CM002", borrowerCode: "bo000002", principal: 1000, rate: 20, interest: 200, start: "2026-10-09", due: "2026-10-20", status: "ACTIVE", paid: 0, disbursementSlip: "04628250988tc7tsl20k", note: "นำเข้าจากรายการวันที่ 9/10 ซึ่งระบุ LM26-002 ในบัญชีเดิม; จัดเป็น LM26-011 ตามตารางสัญญา เพราะ LM26-002 ปิดยอดแล้ว" },
  { number: "LM26-012", borrowerId: "CM003", borrowerCode: "bo000003", principal: 2000, rate: 20, interest: 400, start: "2026-10-15", due: "2026-10-30", status: "RESERVED", paid: 0, note: "จองสัญญา รอวันเริ่มสัญญาและเงินทุนพร้อม" },
  { number: "LM26-013", borrowerId: "CM003", borrowerCode: "bo000003", principal: 5000, rate: 15, interest: 750, start: "2026-11-01", due: "2026-11-30", status: "RESERVED", paid: 0, note: "จองสัญญา รอวันเริ่มสัญญาและเงินทุนพร้อม" },
  { number: "LM26-014", borrowerId: "CM001", borrowerCode: "bo000001", principal: 5000, rate: 20, interest: 1000, start: "2026-11-01", due: "2026-11-30", status: "RESERVED", paid: 0, note: "จองสัญญา รอวันเริ่มสัญญาและเงินทุนพร้อม" },
  { number: "LM26-015", borrowerId: "CM001", borrowerCode: "bo000001", principal: 500, rate: 15, interest: 75, start: "2026-10-12", due: "2026-12-15", status: "ACTIVE", paid: 0, note: "ข้อมูลสัญญาระบุว่ารอส่งคืน; ตารางบัญชีไม่มีรายการจ่ายเงินหรือเลขสลิปของสัญญานี้" },
];

try {
  const findBorrower = db.prepare("SELECT id, borrowersCode FROM borrowers WHERE id = ?");
  for (const contract of contracts) {
    const borrower = findBorrower.get(contract.borrowerId);
    if (!borrower || borrower.borrowersCode !== contract.borrowerCode) {
      throw new Error(`รหัสผู้กู้ไม่ตรงกันสำหรับ ${contract.number} (${contract.borrowerCode})`);
    }
  }

  const importData = db.transaction(() => {
    const existing = db.prepare(`SELECT contractNumber FROM Contract WHERE contractNumber IN (${contracts.map(() => "?").join(",")})`).all(...contracts.map((contract) => contract.number));
    if (existing.length) throw new Error(`พบรหัสสัญญาที่มีอยู่แล้ว: ${existing.map((row) => row.contractNumber).join(", ")}`);

    const now = new Date().toISOString();
    const insertContract = db.prepare(`INSERT INTO Contract (
      id, contractNumber, debtorId, principal, interestRate, interestAmount, netDisbursed,
      repayType, interestMode, interestRateBasis, installmentMonths, periodDays, startDate, dueDate,
      contractType, documentUrl, signedAt, signatureMode, signatureUrl, documentData,
      consentAccepted, consentedAt, consentText, witness1, witness2, guarantor, status, note,
      lateFeePerDay, lateFeeWaived, createdAt, updatedAt
    ) VALUES (
      @id, @contractNumber, @debtorId, @principal, @interestRate, @interestAmount, @netDisbursed,
      'LUMP_SUM', 'ON_SCHEDULE', 'CONTRACT_FLAT', NULL, NULL, @startDate, @dueDate,
      'NONE', NULL, NULL, 'PRINT', NULL, @documentData,
      0, NULL, NULL, NULL, NULL, NULL, @status, @note,
      5000, @lateFeeWaived, @createdAt, @updatedAt
    )`);
    const insertPayment = db.prepare(`INSERT INTO Payment (id, contractId, scheduleId, type, amount, paidAt, method, note, createdAt)
      VALUES (@id, @contractId, NULL, @type, @amount, @paidAt, 'BANK_TRANSFER', @note, @createdAt)`);
    const insertRepayment = db.prepare(`INSERT INTO Repayment (
      id, requestKey, receiptNumber, contractId, paidAt, amount, interestPaid, penaltyPaid, principalPaid,
      principalBefore, interestBefore, penaltyBefore, principalRemaining, interestRemaining, penaltyRemaining,
      totalRemaining, method, evidenceUrl, note, createdAt
    ) VALUES (
      @id, @requestKey, @receiptNumber, @contractId, @paidAt, @amount, @interestPaid, 0, 0,
      @principalBefore, @interestBefore, 0, @principalRemaining, 0, 0,
      @totalRemaining, 'BANK_TRANSFER', NULL, @note, @createdAt
    )`);

    for (const source of contracts) {
      const principal = baht(source.principal);
      const interestAmount = baht(source.interest);
      const startDate = date(source.start);
      const dueDate = date(source.due);
      const note = source.note ?? (source.status === "CLOSED"
        ? `นำเข้าข้อมูลสัญญาเดิม · ชำระครบ ${source.paid.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท · ปิดยอด ${source.closed}`
        : "นำเข้าข้อมูลสัญญาเดิม");
      const legacy = {
        source: "legacy-contract-table",
        paidAmount: source.paid,
        closedAt: source.closed ?? null,
        overdueDays: source.lateDays ?? 0,
        overdueFee: source.penalty ?? 0,
        originalLateFeeWaived: source.waived ?? false,
        originalStatus: source.status,
      };
      const contractId = randomUUID();

      insertContract.run({
        id: contractId,
        contractNumber: source.number,
        debtorId: source.borrowerId,
        principal,
        interestRate: source.rate,
        interestAmount,
        netDisbursed: principal,
        startDate,
        dueDate,
        documentData: JSON.stringify({ legacy }),
        status: source.status,
        note,
        lateFeeWaived: source.waived ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });

      if (source.status === "ACTIVE" && source.disbursementSlip) {
        insertPayment.run({ id: randomUUID(), contractId, type: "DISBURSEMENT", amount: principal, paidAt: startDate, note: `เลขสลิปเดิม: ${source.disbursementSlip}`, createdAt: now });
      }
      if (source.status === "ACTIVE" && source.interestPaid && source.repaymentSlip && source.payDate) {
        const paid = baht(source.interestPaid);
        const paidAt = date(source.payDate);
        const receiptNumber = source.repaymentSlip;
        insertRepayment.run({
          id: randomUUID(),
          requestKey: `legacy-${source.number}-${randomUUID()}`,
          receiptNumber,
          contractId,
          paidAt,
          amount: paid,
          interestPaid: paid,
          principalBefore: principal,
          interestBefore: paid,
          principalRemaining: principal,
          totalRemaining: principal,
          note: `รับดอกเบี้ยย้อนหลัง · เลขสลิปเดิม: ${receiptNumber}`,
          createdAt: now,
        });
        insertPayment.run({ id: randomUUID(), contractId, type: "INTEREST", amount: paid, paidAt, note: `เลขสลิปเดิม: ${receiptNumber}`, createdAt: now });
      }
    }
    return contracts.length;
  });
  console.log(`นำเข้าสัญญาย้อนหลัง ${importData()} รายการ`);
} finally {
  db.close();
}
