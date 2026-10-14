import "dotenv/config";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const databasePath = path.resolve(databaseUrl.replace(/^file:/, "").split("?")[0]);
const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

const entries = [
  ["2026-08-30", "INCOME", "เงินทุนเริ่มต้น", 1300, "", "เงินทุนดำเนินงาน"],
  ["2026-09-12", "EXPENSE", "ปล่อยกู้", 500, "LM26-002 · นิคม", ""],
  ["2026-09-17", "INCOME", "เงินทุนเริ่มต้น", 7900, "", "เงินทุนดำเนินงาน"],
  ["2026-09-17", "EXPENSE", "ปล่อยกู้", 2000, "LM26-001 · ส้ม", ""],
  ["2026-09-19", "EXPENSE", "ปล่อยกู้", 1000, "LM26-004 · จิ", ""],
  ["2026-09-20", "EXPENSE", "ปล่อยกู้", 5000, "LM26-003 · แคท", ""],
  ["2026-09-20", "INCOME", "รับดอกเบี้ย", 500, "LM26-003 · แคท", ""],
  ["2026-09-21", "INCOME", "รับชำระเงินต้น", 500, "LM26-002 · นิคม", ""],
  ["2026-09-25", "INCOME", "รับชำระเงินต้น", 1000, "LM26-004 · จิ", ""],
  ["2026-09-25", "INCOME", "รับดอกเบี้ย", 100, "LM26-004 · จิ", ""],
  ["2026-09-26", "EXPENSE", "ถอนทุน", 500, "", ""],
  ["2026-09-28", "EXPENSE", "ปล่อยกู้", 500, "LM26-005 · นิคม", ""],
  ["2026-09-28", "EXPENSE", "ปล่อยกู้", 300, "LM26-006 · มิ้น", ""],
  ["2026-09-30", "INCOME", "รับชำระเงินต้นพร้อมดอกเบี้ย", 2200, "LM26-001 · ส้ม", ""],
  ["2026-09-30", "INCOME", "รับชำระเงินต้นพร้อมดอกเบี้ย", 330, "LM26-006 · มิ้น", ""],
  ["2026-09-30", "INCOME", "รับชำระเงินต้น", 5000, "LM26-003 · แคท", ""],
  ["2026-09-30", "INCOME", "เงินทุนเริ่มต้น", 1370, "", "เงินทุนดำเนินงาน"],
  // These two missing rows were in the same complete ledger shared earlier.
  ["2026-10-01", "EXPENSE", "ถอนทุน", 150, "", ""],
  ["2026-10-02", "INCOME", "รับชำระเงินต้น", 500, "LM26-005 · นิคม", ""],
];

const categoryCodes = new Map([
  ["INCOME:เงินทุนเริ่มต้น", "LEGACY_CAPITAL_START"],
  ["EXPENSE:ปล่อยกู้", "LEGACY_LOAN_DISBURSEMENT"],
  ["INCOME:รับดอกเบี้ย", "LEGACY_INTEREST_RECEIVED"],
  ["INCOME:รับชำระเงินต้น", "LOAN_PRINCIPAL"],
  ["INCOME:รับชำระเงินต้นพร้อมดอกเบี้ย", "LEGACY_LOAN_RECEIPT"],
  ["EXPENSE:ถอนทุน", "LEGACY_CAPITAL_WITHDRAWAL"],
]);

const toIsoDate = (date) => new Date(`${date}T12:00:00+07:00`).toISOString();
const now = new Date().toISOString();
const findCategory = db.prepare("SELECT id FROM CompanyFinanceCategory WHERE direction = ? AND name = ?");
const insertCategory = db.prepare(`INSERT INTO CompanyFinanceCategory
  (id, code, direction, name, isSystem, isActive, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, 0, 1, ?, ?)`);
const findEntry = db.prepare("SELECT id FROM CompanyLedgerEntry WHERE id = ?");
const insertEntry = db.prepare(`INSERT INTO CompanyLedgerEntry
  (id, type, title, category, amount, transactionDate, party, method, reference, note, createdAt, updatedAt, financeCategoryId)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'OTHER', ?, ?, ?, ?, ?)`);

const importEntries = db.transaction(() => {
  const categories = new Map();
  for (const [key, code] of categoryCodes) {
    const [direction, name] = key.split(":");
    let category = findCategory.get(direction, name);
    if (!category) {
      const id = `legacy-finance-category-${randomUUID()}`;
      insertCategory.run(id, code, direction, name, now, now);
      category = { id };
    }
    categories.set(key, category.id);
  }

  let inserted = 0;
  for (const [index, [date, type, title, amountBaht, party, remark]] of entries.entries()) {
    const id = `legacy-ledger-${date.replaceAll("-", "")}-${String(index + 1).padStart(2, "0")}`;
    if (findEntry.get(id)) continue;
    const categoryId = categories.get(`${type}:${title}`);
    const note = [remark, "นำเข้าจากบัญชีเดิม; ไม่ระบุช่องทางชำระ"].filter(Boolean).join(" · ");
    insertEntry.run(id, type, title, title, amountBaht * 100, toIsoDate(date), party, "", note, now, now, categoryId);
    inserted += 1;
  }
  return inserted;
});

try {
  const inserted = importEntries();
  console.log(`บันทึกรายการย้อนหลัง ${inserted} รายการ (${entries.length - inserted} รายการมีอยู่แล้ว)`);
} finally {
  db.close();
}
