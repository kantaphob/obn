CREATE TABLE "CompanyFinanceCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "CompanyFinanceCategory_code_key" ON "CompanyFinanceCategory"("code");
CREATE UNIQUE INDEX "CompanyFinanceCategory_direction_name_key" ON "CompanyFinanceCategory"("direction", "name");
CREATE INDEX "CompanyFinanceCategory_direction_isActive_idx" ON "CompanyFinanceCategory"("direction", "isActive");

ALTER TABLE "CompanyLedgerEntry" ADD COLUMN "financeCategoryId" TEXT REFERENCES "CompanyFinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CompanyLedgerEntry_financeCategoryId_idx" ON "CompanyLedgerEntry"("financeCategoryId");

INSERT INTO "CompanyFinanceCategory" ("id", "code", "direction", "name", "isSystem", "isActive", "updatedAt") VALUES
('finance-category-01', 'INC_SALES', 'INCOME', 'รายได้จากการขาย', false, true, CURRENT_TIMESTAMP),
('finance-category-02', 'INC_SERVICES', 'INCOME', 'รายได้จากบริการ', false, true, CURRENT_TIMESTAMP),
('finance-category-03', 'LOAN_INTEREST', 'INCOME', 'ดอกเบี้ยรับ', true, true, CURRENT_TIMESTAMP),
('finance-category-04', 'LOAN_CAPITAL_IN', 'INCOME', 'เงินทุนเข้า', true, true, CURRENT_TIMESTAMP),
('finance-category-05', 'INC_OTHER', 'INCOME', 'รายได้อื่นๆ', false, true, CURRENT_TIMESTAMP),
('finance-category-06', 'LOAN_RECEIPT', 'INCOME', 'รับชำระเงินกู้', true, true, CURRENT_TIMESTAMP),
('finance-category-07', 'LOAN_PRINCIPAL', 'INCOME', 'รับชำระเงินต้น', true, true, CURRENT_TIMESTAMP),
('finance-category-08', 'LOAN_PENALTY', 'INCOME', 'ค่าปรับรับ', true, true, CURRENT_TIMESTAMP),
('finance-category-09', 'EXP_RENT', 'EXPENSE', 'ค่าเช่า', false, true, CURRENT_TIMESTAMP),
('finance-category-10', 'EXP_PAYROLL', 'EXPENSE', 'เงินเดือนและค่าจ้าง', false, true, CURRENT_TIMESTAMP),
('finance-category-11', 'EXP_UTILITIES', 'EXPENSE', 'ค่าสาธารณูปโภค', false, true, CURRENT_TIMESTAMP),
('finance-category-12', 'EXP_SUPPLIES', 'EXPENSE', 'ค่าวัสดุและสินค้า', false, true, CURRENT_TIMESTAMP),
('finance-category-13', 'EXP_TRAVEL', 'EXPENSE', 'ค่าเดินทาง', false, true, CURRENT_TIMESTAMP),
('finance-category-14', 'EXP_MARKETING', 'EXPENSE', 'ค่าการตลาด', false, true, CURRENT_TIMESTAMP),
('finance-category-15', 'EXP_DEBT', 'EXPENSE', 'ชำระหนี้', false, true, CURRENT_TIMESTAMP),
('finance-category-16', 'LOAN_EXPENSE', 'EXPENSE', 'ค่าใช้จ่ายอื่นๆ', true, true, CURRENT_TIMESTAMP),
('finance-category-17', 'LOAN_DISBURSEMENT', 'EXPENSE', 'จ่ายเงินกู้', true, true, CURRENT_TIMESTAMP),
('finance-category-18', 'LOAN_CAPITAL_OUT', 'EXPENSE', 'เงินทุนออก', true, true, CURRENT_TIMESTAMP);
