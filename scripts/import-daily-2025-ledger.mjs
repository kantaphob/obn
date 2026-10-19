import "dotenv/config";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const sourcePath = args.find((argument) => !argument.startsWith("--"));
const commit = args.includes("--commit");
const databaseUrl = process.env.DATABASE_URL;

if (!sourcePath) throw new Error("Pass the source CSV path.");
if (!databaseUrl?.startsWith("file:")) throw new Error("Set a SQLite file DATABASE_URL before importing.");

function parseCsv(value) {
  const input = value.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function parseSatang(value, label) {
  const cleaned = String(value ?? "").replaceAll(",", "").replace(/[฿\s]/g, "");
  const match = cleaned.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`Invalid ${label}: ${value}`);
  const satang = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -satang : satang;
}

function parseZeroPercent(value, label) {
  const numeric = Number(String(value ?? "0").replace("%", "").trim() || 0);
  if (!Number.isFinite(numeric) || numeric !== 0) throw new Error(`${label} is non-zero (${value}); stop and review the tax mapping.`);
}

function parseDate(value, sourceLine) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error(`Invalid date on CSV line ${sourceLine}: ${value}`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year !== 2025) throw new Error(`Unexpected year on CSV line ${sourceLine}: ${year}`);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date on CSV line ${sourceLine}: ${value}`);
  }
  const dateText = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { dateText, timestamp: new Date(`${dateText}T12:00:00.000+07:00`).toISOString() };
}

const categoryMap = {
  "EXPENSE:ครอบครัว/สัตว์เลี้ยง": "ของใช้ในสำนักงาน",
  "EXPENSE:อาหาร": "จัดเลี้ยง",
  "EXPENSE:เครื่องดื่ม": "จัดเลี้ยง",
  "EXPENSE:ของใช้ในบ้าน": "อุปกรณ์สำนักงาน",
  "EXPENSE:เงินเดือน": "เงินเดือนและค่าจ้าง",
  "EXPENSE:เดินทาง": "ค่าเดินทาง",
  "EXPENSE:สาธารณูปโภค": "ค่าสาธารณูปโภค",
  "EXPENSE:จิปาถะ/อื่นๆ": "ค่าใช้จ่ายอื่นๆ",
  "INCOME:ครอบครัว/สัตว์เลี้ยง": "รายได้อื่นๆ",
  "INCOME:จิปาถะ/อื่นๆ": "รายได้อื่นๆ",
  "INCOME:เงินเดือน": "รายได้อื่นๆ",
};

function resolveCategoryName(type, sourceCategory) {
  const mapped = categoryMap[`${type}:${sourceCategory}`];
  if (mapped) return mapped;
  throw new Error(`No category mapping for ${type}:${sourceCategory}`);
}

function resolveMethod(channel) {
  if (channel === "เงินสด") return "CASH";
  if (channel === "K PLUS") return "BANK_TRANSFER";
  return "OTHER";
}

const csv = parseCsv(readFileSync(sourcePath, "utf8"));
if (csv.length < 3) throw new Error("CSV must have a header, a subheader, and transaction rows.");
const rows = [];
let zeroAmountRows = 0;
let blankDateRows = 0;
let missingDetails = 0;
let runningBalance = 0;
let balanceMismatches = 0;
const sourceCompanies = new Set();
const duplicateSignatures = new Map();
const categoryCounts = new Map();

for (let index = 2; index < csv.length; index += 1) {
  const sourceLine = index + 1;
  const cells = [...csv[index], ...Array(Math.max(0, 14 - csv[index].length)).fill("")];
  const [dateRaw, companyName, sourceCategory, detail, incomeGross, incomeTaxRate, incomeTax, incomeNet, expenseGross, expenseTaxRate, expenseTax, expenseNet, balanceRaw, channel] = cells;
  if (!dateRaw.trim()) { blankDateRows += 1; continue; }
  sourceCompanies.add(companyName.trim());
  const { dateText, timestamp } = parseDate(dateRaw, sourceLine);
  const incomeBase = parseSatang(incomeGross, `income gross on line ${sourceLine}`);
  const income = parseSatang(incomeNet, `income received on line ${sourceLine}`);
  const expenseBase = parseSatang(expenseGross, `expense gross on line ${sourceLine}`);
  const expense = parseSatang(expenseNet, `expense paid on line ${sourceLine}`);
  parseZeroPercent(incomeTaxRate, `Income withholding rate on line ${sourceLine}`);
  parseZeroPercent(incomeTax, `Income withholding amount on line ${sourceLine}`);
  parseZeroPercent(expenseTaxRate, `Expense withholding rate on line ${sourceLine}`);
  parseZeroPercent(expenseTax, `Expense withholding amount on line ${sourceLine}`);
  if (incomeBase !== income || expenseBase !== expense) throw new Error(`Gross/net mismatch on CSV line ${sourceLine}.`);
  if (income > 0 && expense > 0) throw new Error(`Both income and expense are non-zero on CSV line ${sourceLine}.`);
  const balance = parseSatang(balanceRaw, `balance on line ${sourceLine}`);
  runningBalance += income - expense;
  if (Math.abs(runningBalance - balance) > 1) balanceMismatches += 1;
  if (income === 0 && expense === 0) { zeroAmountRows += 1; continue; }

  const type = income > 0 ? "INCOME" : "EXPENSE";
  const categoryName = resolveCategoryName(type, sourceCategory.trim());
  const row = {
    sourceLine,
    dateText,
    timestamp,
    companyName: companyName.trim(),
    type,
    sourceCategory: sourceCategory.trim(),
    categoryName,
    amount: income > 0 ? income : expense,
    title: detail.trim() || `${type === "INCOME" ? "รับเงิน" : "จ่ายเงิน"} · ${sourceCategory.trim()}`,
    method: resolveMethod(channel.trim()),
    channel: channel.trim(),
  };
  const signature = [row.dateText, row.companyName, row.type, row.categoryName, row.title, row.amount, row.channel].join("\u001f");
  const group = duplicateSignatures.get(signature) ?? [];
  group.push(sourceLine);
  duplicateSignatures.set(signature, group);
  if (!detail.trim()) missingDetails += 1;
  categoryCounts.set(`${type}:${categoryName}`, (categoryCounts.get(`${type}:${categoryName}`) ?? 0) + 1);
  rows.push(row);
}

if (sourceCompanies.size !== 1 || !sourceCompanies.has("OBN Co., Ltd.")) {
  throw new Error(`Expected only OBN Co., Ltd.; found ${[...sourceCompanies].join(", ")}.`);
}
if (balanceMismatches) throw new Error(`Running balance did not reconcile on ${balanceMismatches} source rows.`);

const duplicates = [...duplicateSignatures.entries()].filter(([, lines]) => lines.length > 1);
const db = new Database(databaseUrl.slice(5), { fileMustExist: true });
db.pragma("foreign_keys = ON");

try {
  const company = db.prepare("SELECT companycode FROM CompanySequence WHERE nameEN = ? AND type = 'COMPANY' AND status = 'ACTIVE'").get("OBN Co., Ltd.");
  if (!company) throw new Error("Active OBN Co., Ltd. record was not found.");
  const companyCode = company.companycode;
  const expenseCategoryCodes = new Map([
    ["ของใช้ในสำนักงาน", "IMPORT_OFFICE_SUPPLIES"],
    ["จัดเลี้ยง", "IMPORT_CATERING"],
    ["อุปกรณ์สำนักงาน", "IMPORT_OFFICE_EQUIPMENT"],
  ]);
  const findCategory = db.prepare("SELECT id FROM CompanyFinanceCategory WHERE direction = ? AND name = ?");
  const findCategoryCode = db.prepare("SELECT id FROM CompanyFinanceCategory WHERE code = ?");
  const insertCategory = db.prepare("INSERT INTO CompanyFinanceCategory (id, code, direction, name, isSystem, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, ?, ?)");
  const findEntry = db.prepare("SELECT id FROM CompanyLedgerEntry WHERE id = ?");
  const insertEntry = db.prepare(`INSERT INTO CompanyLedgerEntry
    (id, type, title, category, financeCategoryId, amount, baseAmount, vatRateBps, vatAmount, whtRateBps, whtAmount,
     transactionDate, timeRecorded, documentNumber, companyCode, branchCode, party, method, reference, note, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, 0, ?, ?, ?, '', ?, ?, ?, ?, ?)`);
  const existingSequence = db.prepare("SELECT lastNumber FROM CompanyLedgerNumberSequence WHERE companyCode = ? AND branchCode = ? AND year = 2025").get(companyCode, companyCode);
  const existingEntryCount = db.prepare("SELECT COUNT(*) AS count FROM CompanyLedgerEntry WHERE transactionDate >= '2025-01-01' AND transactionDate < '2026-01-01'").get().count;
  const existingNonImportCount = db.prepare("SELECT COUNT(*) AS count FROM CompanyLedgerEntry WHERE transactionDate >= '2025-01-01' AND transactionDate < '2026-01-01' AND id NOT LIKE 'daily-2025-%'").get().count;
  let nextNumber = existingSequence?.lastNumber ?? 0;
  const now = new Date().toISOString();
  const categoryIds = new Map();
  const categoriesToCreate = [];

  for (const [key, count] of categoryCounts) {
    const [type, name] = key.split(":");
    let category = findCategory.get(type, name);
    if (!category) {
      let code = expenseCategoryCodes.get(name);
      if (!code) throw new Error(`Category ${name} needs a stable code before import.`);
      const codeOwner = findCategoryCode.get(code);
      if (codeOwner) code = `${code}_2025`;
      const id = `daily-2025-category-${type.toLowerCase()}-${code.toLowerCase()}`;
      category = { id };
      categoriesToCreate.push({ id, code, direction: type, name, count });
    }
    categoryIds.set(key, category.id);
  }

  const execute = db.transaction(() => {
    for (const category of categoriesToCreate) {
      insertCategory.run(category.id, category.code, category.direction, category.name, now, now);
    }
    let inserted = 0;
    let skippedExisting = 0;
    for (const row of rows) {
      const id = `daily-2025-${String(row.sourceLine).padStart(4, "0")}`;
      if (findEntry.get(id)) { skippedExisting += 1; continue; }
      nextNumber += 1;
      if (nextNumber > 999999) throw new Error("The headquarters transaction sequence is full for 2025.");
      const documentNumber = `OBN-L-25-${companyCode}-${companyCode}-${String(nextNumber).padStart(6, "0")}`;
      const reference = `CSV-2025-L${String(row.sourceLine).padStart(4, "0")}`;
      const note = `นำเข้าจากเอกสารรับจ่ายปี 2025 · บรรทัด ${row.sourceLine} · หมวดเดิม ${row.sourceCategory || "ไม่ระบุ"} · ช่องทางเดิม ${row.channel || "ไม่ระบุ"}`;
      insertEntry.run(id, row.type, row.title, row.categoryName, categoryIds.get(`${row.type}:${row.categoryName}`), row.amount,
        row.amount, row.timestamp, documentNumber, companyCode, companyCode, row.method, reference, note, now, now);
      inserted += 1;
    }
    if (inserted) {
      db.prepare(`INSERT INTO CompanyLedgerNumberSequence (id, companyCode, branchCode, year, lastNumber)
        VALUES (?, ?, ?, 2025, ?)
        ON CONFLICT(companyCode, branchCode, year) DO UPDATE SET lastNumber = excluded.lastNumber`)
        .run(`daily-2025-sequence-${companyCode}`, companyCode, companyCode, nextNumber);
    }
    return { inserted, skippedExisting };
  });

  console.log(JSON.stringify({
    mode: commit ? "commit" : "dry-run",
    company: "OBN Co., Ltd.",
    companyCode,
    location: "สำนักงานใหญ่",
    dateRange: [rows[0]?.dateText, rows.at(-1)?.dateText],
    sourceRows: rows.length,
    zeroAmountRowsSkipped: zeroAmountRows,
    undatedSummaryRowsSkipped: blankDateRows,
    rowsWithMissingDetail: missingDetails,
    incomeCount: rows.filter((row) => row.type === "INCOME").length,
    expenseCount: rows.filter((row) => row.type === "EXPENSE").length,
    incomeTotalSatang: rows.filter((row) => row.type === "INCOME").reduce((total, row) => total + row.amount, 0),
    expenseTotalSatang: rows.filter((row) => row.type === "EXPENSE").reduce((total, row) => total + row.amount, 0),
    closingBalanceSatang: runningBalance,
    balanceMismatches,
    duplicateSignatures: duplicates.map(([signature, lines]) => ({ signature: signature.split("\u001f").slice(0, 7), sourceLines: lines, retained: true })),
    categoryCounts: Object.fromEntries(categoryCounts),
    categoriesToCreate,
    existing2025LedgerRows: existingEntryCount,
    existingUnrelated2025Rows: existingNonImportCount,
    sequenceBefore: existingSequence?.lastNumber ?? 0,
  }, null, 2));

  if (commit) {
    if (existingNonImportCount > 0) throw new Error("Unrelated 2025 ledger entries already exist; refusing to mix this import into them.");
    const result = execute();
    console.log(`Imported ${result.inserted} rows; skipped ${result.skippedExisting} rows already imported.`);
  } else {
    console.log("Dry run only. Pass --commit to write these rows to the database.");
  }
} finally {
  db.close();
}
